import { STEPS, CTA_STYLES, checkCompliance } from "./methodology.js";
import { loadSettings } from "./storage.js";
import { generateEmail } from "./api.js";

const $ = (id) => document.getElementById(id);
let settings;
let draftStep; // step that produced the current draft

async function renderSettings() {
  settings = await loadSettings();
  $("setup-warning").hidden = Boolean(settings.apiKey);
  const selected = $("sequence").value;
  $("sequence").innerHTML = settings.sequences
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");
  if (settings.sequences.some((s) => s.id === selected)) $("sequence").value = selected;
}

async function init() {
  await renderSettings();
  $("step").innerHTML = STEPS.map(
    (s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`
  ).join("");

  // Restore the draft form per-viewer so switching tabs doesn't lose it.
  const { draft } = await chrome.storage.session.get("draft").catch(() => ({}));
  if (draft) for (const [k, v] of Object.entries(draft)) if ($(k)) setVal($(k), v);

  showGuide();
  $("step").addEventListener("change", showGuide);
  document.querySelectorAll("input, textarea, select").forEach((el) =>
    el.addEventListener("change", saveDraft)
  );
  $("generate").addEventListener("click", onGenerate);
  $("grab").addEventListener("click", onGrab);
  $("insert").addEventListener("click", onInsert);
  $("copy-subject").addEventListener("click", () => copy($("out-subject").value, "Subject copied"));
  $("copy-body").addEventListener("click", () => copy($("out-body").value, "Body copied"));
  $("out-subject").addEventListener("input", runChecks);
  $("out-body").addEventListener("input", runChecks);
}

const FORM_IDS = ["sequence", "step", "triple", "p-name", "p-title", "p-company", "p-trigger", "p-ps", "p-context", "history"];
function saveDraft() {
  const draft = Object.fromEntries(FORM_IDS.map((id) => [id, getVal($(id))]));
  chrome.storage.session.set({ draft }).catch(() => {});
}
const getVal = (el) => (el.type === "checkbox" ? el.checked : el.value);
const setVal = (el, v) => (el.type === "checkbox" ? (el.checked = v) : (el.value = v));

function currentStep() {
  return STEPS.find((s) => s.id === $("step").value);
}
function currentSequence() {
  return settings.sequences.find((s) => s.id === $("sequence").value) || settings.sequences[0];
}

function showGuide() {
  const step = currentStep();
  $("step-guide").textContent = `${step.phase} · ${step.subject === "reply" ? "reply on same thread" : "new subject"}`;
}

function buildPrompt() {
  const step = currentStep();
  const seq = currentSequence();
  const field = (label, v) => (v && String(v).trim() ? `${label}: ${String(v).trim()}` : `${label}: (not provided)`);

  return [
    `Write ${step.label} of a 30MPC-style outbound sequence.`,
    ``,
    `STEP GUIDE`,
    step.guide,
    ``,
    `SEQUENCE`,
    field("Sequence name", seq.name),
    field("Target persona", seq.persona),
    field("Biggest problem we solve (#1)", seq.problem1),
    field("Second biggest problem (#2)", seq.problem2),
    field("How we solve it (for the Notice line)", seq.solution),
    field("Proof points (use only these, verbatim facts)", seq.proof),
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
    field("Research trigger", $("p-trigger").value),
    field("P.S. nugget", $("p-ps").value),
    field("Extra page context (may be noisy; use only relevant facts)", $("p-context").value.slice(0, 4000)),
    ``,
    `EARLIER EMAILS IN THIS SEQUENCE (do not repeat their wording)`,
    $("history").value.trim() || "(none)",
    ``,
    $("triple").checked ? `TRIPLE T (apply to this email)\n${settings.tripleT}\n` : ``,
    settings.extraRules?.trim() ? `ADDITIONAL HOUSE RULES\n${settings.extraRules.trim()}\n` : ``,
    step.subject === "reply"
      ? `This step is a reply on the existing thread: return subject as an empty string.`
      : `Return a new subject line.`,
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
      userPrompt: buildPrompt(),
    });
    draftStep = currentStep();
    $("out-subject").value = out.subject || "";
    $("out-body").value = out.body || "";
    $("rationale").textContent = out.rationale || "";
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
  if (idx < STEPS.length - 1) $("step").value = STEPS[idx + 1].id;
  showGuide();
  saveDraft();
}

function runChecks() {
  const { issues, passes } = checkCompliance(draftStep || currentStep(), $("out-subject").value.trim(), $("out-body").value);
  $("checks").innerHTML =
    issues.map((i) => `<li class="bad">✗ ${escapeHtml(i)}</li>`).join("") +
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
    setStatus(result.length ? `Inserted ${result.join(" + ")}. Review before sending.` : "No editor found — use the Copy buttons.", !result.length);
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
