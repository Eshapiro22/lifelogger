// Turns what readOutreachTask() found on an Outreach task page into prospect
// fields and a step guess. Outreach's markup isn't documented and changes, so
// everything here is a best guess from labels and text patterns. Claude also
// gets the raw page text and fills in anything missed.

import { STEPS } from "./methodology.js";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

export function parseTask(frames, { senderCompany = "" } = {}) {
  const top = frames.find((f) => f.isTop) || frames[0] || {};
  const labels = Object.assign({}, ...frames.map((f) => f.labels || {}));
  const text = frames.map((f) => f.text || "").join("\n").slice(0, 12000);
  const own = senderCompany.toLowerCase().replace(/[^a-z0-9]/g, "");
  const notMine = (addr) => !own || !addr.toLowerCase().split("@")[1]?.replace(/[^a-z0-9.]/g, "").includes(own);

  // Email address: mailto links, then "Name <email>" in a To line, then a labeled field, then any address.
  const mailtos = frames.flatMap((f) => f.mailtos || []).filter(notMine);
  const named = [...text.matchAll(/([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,3})\s*<\s*([^<>\s]+@[^<>\s]+)\s*>/g)]
    .map((m) => ({ name: clean(m[1]), email: m[2] }))
    .filter((m) => notMine(m.email));
  const anyEmail = (text.match(EMAIL_RE) || []).filter(notMine);
  const labeledEmail = (labels.email || "").match(EMAIL_RE)?.[0];
  const email = mailtos[0] || named[0]?.email || labeledEmail || anyEmail[0] || "";

  const fullName = clean(labels.name) || named.find((m) => m.email === email)?.name || named[0]?.name || "";
  const title = clean(labels.title);
  let company = clean(labels.company);
  let companyGuessed = false;
  if (!company && email) {
    const domain = email.split("@")[1].split(".").slice(-2, -1)[0] || "";
    if (domain && !/^(gmail|yahoo|outlook|hotmail|icloud|aol|proton|protonmail)$/i.test(domain)) {
      company = domain.charAt(0).toUpperCase() + domain.slice(1);
      companyGuessed = true;
    }
  }

  // Step: a "Day N" label maps to the playbook day; a "Re:" subject means a reply step.
  const subject = clean(frames.map((f) => f.subject).find(Boolean));
  const body = frames
    .filter((f) => f.body)
    .sort((a, b) => b.bodyArea - a.bodyArea)
    .map((f) => f.body.trim())[0] || "";
  const dayMatch = text.match(/\bday\s*(\d{1,2})\b/i);
  const stepNum = text.match(/\bstep\s*(\d{1,2})(?:\s*(?:of|\/)\s*(\d{1,2}))?/i);
  let step = null;
  let stepReason = "";
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    const emailSteps = STEPS.filter((s) => s.day);
    step = emailSteps.find((s) => s.day === day) || [...emailSteps].reverse().find((s) => s.day <= day) || null;
    stepReason = `found "Day ${day}"`;
  }
  if (!step && /^re:/i.test(subject)) {
    stepReason = 'subject starts with "Re:" (reply step)';
  }

  return {
    email,
    fullName,
    firstName: fullName.split(" ")[0] || "",
    title,
    company,
    companyGuessed,
    stepId: step?.id || "",
    stepReason,
    outreachStep: stepNum ? `Step ${stepNum[1]}${stepNum[2] ? ` of ${stepNum[2]}` : ""}` : "",
    subject: subject.replace(/^re:\s*/i, ""),
    body,
    text,
    url: top.url || "",
  };
}
