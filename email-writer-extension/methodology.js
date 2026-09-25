// Email steps and writing rules for a Triple Touch outbound sequence, following
// 30 Minutes to President's Club (30MPC) and Ian Koniak's Untap Your Sales
// Potential (UYSP). Company-specific content (persona pains, proof, positioning)
// belongs in the Playbook field in Settings, not in this file.

export const DEFAULT_TRIPLE_T = `Triple Touch: a call, a voicemail and an email to the same person within ~5 minutes, each pointing to the next. The voicemail (≤25 seconds, ~60 words) names the email's subject line out loud and says the sender's name twice, with no product pitch. The email goes out right after the voicemail, opens by saying I just left a voicemail, and uses a subject line that references it.`;

export const STEPS = [
  {
    id: "tt1",
    day: 1,
    label: "Day 1 — Triple Touch #1 email (Pain A)",
    thread: "new",
    tripleTouch: true,
    assetsAllowed: false,
    guide: `Triple Touch #1 follow-up email, sent right after the voicemail.
- Subject references the voicemail ("voicemail", "{first} – just called") or is the exact subject named in the voicemail. 1–4 words.
- Open with "Just left you a voicemail." then a one-sentence observation/trigger about THEM.
- Problem proposition: what that trigger usually creates for this persona, Pain A (and optionally Pain B), in the buyer's own words.
- One line of credibility: one customer, one number (from proof points only).
- Interest-based CTA ("Worth a conversation to see if this is on your radar?").
- No attachments or links.
Also write the matching voicemail.`,
  },
  {
    id: "e2",
    day: 3,
    label: "Day 3 — Email #2 (reply, new angle: Pain B or story)",
    thread: "reply",
    tripleTouch: false,
    assetsAllowed: false,
    guide: `Reply in the same thread as the Day 1 email, so the subject is empty.
- A NEW angle: Pain B, or a short customer story. Never "just following up" or "bumping this".
- 2–4 short sentences. One idea, one interest-based ask. No attachments.`,
  },
  {
    id: "tt2",
    day: 7,
    label: "Day 7 — Triple Touch #2 email (trigger / insight)",
    thread: "new",
    tripleTouch: true,
    assetsAllowed: true,
    guide: `Triple Touch #2 follow-up email, new thread, sent right after the voicemail.
- Subject references the voicemail or names the insight. 1–4 words.
- Mentions the voicemail. Angle: a trigger or insight (earnings quote, job post, initiative, new exec). Use only triggers from the input.
- Problem proposition tied to the trigger, then an interest-based CTA.
- At most one asset, offered rather than attached ("Want me to send it over?").
Also write the matching voicemail.`,
  },
  {
    id: "e4",
    day: 10,
    label: "Day 10 — Email #4 (new thread, peer proof)",
    thread: "new",
    tripleTouch: false,
    assetsAllowed: true,
    guide: `New thread with a new subject. Peer proof: "How {similar company} handled {pain}".
- Tell it as a 3–5 sentence story: setup (who they were), conflict (the problem and what was at stake), turning point (what changed), resolution (a measurable outcome), lesson (why it matters to this prospect).
- Proof must come from the proof points. If none are given, use {customer proof} placeholders and flag them.
- At most one asset, offered ("Want me to send the 1-pager?"). Interest-based CTA.`,
  },
  {
    id: "tt3",
    day: 14,
    label: "Day 14 — Triple Touch #3 email (wrong person?)",
    thread: "new",
    tripleTouch: true,
    assetsAllowed: false,
    guide: `Triple Touch #3 follow-up email, sent right after the voicemail. Mentions the voicemail.
- Referral ask: am I reaching the wrong person? Name the problem area in a few words and ask who owns it. Make it easy to point me elsewhere.
- 2–3 sentences. No asset.
Also write the matching voicemail.`,
  },
  {
    id: "breakup",
    day: 21,
    label: "Day 21 — Breakup (reply, permission to close the loop)",
    thread: "reply",
    tripleTouch: false,
    assetsAllowed: false,
    guide: `Breakup email asking permission to close the loop, sent as a reply in the most recent thread (the Day 14 email), so the subject is empty. Direct, professional and detached (UYSP: sell from service, not neediness). No guilt, no cheekiness, no asset.
- Restate the one problem in a few words, say I'll stop reaching out, and leave the door open. 2–3 sentences.`,
  },
  {
    id: "exec",
    day: null,
    label: "Anytime — Exec reverse-selling email (bottom-up insight)",
    thread: "new",
    tripleTouch: false,
    assetsAllowed: false,
    exec: true,
    guide: `Reverse selling (UYSP) to an executive who hasn't responded. Use what practitioners on their team told me (from the "Colleague intel" input only).
- Shape: "Spoke with a few folks on your {team}. They mentioned {specific issue}. Estimated {cost}. Worth 20 minutes to share what we heard?"
- 2–3 sentences, ≤50 words. Insight about their business, not features. If there's no colleague intel, use placeholders and flag them.`,
  },
];

export const RELATIONSHIPS = {
  "net-new": "Net-new logo",
  customer: "Existing customer (expansion)",
  "closed-lost": "Closed-lost before",
  competitor: "Uses a competitor",
};

export const CTA_STYLES = {
  interest: "Interest-based yes/no (e.g., \"Worth exploring?\" / \"Open to a look?\")",
  offer: "Offer-based (offer to send one short asset; no meeting ask)",
};

export function buildSystemPrompt({ senderName, senderCompany }) {
  const me = senderName || "the sender";
  const co = senderCompany || "the sender's company";
  return `You write outbound sales emails (and, when asked, voicemails, call scripts and LinkedIn messages) for ${me} at ${co}, following 30 Minutes to President's Club (30MPC) and Ian Koniak's Untap Your Sales Potential (UYSP). If a PLAYBOOK is provided, it is the source of truth and overrides the defaults below.

Rules:
1. Always open with the prospect's world: a trigger, observation or persona pain. Never open with ${co}, "I hope this finds you well" or "My name is". (Triple Touch emails may open with "Just left you a voicemail.")
2. First touches use the problem proposition: 2–3 pains in the buyer's own words, ending in a question that lets them pick.
3. Lengths: cold email ≤90 words; executive email ≤50 words; voicemail ≤25 seconds (~60 words).
4. Interest-based CTAs ("Worth exploring?"). Never ask for a specific time slot or send a calendar link unless the prospect already showed interest.
5. Change the angle on every touch. Never write "just following up", "circling back", "checking in" or "bumping this".
6. Link Triple Touch assets: the voicemail names the email subject line out loud, and the email mentions the voicemail.
7. One idea, one ask, at most one asset per message. Offer assets ("Want me to send it over?") rather than attaching them.
8. Plain language. Avoid "synergy", "leverage", "revolutionize", "cutting-edge", "end-to-end", "transform your business", "I'd love to", "quick call".
9. Don't invent facts. Customer names, statistics and triggers must come from the input or the playbook. If you need one that isn't provided, write a placeholder like {customer proof} and list it in flags.
10. Tone: confident, helpful, a little casual. Write like a peer who has seen the problem before, not a vendor asking for time. "You/your" should outnumber "I/we/${co}".
11. Subject lines: 1–4 words, lowercase feel (acronyms and proper nouns may stay capitalized), internal-looking, no clickbait.
12. Keep any merge fields the user supplied (e.g. {{first_name}}) exactly as given.

Before answering, run the playbook's tests: swap test (could this go to any company?), "so what" test, phone test (readable without scrolling), me/we count.

Return JSON only, matching the provided schema.`;
}

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    angle: { type: "string", description: "Research summary: the angle chosen and why, in 1–2 lines." },
    subject: { type: "string", description: "Subject line. Empty string when the step replies in the existing thread." },
    body: { type: "string", description: "Email body with greeting and a short sign-off using the sender's first name." },
    voicemail: { type: "string", description: "The matching ≤25-second voicemail script for Triple Touch steps. Empty string otherwise." },
    flags: {
      type: "array",
      items: { type: "string" },
      description: "Placeholders needing real data, or anything the rep should verify before sending.",
    },
  },
  required: ["angle", "subject", "body", "voicemail", "flags"],
  additionalProperties: false,
};

// Full-sequence plan (the playbook's Section 10 output format).
export const PLAN_GUIDE = `Build the full outbound plan for this ONE contact, following the playbook's default 3-week, 12-touch sequence (Section 3) and its output format (Section 10).

Include:
1. research_summary: the angle chosen and why (1–2 lines).
2. triple_touch_1: the Day 1 cold call opener (permission-based, then the problem proposition), exactly 3 discovery questions, the voicemail (≤25s, names the email subject), the follow-up email, and an optional one-line LinkedIn connect note.
3. sequence: one row per touch, in day order:
   Day 1 Triple Touch #1 (call → VM → email, Pain A) · Day 1 LinkedIn connect · Day 3 Email #2 (reply in same thread, new angle: Pain B or story) · Day 5 call only (no VM if one was left in the last 72 hrs) · Day 7 Triple Touch #2 (trigger/insight, new thread) · Day 8 LinkedIn engage · Day 10 Email #4 (new thread, peer proof story) · Day 12 call only, referencing prior emails · Day 14 Triple Touch #3 ("wrong person?" referral ask, new thread) · Day 17 LinkedIn DM (share one relevant asset, no ask) · Day 21 breakup email (reply in the Day 14 thread).
   Fill only the fields a touch uses; leave the others as empty strings. Replies have an empty subject.
4. objections: the top 3 likely objections for this persona, each with a response using Acknowledge → Question → Respond → Ask.
5. flags: every placeholder that needs real data, and anything to verify.

Every touch changes the angle. Keep all the length limits.`;

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    research_summary: { type: "string" },
    triple_touch_1: {
      type: "object",
      properties: {
        call_opener: { type: "string", description: "Permission-based opener followed by the problem proposition." },
        discovery_questions: { type: "array", items: { type: "string" }, description: "Exactly 3 questions." },
        voicemail: { type: "string" },
        email_subject: { type: "string" },
        email_body: { type: "string" },
        linkedin_note: { type: "string", description: "Optional one-line connect note; empty string for no note." },
      },
      required: ["call_opener", "discovery_questions", "voicemail", "email_subject", "email_body", "linkedin_note"],
      additionalProperties: false,
    },
    sequence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "integer" },
          channel: { type: "string", description: "e.g. \"Call → VM → Email\", \"Email\", \"Call\", \"LinkedIn\"" },
          angle: { type: "string" },
          subject: { type: "string", description: "Email subject; empty string for replies and non-email touches." },
          email_body: { type: "string", description: "Empty string if this touch has no email." },
          voicemail: { type: "string", description: "Empty string if this touch has no voicemail." },
          other_copy: { type: "string", description: "Call talk track or LinkedIn text; empty string if not used." },
        },
        required: ["day", "channel", "angle", "subject", "email_body", "voicemail", "other_copy"],
        additionalProperties: false,
      },
    },
    objections: {
      type: "array",
      items: {
        type: "object",
        properties: { objection: { type: "string" }, response: { type: "string" } },
        required: ["objection", "response"],
        additionalProperties: false,
      },
      description: "Top 3 for this persona.",
    },
    flags: { type: "array", items: { type: "string" } },
  },
  required: ["research_summary", "triple_touch_1", "sequence", "objections", "flags"],
  additionalProperties: false,
};

export const stepForDay = (day) => STEPS.find((s) => s.day === day);

const BANNED = [
  "hope this finds you", "hope this email finds you", "my name is", "just following up",
  "following up on", "circling back", "checking in", "touching base", "bumping this",
  "top of your inbox", "synergy", "leverage", "revolutionize", "cutting-edge", "cutting edge",
  "end-to-end", "end to end", "transform your business", "i'd love to", "quick call",
  "game-changer", "calendly", "quick question",
];

const words = (s) => s.trim().split(/\s+/).filter(Boolean);

// Local, deterministic checks against the playbook's Section 9 rules.
// Returns { issues, warnings, passes }.
export function checkCompliance(step, { subject, body, voicemail, exec, senderCompany }) {
  const issues = [];
  const warnings = [];
  const passes = [];
  const lower = `${subject} ${body}`.toLowerCase();

  // Length (excluding the greeting line and the sign-off name).
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const content = lines.filter((l, i) => !(i === 0 && /^(hi|hey|hello)\b/i.test(l) && words(l).length <= 3));
  if (content.length > 1 && words(content.at(-1)).length <= 2) content.pop();
  const n = words(content.join(" ")).length;
  const limit = exec || step.exec ? 50 : 90;
  if (n <= limit) passes.push(`${n} words (limit ${limit})`);
  else issues.push(`${n} words, over the ${limit}-word limit. Trim it.`);

  // Thread / subject.
  if (step.thread === "reply") {
    if (!subject) passes.push("Replies in the existing thread");
    else issues.push("This step replies in the same thread, so leave the subject empty");
  } else if (!subject) {
    issues.push("This step starts a new thread and needs a subject line");
  } else {
    const sw = words(subject);
    if (sw.length <= 4) passes.push(`Subject is ${sw.length} word${sw.length > 1 ? "s" : ""}`);
    else issues.push(`Subject is ${sw.length} words. Aim for 1–4.`);
    const caps = sw.filter((w) => /^[A-Z][a-z]/.test(w) && !/^\{/.test(w));
    if (caps.length) warnings.push(`Subject capitals (${caps.join(", ")}): OK only for proper nouns`);
    else passes.push("Subject has a lowercase feel");
  }

  // Opening line (rule 1).
  const first = content[0] || "";
  const co = (senderCompany || "").toLowerCase();
  if (/^(i'm|i am|my name|we |we're|our )/i.test(first) || (co && first.toLowerCase().startsWith(co))) {
    issues.push("Opens with you or your company. Open with the prospect's world.");
  } else passes.push("Opens with the prospect's world");

  // Banned phrases (rules 5 and 8).
  const hits = BANNED.filter((b) => lower.includes(b));
  if (hits.length) issues.push(`Avoid: ${hits.map((h) => `"${h}"`).join(", ")}`);
  else passes.push("No banned phrases");

  // Me/we count (rule 10).
  const you = (lower.match(/\b(you|your|you're|yours)\b/g) || []).length;
  const meRe = new RegExp(`\\b(i|i'm|i've|me|my|we|we're|our|us${co ? "|" + co.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : ""})\\b`, "g");
  const me = (body.toLowerCase().match(meRe) || []).length;
  if (you >= me) passes.push(`You/your (${you}) ≥ I/we (${me})`);
  else warnings.push(`I/we (${me}) outnumber you/your (${you})`);

  // One ask (rule 7).
  const q = (body.match(/\?/g) || []).length;
  if (q > 2) warnings.push(`${q} questions. Aim for one ask.`);

  // Assets (rule 7 + content library).
  const urls = (body.match(/https?:\/\/\S+/g) || []).length;
  if (urls > 1) issues.push(`${urls} links. One asset max.`);
  else if (urls && !step.assetsAllowed) issues.push("Early touches and breakups shouldn't include assets or links");

  // Triple Touch linking (rule 6).
  if (step.tripleTouch) {
    if (/voicemail|just called|just tried you/i.test(body)) passes.push("Email mentions the voicemail");
    else issues.push("Triple Touch email should mention the voicemail");
    if (voicemail) {
      const vw = words(voicemail).length;
      if (vw <= 65) passes.push(`Voicemail is ~${vw} words (≤25s)`);
      else issues.push(`Voicemail is ${vw} words, likely over 25 seconds`);
      if (subject && voicemail.toLowerCase().includes(subject.toLowerCase().replace(/[{}]/g, "").trim()))
        passes.push("Voicemail names the email subject");
      else warnings.push("Voicemail should say the email's subject line out loud");
    } else issues.push("Missing the matching voicemail");
  }

  // Placeholders (rule 9) — {{merge_fields}} are fine, {single braces} need data.
  const ph = [...new Set(body.match(/(?<!\{)\{[^{}]+\}(?!\})/g) || [])];
  if (ph.length) warnings.push(`Needs real data before sending: ${ph.join(", ")}`);

  return { issues, warnings, passes };
}
