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
  return extractAllJson(text)[0] || null;
}

// Every top-level JSON object found in the text, newest (last) first. Tries
// fenced blocks first, then scans for balanced {...} spans, so it works on a
// code block, a copied reply, or the whole text of the Claude page.
export function extractAllJson(text) {
  if (!text) return [];
  const found = [];
  const tryParse = (c) => {
    try {
      const obj = JSON.parse(c.trim());
      if (obj && typeof obj === "object" && !Array.isArray(obj)) found.push(obj);
    } catch {
      // not JSON
    }
  };
  for (const m of [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].reverse()) tryParse(m[1]);
  const spans = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"' && depth > 0) inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0) spans.push(text.slice(start, i + 1));
    }
  }
  for (const span of spans.reverse()) tryParse(span);
  return found;
}
