// The reply format Claude is asked for: a readable email with simple labels,
// not JSON. It reads naturally in the Claude tab and is easy to pull back out.
//
//   STEP: Day 3 — Email #2
//   SUBJECT: contractor onboarding
//   EMAIL:
//   Hi Deborah,
//   ...
//   VOICEMAIL: Hey Deborah, ...
//   PROOF: https://...
//   NOTES: anything to check before sending
//   END

const LABELS = ["PROSPECT", "STEP", "SUBJECT", "EMAIL", "VOICEMAIL", "PROOF", "NOTES"];
const LABEL_RE = new RegExp(`^\\s*(?:[*_#>\\s]*)(${LABELS.join("|")})(?:[*_\\s]*):(?:[*_]*)\\s?(.*)$`, "i");
const END_RE = /^\s*[*_#>\s]*END[*_\s]*$/i;

export function formatInstructions({ batch = false, tripleTouch = false } = {}) {
  const one = [
    batch ? "PROSPECT: <their full name>" : "",
    "STEP: <which step this is, e.g. Day 3 — Email #2>",
    "SUBJECT: <1–4 words, or leave empty if this replies in the existing thread>",
    "EMAIL:",
    "<the email, ready to send, signed with my first name>",
    tripleTouch ? "VOICEMAIL: <a ≤25-second script, in case I leave one>" : "VOICEMAIL: <leave empty>",
    "PROOF: <the URL of the customer story you used, or none>",
    "NOTES: <anything I should check before sending, or none>",
    "END",
  ].filter(Boolean);
  return [
    batch
      ? "Reply with one block per person in exactly this format, and nothing else (no intro, no explanation):"
      : "Reply in exactly this format and nothing else (no intro, no explanation):",
    "",
    ...one,
  ].join("\n");
}

const isPlaceholder = (v) => /^\s*<[^>]*>\s*$/.test(v || "") || /^<(the|their|a|which|1–4|leave|anything)/i.test((v || "").trim());
const none = (v) => (/^\s*(none|n\/a|-|—|leave empty|\(none\))\s*\.?\s*$/i.test(v || "") ? "" : (v || "").trim());

// Returns every finished block in the text (one per email), oldest first.
// lenient: also accept a last block with no END line (use only once Claude's
// page has stopped changing, so a half-written email isn't taken).
export function parseEmails(text, { lenient = false } = {}) {
  if (!text) return [];
  const blocks = [];
  let cur = null;
  let field = null;
  const start = () => ({ PROSPECT: "", STEP: "", SUBJECT: "", EMAIL: "", VOICEMAIL: "", PROOF: "", NOTES: "", _ended: false });
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, " ");
    if (END_RE.test(line)) {
      if (cur) {
        cur._ended = true;
        blocks.push(cur);
      }
      cur = null;
      field = null;
      continue;
    }
    const m = line.match(LABEL_RE);
    if (m) {
      const label = m[1].toUpperCase();
      // A new email starts at PROSPECT, STEP or SUBJECT when the current one already has that field.
      if (!cur || (["PROSPECT", "STEP", "SUBJECT"].includes(label) && cur[label])) cur = start();
      field = label;
      cur[label] = m[2] || "";
      continue;
    }
    if (cur && field) cur[field] += (cur[field] ? "\n" : "") + line;
  }
  if (lenient && cur && cur.EMAIL.trim()) {
    cur._ended = true;
    // Drop trailing page chrome such as "Copy" / "Retry" / disclaimers from the last field.
    const chrome = /(\n\s*(copy|retry|edit|share|claude can make mistakes.*|claude is ai.*)\s*)+$/i;
    if (field) cur[field] = cur[field].replace(chrome, "");
    blocks.push(cur);
  }
  return blocks
    .filter((b) => b._ended && b.EMAIL.trim() && !isPlaceholder(b.EMAIL) && !isPlaceholder(b.SUBJECT))
    .map((b) => {
      const subject = none(b.SUBJECT).replace(/^["'“]|["'”]$/g, "");
      return {
        prospect: none(b.PROSPECT),
        step: none(b.STEP),
        subject: /^\(?(reply|empty|leave)/i.test(subject) ? "" : subject,
        body: b.EMAIL.replace(/^\s*\n/, "").replace(/\s+$/, ""),
        voicemail: none(b.VOICEMAIL),
        proof_source: (none(b.PROOF).match(/https?:\/\/\S+/) || [""])[0].replace(/[).,]+$/, ""),
        flags: none(b.NOTES) ? [none(b.NOTES)] : [],
      };
    });
}

// "Day 3 — Email #2" → 3
export function dayFromStep(step) {
  const m = (step || "").match(/\bday\s*(\d{1,2})\b/i);
  return m ? Number(m[1]) : 0;
}
