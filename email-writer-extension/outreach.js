// Turns what readOutreachTask() found on an Outreach page into prospects.
// Outreach's markup isn't documented and changes, so this leans on the most
// stable things on the page: links to /prospects/, /accounts/ and
// /sequences/ (each task row has them), then labels and text patterns.
// Claude also gets the prospect's own text and fills in anything missed.

import { STEPS } from "./methodology.js";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
const TASK_TYPES = /^(email|call|linkedin|action item|meet in person|manual email|auto email)$/i;

// "Step #1", "Step 1 of 30MPC Sequence" → { stepNumber: 1, sequence: "30MPC Sequence" }
function parseStep(text) {
  const m = (text || "").match(/\bstep\s*#?\s*(\d{1,2})(?:\s+of\s+([^\n]+))?/i);
  return m ? { stepNumber: Number(m[1]), sequence: clean(m[2] || "") } : { stepNumber: 0, sequence: "" };
}

// Title = the text between the name and the company in the row.
function rowTitle(text, name, company) {
  let rest = text.slice(text.indexOf(name) + name.length);
  if (company && rest.includes(company)) rest = rest.slice(0, rest.indexOf(company));
  else rest = rest.split(/\n\s*\n|\bstep\s*#?\s*\d/i)[0];
  return clean(rest.replace(/[•·|,]\s*$/g, "").replace(/^[\s•·|,]+/, "")).replace(/[•·|,]\s*$/, "").trim();
}

// "Day 3" on the page → the playbook step for that day.
function stepFromDay(text) {
  const m = (text || "").match(/\bday\s*(\d{1,2})\b/i);
  if (!m) return "";
  const day = Number(m[1]);
  const emailSteps = STEPS.filter((s) => s.day);
  return (emailSteps.find((s) => s.day === day) || [...emailSteps].reverse().find((s) => s.day <= day) || {}).id || "";
}

function fromRow(r) {
  const step = parseStep(r.stepText || r.text);
  const firstLine = (r.text.split("\n")[0] || "").trim();
  return {
    fullName: clean(r.fullName),
    firstName: clean(r.fullName).split(" ")[0] || "",
    title: rowTitle(r.text, r.fullName, r.company),
    company: clean(r.company),
    companyGuessed: false,
    email: r.mailto || (r.text.match(EMAIL_RE) || [])[0] || "",
    stepNumber: step.stepNumber,
    sequence: clean(r.sequence) || step.sequence,
    taskType: TASK_TYPES.test(firstLine) ? firstLine : "",
    stepId: stepFromDay(r.text),
    subject: "",
    body: "",
    text: r.text,
  };
}

export function parseTask(frames, { senderCompany = "" } = {}) {
  const labels = Object.assign({}, ...frames.map((f) => f.labels || {}));
  const pageText = frames.map((f) => f.text || "").join("\n").slice(0, 12000);
  const own = senderCompany.toLowerCase().replace(/[^a-z0-9]/g, "");
  const notMine = (addr) => !own || !addr.toLowerCase().split("@")[1]?.replace(/[^a-z0-9.]/g, "").includes(own);

  // The email being composed, if a task is open.
  const subject = clean(frames.map((f) => f.subject).find(Boolean)).replace(/^re:\s*/i, "");
  const body = frames
    .filter((f) => f.body)
    .sort((a, b) => b.bodyArea - a.bodyArea)
    .map((f) => f.body.trim())[0] || "";

  // Recipient hints: "Name <email>" lines, mailto links, labeled fields.
  const named = [...pageText.matchAll(/([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,3})\s*<\s*([^<>\s]+@[^<>\s]+)\s*>/g)]
    .map((m) => ({ name: clean(m[1]), email: m[2] }))
    .filter((m) => notMine(m.email));
  const mailtos = frames.flatMap((f) => f.mailtos || []).filter(notMine);

  const rows = [];
  const seen = new Set();
  for (const r of frames.flatMap((f) => f.rows || [])) {
    const key = clean(r.fullName).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(fromRow(r));
  }

  // Which single prospect is this page about?
  let single = null;
  if (rows.length === 1) {
    single = rows[0];
  } else if (rows.length > 1 && (body || subject)) {
    // An open task with a list beside it: match the recipient.
    const recipient = named[0]?.name || clean(labels.name);
    single = rows.find((r) => recipient && r.fullName.toLowerCase() === recipient.toLowerCase()) || null;
  } else if (!rows.length) {
    // No task rows: fall back to labels and recipient patterns.
    const email = mailtos[0] || named[0]?.email || (labels.email || "").match(EMAIL_RE)?.[0] || "";
    const fullName = clean(labels.name) || named.find((m) => m.email === email)?.name || "";
    if (fullName || email) {
      let company = clean(labels.company);
      let companyGuessed = false;
      if (!company && email) {
        const domain = email.split("@")[1].split(".").slice(-2, -1)[0] || "";
        if (domain && !/^(gmail|yahoo|outlook|hotmail|icloud|aol|proton|protonmail)$/i.test(domain)) {
          company = domain.charAt(0).toUpperCase() + domain.slice(1);
          companyGuessed = true;
        }
      }
      single = {
        fullName, firstName: fullName.split(" ")[0] || "", title: clean(labels.title), company, companyGuessed,
        email, ...parseStep(pageText), taskType: "", stepId: stepFromDay(pageText), text: pageText,
      };
    }
  }
  if (single) {
    single = { ...single, subject, body };
    if (!single.email) single.email = named.find((m) => m.name.toLowerCase() === single.fullName.toLowerCase())?.email || mailtos[0] || "";
    // A lone task page: give Claude the whole page (history, notes); a row from a list: just that row.
    if (rows.length <= 1) single.text = pageText;
    if (/^re:/i.test(frames.map((f) => f.subject).find(Boolean) || "") && !single.stepNumber) single.replyHint = true;
  }
  return { rows, single };
}

// Maps an Outreach step number to one of our email steps using the
// sequence's step map from Settings ("1:tt1, 3:e2, ..."). Step 1 defaults to
// the Day 1 Triple Touch email.
export function mapOutreachStep(seq, stepNumber) {
  if (!stepNumber) return "";
  const map = Object.fromEntries(
    (seq?.outreachSteps || "")
      .split(/[,;\n]+/)
      .map((p) => p.split(/[:=]/).map((x) => x.trim()))
      .filter(([n, id]) => n && id && STEPS.some((s) => s.id === id))
  );
  if (map[stepNumber]) return map[stepNumber];
  return stepNumber === 1 ? "tt1" : "";
}

// Finds our saved sequence matching the Outreach sequence name.
export function matchSequence(sequences, name) {
  const n = clean(name).toLowerCase();
  if (!n) return null;
  return (
    sequences.find((s) => clean(s.name).toLowerCase() === n) ||
    sequences.find((s) => clean(s.outreachName || "").toLowerCase() === n) ||
    sequences.find((s) => n.includes(clean(s.name).toLowerCase()) || clean(s.name).toLowerCase().includes(n)) ||
    null
  );
}
