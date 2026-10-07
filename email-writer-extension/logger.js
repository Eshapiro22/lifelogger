// Diagnostic log for troubleshooting runs. Kept in chrome.storage.session
// (cleared when Chrome closes), capped in size, and viewable/exportable from
// log.html. Never records the API key or the playbook text.

const KEY = "debugLog";
const MAX_ENTRIES = 600;
const MAX_DETAIL = 1500; // characters per detail value

let entries = [];
let saveTimer = null;

export async function initLog() {
  const stored = await chrome.storage.session.get(KEY).catch(() => ({}));
  entries = stored[KEY] || [];
}

function clip(v) {
  if (typeof v === "string") return v.length > MAX_DETAIL ? `${v.slice(0, MAX_DETAIL)}… [${v.length} chars]` : v;
  if (Array.isArray(v)) return v.slice(0, 30).map(clip);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clip(x)]));
  return v;
}

export function log(level, event, details = {}) {
  const entry = { t: new Date().toISOString(), level, event, details: clip(details) };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.session.set({ [KEY]: entries }).catch(() => {}), 200);
  (level === "error" ? console.error : console.log)(`[email-writer] ${event}`, details);
}

export async function clearLog() {
  entries = [];
  await chrome.storage.session.set({ [KEY]: [] }).catch(() => {});
}

export function logText(list = entries) {
  return list
    .map((e) => `${e.t}  ${e.level.toUpperCase().padEnd(5)} ${e.event}${Object.keys(e.details || {}).length ? `\n    ${JSON.stringify(e.details, null, 2).replace(/\n/g, "\n    ")}` : ""}`)
    .join("\n");
}

export { KEY as LOG_KEY };
