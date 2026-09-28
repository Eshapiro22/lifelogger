import { extractJson } from "./claudetab.js";

// Calls the Claude Messages API directly over HTTP. The extension ships with no
// build step, so the npm SDK can't be imported here. The API key is stored in
// chrome.storage.local on this machine only and sent solely to api.anthropic.com.
//
// With webSearch on, Claude can look up a real public customer story. Search
// results come back with citations, so instead of structured outputs the reply
// is a fenced JSON block that we parse ourselves.
export async function callClaude({ apiKey, model, systemPrompt, playbook, userPrompt, schema, webSearch = false }) {
  // The playbook is long and identical across calls, so it goes last in the
  // system prompt with a cache breakpoint (reused while you work a list).
  const system = [{ type: "text", text: systemPrompt }];
  if (playbook?.trim()) {
    system.push({
      type: "text",
      text: `PLAYBOOK (source of truth)\n\n${playbook.trim()}`,
      cache_control: { type: "ephemeral" },
    });
  }

  const content = webSearch
    ? `${userPrompt}\n\nReply with ONE fenced \`\`\`json code block and nothing else. It must be a JSON object matching this JSON Schema exactly:\n${JSON.stringify(schema)}`
    : userPrompt;
  const messages = [{ role: "user", content }];
  const body = {
    model,
    max_tokens: 16000,
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: webSearch ? { effort: "medium" } : { effort: "medium", format: { type: "json_schema", schema } },
    system,
    messages,
  };
  if (webSearch) {
    // Haiku 4.5 only supports the basic web search tool.
    const type = model.startsWith("claude-haiku") ? "web_search_20250305" : "web_search_20260209";
    body.tools = [{ type, name: "web_search", max_uses: 5 }];
  }

  // Server tools can pause a long turn; resend with the partial turn to continue.
  for (let round = 0; round < 5; round++) {
    const data = await post(apiKey, body);
    if (data.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: data.content });
      continue;
    }
    if (data.stop_reason === "refusal") throw new Error("The model declined this request. Try rephrasing the inputs.");
    if (data.stop_reason === "max_tokens") throw new Error("Response was cut off. Try again.");
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = webSearch ? extractJson(text) : safeParse(text);
    if (!parsed) throw new Error("Could not parse the model's response.");
    return parsed;
  }
  throw new Error("The search took too many rounds. Try again.");
}

async function post(apiKey, body) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      // Required for requests made from a browser context.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) throw new Error(`Invalid API key (${msg})`);
    if (res.status === 429) throw new Error(`Rate limited — try again shortly (${msg})`);
    throw new Error(msg);
  }
  return data;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
