// 30MPC-style sequence map and writing rules.
//
// Sources (30 Minutes to President's Club, public posts/newsletters):
//  - "How to structure your cold email follow-up" (LinkedIn): three phases —
//    opening touches (same subject), switch the problem (new subject),
//    breakup (new subject: "are you the right person" then break-up).
//  - "The Perfect Outbound Sequence Template": Day-1 email is the powerhouse;
//    bumps are one sentence, sent as a reply so the original stays visible;
//    no cheeky/unprofessional breakups.
//  - "4 Questions to Write Painfully Triggering Cold Emails": trigger the
//    problem like a movie scene, a "Notice" line with the minimum detail on
//    the solution, a humanizing P.S.
//  - "4 Data-Backed Subject Lines": all-lowercase subject lines (proper nouns
//    excepted), look internal, no marketing gimmicks.
//  - 3x3 rule: crispy problem, what you do, quick interest-based ask.
//
// "Triple T": the exact 30MPC definition could not be verified from this
// environment. The default text below treats it as the "triple" touch
// (call + voicemail + email within minutes). Edit it in Settings to match
// your course notes; whatever you save there is sent to the model verbatim.

export const DEFAULT_TRIPLE_T = `Triple touch: when I call and leave a voicemail, the email goes out within ~90 seconds of the voicemail. The email should read as the written companion to that voicemail — briefly reference that I just called / left a voicemail, repeat the single core problem, and keep the same ask. Recency + frequency + relevancy.`;

export const STEPS = [
  {
    id: "e1",
    label: "Email 1 — Tailored opener (problem #1)",
    phase: "Opening touches",
    subject: "new",
    kind: "opener",
    guide: `The powerhouse email. Structure:
1) Trigger/observation line that proves research (a specific, recent trigger about the person or company — not flattery).
2) Paint the #1 problem like a movie scene so it hits close to home ("dangerously specific"). Sell the hole, not the drill.
3) "Notice" line: the minimum detail about how we solve it, with a credible proof point if provided.
4) Low-friction, interest-based yes/no CTA (do NOT ask for 30 minutes or a calendar slot).
5) Optional P.S. with one more personal nugget so they know a human wrote it.
Under 100 words (body excluding P.S. and signature), ~3-4 short skimmable sentences.`,
  },
  {
    id: "e2",
    label: "Email 2 — Bump (bubble up #1)",
    phase: "Opening touches",
    subject: "reply",
    kind: "bump",
    guide: `A bump sent as a REPLY to Email 1 so the original stays visible. One sentence (two max). Bubble the thread back to the top. Can reframe the ask or add a single new relevance hook. No "just following up", no guilt.`,
  },
  {
    id: "e3",
    label: "Email 3 — Bump (bubble up #1 again)",
    phase: "Opening touches",
    subject: "reply",
    kind: "bump",
    guide: `Second bump, still a reply on the same thread. One to two sentences. Different angle from Email 2 (e.g., a "thoughts?" style check or a tiny proof point). Never repeat Email 2's wording.`,
  },
  {
    id: "e4",
    label: "Email 4 — Switch the problem (problem #2)",
    phase: "Switch the problem",
    subject: "new",
    kind: "opener",
    guide: `New thread with a NEW subject line. Lead with the SECOND biggest problem we solve for this persona, painted specifically. Same structure as Email 1 (observation → problem → notice → interest CTA), under 100 words. Do not reference previous emails.`,
  },
  {
    id: "e5",
    label: "Email 5 — Bump (bubble up #2)",
    phase: "Switch the problem",
    subject: "reply",
    kind: "bump",
    guide: `Reply-bump on the Email 4 thread. One to two sentences, bubbles problem #2 back up.`,
  },
  {
    id: "e6",
    label: "Email 6 — Are you the right person?",
    phase: "Breakup",
    subject: "new",
    kind: "right-person",
    guide: `New subject. Short, direct, professional: ask whether they own <problem area> or who does. Make it easy to point you elsewhere. Two to three sentences.`,
  },
  {
    id: "e7",
    label: "Email 7 — Professional break-up",
    phase: "Breakup",
    subject: "new",
    kind: "breakup",
    guide: `New subject. Direct but professional break-up: acknowledge you'll stop reaching out, restate the one problem in a few words, leave the door open. No cheeky "1-2-3" multiple-choice, no guilt trips, no "did you fall off a cliff". Two to three sentences.`,
  },
];

export const CTA_STYLES = {
  interest: "Interest-based yes/no (e.g., \"worth exploring?\" / \"open to learning more?\")",
  offer: "Offer-based (offer a resource, teardown, or benchmark — no meeting ask)",
  thoughts: "\"Thoughts?\"-style soft question",
};

export const SYSTEM_PROMPT = `You write B2B outbound sales emails in the style taught by 30 Minutes to President's Club (30MPC).

Non-negotiable rules:
- Problem-first, not product-first. Describe the prospect's pain so specifically it feels like you saw it happen last Tuesday. "Don't sell the drill, sell the hole."
- Cold openers: under 100 words in the body, ~3-4 short, punchy, skimmable sentences. Bumps: 1-2 sentences.
- Subject lines: all lowercase except proper nouns, 1-4 words, look like an internal email from a colleague. No clickbait, no emojis, no "quick question", no punctuation gimmicks.
- CTA: low-friction interest- or offer-based. Never ask for a specific block of time or send a calendar link in cold emails.
- Write like a human peer: plain words, contractions, no buzzwords ("synergy", "leverage", "revolutionize", "cutting-edge", "game-changer"), no "I hope this email finds you well", no "my name is", no "just following up/checking in/circling back".
- Never invent facts about the prospect, their company, customers, or numbers. Only use research and proof points supplied in the input. If a field is missing, write around it rather than fabricating.
- Personalization must connect to the problem; don't compliment for its own sake.
- Output must be ready to paste. No placeholders like [Name] unless the user supplied a merge-field style (e.g., {{first_name}}), in which case keep their merge fields exactly.

Return JSON only matching the provided schema.`;

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    subject: {
      type: "string",
      description: "Subject line. Empty string if this step is a reply-bump on the existing thread.",
    },
    body: { type: "string", description: "Email body including greeting, P.S. if used, and a short sign-off with the sender's first name." },
    rationale: { type: "string", description: "One or two sentences on which 30MPC principles this draft applies." },
  },
  required: ["subject", "body", "rationale"],
  additionalProperties: false,
};

// Local, deterministic compliance checks shown under the draft.
const BANNED = [
  "hope this finds you", "hope this email finds you", "my name is", "just following up",
  "just checking in", "circling back", "touching base", "synergy", "revolutionize",
  "game-changer", "game changer", "cutting-edge", "best-in-class", "15 minutes",
  "30 minutes", "calendly", "hop on a call", "quick question",
];

export function checkCompliance(step, subject, body) {
  const issues = [];
  const passes = [];
  const mainBody = body.split(/\n\s*p\.?s\.?/i)[0];
  const words = mainBody.trim().split(/\s+/).filter(Boolean).length;
  const sentences = mainBody.split(/[.!?]+\s/).filter((s) => s.trim().length > 3).length;

  if (step.kind === "bump") {
    if (sentences <= 3 && words <= 45) passes.push(`Bump is short (${words} words)`);
    else issues.push(`Bump should be 1-2 sentences — currently ~${words} words`);
  } else if (words < 100) passes.push(`Under 100 words (${words})`);
  else issues.push(`Over 100 words (${words}) — trim`);

  if (step.subject === "reply") {
    if (!subject) passes.push("Sent as a reply on the existing thread");
    else issues.push("Bump steps should reply on the existing thread (no new subject)");
  } else if (subject) {
    const letters = subject.replace(/[^A-Za-z]/g, "");
    const upper = subject.split(/\s+/).filter((w) => /^[A-Z]/.test(w));
    if (upper.length === 0) passes.push("Subject is lowercase");
    else issues.push(`Subject has capitals (${upper.join(", ")}) — fine only if proper nouns`);
    const n = subject.trim().split(/\s+/).length;
    if (n <= 4) passes.push(`Subject is short (${n} words)`);
    else issues.push(`Subject is ${n} words — aim for 1-4`);
    if (!letters) issues.push("Subject is empty");
  } else {
    issues.push("This step needs a new subject line");
  }

  const lower = (subject + " " + body).toLowerCase();
  const hits = BANNED.filter((b) => lower.includes(b));
  if (hits.length) issues.push(`Avoid: ${hits.map((h) => `"${h}"`).join(", ")}`);
  else passes.push("No banned phrases");

  if (/\[[A-Za-z _]+\]/.test(body)) issues.push("Contains an unfilled [placeholder]");

  return { issues, passes };
}
