#!/usr/bin/env node
// sf-cleanup: crawl a Salesforce account list, flag problems, and draft/submit
// Sales Technologies data-quality requests after you approve each one.
//
//   sf-cleanup scan --csv accounts.csv        offline checks (duplicates, bad/missing data, dead websites)
//   sf-cleanup scan --sf-org myorg            same, pulling accounts from Salesforce via the sf CLI login
//   sf-cleanup research [--all|--flagged]     Claude + web search: acquired / merged / renamed / defunct
//   sf-cleanup review [--csv out.csv]         list findings for review
//   sf-cleanup approve F-0001 F-0007 ...      (or --all --severity high --kind duplicate)
//   sf-cleanup reject  F-0002 ...
//   sf-cleanup login                          one-time SSO login for the portal browser profile
//   sf-cleanup form-check                     print the portal's real field labels per request type
//   sf-cleanup submit [--live] [--via portal|api]   submit approved findings (dry-run unless --live)
//   sf-cleanup mass-update                    write work/mass-update.csv for field corrections
//   sf-cleanup jsm-fields                     discover JSM API ids (optional API path)

import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAccountsFromCsv, loadAccountsFromSalesforce, DEFAULT_SOQL } from "./accounts.mjs";
import { checkDuplicates, checkNames, checkRequiredFields, checkStale, checkWebsites } from "./rules.mjs";
import { loadFindings, saveFindings, mergeFindings, sortFindings, SEVERITY_ORDER } from "./findings.mjs";
import { readJson, writeJson, toCsv } from "./util.mjs";

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const WORK = resolve(args.work || "work");
const ACCOUNTS_PATH = join(WORK, "accounts.json");
const FINDINGS_PATH = join(WORK, "findings.json");
const CACHE_PATH = join(WORK, "research-cache.json");

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, inline] = a.slice(2).split("=");
      if (inline != null) out[k] = inline;
      else if (argv[i + 1] != null && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

async function loadConfig() {
  const path = resolve(args.config || "sf-cleanup.config.json");
  if (existsSync(path)) return readJson(path);
  const example = fileURLToPath(new URL("../sf-cleanup.config.example.json", import.meta.url));
  console.warn(`(no ${path}; using defaults from sf-cleanup.config.example.json — copy it and fill in portal.createUrl before submitting)`);
  return readJson(example);
}

function requireAccounts() {
  if (!existsSync(ACCOUNTS_PATH)) throw new Error(`No ${ACCOUNTS_PATH}. Run "sf-cleanup scan" first.`);
  return readJson(ACCOUNTS_PATH);
}

const log = (...m) => console.log(...m);

async function cmdScan(config) {
  let accounts;
  if (args.csv) {
    accounts = await loadAccountsFromCsv(resolve(args.csv));
    log(`Loaded ${accounts.length} accounts from ${args.csv}`);
  } else if (args["sf-org"] || (process.env.SF_INSTANCE_URL && process.env.SF_ACCESS_TOKEN)) {
    accounts = await loadAccountsFromSalesforce({ org: args["sf-org"], soql: args.soql || DEFAULT_SOQL });
    log(`Loaded ${accounts.length} accounts from Salesforce`);
  } else {
    throw new Error("Give --csv <export.csv> or --sf-org <alias> (or SF_INSTANCE_URL + SF_ACCESS_TOKEN).");
  }
  const noId = accounts.filter((a) => !a.id).length;
  if (noId) console.warn(`WARNING: ${noId} accounts have no Account ID column; Merge/Delete requests need the 18-char ID. Add "Account ID" to your report.`);
  await writeJson(ACCOUNTS_PATH, accounts);
  if (accounts.columns) {
    const absent = ["industry", "country", "lastActivity"].filter((k) => !accounts.columns.includes(k));
    if (absent.length) log(`Note: export has no ${absent.join(", ")} column(s); related checks are skipped.`);
  }

  const rules = config.rules || {};
  log("Checking duplicates, names, required fields, staleness...");
  let fresh = [
    ...checkDuplicates(accounts),
    ...checkNames(accounts),
    ...checkRequiredFields(accounts, (rules.requiredFields || ["website", "industry", "country"]).filter((k) => !accounts.columns || accounts.columns.includes(k))),
    ...checkStale(accounts, rules.staleDays),
  ];
  if (rules.checkWebsites !== false && !args["no-web"]) {
    log("Probing websites (dead domains / redirects)...");
    fresh.push(...(await checkWebsites(accounts, { concurrency: rules.websiteConcurrency || 8, log: args.verbose ? log : () => {} })));
  }
  const data = await loadFindings(FINDINGS_PATH);
  // Keep LLM research findings from earlier runs; they are refreshed by `research`, not `scan`.
  const researchKinds = new Set(["acquired", "merged", "renamed", "defunct"]);
  const kept = data.findings.filter((f) => researchKinds.has(f.kind));
  const offline = data.findings.filter((f) => !researchKinds.has(f.kind));
  data.findings = [...mergeFindings(offline, fresh), ...kept];
  data.findings = dedupeIds(data.findings);
  await saveFindings(FINDINGS_PATH, data);
  summarize(data.findings);
}

async function cmdResearch(config) {
  const { researchAccounts, findingsFromResearch } = await import("./research.mjs");
  const accounts = await requireAccounts();
  const data = await loadFindings(FINDINGS_PATH);
  const rc = { ...(config.research || {}) };

  const signals = new Map();
  for (const f of data.findings) {
    if (["website_dead", "website_redirects", "stale", "suspicious_name"].includes(f.kind)) {
      const k = f.accountId || f.accountName;
      signals.set(k, [...(signals.get(k) || []), ...f.evidence]);
    }
  }
  let targets = accounts;
  if (args.ids) targets = accounts.filter((a) => String(args.ids).split(",").includes(a.id));
  else if (args.flagged || (rc.onlyFlagged && !args.all)) targets = accounts.filter((a) => signals.has(a.id || a.name));
  if (args.limit) targets = targets.slice(0, Number(args.limit));
  if (!targets.length) { log("Nothing to research (use --all, --flagged, or --ids)."); return; }

  log(`Researching ${targets.length} accounts with ${rc.model || "claude-opus-5"} + web search (cached results are free)...`);
  const { results, totals } = await researchAccounts(targets, {
    cachePath: CACHE_PATH, concurrency: rc.concurrency || 3, log, force: !!args.force, signalsByAccount: signals,
    model: rc.model, maxWebSearches: rc.maxWebSearches, effort: rc.effort,
  });
  log(`Done: ${totals.calls} API calls, ${totals.cached} from cache, ${totals.searches} web searches, ${totals.input} in / ${totals.output} out tokens.`);

  const fresh = findingsFromResearch(results, accounts, { minConfidence: rc.minConfidence ?? 0.5 });
  const researchKinds = new Set(["acquired", "merged", "renamed", "defunct"]);
  const prevResearch = data.findings.filter((f) => researchKinds.has(f.kind));
  const rest = data.findings.filter((f) => !researchKinds.has(f.kind));
  data.findings = dedupeIds([...rest, ...mergeFindings(prevResearch, fresh)]);
  // Store the raw research result on the account for the review output.
  for (const { account, result } of results) if (result) account.research = result;
  await writeJson(ACCOUNTS_PATH, accounts);
  await saveFindings(FINDINGS_PATH, data);
  summarize(data.findings);
}

function dedupeIds(findings) {
  const seen = new Set();
  let n = 0;
  for (const f of findings) {
    while (!f.id || seen.has(f.id)) { n += 1; f.id = `F-${String(n).padStart(4, "0")}`; }
    seen.add(f.id);
  }
  return findings;
}

function filterFindings(findings) {
  let out = findings;
  if (args.kind) out = out.filter((f) => String(args.kind).split(",").includes(f.kind));
  if (args.status) out = out.filter((f) => String(args.status).split(",").includes(f.status));
  if (args.severity) out = out.filter((f) => SEVERITY_ORDER[f.severity] <= SEVERITY_ORDER[args.severity]);
  if (args["min-confidence"]) out = out.filter((f) => f.confidence >= Number(args["min-confidence"]));
  if (args._.length > 1) out = out.filter((f) => args._.slice(1).includes(f.id));
  return out;
}

async function cmdReview() {
  const data = await loadFindings(FINDINGS_PATH);
  const list = sortFindings(filterFindings(data.findings));
  if (args.csv) {
    const headers = ["id", "status", "severity", "confidence", "kind", "accountId", "accountName", "relatedAccountId", "relatedAccountName", "requestType", "fields", "evidence", "sources"];
    const rows = list.map((f) => ({
      ...f, confidence: f.confidence.toFixed(2), requestType: f.proposal ? `${f.proposal.action} / ${f.proposal.requestType}` : "",
      fields: f.proposal ? JSON.stringify(f.proposal.fields) : "", evidence: f.evidence.join(" | "), sources: (f.sources || []).join(" "),
    }));
    await writeFile(resolve(args.csv), toCsv(headers, rows));
    log(`Wrote ${list.length} findings to ${args.csv}`);
    return;
  }
  for (const f of list) {
    const rel = f.relatedAccountName ? ` -> ${f.relatedAccountName} (${f.relatedAccountId || "?"})` : "";
    log(`${f.id}  [${f.status}] ${f.severity.toUpperCase().padEnd(6)} ${Math.round(f.confidence * 100).toString().padStart(3)}%  ${f.kind.padEnd(18)} ${f.accountName} (${f.accountId || "no id"})${rel}`);
    for (const e of f.evidence) log(`        - ${e}`);
    if (f.proposal) log(`        => ${f.proposal.action} / ${f.proposal.requestType}${f.proposal.verifyFields ? "  (field labels unverified: run form-check)" : ""}: ${JSON.stringify(f.proposal.fields)}`);
    for (const s of f.sources || []) log(`        src ${s}`);
    if (f.submission?.ticketKey) log(`        ticket ${f.submission.ticketKey} ${f.submission.ticketUrl}`);
  }
  log("");
  summarize(data.findings);
}

async function setStatus(status) {
  const data = await loadFindings(FINDINGS_PATH);
  const ids = args._.slice(1);
  let targets;
  if (args.all) targets = filterFindings(data.findings).filter((f) => f.status === "proposed" || f.status === (status === "approved" ? "rejected" : "approved"));
  else if (ids.length) targets = data.findings.filter((f) => ids.includes(f.id));
  else throw new Error(`Give finding ids (e.g. ${status === "approved" ? "approve" : "reject"} F-0001 F-0002) or --all with filters.`);
  let n = 0;
  for (const f of targets) {
    if (f.status === "submitted") { log(`${f.id} already submitted; skipping`); continue; }
    if (status === "approved" && !f.proposal) { log(`${f.id} has no proposal (informational only); skipping`); continue; }
    f.status = status; f.reviewedAt = new Date().toISOString(); n += 1;
  }
  await saveFindings(FINDINGS_PATH, data);
  log(`${n} finding(s) marked ${status}.`);
}

async function cmdSubmit(config) {
  const live = !!args.live;
  const via = args.via || "portal";
  const data = await loadFindings(FINDINGS_PATH);
  let targets = data.findings.filter((f) => f.status === "approved" && f.proposal?.action === "Single Update Request");
  if (args._.length > 1) targets = targets.filter((f) => args._.slice(1).includes(f.id));
  if (args.limit) targets = targets.slice(0, Number(args.limit));
  if (!targets.length) { log("No approved single-update findings to submit. (Field corrections go through `mass-update`.)"); return; }
  if (targets.some((f) => !f.accountId)) throw new Error("Some approved findings lack an Account ID; the portal needs the 18-char Salesforce ID.");
  if (via === "portal" && /YOURCOMPANY|<PORTAL_ID>/.test(config.portal?.createUrl || "")) {
    throw new Error("portal.createUrl in sf-cleanup.config.json still has placeholders. Paste the URL of the 'Data quality issue' create form.");
  }

  log(`${live ? "LIVE" : "DRY RUN"}: ${targets.length} request(s) via ${via}. ${live ? "" : "Nothing will be sent; pass --live to submit."}`);
  let page, context;
  if (via === "portal") {
    const portal = await import("./submit-portal.mjs");
    ({ context, page } = await portal.openPortal(config, { headless: !!args.headless }));
  }
  try {
    for (const f of targets) {
      try {
        let r;
        if (via === "portal") {
          const portal = await import("./submit-portal.mjs");
          r = await portal.submitFinding(page, config, f, { live, screenshotDir: join(WORK, "screenshots"), log });
        } else {
          const api = await import("./submit-jsm.mjs");
          r = await api.submitFindingViaApi(config, f, { live, log });
        }
        if (live) {
          f.status = "submitted";
          f.submission = { at: new Date().toISOString(), via, ...r };
          await saveFindings(FINDINGS_PATH, data); // persist after every ticket so a crash never double-submits
        }
      } catch (e) {
        log(`  ${f.id} FAILED: ${e.message.split("\n")[0]}`);
        f.lastError = e.message.split("\n")[0];
        await saveFindings(FINDINGS_PATH, data);
        if (args["stop-on-error"]) throw e;
      }
    }
  } finally {
    if (context) await context.close();
  }
  summarize(data.findings);
}

async function cmdMassUpdate() {
  const data = await loadFindings(FINDINGS_PATH);
  const targets = data.findings.filter((f) => f.status === "approved" && f.proposal?.action === "Mass Update");
  if (!targets.length) { log("No approved Mass Update findings."); return; }
  const cols = new Set(["Account ID", "Account Name"]);
  for (const f of targets) for (const k of Object.keys(f.proposal.fields)) cols.add(k);
  const headers = [...cols];
  const rows = targets.map((f) => ({ ...f.proposal.fields, Reason: `${f.id}: ${f.evidence.join("; ")}` }));
  await mkdir(WORK, { recursive: true });
  const out = resolve(args.out || join(WORK, "mass-update.csv"));
  await writeFile(out, toCsv(headers, rows));
  log(`Wrote ${rows.length} rows to ${out}. Fill in the corrected values, then raise ONE portal request with Action = "Mass Update" and attach this file.`);
}

function summarize(findings) {
  const by = {};
  for (const f of findings) by[`${f.status}/${f.kind}`] = (by[`${f.status}/${f.kind}`] || 0) + 1;
  const statuses = {};
  for (const f of findings) statuses[f.status] = (statuses[f.status] || 0) + 1;
  log(`Findings: ${findings.length} total — ${Object.entries(statuses).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  for (const [k, v] of Object.entries(by).sort()) log(`  ${v.toString().padStart(4)}  ${k}`);
}

async function main() {
  const config = await loadConfig();
  switch (cmd) {
    case "scan": return cmdScan(config);
    case "research": return cmdResearch(config);
    case "review": return cmdReview();
    case "approve": return setStatus("approved");
    case "reject": return setStatus("rejected");
    case "submit": return cmdSubmit(config);
    case "mass-update": return cmdMassUpdate();
    case "login": return (await import("./submit-portal.mjs")).login(config, log);
    case "form-check": return (await import("./submit-portal.mjs")).formCheck(config, log);
    case "jsm-fields": return (await import("./submit-jsm.mjs")).listFields(config, log);
    default:
      console.log(`Usage: sf-cleanup <scan|research|review|approve|reject|login|form-check|submit|mass-update|jsm-fields> [options]\n(see header of src/cli.mjs or README.md)`);
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((e) => { console.error(`Error: ${e.message}`); process.exitCode = 1; });
