import {
  STEPS, CTA_STYLES, RELATIONSHIPS, OUTPUT_SCHEMA, PLAN_GUIDE, PLAN_SCHEMA, BATCH_SCHEMA, CALL_OUTCOMES,
  buildSystemPrompt, callOutcomeInstruction, checkCompliance, stepForDay,
} from "./methodology.js";
import { loadSettings } from "./storage.js";
import { callClaude, callClaudeText } from "./api.js";
import { formatInstructions, parseEmails, dayFromStep } from "./emailformat.js";
import {
  probeFrame, fillSubject, fillBody, readPage, pasteIntoClaude, submitClaude, readClaudeReply, readOutreachTask,
  readFrameText, openActivityTab, claudeComposerText,
} from "./inject.js";
import { parseTask, mapOutreachStep, matchSequence } from "./outreach.js";
import { initLog, log, clearLog, logText } from "./logger.js";
import { buildClaudeTabPrompt, extractJson, extractAllJson } from "./claudetab.js";

const $ = (id) => document.getElementById(id);
let settings;
let draftStep; // step that produced the current draft
let lastPlan; // most recent full plan, for Markdown export
let pending; // request waiting on a reply from the Claude tab: { kind, stepId, tabId }

const FORM_IDS = [
  "mode", "sequence", "step", "call-outcome", "p-name", "p-title", "p-company", "p-industry", "p-relationship",
  "p-exec", "p-trigger", "p-intel", "p-context", "p-email", "ot-summary", "ot-subject", "ot-body", "ot-text", "history",
];
const PROSPECT_IDS = FORM_IDS.filter((id) => /^(p|ot)-/.test(id) || id === "history");
let outreachTabId; // the Outreach task tab to write back into
let pageRows = []; // prospects found on the current Outreach page
let batch = []; // drafts written for several prospects at once: [{ row, out, stepId }]

async function renderSettings() {
  settings = await loadSettings();
  $("setup-warning").hidden = useClaudeTab() || Boolean(settings.apiKey);
  $("playbook-warning").hidden = Boolean(settings.playbook?.trim()) || (!useClaudeTab() && !settings.apiKey);
  $("sender-warning").hidden = Boolean(settings.senderName?.trim() && settings.senderCompany?.trim());
  if ($("mode").value) showMode();
  const selected = $("sequence").value;
  $("sequence").innerHTML = settings.sequences
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");
  if (settings.sequences.some((s) => s.id === selected)) $("sequence").value = selected;
}

async function init() {
  await initLog();
  window.addEventListener("error", (e) => log("error", "panel error", { message: e.message, source: `${e.filename}:${e.lineno}` }));
  window.addEventListener("unhandledrejection", (e) => log("error", "unhandled promise rejection", { message: String(e.reason?.message || e.reason), stack: e.reason?.stack }));
  await renderSettings();
  $("step").innerHTML = STEPS.map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join("");
  $("call-outcome").innerHTML = Object.entries(CALL_OUTCOMES)
    .map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`)
    .join("");
  $("p-relationship").innerHTML = Object.entries(RELATIONSHIPS)
    .map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`)
    .join("");

  // Buttons first, so a problem restoring saved state can never leave them dead.
  bindEvents();

  // Restore the in-progress form so closing the panel doesn't lose it.
  try {
    const { draft } = await chrome.storage.session.get("draft").catch(() => ({}));
    if (draft) for (const [k, v] of Object.entries(draft)) if ($(k)) setVal($(k), v);
    if (!STEPS.some((x) => x.id === $("step").value)) $("step").value = STEPS[0].id;
    if (!$("call-outcome").value) $("call-outcome").value = "novm";
    ({ pending } = await chrome.storage.session.get("pending").catch(() => ({})));
    $("reply-wrap").hidden = !pending;
    $("ot-wrap").hidden = !$("ot-text").value;
    ({ batch = [], pageRows = [] } = await chrome.storage.session.get(["batch", "pageRows"]).catch(() => ({})));
    renderRows();
    renderBatch();
    showMode();
    showGuide();
  } catch (err) {
    log("error", "panel: couldn't restore saved state (starting fresh)", { error: err.message, stack: err.stack });
    await chrome.storage.session.remove(["draft", "pending", "batch", "pageRows"]).catch(() => {});
    batch = [];
    pageRows = [];
  }
}

function bindEvents() {
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
  $("fetch-reply").addEventListener("click", onFetchReply);
  $("auto-run").addEventListener("click", onRun);
  $("stop-run").addEventListener("click", () => {
    stopRequested = true;
    setStatus("Stopping…");
  });
  $("open-log").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("log.html") }));
  $("copy-log").addEventListener("click", async () => {
    const { version } = chrome.runtime.getManifest();
    await initLog();
    copy(`Email Writer log · v${version}\n${logText()}`, "Log copied");
  });
  $("clear-log").addEventListener("click", async () => {
    await clearLog();
    setStatus("Log cleared.");
  });
  $("import").addEventListener("click", onImport);
  $("paste-reply").addEventListener("click", onPasteReply);
  $("copy-subject").addEventListener("click", () => copy($("out-subject").value, "Subject copied"));
  $("copy-body").addEventListener("click", () => copy($("out-body").value, "Body copied"));
  $("copy-vm").addEventListener("click", () => copy($("out-voicemail").value, "Voicemail copied"));
  $("copy-plan").addEventListener("click", () => lastPlan && copy(planToMarkdown(lastPlan), "Plan copied as Markdown"));
  ["out-subject", "out-body", "out-voicemail"].forEach((id) => $(id).addEventListener("input", runChecks));
  $("p-exec").addEventListener("change", runChecks);
  $("call-outcome").addEventListener("change", runChecks);
  $("write-all").addEventListener("click", onWriteAll);
}

function saveDraft() {
  const draft = Object.fromEntries(FORM_IDS.map((id) => [id, getVal($(id))]));
  chrome.storage.session.set({ draft }).catch(() => {});
}
const getVal = (el) => (el.type === "checkbox" ? el.checked : el.value);
const setVal = (el, v) => (el.type === "checkbox" ? (el.checked = v) : (el.value = v));

const currentStep = () => STEPS.find((s) => s.id === $("step").value) || STEPS[0];
const currentSequence = () => settings.sequences.find((s) => s.id === $("sequence").value) || settings.sequences[0];

function showMode() {
  const plan = $("mode").value === "plan";
  $("step-wrap").hidden = plan;
  $("history-wrap").hidden = plan;
  const via = useClaudeTab() ? " in Claude" : "";
  $("generate").textContent = (plan ? "Build full plan" : "Write email") + via;
  $("result").hidden = plan || !draftStep;
  $("plan").hidden = !plan || !lastPlan;
}

function showGuide() {
  const step = currentStep();
  const bits = [
    step.day ? `Day ${step.day}` : "Anytime",
    step.thread === "reply" ? "reply in same thread" : "new thread",
    step.tripleTouch ? "Triple Touch: call → (voicemail) → email" : null,
  ];
  $("step-guide").textContent = bits.filter(Boolean).join(" · ");
  $("outcome-wrap").hidden = !step.tripleTouch;
}

const field = (label, v) => `${label}: ${v && String(v).trim() ? String(v).trim() : "(not provided)"}`;

// Sequence and sender details shared by every prompt.
function sequenceBlock({ assets }) {
  const seq = currentSequence();
  return [
    `SEQUENCE`,
    field("Sequence name", seq.name),
    field("Persona track", seq.persona),
    field("Pain A", seq.problem1),
    field("Pain B", seq.problem2),
    field("What we do about it", seq.solution),
    field("Approved proof points", seq.proof),
    assets ? field("Asset that may be offered (max one)", seq.asset) : `Assets: none on this step.`,
    `CTA style: ${CTA_STYLES[seq.cta] || CTA_STYLES.interest}`,
    ``,
    `SENDER`,
    field("Name", settings.senderName),
    field("Company", settings.senderCompany),
    ``,
    `TRIPLE TOUCH\n${settings.tripleT}\n`,
    settings.extraRules?.trim() ? `ADDITIONAL HOUSE RULES\n${settings.extraRules.trim()}\n` : ``,
  ].join("\n");
}

function prospectBlock({ exec }) {
  return [
    `PROSPECT`,
    field("First name", $("p-name").value),
    field("Title", $("p-title").value),
    field("Company", $("p-company").value),
    field("Industry", $("p-industry").value),
    `Existing relationship: ${RELATIONSHIPS[$("p-relationship").value]}`,
    `Executive: ${exec ? "yes, so keep emails ≤50 words" : "no"}`,
    field("Triggers", $("p-trigger").value),
    field("Colleague intel (for snowball / reverse selling)", $("p-intel").value),
    field("Email address", $("p-email").value),
    field("Extra page context (may be noisy; use only relevant facts)", $("p-context").value.slice(0, 4000)),
    $("ot-text").value.trim()
      ? `\nOUTREACH TASK TEXT (from the Outreach task for this prospect; may include details, the step and earlier emails sent. Use it to fill gaps and treat emails already sent as history. Ignore UI text and anyone else listed.)\n${$("ot-text").value.slice(0, 12000)}`
      : ``,
    ``,
  ].join("\n");
}

function contextBlock({ exec, assets }) {
  return `${sequenceBlock({ assets })}\n${prospectBlock({ exec })}`;
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
    $("ot-body").value.trim() || $("ot-subject").value.trim()
      ? `EXISTING EMAIL IN THIS OUTREACH STEP (rewrite it to follow the playbook; keep anything specific and true; keep Outreach variables like {{first_name}} exactly as written)\nSubject: ${$("ot-subject").value.trim() || "(none)"}\n${$("ot-body").value.trim()}`
      : ``,
    ``,
    step.thread === "reply"
      ? `This step replies in the existing thread, so return subject as an empty string.`
      : `Return a new subject line.`,
    step.tripleTouch ? callOutcomeInstruction($("call-outcome").value) : ``,
    step.tripleTouch ? `Return the voicemail script too (ready in case I leave one).` : `Return voicemail as an empty string.`,
  ].join("\n");
}

const useClaudeTab = () => settings.engine !== "api";

async function run(schema, userPrompt, label) {
  if (!settings.apiKey) throw new Error("Add your API key in Settings, or switch to the Claude tab engine.");
  setStatus(label);
  return callClaude({
    apiKey: settings.apiKey,
    model: settings.model,
    systemPrompt: buildSystemPrompt(settings),
    playbook: settings.playbook,
    userPrompt,
    schema,
    webSearch: settings.findProof !== false,
  });
}

// No-API-key path: open Claude in a new tab with the full prompt pasted into
// the message box. You press Enter, then pull the reply back with the button.
async function openInClaude(kind, schema, userPrompt, { autoSend = false } = {}) {
  const text = buildClaudeTabPrompt({
    systemPrompt: buildSystemPrompt(settings),
    playbook: settings.includePlaybook === false ? "" : settings.playbook,
    userPrompt,
    schema,
  });
  await navigator.clipboard.writeText(text).catch(() => {});
  const tab = await chrome.tabs.create({ url: settings.claudeUrl || "https://claude.ai/new" });
  pending = { kind, stepId: $("step").value, tabId: tab.id };
  chrome.storage.session.set({ pending }).catch(() => {});
  $("reply-wrap").hidden = false;
  setStatus("Opening Claude…");

  // The message box renders after the page loads, so retry for ~20 seconds.
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const [{ result }] = await exec({ target: { tabId: tab.id }, func: pasteIntoClaude, args: [text] });
      if (result) {
        if (autoSend) {
          await new Promise((r) => setTimeout(r, 400));
          const [{ result: sent }] = await exec({ target: { tabId: tab.id }, func: submitClaude });
          if (sent) return { tabId: tab.id, sent: true };
        }
        setStatus("Prompt is in Claude. Press Enter there. When Claude finishes, click “Get reply from Claude tab”.");
        return { tabId: tab.id, sent: false };
      }
    } catch {
      // Tab still loading or not on claude.ai yet (e.g. a login page).
    }
  }
  setStatus("Couldn't paste automatically. The prompt is on your clipboard: paste it into Claude (Ctrl/Cmd+V) and send.", true);
  return { tabId: tab.id, sent: false };
}

// Polls the Claude tab until a complete reply of the right shape appears and
// stops changing (Claude has finished writing).
async function waitForClaudeReply(tabId, kind, timeoutMs = 240000) {
  let last = "";
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const [{ result }] = await exec({ target: { tabId }, func: readClaudeReply });
      const obj = (result || []).flatMap(extractAllJson).find((o) => replyFits(o, kind));
      if (obj) {
        const key = JSON.stringify(obj);
        if (key === last) return obj;
        last = key;
      }
    } catch {
      // tab busy or navigating; keep waiting
    }
  }
  throw new Error("Claude didn't finish within 4 minutes. When it's done, click “Get reply from Claude tab”.");
}

// The page also shows the prompt (with its schema), so only accept a reply
// shaped like the thing we asked for.
const replyFits = (obj, kind) =>
  kind === "plan"
    ? Array.isArray(obj?.sequence) && typeof obj?.triple_touch_1 === "object" && !obj.properties
    : kind === "batch"
      ? Array.isArray(obj?.emails) && !obj.properties
      : typeof obj?.body === "string";

function applyReply(obj) {
  if (!pending) throw new Error("Nothing is waiting on a reply. Click the button to open Claude first.");
  if (!replyFits(obj, pending.kind)) {
    throw new Error(`That reply isn't ${{ plan: "a full plan", batch: "a set of emails" }[pending.kind] || "an email draft"}. Check you copied the right message.`);
  }
  // Pulling the same reply twice shouldn't add it to the history twice. A
  // revised reply from the same tab (e.g. "make it shorter") loads normally.
  const key = JSON.stringify(obj);
  if (key === pending.lastApplied) {
    setStatus("That reply is already loaded.");
    return;
  }
  pending.lastApplied = key;
  chrome.storage.session.set({ pending }).catch(() => {});
  if (pending.kind === "plan") {
    applyPlan(obj);
  } else if (pending.kind === "batch") {
    throw new Error("Unexpected reply type.");
  } else {
    $("step").value = pending.stepId;
    applyEmail({ angle: "", subject: "", voicemail: "", flags: [], ...obj });
  }
  setStatus("Loaded Claude's reply.");
}

async function onFetchReply() {
  try {
    if (!pending?.tabId) throw new Error("Open Claude from the panel first.");
    const [{ result }] = await exec({ target: { tabId: pending.tabId }, func: readClaudeReply });
    if (pending.kind === "run" || pending.kind === "runbatch") return applyTextReply((result || []).at(-1) || "");
    const obj = (result || []).flatMap(extractAllJson).find((o) => replyFits(o, pending.kind));
    if (!obj) throw new Error("No finished reply found yet. Wait for Claude to finish, or copy the reply and use Paste.");
    applyReply(obj);
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function onPasteReply() {
  try {
    const text = $("reply-text").value.trim() || (await navigator.clipboard.readText());
    if (pending?.kind === "run" || pending?.kind === "runbatch") {
      applyTextReply(text);
      $("reply-text").value = "";
      return;
    }
    const obj = extractAllJson(text).find((o) => replyFits(o, pending?.kind)) || extractJson(text);
    if (!obj) throw new Error("Couldn't find the JSON in that text. Copy Claude's whole reply and try again.");
    applyReply(obj);
    $("reply-text").value = "";
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function withButton(fn) {
  const btn = $("generate");
  btn.disabled = true;
  try {
    await fn();
    if (!useClaudeTab()) setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

function onGenerate() {
  if (useClaudeTab()) return withButton(() => openInClaude("email", OUTPUT_SCHEMA, buildEmailPrompt()));
  return withButton(async () => applyEmail(await run(OUTPUT_SCHEMA, buildEmailPrompt(), "Writing…")));
}

function applyEmail(out) {
  draftStep = currentStep();
  $("angle").textContent = out.angle ? `Angle: ${out.angle}` : "";
  $("out-subject").value = out.subject || "";
  $("out-body").value = out.body || "";
  $("out-voicemail").value = out.voicemail || "";
  $("vm-wrap").hidden = !draftStep.tripleTouch;
  const flags = out.flags || [];
  $("flags").innerHTML = flags.map((f) => `<li class="warn">⚑ ${escapeHtml(f)}</li>`).join("");
  $("flags-wrap").hidden = !flags.length;
  $("proof").innerHTML = proofHtml(out.proof_source);
  $("result").hidden = false;
  runChecks();
  appendHistory(out);
}

// Customer-proof source link, so you can check the fact before sending.
function proofHtml(url) {
  if (!url?.trim()) return "";
  const safe = /^https?:\/\//i.test(url.trim()) ? url.trim() : "";
  return safe
    ? `Proof source: <a href="${escapeHtml(safe)}" target="_blank" rel="noopener">${escapeHtml(safe)}</a> (check the fact before sending)`
    : `Proof source: ${escapeHtml(url)}`;
}

function onPlan() {
  const prompt = [PLAN_GUIDE, ``, callOutcomeInstruction($("call-outcome").value), ``, contextBlock({ exec: $("p-exec").checked, assets: true })].join("\n");
  if (useClaudeTab()) return withButton(() => openInClaude("plan", PLAN_SCHEMA, prompt));
  return withButton(async () => applyPlan(await run(PLAN_SCHEMA, prompt, "Building the full plan (this can take a minute)…")));
}

function applyPlan(plan) {
  lastPlan = plan;
  renderPlan(plan);
  $("plan").hidden = false;
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
  $("ot-wrap").hidden = true;
  batch = [];
  pageRows = [];
  chrome.storage.session.remove(["batch", "pageRows"]).catch(() => {});
  renderRows();
  renderBatch();
  draftStep = undefined;
  lastPlan = undefined;
  showGuide();
  saveDraft();
  setStatus("Cleared. Ready for the next prospect.");
}

function checksHtml(step, subject, body, voicemail, exec = $("p-exec").checked) {
  const { issues, warnings, passes } = checkCompliance(step, {
    subject, body, voicemail, exec, senderCompany: settings.senderCompany, callOutcome: $("call-outcome").value,
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
    const [{ result }] = await exec({ target: { tabId: await activeTabId() }, func: readPage });
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
async function insertEmail(subject, body, targetTabId) {
  try {
    const tabId = targetTabId ?? (await activeTabId());
    const probes = await exec({ target: { tabId, allFrames: true }, func: probeFrame });
    const ok = probes.filter((p) => p.result);
    const bodyFrame =
      ok.find((p) => p.result.focusedEditor) ||
      ok.filter((p) => p.result.editorArea > 0).sort((a, b) => b.result.editorArea - a.result.editorArea)[0];
    const subjFrame = ok.find((p) => p.result.hasSubject && p.result.isTop) || ok.find((p) => p.result.hasSubject);

    const done = [];
    if (subject && subjFrame) {
      const [{ result }] = await exec({
        target: { tabId, frameIds: [subjFrame.frameId] }, func: fillSubject, args: [subject],
      });
      if (result) done.push("subject");
    }
    if (bodyFrame) {
      const [{ result }] = await exec({
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
    return done.includes("body");
  } catch (err) {
    setStatus(`Couldn't insert (${err.message}). Use the Copy buttons.`, true);
    return false;
  }
}

// ---- Outreach task import + one-click flow ----

const isOutreach = (url) => /^https:\/\/[^/]*outreach\.io\//.test(url || "");

// Clears the previous prospect so nothing stale leaks into the next email.
function clearProspect() {
  PROSPECT_IDS.forEach((id) => setVal($(id), $(id).type === "checkbox" ? false : ""));
  $("p-relationship").value = "net-new";
  $("result").hidden = true;
  draftStep = undefined;
}

// Fills the form from one Outreach prospect (a task row or an open task).
function useProspect(t) {
  clearProspect();
  $("p-name").value = t.firstName || "";
  $("p-title").value = t.title || "";
  $("p-company").value = t.company || "";
  $("p-email").value = t.email || "";
  if (/\bchief\b|\bc[a-z]{1,2}o\b/i.test(t.title || "")) $("p-exec").checked = true;
  const seq = matchSequence(settings.sequences, t.sequence);
  if (seq) $("sequence").value = seq.id;
  const stepId = t.stepId || mapOutreachStep(currentSequence(), t.stepNumber);
  if (stepId) $("step").value = stepId;
  $("mode").value = "email";
  $("ot-subject").value = t.subject || "";
  $("ot-body").value = t.body || "";
  $("ot-text").value = t.text || "";
  const found = [
    t.fullName && `name: ${t.fullName}`,
    t.email && `email: ${t.email}`,
    t.title && `title: ${t.title}`,
    t.company && `company: ${t.company}${t.companyGuessed ? " (guessed from email domain)" : ""}`,
    t.stepNumber && `Outreach step ${t.stepNumber}${t.sequence ? ` of ${t.sequence}` : ""}`,
    stepId ? `writing: ${currentStep().label}` : "step not mapped: pick it above, or add a step map in Settings",
    t.body ? "existing email found" : "",
  ].filter(Boolean);
  $("ot-summary").value = found.join(" · ");
  $("ot-wrap").hidden = false;
  showMode();
  showGuide();
  saveDraft();
}

async function readOutreach() {
  const tabId = await activeTabId();
  const tab = await chrome.tabs.get(tabId);
  if (!isOutreach(tab.url)) throw new Error("Open Outreach (a task, or your task list) first, then click this again.");
  const frames = (await exec({ target: { tabId, allFrames: true }, func: readOutreachTask }))
    .map((r) => r.result)
    .filter(Boolean);
  outreachTabId = tabId;
  const t = parseTask(frames, { senderCompany: settings.senderCompany });
  log("info", "outreach: read page", {
    url: tab.url,
    frames: frames.length,
    rowsFound: t.rows.length,
    rows: t.rows.map((r) => ({ name: r.fullName, title: r.title, company: r.company, step: r.stepNumber, sequence: r.sequence, link: r.url })),
    single: t.single && { name: t.single.fullName, title: t.single.title, company: t.single.company, email: t.single.email, step: t.single.stepNumber, link: t.single.url, hasDraftInTask: Boolean(t.single.body) },
    labels: frames.map((f) => f.labels),
  });
  return t;
}

// One prospect → fill the form. Several (e.g. the task list) → show a picker.
async function importOutreachTask() {
  const t = await readOutreach();
  pageRows = t.rows;
  chrome.storage.session.set({ pageRows }).catch(() => {});
  renderRows();
  if (t.single) {
    useProspect(t.single);
    return t.single;
  }
  if (!t.rows.length) throw new Error("Couldn't find a prospect on this Outreach page. Open the prospect's email task and try again.");
  return null;
}

async function onImport() {
  try {
    const one = await importOutreachTask();
    setStatus(one
      ? `Imported ${one.fullName || "the prospect"}. Check the fields, then write the email.`
      : `Found ${pageRows.length} prospects on this page. Pick one below, or write them all at once.`);
  } catch (err) {
    setStatus(err.message, true);
  }
}

function renderRows() {
  $("rows-wrap").hidden = pageRows.length < 2;
  $("write-all").textContent = `Write all ${pageRows.length}`;
  $("rows").innerHTML = pageRows
    .map((r, i) => `<div class="card">
      <h3>${escapeHtml(r.fullName)}</h3>
      <p class="meta">${escapeHtml([r.title, r.company].filter(Boolean).join(" · "))}${r.stepNumber ? ` · Step ${r.stepNumber}` : ""}${r.taskType ? ` · ${escapeHtml(r.taskType)}` : ""}</p>
      <button class="secondary" data-row="${i}">Write email</button>
    </div>`)
    .join("");
  $("rows").querySelectorAll("button[data-row]").forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true;
      resetProgress();
      stopRequested = false;
      $("stop-run").hidden = false;
      logRunStart(`row: ${pageRows[Number(b.dataset.row)].fullName}`);
      try {
        await runForProspect(pageRows[Number(b.dataset.row)]);
      } catch (err) {
        failRun(err);
      } finally {
        b.disabled = false;
        $("stop-run").hidden = true;
      }
    })
  );
}

// ---- One click: Outreach → past emails → Claude → email ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// executeScript with a time limit: a frame that never finishes loading would
// otherwise leave the call (and the whole run) hanging forever.
function exec(opts, ms = 10000) {
  return Promise.race([
    chrome.scripting.executeScript(opts),
    sleep(ms).then(() => {
      throw new Error(`page didn't respond within ${ms / 1000}s`);
    }),
  ]);
}

let stopRequested = false;
function checkStop() {
  if (stopRequested) throw new Error("Stopped.");
}
const isProspectUrl = (url) => /\/prospects\/\d+/.test(url || "");
const tidy = (t, max) => (t || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

const STAGES = [
  ["outreach", "Read the prospect from Outreach"],
  ["history", "Find what you've already sent them"],
  ["claude", "Claude writes the email"],
  ["insert", "Put it in the Outreach task"],
];
function progress(key, state, note = "") {
  const ol = $("progress");
  if (!ol.children.length) {
    ol.innerHTML = STAGES.map(([k, label]) => `<li data-k="${k}">${escapeHtml(label)}<span class="note"></span></li>`).join("");
  }
  ol.hidden = false;
  const li = ol.querySelector(`li[data-k="${key}"]`);
  li.className = state;
  li.querySelector(".note").textContent = note ? ` — ${note}` : "";
}
function resetProgress() {
  $("progress").innerHTML = "";
}

async function waitTabComplete(tabId, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return;
    if (tab.status === "complete") return;
    await sleep(300);
  }
}

async function tabText(tabId) {
  const res = await exec({ target: { tabId, allFrames: true }, func: readFrameText }).catch(() => []);
  return res.map((r) => r.result?.text || "").filter(Boolean).join("\n");
}

// Opens a page in a background tab, waits for the app to render (and opens
// its Activity tab if it has one), reads the text, then closes the tab.
async function readInBackground(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  log("info", "history: opened background tab", { tabId: tab.id, url });
  try {
    await waitTabComplete(tab.id);
    const loaded = await chrome.tabs.get(tab.id).catch(() => null);
    log("info", "history: tab loaded", { url: loaded?.url, status: loaded?.status, title: loaded?.title });
    let text = "";
    let last = -1;
    for (let i = 0; i < 14; i++) {
      checkStop();
      await sleep(1000);
      if (i === 2) {
        const clicked = await exec({ target: { tabId: tab.id, allFrames: true }, func: openActivityTab }).catch((e) => (log("warn", "history: activity click failed", { error: e.message }), []));
        log("info", "history: activity tab click", { clicked: clicked.some((r) => r.result) });
      }
      text = await tabText(tab.id);
      log("info", `history: read ${i + 1}`, { chars: text.length });
      if (i > 3 && text.length > 300 && text.length === last) break;
      last = text.length;
    }
    log("info", "history: done", { chars: text.length, start: text.slice(0, 400), end: text.slice(-400) });
    return text;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// Salesforce: any open Salesforce tab that mentions this prospect.
async function readSalesforceTabs(p) {
  const tabs = await chrome.tabs.query({ url: ["https://*.force.com/*", "https://*.salesforce.com/*"] }).catch(() => []);
  const keys = [p.fullName, p.email].filter(Boolean).map((k) => k.toLowerCase());
  const found = [];
  for (const tab of tabs) {
    const text = await tabText(tab.id);
    const match = keys.some((k) => text.toLowerCase().includes(k));
    log("info", "salesforce: checked tab", { url: tab.url, chars: text.length, mentionsProspect: match });
    if (match) found.push(tidy(text, 6000));
  }
  if (!tabs.length) log("info", "salesforce: no Salesforce tabs open");
  return found.join("\n\n---\n\n");
}

// What we've already sent this person, from Outreach and (if open) Salesforce.
async function gatherHistory(p) {
  const parts = [];
  let outreachText = "";
  if (p.url && isOutreach(p.url)) outreachText = await readInBackground(p.url).catch(() => "");
  if (outreachText) parts.push(`FROM OUTREACH (${p.fullName}'s prospect record and activity):\n${tidy(outreachText, 10000)}`);
  if (p.text && p.text !== outreachText) parts.push(`FROM THE OUTREACH PAGE YOU HAD OPEN:\n${tidy(p.text, 4000)}`);
  const sf = await readSalesforceTabs(p);
  if (sf) parts.push(`FROM SALESFORCE (open tab):\n${sf}`);
  return { text: parts.join("\n\n"), outreach: Boolean(outreachText), salesforce: Boolean(sf) };
}

function stepFor(p) {
  const id = p.stepId || mapOutreachStep(currentSequence(), p.stepNumber);
  return STEPS.find((s) => s.id === id) || null;
}

// A short, readable brief: who, where they are in the sequence, what's been
// sent, how to make it pointed, and the reply format.
function buildRunPrompt(p, historyText, step) {
  const seq = currentSequence();
  const where = step
    ? `This is ${step.label}${p.stepNumber ? ` (Outreach: step ${p.stepNumber}${p.sequence ? ` of ${p.sequence}` : ""})` : ""}.\n${step.guide}`
    : `Outreach shows ${p.stepNumber ? `step ${p.stepNumber}${p.sequence ? ` of ${p.sequence}` : ""}` : "no step number"}. Work out which playbook step this is from what's already been sent (Day 1 Triple Touch email, Day 3 reply, Day 7 Triple Touch, Day 10 peer proof, Day 14 Triple Touch "wrong person?", Day 21 breakup) and write that one.`;
  const lines = [
    `Write the next email in my outbound sequence to ${p.fullName || "this prospect"}${p.title ? `, ${p.title}` : ""}${p.company ? ` at ${p.company}` : ""}.`,
    ``,
    `WHERE THEY ARE IN THE SEQUENCE`,
    where,
    ``,
    `CALL OUTCOME`,
    callOutcomeInstruction($("call-outcome").value) + ` (Applies only to Triple Touch steps.)`,
    ``,
    `WHAT I'VE ALREADY SENT THEM`,
    historyText
      ? `Below is what I could read from Outreach${/SALESFORCE/.test(historyText) ? " and Salesforce" : ""}. It includes page and menu text, so ignore anything that isn't about ${p.fullName || "this person"}. Don't repeat any subject, pain, angle or customer story already used. If they replied, answer that reply instead of continuing the sequence, and say so in NOTES.\n<<<\n${historyText}\n>>>`
      : `I couldn't read their history, so assume nothing has been sent yet unless the step says otherwise, and say so in NOTES.`,
    p.body ? `\nThe Outreach task already has this draft, which you should replace:\nSubject: ${p.subject || "(none)"}\n${p.body}` : ``,
    ``,
    `MAKE IT POINTED`,
    `- One specific observation about ${p.company || "their company"} or their role, one pain in their words, one real customer proof, one question. Under 90 words${/\bchief\b|\bc[a-z]{1,2}o\b/i.test(p.title || "") ? " (they're an executive, so under 50)" : ""}.`,
    `- If you can search the web, take a minute to find one recent, specific trigger about ${p.company || "the company"} (news, hiring, earnings, new leaders) and use it only if you verified it.`,
    `- Customer proof: use an approved one below if it fits; otherwise find a real, public ${settings.senderCompany || "company"} customer story that matches their industry or role and give its URL in PROOF. Never make one up.`,
    ``,
    `ABOUT ME`,
    `${settings.senderName || "(name not set)"} at ${settings.senderCompany || "(company not set)"}. Sign the email with my first name.`,
    seq.persona || seq.problem1 || seq.problem2 || seq.solution || seq.proof
      ? [
          ``,
          `MY SEQUENCE NOTES`,
          seq.persona && `Persona: ${seq.persona}`,
          seq.problem1 && `Pain A: ${seq.problem1}`,
          seq.problem2 && `Pain B: ${seq.problem2}`,
          seq.solution && `What we do about it: ${seq.solution}`,
          seq.proof && `Approved proof points: ${seq.proof}`,
          seq.asset && `Asset I can offer (mid-sequence only): ${seq.asset}`,
        ].filter(Boolean).join("\n")
      : ``,
    settings.extraRules?.trim() ? `\nHOUSE RULES\n${settings.extraRules.trim()}` : ``,
    ``,
    formatInstructions({ tripleTouch: !step || step.tripleTouch }),
  ];
  return lines.join("\n");
}

// System rules + playbook + brief, as one message for a Claude tab.
function claudeTabMessage(brief) {
  const rules = buildSystemPrompt(settings).replace(/\s*Return JSON only, matching the provided schema\.\s*$/, "");
  const playbook = settings.includePlaybook === false ? "" : settings.playbook?.trim();
  return [rules, playbook ? `\n=== MY PLAYBOOK ===\n${playbook}\n=== END PLAYBOOK ===` : "", `\n=== THIS EMAIL ===\n${brief}`].join("\n");
}

// Opens Claude, pastes the message, sends it, and confirms it went.
async function openClaudeWith(text) {
  await navigator.clipboard.writeText(text).catch(() => {});
  const tab = await chrome.tabs.create({ url: settings.claudeUrl || "https://claude.ai/new" });
  log("info", "claude: opened tab", { tabId: tab.id, url: settings.claudeUrl || "https://claude.ai/new", promptChars: text.length });
  for (let i = 0; i < 40; i++) {
    checkStop();
    await sleep(500);
    const [{ result: pasted } = {}] = await exec({ target: { tabId: tab.id }, func: pasteIntoClaude, args: [text] }).catch((e) => {
      if (i % 5 === 0) log("warn", `claude: paste attempt ${i + 1} failed`, { error: e.message });
      return [];
    });
    if (!pasted) continue;
    const t = await chrome.tabs.get(tab.id).catch(() => null);
    log("info", "claude: prompt pasted", { attempt: i + 1, url: t?.url, title: t?.title });
    if (settings.autoSend === false) return { tabId: tab.id, sent: false };
    // Send at most twice, and only retry if the whole message is still in the box,
    // so a slow page never gets the prompt twice.
    for (let attempt = 0; attempt < 2; attempt++) {
      await sleep(700);
      const [{ result: clicked } = {}] = await exec({ target: { tabId: tab.id }, func: submitClaude }).catch(() => []);
      log("info", `claude: send attempt ${attempt + 1}`, { sendTriggered: Boolean(clicked) });
      for (let w = 0; w < 8; w++) {
        await sleep(500);
        const [{ result: left } = {}] = await exec({ target: { tabId: tab.id }, func: claudeComposerText }).catch(() => []);
        if (left === "" || (typeof left === "string" && left.length < text.length * 0.5)) {
          log("info", "claude: message sent", { leftInBox: left?.length ?? null });
          return { tabId: tab.id, sent: true };
        }
        if (w === 7) log("warn", "claude: message still in the box", { leftInBox: left?.length ?? null });
      }
    }
    return { tabId: tab.id, sent: false };
  }
  const t = await chrome.tabs.get(tab.id).catch(() => null);
  log("error", "claude: couldn't paste after 20s", { url: t?.url, title: t?.title });
  return { tabId: tab.id, sent: false, pasteFailed: true };
}

// Polls the Claude tab until `count` finished emails are on the page and stop changing.
async function waitForEmails(tabId, count = 1, ms = 300000) {
  let last = "";
  let lastText = "";
  let unchanged = 0;
  const until = Date.now() + ms;
  for (let poll = 1; Date.now() < until; poll++) {
    checkStop();
    await sleep(2000);
    const [{ result } = {}] = await exec({ target: { tabId }, func: readClaudeReply }).catch((e) => {
      log("warn", `claude: read ${poll} failed`, { error: e.message });
      return [];
    });
    const text = (result || []).at(-1) || "";
    unchanged = text && text === lastText ? unchanged + 1 : 0;
    lastText = text;
    let emails = parseEmails(text);
    // Claude finished but skipped END: accept once the page stops changing.
    if (emails.length < count && unchanged >= 4) emails = parseEmails(text, { lenient: true });
    if (poll === 1 || poll % 5 === 0 || emails.length) {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      log("info", `claude: poll ${poll}`, { url: tab?.url, pageChars: text.length, unchangedPolls: unchanged, emailsFound: emails.length, pageEnd: text.slice(-500) });
    }
    if (emails.length >= count) {
      const key = JSON.stringify(emails);
      if (key === last || unchanged >= 4) {
        log("info", "claude: reply parsed", { emails: emails.length, lenient: unchanged >= 4 });
        return emails;
      }
      last = key;
    }
  }
  log("error", "claude: timed out waiting for the reply", { pageEnd: lastText.slice(-1500) });
  throw new Error("Claude didn't finish within 5 minutes. When it's done, click “Get reply from Claude tab”.");
}

// Sends a brief to Claude (tab or API) and returns the parsed emails.
async function askClaude(brief, count = 1, meta = {}) {
  if (!useClaudeTab()) {
    if (!settings.apiKey) throw new Error("Add your API key in Settings, or switch to the Claude tab engine.");
    const text = await callClaudeText({
      apiKey: settings.apiKey, model: settings.model, systemPrompt: buildSystemPrompt(settings).replace(/\s*Return JSON only, matching the provided schema\.\s*$/, ""),
      playbook: settings.playbook, userPrompt: brief, webSearch: settings.findProof !== false,
    });
    const emails = parseEmails(text).length >= count ? parseEmails(text) : parseEmails(text, { lenient: true });
    log("info", "api: reply", { chars: text.length, emailsFound: emails.length, end: text.slice(-500) });
    if (emails.length < count) throw new Error("Claude's reply wasn't in the expected format. Try again.");
    return emails;
  }
  const { tabId, sent, pasteFailed } = await openClaudeWith(claudeTabMessage(brief));
  pending = { kind: count > 1 ? "runbatch" : "run", tabId, count, ...meta };
  chrome.storage.session.set({ pending }).catch(() => {});
  $("reply-wrap").hidden = false;
  progress("claude", "active",
    pasteFailed ? "couldn't paste: the prompt is on your clipboard, paste it into Claude and send"
      : sent ? "writing…" : "press Enter in the Claude tab");
  return waitForEmails(tabId, count);
}

// Turns Claude's STEP line into one of our steps.
function resolveStep(known, email) {
  if (known) return known;
  const day = dayFromStep(email.step);
  if (day) return stepForDay(day) || [...STEPS].filter((s) => s.day && s.day <= day).at(-1) || STEPS[0];
  return STEPS[0];
}

function showEmail(p, email, step, historyText) {
  $("step").value = step.id;
  draftStep = step;
  const out = { ...email, subject: step.thread === "reply" ? "" : email.subject };
  $("angle").textContent = [p.fullName, p.title, p.company].filter(Boolean).join(" · ") + ` — ${step.label}`;
  $("out-subject").value = out.subject;
  $("out-subject").placeholder = step.thread === "reply" ? "Replies in the existing thread (no new subject)" : "";
  $("copy-subject").hidden = step.thread === "reply";
  $("reply-wrap").hidden = true;
  $("out-body").value = out.body;
  $("out-voicemail").value = out.voicemail;
  $("vm-wrap").hidden = !step.tripleTouch || !out.voicemail;
  $("flags").innerHTML = (out.flags || []).map((f) => `<li class="warn">⚑ ${escapeHtml(f)}</li>`).join("");
  $("flags-wrap").hidden = !(out.flags || []).length;
  $("proof").innerHTML = proofHtml(out.proof_source);
  $("history-used").textContent = historyText || "(nothing found)";
  $("history-used-wrap").hidden = false;
  $("result").hidden = false;
  runChecks();
  saveDraft();
  return out;
}

async function hasEditor(tabId) {
  const probes = await exec({ target: { tabId, allFrames: true }, func: probeFrame }).catch(() => []);
  return probes.some((r) => r.result?.editorArea > 0);
}

function rememberDraft(p, out, step) {
  batch = batch.filter((b) => !sameName(b.row.fullName, p.fullName));
  batch.push({ row: p, out, stepId: step.id });
  chrome.storage.session.set({ batch }).catch(() => {});
  renderBatch();
}

// The whole flow for one prospect.
async function runForProspect(p) {
  useProspect(p);
  progress("outreach", "done", [p.fullName, p.title, p.company].filter(Boolean).join(", "));

  // Reuse a draft already written for this person (e.g. from "Write all").
  const saved = batch.find((b) => sameName(b.row.fullName, p.fullName));
  let email, step, historyText = "";
  if (saved) {
    progress("history", "skip", "used the draft written earlier");
    progress("claude", "skip", "already written");
    email = saved.out;
    step = STEPS.find((s) => s.id === saved.stepId) || STEPS[0];
  } else {
    progress("history", "active", "reading Outreach" + (p.url ? "" : " (no prospect link found)") + "…");
    const h = await gatherHistory(p);
    historyText = h.text;
    $("ot-text").value = historyText;
    progress("history", h.outreach || h.salesforce ? "done" : "skip",
      [h.outreach && "Outreach record", h.salesforce && "Salesforce tab"].filter(Boolean).join(" + ") || "nothing found; Claude will treat this as the first touch");
    const known = stepFor(p);
    const brief = buildRunPrompt(p, historyText, known);
    log("info", "prompt built", { prospect: p.fullName, outreachStep: p.stepNumber, mappedStep: known?.id || "(Claude decides)", historyChars: historyText.length, briefChars: brief.length });
    progress("claude", "active", "opening Claude…");
    const [first] = await askClaude(brief, 1, { prospect: p, stepId: known?.id || "" });
    step = resolveStep(known, first);
    email = first;
    progress("claude", "done", step.label);
  }
  const out = showEmail(p, email, step, historyText);
  log("info", "email ready", { prospect: p.fullName, step: step.id, subject: out.subject, bodyWords: out.body.split(/\s+/).length, notes: out.flags, proof: out.proof_source });
  if (!saved) rememberDraft(p, out, step);

  // Back to Outreach; fill the task if its email editor is open.
  if (outreachTabId) {
    await chrome.tabs.update(outreachTabId, { active: true }).catch(() => {});
    const editor = await hasEditor(outreachTabId);
    log("info", "outreach: email editor open?", { editor });
    if (editor) {
      const ok = await insertEmail(out.subject, out.body, outreachTabId);
      log(ok ? "info" : "warn", "outreach: insert", { ok });
      progress("insert", ok ? "done" : "fail", ok ? "review it, then send" : "use Copy");
    } else {
      progress("insert", "skip", "no email task open; copy it, or open their task and click again");
    }
  }
  setStatus("Your email is ready below.");
}

function logRunStart(kind) {
  const { version } = chrome.runtime.getManifest();
  log("info", `run started: ${kind}`, {
    version,
    engine: settings.engine,
    claudeUrl: settings.claudeUrl,
    autoSend: settings.autoSend !== false,
    findProof: settings.findProof !== false,
    includePlaybook: settings.includePlaybook !== false,
    playbookChars: (settings.playbook || "").length,
    senderNameSet: Boolean(settings.senderName),
    senderCompany: settings.senderCompany,
    sequences: settings.sequences.map((q) => ({ name: q.name, outreachName: q.outreachName, stepMap: q.outreachSteps })),
    callOutcome: $("call-outcome").value,
  });
}

function startRunning(btn) {
  stopRequested = false;
  btn.disabled = true;
  $("stop-run").hidden = false;
}
function stopRunning(btn) {
  btn.disabled = false;
  $("stop-run").hidden = true;
}

function failRun(err) {
  const active = $("progress").querySelector("li.active");
  if (active) active.className = "fail";
  log(err.message === "Stopped." ? "warn" : "error", err.message === "Stopped." ? "run stopped by user" : "run failed", { error: err.message, stack: err.stack });
  setStatus(err.message === "Stopped." ? "Stopped." : `${err.message} (Open the log for details.)`, true);
}

async function onRun() {
  const btn = $("auto-run");
  startRunning(btn);
  resetProgress();
  logRunStart("single");
  try {
    progress("outreach", "active", "reading…");
    const t = await readOutreach();
    pageRows = t.rows;
    chrome.storage.session.set({ pageRows }).catch(() => {});
    renderRows();
    let p = t.single;
    // On a prospect's own page, that page is their record.
    const tab = await chrome.tabs.get(outreachTabId);
    if (p && !p.url && isProspectUrl(tab.url)) p = { ...p, url: tab.url };
    if (!p) {
      if (t.rows.length) {
        progress("outreach", "done", `${t.rows.length} prospects on this page`);
        setStatus("Pick who to write to below, or write them all at once.");
        $("rows-wrap").scrollIntoView({ behavior: "smooth" });
        return;
      }
      throw new Error("Couldn't find a prospect on this Outreach page. Open the prospect or their email task and try again.");
    }
    await runForProspect(p);
  } catch (err) {
    failRun(err);
  } finally {
    stopRunning(btn);
  }
}

// ---- Several prospects at once ----

async function onWriteAll() {
  const btn = $("write-all");
  startRunning(btn);
  resetProgress();
  logRunStart(`write all (${pageRows.length})`);
  try {
    const rows = pageRows;
    const seq = matchSequence(settings.sequences, rows[0]?.sequence);
    if (seq) $("sequence").value = seq.id;
    progress("outreach", "done", `${rows.length} prospects`);
    const histories = [];
    for (const [i, r] of rows.entries()) {
      checkStop();
      log("info", `history ${i + 1} of ${rows.length}`, { prospect: r.fullName, link: r.url });
      progress("history", "active", `${i + 1} of ${rows.length}: ${r.fullName}`);
      histories.push((await gatherHistory({ ...r, text: "" })).text);
    }
    progress("history", "done", `read ${histories.filter(Boolean).length} of ${rows.length} records`);
    const briefs = rows.map((r, i) => `----- PERSON ${i + 1} -----\n${buildRunPrompt(r, histories[i], stepFor(r)).split("\nReply in exactly this format")[0]}`);
    const brief = [
      `Write one email for EACH of the ${rows.length} people below. They work at the same account, so give each a different pain, angle and customer story.`,
      ``,
      ...briefs,
      ``,
      formatInstructions({ batch: true, tripleTouch: true }),
    ].join("\n");
    progress("claude", "active", "opening Claude…");
    const emails = await askClaude(brief, rows.length, { rows });
    const saved = saveBatchEmails(rows, emails);
    progress("claude", "done", `${saved} emails`);
    progress("insert", "skip", "open each person's task and click the top button");
    setStatus(`Wrote ${saved} emails. Open each person's task in Outreach and click the top button to drop theirs in.`);
    log("info", "write all done", { saved });
  } catch (err) {
    failRun(err);
  } finally {
    stopRunning(btn);
  }
}

// Saves one draft per person (the newest if Claude wrote more than one), and returns how many.
function saveBatchEmails(rows, emails) {
  let saved = 0;
  for (const [i, r] of rows.entries()) {
    const e = [...emails].reverse().find((x) => sameName(x.prospect, r.fullName)) || emails[i];
    if (!e) continue;
    const step = resolveStep(stepFor(r), e);
    rememberDraft(r, { ...e, subject: step.thread === "reply" ? "" : e.subject }, step);
    saved++;
  }
  return saved;
}

// "Get reply" / "Paste" for the plain-text format.
function applyTextReply(text) {
  const emails = parseEmails(text);
  if (!emails.length) throw new Error("No finished email found yet. Wait for Claude to finish (it ends with END), or copy its whole reply and use Paste.");
  if (pending.kind === "runbatch") {
    setStatus(`Loaded ${saveBatchEmails(pending.rows || [], emails)} emails.`);
    return;
  }
  const p = pending.prospect || {};
  const known = STEPS.find((s) => s.id === pending.stepId) || null;
  const email = emails.at(-1);
  const step = resolveStep(known, email);
  const out = showEmail(p, email, step, $("ot-text").value);
  if (p.fullName) rememberDraft(p, out, step);
  setStatus("Loaded Claude's reply.");
}

const sameName = (a, b) => (a || "").toLowerCase().replace(/\s+/g, " ").trim() === (b || "").toLowerCase().replace(/\s+/g, " ").trim();

function renderBatch() {
  // One draft is already shown above as "Your email"; list them once there are several.
  $("batch-wrap").hidden = batch.length < 2;
  $("batch").innerHTML = batch
    .map((b, i) => {
      const step = STEPS.find((s) => s.id === b.stepId) || STEPS[0];
      const exec = /\bchief\b|\bc[a-z]{1,2}o\b/i.test(b.row.title || "");
      return `<div class="card">
        <h3>${escapeHtml(b.row.fullName)}</h3>
        <p class="meta">${escapeHtml([b.row.title, b.row.company].filter(Boolean).join(" · "))} · ${escapeHtml(step.label)}</p>
        ${b.out.subject ? `<p class="label">Subject: ${escapeHtml(b.out.subject)}</p>` : `<p class="label">Reply in thread</p>`}
        <p class="text">${escapeHtml(b.out.body)}</p>
        ${b.out.proof_source ? `<p class="meta">${proofHtml(b.out.proof_source)}</p>` : ""}
        ${(b.out.flags || []).length ? `<ul>${b.out.flags.map((f) => `<li class="warn">⚑ ${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
        <div class="row">
          ${b.out.subject ? `<button class="secondary" data-b="${i}" data-act="subj">Copy subject</button>` : ""}
          <button class="secondary" data-b="${i}" data-act="body">Copy body</button>
          <button class="secondary" data-b="${i}" data-act="insert">Insert into open task</button>
        </div>
        <details><summary>Playbook check</summary><ul class="checks">${checksHtml(step, b.out.subject, b.out.body, b.out.voicemail, exec)}</ul></details>
      </div>`;
    })
    .join("");
  $("batch").querySelectorAll("button[data-b]").forEach((btn) => {
    const b = batch[Number(btn.dataset.b)];
    btn.addEventListener("click", () => {
      if (btn.dataset.act === "subj") copy(b.out.subject, "Subject copied");
      else if (btn.dataset.act === "body") copy(b.out.body, "Body copied");
      else insertEmail(b.out.subject, b.out.body);
    });
  });
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
