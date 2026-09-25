/* Call Copilot side panel. Plain JS, no build step. Content lives in playbook.js. */

const SLOT_COUNT = 5;
const OUTCOMES = ["hangup", "earned", "conversation", "meeting", "optout"];
const KEYS = { h: "hangup", g: "earned", c: "conversation", m: "meeting", x: "optout" };

// ---------- storage (chrome.storage in the extension, localStorage when opened as a plain page) ----------
const store = {
  async get() {
    if (globalThis.chrome?.storage?.local) return (await chrome.storage.local.get("state")).state;
    try { return JSON.parse(localStorage.getItem("callCopilot")); } catch { return null; }
  },
  async set(state) {
    if (globalThis.chrome?.storage?.local) return chrome.storage.local.set({ state });
    try { localStorage.setItem("callCopilot", JSON.stringify(state)); } catch {}
  },
};

const blankStats = () => Object.fromEntries(PLAYBOOK.openers.map((o) => [o.id, Object.fromEntries(OUTCOMES.map((k) => [k, 0]))]));

let state = {
  settings: {
    rep: "Ethan", org: "UiPath", mode: "auto", threshold: 3,
    nooksOrigin: "",
    // Guesses: Nooks' real "picked up" label is unknown until you see it. Toggle chips in the panel.
    connectedStatuses: ["connected", "in call", "on call", "live", "answered", "talking", "in progress"],
  },
  prospects: [],
  slots: Array(SLOT_COUNT).fill(null),
  activeSlot: 0,
  openerIdx: 0,
  streak: 0,
  painOffset: 0,
  stats: blankStats(),
  log: [],
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const save = () => store.set(state);
const active = () => state.slots[state.activeSlot];
const opener = () => PLAYBOOK.openers[state.openerIdx];

// ---------- template filling ----------
function tokens(p) {
  const persona = PLAYBOOK.personas[p?.persona];
  const pains = persona?.pains ?? [];
  const n = pains.length || 1;
  return {
    first: p?.first, rep: state.settings.rep, org: state.settings.org,
    company: p?.company, industry: p?.industry, trigger: p?.trigger, lastTouch: p?.lastTouch,
    proof: p?.proof, personaPlural: persona?.plural, gap: persona?.gap,
    pain1: pains[state.painOffset % n], pain2: pains[(state.painOffset + 1) % n],
  };
}

// Missing values render as a highlighted {placeholder} so nothing gets invented on the call.
function fill(template, t) {
  return esc(template).replace(/\{(\w+)\}/g, (_, k) =>
    t[k] ? `<b>${esc(t[k])}</b>` : `<span class="flag">{${k === "proof" ? "customer proof" : k}}</span>`);
}

function proposition(p) {
  if (p?.trigger) {
    return "I noticed {trigger}. When I talk to {personaPlural}, it's usually one of two things: {pain1}, or {pain2}. Is either of those on your radar?";
  }
  const where = p?.industry ? " in {industry}" : "";
  return `I work with {personaPlural}${where}. Usually I hear one of two things: {pain1}, or {pain2}. Curious if either of those is on your radar?`;
}

function guessPersona(title = "") {
  const t = ` ${title.toLowerCase()} `;
  for (const [id, persona] of Object.entries(PLAYBOOK.personas)) {
    if (persona.titleKeywords.some((k) => t.includes(k))) return id;
  }
  return "";
}

// ---------- opener rotation ----------
function openerUsable(o, p) {
  return !o.needs || Boolean(p?.[o.needs]);
}

function advanceOpener(reason) {
  const p = active();
  for (let i = 1; i <= PLAYBOOK.openers.length; i++) {
    const idx = (state.openerIdx + i) % PLAYBOOK.openers.length;
    if (openerUsable(PLAYBOOK.openers[idx], p)) { state.openerIdx = idx; break; }
  }
  state.streak = 0;
  if (reason) toast(reason);
}

function logOutcome(outcome) {
  const o = opener();
  const p = active();
  state.stats[o.id] ??= Object.fromEntries(OUTCOMES.map((k) => [k, 0]));
  state.stats[o.id][outcome]++;
  state.log.push({
    ts: new Date().toISOString(), outcome, opener: o.id,
    prospect: p ? `${p.first ?? ""} ${p.last ?? ""}`.trim() : "", company: p?.company ?? "",
    persona: p?.persona ?? "", pains: p ? `${tokens(p).pain1} | ${tokens(p).pain2}` : "",
  });

  state.streak = outcome === "hangup" ? state.streak + 1 : 0;
  const { mode, threshold } = state.settings;
  if (mode === "roundrobin") advanceOpener(`Logged ${outcome}. Next call: new opener.`);
  else if (mode === "auto" && outcome === "hangup" && state.streak >= threshold) {
    advanceOpener(`${threshold} hang-ups in a row on "${o.name}". Switched opener.`);
  } else toast(`Logged ${outcome} on "${o.name}".`);

  if (outcome === "optout") toast("Opt-out logged. Remove them from the Outreach sequence.");
  save();
  render();
}

// ---------- rendering ----------
function render() {
  const p = active();
  const t = tokens(p);

  $("today").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  $("slots").innerHTML = state.slots.map((s, i) =>
    `<button data-slot="${i}" class="${i === state.activeSlot ? "active" : ""}" title="Line ${i + 1} (key ${i + 1})">${i + 1} · ${esc(s ? s.first || s.company : "empty")}</button>`).join("");

  $("prospectSummary").innerHTML = p
    ? `${esc([p.first, p.last].filter(Boolean).join(" "))} — ${esc(p.title || "no title")} @ ${esc(p.company || "?")}` +
      (p.sequence ? `<br><span class="context">${esc(p.sequence)}${p.step ? ` · ${esc(p.step)}` : ""}</span>` : "")
    : "No prospect loaded (scripts use placeholders)";
  document.querySelectorAll("[data-f]").forEach((el) => {
    if (document.activeElement !== el) el.value = p?.[el.dataset.f] ?? "";
    el.disabled = !p;
  });

  $("openerSelect").value = String(state.openerIdx);
  $("openerText").innerHTML = fill(opener().text, t);
  const mode = state.settings.mode;
  $("rotationNote").textContent =
    mode === "auto" ? `Auto-rotate: ${state.streak}/${state.settings.threshold} hang-ups on this opener.`
    : mode === "roundrobin" ? "Round-robin: opener changes after every logged call." : "Manual rotation.";
  if (!openerUsable(opener(), p)) $("rotationNote").textContent += " This opener needs a last touch for this prospect.";

  $("propText").innerHTML = p?.persona || !p ? fill(proposition(p), t) : `<span class="flag">Pick a persona for this prospect</span>`;
  const disc = PLAYBOOK.personas[p?.persona]?.discovery ?? [];
  $("discovery").innerHTML = [
    "Tell me more. What does that look like today?",
    ...disc,
    "What happens if it doesn't get fixed this year?",
    "Who else is feeling that?",
  ].map((q) => `<li>${esc(q)}</li>`).join("");
  $("askText").innerHTML = fill(PLAYBOOK.meetingAsk, t);

  const openKey = $("objections").dataset.open;
  $("objections").innerHTML = PLAYBOOK.objections.map((o, i) =>
    `<button data-obj="${i}" class="${String(i) === openKey ? "open" : ""}">${esc(o.key)}</button>` +
    (String(i) === openKey ? `<p class="say">${fill(o.text, t)}</p>` : "")).join("");

  renderScoreboard();
  renderNooks();
}

function renderScoreboard() {
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
  const rows = PLAYBOOK.openers.map((o, i) => {
    const s = state.stats[o.id] ?? {};
    const calls = OUTCOMES.reduce((sum, k) => sum + (s[k] ?? 0), 0);
    const earned = (s.earned ?? 0) + (s.conversation ?? 0) + (s.meeting ?? 0);
    return `<tr class="${i === state.openerIdx ? "current" : ""}"><td>${esc(o.name)}</td><td>${calls}</td><td>${pct(s.hangup ?? 0, calls)}</td><td>${pct(earned, calls)}</td><td>${s.meeting ?? 0}</td></tr>`;
  });
  $("scoreboard").innerHTML = `<tr><th>Opener</th><th>Connects</th><th>Hung up</th><th>Got 30s+</th><th>Mtgs</th></tr>${rows.join("")}`;

  const today = new Date().toDateString();
  const todays = state.log.filter((l) => new Date(l.ts).toDateString() === today);
  const count = (k) => todays.filter((l) => l.outcome === k).length;
  $("daily").textContent = `Today: ${todays.length} connects · ${count("conversation") + count("meeting")} conversations · ${count("meeting")} meetings`;
}

let toastTimer;
function toast(msg) {
  $("toast").textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").textContent = ""), 6000);
}

// ---------- prospect search ----------
function searchResults(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const digits = q.replace(/\D/g, "");
  return state.prospects.filter((p) => {
    const hay = `${p.first} ${p.last} ${p.company} ${p.title}`.toLowerCase();
    return hay.includes(q) || (digits.length >= 4 && (p.phone ?? "").replace(/\D/g, "").includes(digits));
  }).slice(0, 12);
}

function renderResults() {
  const q = $("search").value;
  const hits = searchResults(q);
  const items = hits.map((p, i) =>
    `<li data-hit="${i}">${esc(`${p.first} ${p.last}`)} <span class="muted">— ${esc(p.title)} @ ${esc(p.company)}</span></li>`);
  if (q.trim()) items.push(`<li data-new="1" class="muted">+ New prospect "${esc(q.trim())}" on line ${state.activeSlot + 1}</li>`);
  $("results").innerHTML = items.join("");
  $("results").hits = hits;
}

function loadIntoSlot(p) {
  state.slots[state.activeSlot] = { ...p, persona: p.persona || guessPersona(p.title) };
  state.painOffset = 0;
  if (!openerUsable(opener(), active())) advanceOpener();
  $("search").value = "";
  $("results").innerHTML = "";
  $("search").blur(); // hand keys back to the outcome shortcuts
  save();
  render();
}

// ---------- CSV import ----------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

// Header names vary by export, so match loosely. Check the import note to see what was mapped.
const HEADER_MAP = {
  first: ["firstname", "first"],
  last: ["lastname", "last", "surname"],
  full: ["name", "fullname", "prospectname"],
  title: ["title", "jobtitle", "occupation"],
  company: ["company", "companyname", "account", "accountname", "organization"],
  industry: ["industry", "companyindustry", "accountindustry"],
  phone: ["phone", "phonenumber", "mobilephone", "mobile", "workphone", "directphone", "phones"],
  trigger: ["trigger", "observation", "notes"],
  lastTouch: ["lasttouch", "lastemailsubject", "emailsubject", "subject"],
  proof: ["proof", "proofpoint"],
  persona: ["persona", "personatrack"],
};

function importCSV(text) {
  const [header, ...rows] = parseCSV(text);
  if (!header) return "Empty file.";
  const norm = header.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const idx = {};
  for (const [field, names] of Object.entries(HEADER_MAP)) {
    const i = norm.findIndex((h) => names.includes(h));
    if (i >= 0) idx[field] = i;
  }
  const prospects = rows.map((r) => {
    const get = (f) => (idx[f] >= 0 ? (r[idx[f]] ?? "").trim() : "");
    let first = get("first"), last = get("last");
    if (!first && get("full")) {
      const parts = get("full").split(/\s+/);
      first = parts.shift();
      last = parts.join(" ");
    }
    const p = { first, last };
    for (const f of ["title", "company", "industry", "phone", "trigger", "lastTouch", "proof", "persona"]) p[f] = get(f);
    if (!PLAYBOOK.personas[p.persona]) p.persona = guessPersona(p.title);
    return p;
  }).filter((p) => p.first || p.company);
  state.prospects = prospects;
  save();
  const mapped = Object.keys(idx).map((f) => `${f}←"${header[idx[f]]}"`).join(", ");
  const unguessed = prospects.filter((p) => !p.persona).length;
  return `Imported ${prospects.length} prospects. Mapped: ${mapped || "nothing"}. ${unguessed} need a persona picked by hand.`;
}

function exportLog() {
  const cols = ["ts", "outcome", "opener", "prospect", "company", "persona", "pains"];
  const csv = [cols.join(","), ...state.log.map((l) => cols.map((c) => `"${String(l[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `call-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ---------- wiring ----------
function wire() {
  $("personaSelect").innerHTML = `<option value="">— pick —</option>` +
    Object.entries(PLAYBOOK.personas).map(([id, p]) => `<option value="${id}">${esc(p.label)}</option>`).join("");
  $("openerSelect").innerHTML = PLAYBOOK.openers.map((o, i) => `<option value="${i}">${esc(o.name)}</option>`).join("");

  $("slots").addEventListener("click", (e) => {
    const i = e.target.closest("[data-slot]")?.dataset.slot;
    if (i == null) return;
    state.activeSlot = Number(i);
    state.painOffset = 0;
    save(); render();
  });

  $("search").addEventListener("input", renderResults);
  $("search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const hits = $("results").hits ?? [];
      if (hits.length) loadIntoSlot(hits[0]);
      else if ($("search").value.trim()) newFromQuery();
    }
    if (e.key === "Escape") { $("search").value = ""; $("results").innerHTML = ""; $("search").blur(); }
  });
  $("results").addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    if (li.dataset.new) newFromQuery();
    else loadIntoSlot($("results").hits[Number(li.dataset.hit)]);
  });

  document.querySelectorAll("[data-f]").forEach((el) => {
    el.addEventListener("input", () => {
      const p = active();
      if (!p) return;
      p[el.dataset.f] = el.value;
      save(); render();
    });
  });

  $("openerSelect").addEventListener("change", (e) => { state.openerIdx = Number(e.target.value); state.streak = 0; save(); render(); });
  $("nextOpener").addEventListener("click", () => { advanceOpener(); save(); render(); });
  $("swapPains").addEventListener("click", () => { state.painOffset++; save(); render(); });

  document.querySelector(".outcomes").addEventListener("click", (e) => {
    const o = e.target.closest("[data-outcome]")?.dataset.outcome;
    if (o) logOutcome(o);
  });

  $("objections").addEventListener("click", (e) => {
    const i = e.target.closest("[data-obj]")?.dataset.obj;
    if (i == null) return;
    $("objections").dataset.open = $("objections").dataset.open === i ? "" : i;
    render();
  });

  // Settings dialog
  $("settingsBtn").addEventListener("click", () => {
    $("setRep").value = state.settings.rep;
    $("setOrg").value = state.settings.org;
    $("setMode").value = state.settings.mode;
    $("setThreshold").value = state.settings.threshold;
    $("importNote").textContent = `${state.prospects.length} prospects loaded.`;
    $("settings").showModal();
  });
  $("settings").addEventListener("close", () => {
    state.settings = {
      rep: $("setRep").value.trim() || "Ethan",
      org: $("setOrg").value.trim() || "UiPath",
      mode: $("setMode").value,
      threshold: Math.max(1, Number($("setThreshold").value) || 3),
    };
    save(); render();
  });
  $("csvFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) $("importNote").textContent = importCSV(await file.text());
  });
  $("exportLog").addEventListener("click", exportLog);
  $("resetStats").addEventListener("click", () => {
    if (!confirm("Reset the opener scoreboard and call log?")) return;
    state.stats = blankStats(); state.log = []; state.streak = 0;
    save(); render();
  });

  // Keyboard shortcuts (ignored while typing)
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey || $("settings").open) return;
    const k = e.key.toLowerCase();
    if (KEYS[k]) logOutcome(KEYS[k]);
    else if (k === "n") { advanceOpener(); save(); render(); }
    else if (k === "p") { state.painOffset++; save(); render(); }
    else if (k === "/") { e.preventDefault(); $("search").focus(); }
    else if (/^[1-5]$/.test(k)) { state.activeSlot = Number(k) - 1; state.painOffset = 0; save(); render(); }
  });
}

// ---------- Nooks page reader ----------
let nooksRows = [];
let nooksError = "";
const seenStatuses = new Set();
const lastStatus = new Map(); // phone digits -> status

const digitsOf = (s) => String(s ?? "").replace(/\D/g, "");
const normStatus = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const isConnected = (status) => state.settings.connectedStatuses.includes(normStatus(status));

function sequenceTouch(sequence = "") {
  const s = sequence.toLowerCase();
  return (PLAYBOOK.sequenceTouches ?? []).find((t) => s.includes(t.match))?.say ?? "";
}

function prospectFromRow(row) {
  const parts = (row.name ?? "").split(/\s+/).filter(Boolean);
  const nooksPersona = /no persona/i.test(row.persona ?? "") ? "" : row.persona ?? "";
  return {
    first: parts.shift() ?? "", last: parts.join(" "),
    title: row.title ?? "", company: row.account ?? "", industry: "",
    phone: row.phone ?? "", sequence: row.sequence ?? "", step: row.step ?? "",
    trigger: "", lastTouch: sequenceTouch(row.sequence), proof: "",
    persona: guessPersona(nooksPersona) || guessPersona(row.title),
    nooksStatus: row.status ?? "",
  };
}

function onNooksRows(msg) {
  if (!msg.ok) {
    // Other frames on the page report "no headers"; only surface it if nothing has worked yet.
    if (!nooksRows.length) { nooksError = msg.reason; renderNooks(); }
    return;
  }
  nooksError = "";
  nooksRows = msg.rows.map(prospectFromRow);

  // Keep imported/edited details (trigger, proof, industry) and refresh what Nooks knows.
  for (const p of nooksRows) {
    const d = digitsOf(p.phone);
    const existing = state.prospects.find((q) => digitsOf(q.phone) === d);
    if (existing) {
      for (const [k, v] of Object.entries(p)) if (v && !existing[k]) existing[k] = v;
      existing.nooksStatus = p.nooksStatus;
      existing.sequence = p.sequence; existing.step = p.step;
    } else state.prospects.push(p);
  }

  // Someone just picked up: status changed into a "connected" label.
  for (const p of nooksRows) {
    const d = digitsOf(p.phone);
    const status = normStatus(p.nooksStatus);
    if (status) seenStatuses.add(status);
    const before = lastStatus.get(d);
    lastStatus.set(d, status);
    if (isConnected(status) && before !== status) {
      const match = state.prospects.find((q) => digitsOf(q.phone) === d) ?? p;
      loadIntoSlot(match);
      toast(`Picked up: ${match.first} ${match.last} (${match.company})`);
    }
  }
  save();
  renderNooks();
}

function renderNooks() {
  if (!$("nooksCard")) return;
  const origin = state.settings.nooksOrigin;
  $("nooksStatus").textContent = nooksError ? nooksError
    : nooksRows.length ? `Reading ${nooksRows.length} rows` : origin ? `Connected to ${new URL(origin).host}. Waiting for the dialer list…` : "Not connected";
  $("nooksConnect").style.display = origin && !nooksError ? "none" : "";
  const chips = new Set([...seenStatuses, ...state.settings.connectedStatuses.filter((s) => seenStatuses.has(s))]);
  $("statusChips").innerHTML = chips.size
    ? [...chips].map((s) => `<button data-status="${esc(s)}" class="${isConnected(s) ? "on" : ""}">${esc(s)}</button>`).join("")
    : `<span class="muted">none seen yet</span>`;
  $("nooksRows").innerHTML = nooksRows.slice(0, 15).map((p, i) =>
    `<li data-nooks="${i}" class="${isConnected(p.nooksStatus) ? "connected" : ""}"><span class="status">${esc(p.nooksStatus || "–")}</span>${esc(`${p.first} ${p.last}`)} <span class="muted">— ${esc(p.title)} @ ${esc(p.company)}</span></li>`).join("");
}

async function connectNooks() {
  let origin;
  try { origin = new URL($("nooksUrl").value.trim() || state.settings.nooksOrigin).origin; }
  catch { nooksError = "Paste the full Nooks URL, starting with https://"; renderNooks(); return; }
  const pattern = `${origin}/*`;
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) { nooksError = "Permission declined, so the panel can't read Nooks."; renderNooks(); return; }

  await chrome.scripting.unregisterContentScripts({ ids: ["nooks"] }).catch(() => {});
  await chrome.scripting.registerContentScripts([{ id: "nooks", matches: [pattern], js: ["nooks-scraper.js"], runAt: "document_idle", allFrames: true }]);
  state.settings.nooksOrigin = origin;
  nooksError = "";
  save();
  await injectIntoOpenTabs();
  renderNooks();
}

// Registered scripts only run on future page loads, so inject into Nooks tabs that are already open.
async function injectIntoOpenTabs() {
  const origin = state.settings.nooksOrigin;
  if (!origin || !globalThis.chrome?.tabs) return;
  const tabs = await chrome.tabs.query({ url: `${origin}/*` }).catch(() => []);
  for (const tab of tabs) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["nooks-scraper.js"] }).catch(() => {});
    chrome.tabs.sendMessage(tab.id, { type: "nooks-rescan" }).catch(() => {});
  }
}

function wireNooks() {
  if (!globalThis.chrome?.runtime?.onMessage) return;
  chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === "nooks-rows") onNooksRows(msg); });
  $("nooksConnectBtn").addEventListener("click", connectNooks);
  $("statusChips").addEventListener("click", (e) => {
    const s = e.target.closest("[data-status]")?.dataset.status;
    if (!s) return;
    const list = state.settings.connectedStatuses;
    state.settings.connectedStatuses = list.includes(s) ? list.filter((x) => x !== s) : [...list, s];
    save(); renderNooks();
  });
  $("nooksRows").addEventListener("click", (e) => {
    const i = e.target.closest("[data-nooks]")?.dataset.nooks;
    if (i == null) return;
    const p = nooksRows[Number(i)];
    loadIntoSlot(state.prospects.find((q) => digitsOf(q.phone) === digitsOf(p.phone)) ?? p);
  });
  injectIntoOpenTabs();
}

function newFromQuery() {
  const [first, ...rest] = $("search").value.trim().split(/\s+/);
  loadIntoSlot({ first, last: rest.join(" "), title: "", company: "", industry: "", trigger: "", lastTouch: "", proof: "", persona: "" });
  $("prospectEdit").open = true;
}

(async () => {
  const saved = await store.get();
  if (saved) {
    state = { ...state, ...saved, settings: { ...state.settings, ...saved.settings } };
    state.stats = { ...blankStats(), ...state.stats };
    if (state.openerIdx >= PLAYBOOK.openers.length) state.openerIdx = 0;
  }
  wire();
  wireNooks();
  render();
})();
