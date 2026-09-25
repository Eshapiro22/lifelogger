import { STEPS, CTA_STYLES, RELATIONSHIPS, buildSystemPrompt, checkCompliance } from "./methodology.js";
import { loadSettings } from "./storage.js";
import { generateEmail } from "./api.js";

const $ = (id) => document.getElementById(id);
let settings;
let draftStep; // step that produced the current draft

const FORM_IDS = [
  "sequence", "step", "p-name", "p-title", "p-company", "p-industry", "p-relationship",
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

  showGuide();
  $("step").addEventListener("change", showGuide);
  $("p-title").addEventListener("change", () => {
    if (/\bchief\b|\bc[a-z]{1,2}o\b/i.test($("p-title").value)) $("p-exec").checked = true;
  });
  document.querySelectorAll("input, textarea, select").forEach((el) => el.addEventListener("change", saveDraft));
  $("generate").addEventListener("click", onGenerate);
  $("grab").addEventListener("click", onGrab);
  $("insert").addEventListener("click", onInsert);
  $("reset").addEventListener("click", onReset);
  $("copy-subject").addEventListener("click", () => copy($("out-subject").value, "Subject copied"));
  $("copy-body").addEventListener("click", () => copy($("out-body").value, "Body copied"));
  $("copy-vm").addEventListener("click", () => copy($("out-voicemail").value, "Voicemail copied"));
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

function showGuide() {
  const step = currentStep();
  const bits = [
    step.day ? `Day ${step.day}` : "Anytime",
    step.thread === "reply" ? "reply in same thread" : "new thread",
    step.tripleTouch ? "Triple Touch: call → voicemail → email" : null,
  ];
  $("step-guide").textContent = bits.filter(Boolean).join(" · ");
}

function buildPrompt() {
  const step = currentStep();
  const seq = currentSequence();
  const field = (label, v) => `${label}: ${v && String(v).trim() ? String(v).trim() : "(not provided)"}`;

  return [
    `Write this email step: ${step.label}.`,
    ``,
    `STEP GUIDE`,
    step.guide,
    ``,
    `SEQUENCE`,
    field("Sequence name", seq.name),
    field("Persona track", seq.persona),
    field("Pain A", seq.problem1),
    field("Pain B", seq.problem2),
    field("What we do about it", seq.solution),
    field("Approved proof points (use only these)", seq.proof),
    step.assetsAllowed ? field("Asset that may be offered (max one)", seq.asset) : `Assets: none on this step.`,
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
    `Executive: ${$("p-exec").checked || step.exec ? "yes, so keep the body ≤50 words" : "no"}`,
    field("Triggers", $("p-trigger").value),
    field("Colleague intel (for snowball / reverse selling)", $("p-intel").value),
    field("Extra page context (may be noisy; use only relevant facts)", $("p-context").value.slice(0, 4000)),
    ``,
    `EARLIER EMAILS TO THIS PROSPECT (change the angle; don't repeat their wording)`,
    $("history").value.trim() || "(none)",
    ``,
    step.tripleTouch ? `TRIPLE TOUCH\n${settings.tripleT}\n` : ``,
    settings.extraRules?.trim() ? `ADDITIONAL HOUSE RULES\n${settings.extraRules.trim()}\n` : ``,
    step.thread === "reply"
      ? `This step replies in the existing thread, so return subject as an empty string.`
      : `Return a new subject line.`,
    step.tripleTouch ? `Return the matching voicemail.` : `Return voicemail as an empty string.`,
  ].join("\n");
}

async function onGenerate() {
  if (!settings.apiKey) {
    setStatus("Add your API key in Settings first.", true);
    return;
  }
  const btn = $("generate");
  btn.disabled = true;
  setStatus("Writing…");
  try {
    const out = await generateEmail({
      apiKey: settings.apiKey,
      model: settings.model,
      systemPrompt: buildSystemPrompt(settings),
      playbook: settings.playbook,
      userPrompt: buildPrompt(),
    });
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
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    btn.disabled = false;
  }
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
  draftStep = undefined;
  showGuide();
  saveDraft();
  setStatus("Cleared. Ready for the next prospect.");
}

function runChecks() {
  if (!draftStep) return;
  const { issues, warnings, passes } = checkCompliance(draftStep, {
    subject: $("out-subject").value.trim(),
    body: $("out-body").value,
    voicemail: $("out-voicemail").value,
    exec: $("p-exec").checked,
    senderCompany: settings.senderCompany,
  });
  $("checks").innerHTML =
    issues.map((i) => `<li class="bad">✗ ${escapeHtml(i)}</li>`).join("") +
    warnings.map((w) => `<li class="warn">! ${escapeHtml(w)}</li>`).join("") +
    passes.map((p) => `<li class="good">✓ ${escapeHtml(p)}</li>`).join("");
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function onGrab() {
  try {
    const tabId = await activeTabId();
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const sel = window.getSelection()?.toString().trim();
        return sel || document.body.innerText.slice(0, 6000);
      },
    });
    $("p-context").value = result || "";
    saveDraft();
    setStatus("Pulled text from the page. Trim anything irrelevant.");
  } catch (err) {
    setStatus(`Couldn't read this page (${err.message}). Chrome blocks some pages, like the Web Store.`, true);
  }
}

// Best-effort: fills the first visible subject field and the focused (or first)
// rich-text/textarea body editor on the page. Selectors are generic because
// each email tool's markup differs and changes over time.
async function onInsert() {
  try {
    const tabId = await activeTabId();
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      args: [$("out-subject").value, $("out-body").value],
      func: (subject, body) => {
        const visible = (el) => el && el.offsetParent !== null;
        const report = [];
        const subj = [...document.querySelectorAll("input")].find(
          (el) => visible(el) && /subject/i.test(`${el.name} ${el.placeholder} ${el.getAttribute("aria-label")} ${el.id}`)
        );
        if (subject && subj) {
          subj.focus();
          subj.value = subject;
          subj.dispatchEvent(new Event("input", { bubbles: true }));
          report.push("subject");
        }
        const active = document.activeElement;
        const editor =
          (active && (active.isContentEditable || active.tagName === "TEXTAREA") && active !== subj && active) ||
          [...document.querySelectorAll('[contenteditable="true"], textarea')].find(visible);
        if (editor) {
          editor.focus();
          if (editor.tagName === "TEXTAREA") {
            editor.value = body;
            editor.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            editor.innerHTML = body
              .split(/\n{2,}/)
              .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
              .join("");
            editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
          }
          report.push("body");
        }
        return report;
      },
    });
    setStatus(result.length ? `Inserted ${result.join(" + ")}. Review before sending.` : "No editor found. Use the Copy buttons.", !result.length);
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
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) renderSettings();
});

init();
