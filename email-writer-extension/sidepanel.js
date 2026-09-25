import {
  STEPS, CTA_STYLES, RELATIONSHIPS, OUTPUT_SCHEMA, PLAN_GUIDE, PLAN_SCHEMA,
  buildSystemPrompt, checkCompliance, stepForDay,
} from "./methodology.js";
import { loadSettings } from "./storage.js";
import { callClaude } from "./api.js";
import { probeFrame, fillSubject, fillBody, readPage } from "./inject.js";

const $ = (id) => document.getElementById(id);
let settings;
let draftStep; // step that produced the current draft
let lastPlan; // most recent full plan, for Markdown export

const FORM_IDS = [
  "mode", "sequence", "step", "p-name", "p-title", "p-company", "p-industry", "p-relationship",
  "p-exec", "p-trigger", "p-intel", "p-context", "history",
];
const PROSPECT_IDS = FORM_IDS.filter((id) => id.startsWith("p-") || id === "history");

async function renderSettings() {
  settings = await loadSettings();
  $("setup-warning").hidden = Boolean(settings.apiKey);
  $("playbook-warning").hidden = !settings.apiKey || Boolean(settings.playbook?.trim());
  const selected = $("sequence").value;
  $("sequence").innerHTML = settings.sequences
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");
  if (settings.sequences.some((s) => s.id === selected)) $("sequence").value = selected;
}

async function init() {
  await renderSettings();
  $("step").innerHTML = STEPS.map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join("");
  $("p-relationship").innerHTML = Object.entries(RELATIONSHIPS)
    .map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`)
    .join("");

  // Restore the in-progress form so closing the panel doesn't lose it.
  const { draft } = await chrome.storage.session.get("draft").catch(() => ({}));
  if (draft) for (const [k, v] of Object.entries(draft)) if ($(k)) setVal($(k), v);

  showMode();
  showGuide();
  $("mode").addEventListener("change", showMode);
  $("step").addEventListener("change", showGuide);
  $("p-title").addEventListener("change", () => {
    if (/\bchief\b|\bc[a-z]{1,2}o\b/i.test($("p-title").value)) $("p-exec").checked = true;
  });
  document.querySelectorAll("input, textarea, select").forEach((el) => el.addEventListener("change", saveDraft));
  $("generate").addEventListener("click", () => ($("mode").value === "plan" ? onPlan() : onGenerate()));
  $("grab").addEventListener("click", onGrab);
  $("insert").addEventListener("click", () =>
    insertEmail(draftStep?.thread === "reply" ? "" : $("out-subject").value, $("out-body").value)
  );
  $("reset").addEventListener("click", onReset);
  $("copy-subject").addEventListener("click", () => copy($("out-subject").value, "Subject copied"));
  $("copy-body").addEventListener("click", () => copy($("out-body").value, "Body copied"));
  $("copy-vm").addEventListener("click", () => copy($("out-voicemail").value, "Voicemail copied"));
  $("copy-plan").addEventListener("click", () => lastPlan && copy(planToMarkdown(lastPlan), "Plan copied as Markdown"));
  ["out-subject", "out-body", "out-voicemail"].forEach((id) => $(id).addEventListener("input", runChecks));
  $("p-exec").addEventListener("change", runChecks);
}

function saveDraft() {
  const draft = Object.fromEntries(FORM_IDS.map((id) => [id, getVal($(id))]));
  chrome.storage.session.set({ draft }).catch(() => {});
}
const getVal = (el) => (el.type === "checkbox" ? el.checked : el.value);
const setVal = (el, v) => (el.type === "checkbox" ? (el.checked = v) : (el.value = v));

const currentStep = () => STEPS.find((s) => s.id === $("step").value);
const currentSequence = () => settings.sequences.find((s) => s.id === $("sequence").value) || settings.sequences[0];

function showMode() {
  const plan = $("mode").value === "plan";
  $("step-wrap").hidden = plan;
  $("history-wrap").hidden = plan;
  $("generate").textContent = plan ? "Build full plan" : "Write email";
  $("result").hidden = plan || !draftStep;
  $("plan").hidden = !plan || !lastPlan;
}

function showGuide() {
  const step = currentStep();
  const bits = [
    step.day ? `Day ${step.day}` : "Anytime",
    step.thread === "reply" ? "reply in same thread" : "new thread",
    step.tripleTouch ? "Triple Touch: call → voicemail → email" : null,
  ];
  $("step-guide").textContent = bits.filter(Boolean).join(" · ");
}

const field = (label, v) => `${label}: ${v && String(v).trim() ? String(v).trim() : "(not provided)"}`;

// Sequence, sender and prospect details shared by both modes.
function contextBlock({ exec, assets }) {
  const seq = currentSequence();
  return [
    `SEQUENCE`,
    field("Sequence name", seq.name),
    field("Persona track", seq.persona),
    field("Pain A", seq.problem1),
    field("Pain B", seq.problem2),
    field("What we do about it", seq.solution),
    field("Approved proof points (use only these)", seq.proof),
    assets ? field("Asset that may be offered (max one)", seq.asset) : `Assets: none on this step.`,
    `CTA style: ${CTA_STYLES[seq.cta] || CTA_STYLES.interest}`,
    ``,
    `SENDER`,
    field("Name", settings.senderName),
    field("Company", settings.senderCompany),
    ``,
    `PROSPECT`,
    field("First name", $("p-name").value),
    field("Title", $("p-title").value),
    field("Company", $("p-company").value),
    field("Industry", $("p-industry").value),
    `Existing relationship: ${RELATIONSHIPS[$("p-relationship").value]}`,
    `Executive: ${exec ? "yes, so keep emails ≤50 words" : "no"}`,
    field("Triggers", $("p-trigger").value),
    field("Colleague intel (for snowball / reverse selling)", $("p-intel").value),
    field("Extra page context (may be noisy; use only relevant facts)", $("p-context").value.slice(0, 4000)),
    ``,
    `TRIPLE TOUCH\n${settings.tripleT}\n`,
    settings.extraRules?.trim() ? `ADDITIONAL HOUSE RULES\n${settings.extraRules.trim()}\n` : ``,
  ].join("\n");
}

function buildEmailPrompt() {
  const step = currentStep();
  return [
    `Write this email step: ${step.label}.`,
    ``,
    `STEP GUIDE`,
    step.guide,
    ``,
    contextBlock({ exec: $("p-exec").checked || step.exec, assets: step.assetsAllowed }),
    `EARLIER EMAILS TO THIS PROSPECT (change the angle; don't repeat their wording)`,
    $("history").value.trim() || "(none)",
    ``,
    step.thread === "reply"
      ? `This step replies in the existing thread, so return subject as an empty string.`
      : `Return a new subject line.`,
    step.tripleTouch ? `Return the matching voicemail.` : `Return voicemail as an empty string.`,
  ].join("\n");
}

async function run(schema, userPrompt, label) {
  if (!settings.apiKey) throw new Error("Add your API key in Settings first.");
  setStatus(label);
  return callClaude({
    apiKey: settings.apiKey,
    model: settings.model,
    systemPrompt: buildSystemPrompt(settings),
    playbook: settings.playbook,
    userPrompt,
    schema,
  });
}

async function withButton(fn) {
  const btn = $("generate");
  btn.disabled = true;
  try {
    await fn();
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

function onGenerate() {
  return withButton(async () => {
    const out = await run(OUTPUT_SCHEMA, buildEmailPrompt(), "Writing…");
    draftStep = currentStep();
    $("angle").textContent = out.angle ? `Angle: ${out.angle}` : "";
    $("out-subject").value = out.subject || "";
    $("out-body").value = out.body || "";
    $("out-voicemail").value = out.voicemail || "";
    $("vm-wrap").hidden = !draftStep.tripleTouch;
    const flags = out.flags || [];
    $("flags").innerHTML = flags.map((f) => `<li class="warn">⚑ ${escapeHtml(f)}</li>`).join("");
    $("flags-wrap").hidden = !flags.length;
    $("result").hidden = false;
    runChecks();
    appendHistory(out);
  });
}

function onPlan() {
  return withButton(async () => {
    const prompt = [PLAN_GUIDE, ``, contextBlock({ exec: $("p-exec").checked, assets: true })].join("\n");
    lastPlan = await run(PLAN_SCHEMA, prompt, "Building the full plan (this can take a minute)…");
    renderPlan(lastPlan);
    $("plan").hidden = false;
  });
}

function appendHistory(out) {
  const step = currentStep();
  const entry = `--- ${step.label}\n${out.subject ? `Subject: ${out.subject}\n` : ""}${out.body}`;
  $("history").value = ($("history").value.trim() + "\n\n" + entry).trim();
  const idx = STEPS.indexOf(step);
  if (step.day && STEPS[idx + 1]?.day) $("step").value = STEPS[idx + 1].id;
  showGuide();
  saveDraft();
}

function onReset() {
  PROSPECT_IDS.forEach((id) => setVal($(id), $(id).type === "checkbox" ? false : ""));
  $("p-relationship").value = "net-new";
  $("step").value = STEPS[0].id;
  $("result").hidden = true;
  $("plan").hidden = true;
  draftStep = undefined;
  lastPlan = undefined;
  showGuide();
  saveDraft();
  setStatus("Cleared. Ready for the next prospect.");
}

function checksHtml(step, subject, body, voicemail) {
  const { issues, warnings, passes } = checkCompliance(step, {
    subject, body, voicemail, exec: $("p-exec").checked, senderCompany: settings.senderCompany,
  });
  return (
    issues.map((i) => `<li class="bad">✗ ${escapeHtml(i)}</li>`).join("") +
    warnings.map((w) => `<li class="warn">! ${escapeHtml(w)}</li>`).join("") +
    passes.map((p) => `<li class="good">✓ ${escapeHtml(p)}</li>`).join("")
  );
}

function runChecks() {
  if (!draftStep) return;
  $("checks").innerHTML = checksHtml(draftStep, $("out-subject").value.trim(), $("out-body").value, $("out-voicemail").value);
}

// ---- Full plan rendering ----

function textBlock(label, text) {
  return text?.trim() ? `<p class="label">${escapeHtml(label)}</p><p class="text">${escapeHtml(text.trim())}</p>` : "";
}

function emailActions(i, hasSubject) {
  return `<div class="row">
    ${hasSubject ? `<button class="secondary" data-act="copy-subj" data-i="${i}">Copy subject</button>` : ""}
    <button class="secondary" data-act="copy-body" data-i="${i}">Copy body</button>
    <button class="secondary" data-act="insert" data-i="${i}">Insert into page</button>
  </div>`;
}

function renderPlan(plan) {
  const tt = plan.triple_touch_1;
  // Emails referenced by the action buttons, by index.
  const emails = [{ subject: tt.email_subject, body: tt.email_body }];
  const tt1Step = stepForDay(1);

  let html = `<div class="card"><h3>Research summary</h3><p class="text">${escapeHtml(plan.research_summary)}</p></div>`;

  html += `<div class="card"><h3>Triple Touch #1</h3>
    ${textBlock("Call opener + problem proposition", tt.call_opener)}
    <p class="label">Discovery questions</p><ul>${tt.discovery_questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
    ${textBlock("Voicemail (≤25s)", tt.voicemail)}
    ${textBlock(`Email · subject: ${tt.email_subject}`, tt.email_body)}
    ${emailActions(0, Boolean(tt.email_subject))}
    <ul class="checks">${checksHtml(tt1Step, tt.email_subject, tt.email_body, tt.voicemail)}</ul>
    ${textBlock("LinkedIn connect note", tt.linkedin_note || "(no note)")}
  </div>`;

  html += `<h2>Full sequence (Days 1–21)</h2>`;
  for (const row of plan.sequence) {
    let emailPart = "";
    if (row.email_body?.trim()) {
      const i = emails.push({ subject: row.subject, body: row.email_body }) - 1;
      const step = stepForDay(row.day);
      emailPart = `${textBlock(row.subject ? `Email · subject: ${row.subject}` : "Email · reply in thread", row.email_body)}
        ${emailActions(i, Boolean(row.subject))}
        ${step ? `<ul class="checks">${checksHtml(step, row.subject, row.email_body, row.voicemail)}</ul>` : ""}`;
    }
    html += `<div class="card">
      <h3>Day ${row.day} · ${escapeHtml(row.channel)}</h3>
      <p class="meta">${escapeHtml(row.angle)}</p>
      ${textBlock(/linkedin/i.test(row.channel) ? "LinkedIn" : "Call talk track", row.other_copy)}
      ${textBlock("Voicemail", row.voicemail)}
      ${emailPart}
    </div>`;
  }

  html += `<h2>Likely objections</h2>`;
  for (const o of plan.objections) {
    html += `<div class="card"><h3>"${escapeHtml(o.objection)}"</h3><p class="text">${escapeHtml(o.response)}</p></div>`;
  }
  if (plan.flags?.length) {
    html += `<h2>Flags</h2><ul id="plan-flags">${plan.flags.map((f) => `<li class="warn">⚑ ${escapeHtml(f)}</li>`).join("")}</ul>`;
  }

  $("plan-out").innerHTML = html;
  $("plan-out").querySelectorAll("button[data-act]").forEach((b) => {
    const e = emails[Number(b.dataset.i)];
    b.addEventListener("click", () => {
      if (b.dataset.act === "copy-subj") copy(e.subject, "Subject copied");
      else if (b.dataset.act === "copy-body") copy(e.body, "Body copied");
      else insertEmail(e.subject, e.body);
    });
  });
}

function planToMarkdown(plan) {
  const tt = plan.triple_touch_1;
  const cell = (t) => (t || "").trim().replace(/\|/g, "\\|").replace(/\n+/g, "<br>");
  const rows = plan.sequence.map((r) => {
    const parts = [
      r.other_copy && cell(r.other_copy),
      r.voicemail && `VM: ${cell(r.voicemail)}`,
      r.email_body && `${r.subject ? `Subject: ${cell(r.subject)}<br>` : "(reply)<br>"}${cell(r.email_body)}`,
    ].filter(Boolean);
    return `| ${r.day} | ${cell(r.channel)} | ${cell(r.angle)} | ${parts.join("<br><br>")} |`;
  });
  return [
    `## Research Summary`, `- ${plan.research_summary}`, ``,
    `## Triple Touch #1`,
    `**Call opener + problem proposition:** ${tt.call_opener}`, ``,
    `**Discovery questions (3):**`, ...tt.discovery_questions.map((q, i) => `${i + 1}. ${q}`), ``,
    `**Voicemail (≤25s):** ${tt.voicemail}`, ``,
    `**Email** — Subject: ${tt.email_subject}`, ``, tt.email_body, ``,
    `**LinkedIn connect note (optional):** ${tt.linkedin_note || "(no note)"}`, ``,
    `## Full Sequence (Days 1–21)`,
    `| Day | Channel | Angle | Copy |`, `|---|---|---|---|`, ...rows, ``,
    `## Likely Objections + Responses`,
    ...plan.objections.map((o) => `- **"${o.objection}"** — ${o.response}`), ``,
    `## Flags`, ...(plan.flags?.length ? plan.flags.map((f) => `- ${f}`) : ["- None"]),
  ].join("\n");
}

// ---- Page interaction (Outreach or any web email editor) ----

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function onGrab() {
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: await activeTabId() }, func: readPage });
    $("p-context").value = result || "";
    saveDraft();
    setStatus("Pulled text from the page. Trim anything irrelevant.");
  } catch (err) {
    setStatus(`Couldn't read this page (${err.message}). Chrome blocks some pages, like the Web Store.`, true);
  }
}

// Probes every frame (Outreach's editor may sit in an iframe), then writes the
// subject into the frame that has a subject field and the body into the frame
// whose editor you last clicked into, falling back to the largest editor.
async function insertEmail(subject, body) {
  try {
    const tabId = await activeTabId();
    const probes = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: probeFrame });
    const ok = probes.filter((p) => p.result);
    const bodyFrame =
      ok.find((p) => p.result.focusedEditor) ||
      ok.filter((p) => p.result.editorArea > 0).sort((a, b) => b.result.editorArea - a.result.editorArea)[0];
    const subjFrame = ok.find((p) => p.result.hasSubject && p.result.isTop) || ok.find((p) => p.result.hasSubject);

    const done = [];
    if (subject && subjFrame) {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [subjFrame.frameId] }, func: fillSubject, args: [subject],
      });
      if (result) done.push("subject");
    }
    if (bodyFrame) {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [bodyFrame.frameId] }, func: fillBody, args: [body],
      });
      if (result) done.push("body");
    }
    if (!done.length) {
      setStatus("No email editor found. Click into the Outreach email body and try again, or use Copy.", true);
    } else {
      const missing = subject && !done.includes("subject") ? " No subject field found; paste it manually." : "";
      setStatus(`Inserted ${done.join(" + ")}. Review before saving or sending.${missing}`, Boolean(missing));
    }
  } catch (err) {
    setStatus(`Couldn't insert (${err.message}). Use the Copy buttons.`, true);
  }
}

async function copy(text, msg) {
  await navigator.clipboard.writeText(text);
  setStatus(msg);
}

function setStatus(msg, isError = false) {
  $("status").textContent = msg;
  $("status").classList.toggle("error", isError);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) renderSettings();
});

init();
