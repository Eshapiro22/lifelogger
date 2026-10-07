import { LOG_KEY, logText } from "./logger.js";

const $ = (id) => document.getElementById(id);
let entries = [];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function render() {
  const stored = await chrome.storage.session.get(LOG_KEY).catch(() => ({}));
  entries = stored[LOG_KEY] || [];
  const { version } = chrome.runtime.getManifest();
  $("meta").textContent = `Extension v${version} · ${entries.length} entries · generated ${new Date().toLocaleString()} · ${navigator.userAgent}`;
  $("entries").innerHTML = entries.length
    ? entries
        .map((e) => `<div class="entry ${esc(e.level)}">
          <div class="head">${esc(e.t.replace("T", " ").replace("Z", ""))} · ${esc(e.level.toUpperCase())} · ${esc(e.event)}</div>
          ${Object.keys(e.details || {}).length ? `<pre>${esc(JSON.stringify(e.details, null, 2))}</pre>` : ""}
        </div>`)
        .join("")
    : `<p class="hint">The log is empty. Run the extension, then open this page again.</p>`;
}

function fullText() {
  const { version } = chrome.runtime.getManifest();
  return `Email Writer diagnostic log · v${version} · ${new Date().toISOString()}\n${navigator.userAgent}\n\n${logText(entries)}`;
}

$("pdf").addEventListener("click", () => window.print());
$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(fullText());
  $("status").textContent = "Copied.";
});
$("download").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([fullText()], { type: "text/plain" }));
  a.download = `email-writer-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
  a.click();
});
$("refresh").addEventListener("click", render);

render();
