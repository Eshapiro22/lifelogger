import { SYSTEM_PROMPT, OUTPUT_SCHEMA } from "./methodology.js";

// Calls the Claude Messages API directly over HTTP. The extension ships with no
// build step, so the npm SDK can't be imported here. The API key is stored in
// chrome.storage.local on this machine only and sent solely to api.anthropic.com.
export async function generateEmail({ apiKey, model, userPrompt }) {
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
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) throw new Error(`Invalid API key (${msg})`);
    if (res.status === 429) throw new Error(`Rate limited — try again shortly (${msg})`);
    throw new Error(msg);
  }
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined this request. Try rephrasing the inputs.");
  }
  if (data.stop_reason === "max_tokens") {
    throw new Error("Response was cut off. Try again.");
  }
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Could not parse the model's response.");
  }
}
