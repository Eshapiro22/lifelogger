// Builds one self-contained message for a claude.ai tab and pulls the JSON
// answer back out of Claude's reply.

export function buildClaudeTabPrompt({ systemPrompt, playbook, userPrompt, schema }) {
  return [
    systemPrompt.replace(/\s*Return JSON only, matching the provided schema\.\s*$/, ""),
    playbook?.trim() ? `\n=== PLAYBOOK (source of truth) ===\n${playbook.trim()}\n=== END PLAYBOOK ===` : "",
    `\n=== TASK ===\n${userPrompt}`,
    `\n=== OUTPUT FORMAT ===`,
    `Reply with ONE fenced \`\`\`json code block and nothing else. It must be a JSON object that matches this JSON Schema exactly (same keys, no extras):`,
    JSON.stringify(schema),
  ]
    .filter(Boolean)
    .join("\n");
}

// Accepts a whole reply (or a code block) and returns the parsed object, or null.
export function extractJson(text) {
  if (!text) return null;
  const candidates = [];
  const fence = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  candidates.push(...fence.reverse());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c.trim());
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
