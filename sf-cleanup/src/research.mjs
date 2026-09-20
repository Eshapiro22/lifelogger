// LLM research step: for each account, ask Claude (with web search) whether the
// company is still operating under that name, or has been acquired, merged,
// renamed, or shut down. Results are cached on disk so re-runs are free.
//
// Two calls at most per account:
//   1. Research call with the web_search server tool; the model is asked to end
//      with a fenced JSON block matching RESULT_SCHEMA.
//   2. Only if that JSON fails validation: a structured-output call that turns
//      the free-text answer into the schema (client.messages.parse + zod).

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { pool, readJson, writeJson, normalizeName, registrableDomain } from "./util.mjs";
import { makeFinding } from "./findings.mjs";
import { mergeProposal } from "./rules.mjs";

export const ResultSchema = z.object({
  status: z.enum(["active", "acquired", "merged", "renamed", "defunct", "unknown"]),
  summary: z.string(),
  acquirer: z.string().nullable(),
  new_name: z.string().nullable(),
  event_date: z.string().nullable(),
  confidence: z.number(),
  sources: z.array(z.string()),
});

const SYSTEM = `You are a B2B sales-operations data researcher. You verify whether a company in a CRM is still an
independent, operating business under the recorded name.

Use web search to check the company's current status. Prefer primary sources (the company's own site, press
releases, regulator filings, reputable business press). Be careful with common names: confirm you are looking at the
same company as the CRM record (use the website domain, country, and industry given).

Classify status as exactly one of:
- active   : operating independently under (roughly) the same name
- acquired : bought by another company and now operates as part of it (name may or may not survive)
- merged   : combined with a peer into a new entity
- renamed  : same business, new legal/brand name
- defunct  : ceased operations, dissolved, bankrupt with no successor, or domain dead with no trace of operations
- unknown  : could not determine with reasonable confidence

Give confidence 0-1. Only give >= 0.7 when at least one reliable source clearly supports the conclusion.
End your answer with a single fenced \`\`\`json block containing exactly these keys:
{"status": "...", "summary": "...", "acquirer": string|null, "new_name": string|null, "event_date": "YYYY-MM-DD or YYYY or null",
 "confidence": 0.0-1.0, "sources": ["https://..."]}`;

function userPrompt(a) {
  const lines = [
    `Company (CRM record): ${a.name}`,
    a.website ? `Website: ${a.website}` : "Website: (none on record)",
    a.country ? `Country: ${a.country}${a.city ? ", " + a.city : ""}` : "",
    a.industry ? `Industry: ${a.industry}` : "",
    a.parentName ? `Parent account in CRM: ${a.parentName}` : "",
    a._signals?.length ? `Automated signals already found: ${a._signals.join("; ")}` : "",
    "",
    "Is this company still active and independent under this name as of today? If not, what happened, when, and who is the successor?",
  ].filter(Boolean);
  return lines.join("\n");
}

function extractJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const candidates = [fence?.[1], text.slice(text.lastIndexOf("{"))].filter(Boolean);
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
  }
  return null;
}

export function createClient() {
  // Reads ANTHROPIC_API_KEY (or an `ant auth login` profile) from the environment.
  return new Anthropic();
}

/**
 * Research one account. Returns { result, rawText, usage }.
 */
export async function researchAccount(client, account, { model = "claude-opus-5", maxWebSearches = 5, effort = "medium" } = {}) {
  const messages = [{ role: "user", content: userPrompt(account) }];
  const params = {
    model,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort },
    // Server-side refusal fallbacks: if the model declines, the API re-runs on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxWebSearches }],
    messages,
  };

  let response;
  let continuations = 0;
  const usage = { input: 0, output: 0, searches: 0 };
  while (true) {
    response = await client.beta.messages.create(params);
    usage.input += response.usage?.input_tokens ?? 0;
    usage.output += response.usage?.output_tokens ?? 0;
    usage.searches += response.usage?.server_tool_use?.web_search_requests ?? 0;
    if (response.stop_reason === "pause_turn" && continuations < 5) {
      // Server-side tool loop hit its iteration limit; re-send with the assistant turn appended to resume.
      messages.push({ role: "assistant", content: response.content });
      continuations += 1;
      continue;
    }
    break;
  }

  if (response.stop_reason === "refusal") {
    return { result: { status: "unknown", summary: "Model declined to research this record.", acquirer: null, new_name: null, event_date: null, confidence: 0, sources: [] }, rawText: "", usage };
  }

  const rawText = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const searchUrls = [];
  for (const b of response.content) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r.type === "web_search_result" && r.url) searchUrls.push(r.url);
    }
  }

  let parsed = ResultSchema.safeParse(extractJson(rawText));
  if (!parsed.success) {
    // Fallback: have the model restate its own answer in the exact schema.
    const structured = await client.messages.parse({
      model,
      max_tokens: 2000,
      messages: [
        { role: "user", content: `Convert this research note about "${account.name}" into the requested JSON. Do not add facts.\n\n${rawText || "(no text)"}` },
      ],
      output_config: { format: zodOutputFormat(ResultSchema) },
    });
    usage.input += structured.usage?.input_tokens ?? 0;
    usage.output += structured.usage?.output_tokens ?? 0;
    parsed = ResultSchema.safeParse(structured.parsed_output);
    if (!parsed.success) {
      return { result: { status: "unknown", summary: rawText.slice(0, 500), acquirer: null, new_name: null, event_date: null, confidence: 0, sources: searchUrls.slice(0, 5) }, rawText, usage };
    }
  }
  const result = parsed.data;
  result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
  if (!result.sources?.length) result.sources = searchUrls.slice(0, 5);
  return { result, rawText, usage };
}

/**
 * Research many accounts with a disk cache. `signalsByAccount` maps account id/name -> string[] of
 * offline findings (dead website etc.) to give the model context.
 */
export async function researchAccounts(accounts, { cachePath, concurrency = 3, log = () => {}, force = false, signalsByAccount = new Map(), ...opts } = {}) {
  const client = createClient();
  const cache = await readJson(cachePath, {});
  const keyOf = (a) => `${a.id || ""}|${a.name}|${a.website || ""}`;
  const totals = { input: 0, output: 0, searches: 0, calls: 0, cached: 0 };

  const results = await pool(accounts, concurrency, async (a) => {
    const key = keyOf(a);
    if (!force && cache[key]) { totals.cached += 1; return { account: a, ...cache[key], fromCache: true }; }
    a._signals = signalsByAccount.get(a.id || a.name) || [];
    try {
      const r = await researchAccount(client, a, opts);
      totals.calls += 1; totals.input += r.usage.input; totals.output += r.usage.output; totals.searches += r.usage.searches;
      cache[key] = { result: r.result, researchedAt: new Date().toISOString() };
      await writeJson(cachePath, cache);
      log(`  ${a.name}: ${r.result.status} (${Math.round(r.result.confidence * 100)}%)${r.result.acquirer ? " -> " + r.result.acquirer : ""}`);
      return { account: a, result: r.result };
    } catch (e) {
      log(`  ${a.name}: ERROR ${e.message}`);
      return { account: a, result: null, error: e.message };
    }
  });
  return { results, totals };
}

/** Turn research results into findings with portal proposals. */
export function findingsFromResearch(results, allAccounts, { minConfidence = 0.5 } = {}) {
  const byNorm = new Map(allAccounts.map((a) => [normalizeName(a.name), a]));
  const byDomain = new Map(allAccounts.filter((a) => a.website).map((a) => [registrableDomain(a.website), a]));
  const findAccount = (name) => {
    if (!name) return null;
    return byNorm.get(normalizeName(name)) || byDomain.get(registrableDomain(name)) || null;
  };

  const out = [];
  for (const { account: a, result: r } of results) {
    if (!r || r.status === "active" || r.status === "unknown" || r.confidence < minConfidence) continue;
    const severity = r.confidence >= 0.75 ? "high" : "medium";
    const base = { account: a, confidence: r.confidence, severity, sources: r.sources || [] };
    const when = r.event_date ? ` (${r.event_date})` : "";

    if (r.status === "acquired" || r.status === "merged") {
      const successor = findAccount(r.acquirer) || findAccount(r.new_name);
      if (successor && successor !== a) {
        out.push(makeFinding({ ...base, kind: r.status, related: successor,
          evidence: [`${r.status}${when} by ${r.acquirer || r.new_name}; successor exists in your list as "${successor.name}"`, r.summary],
          proposal: mergeProposal(successor, a, `${a.name} was ${r.status} by ${r.acquirer || r.new_name}${when}. ${r.summary}`.slice(0, 900)) }));
      } else {
        out.push(makeFinding({ ...base, kind: r.status,
          evidence: [`${r.status}${when} by ${r.acquirer || r.new_name || "unknown acquirer"}; successor NOT found in your account list`, r.summary],
          proposal: renameProposal(a, r.new_name || r.acquirer, `${a.name} was ${r.status} by ${r.acquirer || "?"}${when}. ${r.summary}`.slice(0, 900)) }));
      }
    } else if (r.status === "renamed") {
      out.push(makeFinding({ ...base, kind: "renamed",
        evidence: [`renamed${when} to ${r.new_name || "?"}`, r.summary],
        proposal: renameProposal(a, r.new_name, `Legal entity renamed${when}. ${r.summary}`.slice(0, 900)) }));
    } else if (r.status === "defunct") {
      out.push(makeFinding({ ...base, kind: "defunct",
        evidence: [`defunct${when}`, r.summary],
        proposal: deleteProposal(a, `Company is defunct${when}. ${r.summary}`.slice(0, 900)) }));
    }
  }
  return out;
}

// NOTE: only the Merge form's fields were visible in the portal screenshots. The Delete and
// Legal Entity Name Change field labels below are best guesses; `sf-cleanup form-check` prints
// the real labels so you can fix them in sf-cleanup.config.json (form.requestTypes).
export function deleteProposal(account, reason) {
  return { action: "Single Update Request", object: "Account", requestType: "Delete", fields: { "Account ID": account.id || "", Reason: reason }, verifyFields: true };
}
export function renameProposal(account, newName, reason) {
  return { action: "Single Update Request", object: "Account", requestType: "Legal Entity Name Change",
    fields: { "Account ID": account.id || "", "New Legal Entity Name": newName || "", Reason: reason }, verifyFields: true };
}
