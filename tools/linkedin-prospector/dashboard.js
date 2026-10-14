const $ = s => document.querySelector(s);
const KEYS = ['liveChecks', 'claudeNotes', 'accounts', 'connections', 'inbox', 'liMessages', 'sentLog', 'contactChecks', 'overrides', 'settings', 'drafts'];
const STATUS_LABEL = {
  ready: 'Ready to message', review: 'Review first', sent: 'Sent', skip: "Don't message", not_prospect: 'Not a prospect',
};
let S = {};
let filter = 'ready';

async function load() {
  S = await chrome.storage.local.get(KEYS);
  S.settings = { cutoff: '2026-08-01', myName: 'Ethan Shapiro', msClientId: '', msTenant: '', outlookUrl: 'https://outlook.office.com/mail/', anthropicKey: '', stories: '', ...(S.settings || {}) };
}
const save = obj => chrome.storage.local.set(obj);

// ---------- tabs ----------
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('section').forEach(sec => sec.hidden = sec.id !== 'tab-' + b.dataset.tab);
});

// ---------- outreach ----------
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e[k] = v; else if (v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}

function profileLink(p) {
  return p.profileUrl || p.salesNavUrl ||
    'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(p.name);
}

function render() {
  $('#cutoff').value = S.settings.cutoff;
  const rows = LP.buildRows(S);
  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

  const f = $('#filters');
  f.replaceChildren(...['ready', 'review', 'sent', 'skip', 'not_prospect', 'all'].map(k =>
    el('button', { class: filter === k ? 'on' : '', onclick: () => { filter = k; render(); } },
      `${k === 'all' ? 'All' : STATUS_LABEL[k]} (${k === 'all' ? rows.length : counts[k] || 0})`)));

  const nAcc = (S.accounts || []).length, nConn = Object.keys(S.connections || {}).length;
  $('#counts').textContent = `${nAcc} accounts · ${nConn} connections captured`;
  const empty = $('#empty');
  empty.hidden = nAcc && nConn;
  empty.textContent = !nAcc ? 'Start on the Import tab: load your account list CSV.'
    : 'No connections yet. Import Connections.csv, or open My Network › Connections and use the extension popup.';

  const shown = rows.filter(r => filter === 'all' || r.status === filter);
  $('#table tbody').replaceChildren(...shown.map(rowEl));
}

function rowEl(r) {
  const p = r.person, c = r.cls, h = r.history;
  const person = el('td', { class: 'person' },
    el('div', { class: 'pill ' + r.status }, STATUS_LABEL[r.status]),
    el('div', { class: 'name' }, el('a', { href: profileLink(p), target: '_blank' }, p.name)),
    el('div', {}, p.title && p.company ? `${p.title} · ${p.company}` : (p.headline || p.title || '')),
    el('div', { class: 'muted' }, `${p.connectedOn ? 'Connected ' + p.connectedOn : 'No connect date'} · ${(p.sources || []).join(', ')}`));

  const acct = c.account;
  const match = el('td', { class: 'match' },
    acct ? el('div', {}, el('b', {}, acct.name), ` (${acct.vertical || 'no vertical'}${acct.type ? ', ' + acct.type : ''})`) : null,
    el('div', { class: c.status === 'prospect' ? 'ok' : (c.status === 'unsure' ? '' : 'muted') }, c.reason),
    el('div', { class: 'muted' }, `Persona: ${r.persona.label}`));

  const hist = el('td', { class: 'hist' },
    h.skip ? el('div', { class: 'bad' }, '⛔ ' + h.skip) : null,
    h.flag ? el('div', {}, '⚠️ ' + h.flag) : null,
    !h.skip && !h.flag ? (h.notes.length
      ? el('div', {}, 'Nothing found so far (not every source checked)')
      : el('div', { class: 'ok' }, 'No prior contact found')) : null,
    h.notes.length ? el('ul', { class: 'notes muted' }, h.notes.map(n => el('li', {}, n))) : null);

  const ta = el('textarea', {});
  ta.value = r.draft;
  ta.oninput = async () => {
    S.drafts = { ...(S.drafts || {}), [r.key]: { text: ta.value, touch: r.touch } };
    await save({ drafts: S.drafts });
    checks.replaceWith(checks = checksEl(LP.checksFor(ta.value, c, r.touch)));
  };
  let checks = checksEl(r.checks);
  const note = S.claudeNotes?.[r.key];
  const draft = el('td', { class: 'draft' }, el('div', { class: 'muted' }, LP.TOUCHES[r.touch - 1].label), ta, checks, note ? el('div', { class: 'muted' }, note) : null);

  const ov = el('select', {
    onchange: async e => {
      S.overrides = { ...(S.overrides || {}) };
      if (e.target.value) S.overrides[r.key] = e.target.value; else delete S.overrides[r.key];
      await save({ overrides: S.overrides }); render();
    } },
    el('option', { value: '' }, 'Override…'),
    el('option', { value: 'prospect' }, 'Is a prospect'),
    el('option', { value: 'not' }, 'Not a prospect'),
    el('option', { value: 'contacted' }, 'Already in touch'));
  ov.value = S.overrides?.[r.key] || '';

  const actions = el('td', { class: 'actions' },
    el('button', { class: 'primary', onclick: () => checkAndOpen(r, ta.value) }, 'Check & open'),
    el('button', { onclick: async () => {
      const prev = S.sentLog?.[r.key];
      const sends = [...(prev?.sends || (prev ? [{ date: prev.date }] : [])), { date: new Date().toISOString(), touch: r.touch, text: ta.value }];
      S.sentLog = { ...(S.sentLog || {}), [r.key]: { date: sends[sends.length - 1].date, sends } };
      if (S.drafts) delete S.drafts[r.key];
      await save({ sentLog: S.sentLog, drafts: S.drafts || {} }); render();
    } }, 'Mark sent'),
    S.sentLog?.[r.key] ? el('button', { onclick: async () => {
      const sends = (S.sentLog[r.key].sends || []).slice(0, -1);
      if (sends.length) S.sentLog[r.key] = { date: sends[sends.length - 1].date, sends };
      else delete S.sentLog[r.key];
      await save({ sentLog: S.sentLog }); render();
    } }, 'Undo last sent') : null,
    el('button', { onclick: () => checkOne(r) }, 'Check Outlook'),
    el('button', { onclick: () => claudeOne(r) }, 'Draft with Claude'),
    r.edited ? el('button', { onclick: async () => {
      delete S.drafts[r.key]; if (S.claudeNotes) delete S.claudeNotes[r.key];
      await save({ drafts: S.drafts, claudeNotes: S.claudeNotes || {} }); render();
    } }, 'Reset draft') : null,
    ov);

  return el('tr', {}, person, match, hist, draft, actions);
}

function checksEl(k) {
  const mark = (ok, label) => el('span', { class: ok ? 'ok' : 'bad' }, (ok ? '✓ ' : '✗ ') + label);
  return el('div', { class: 'checks' },
    mark(k.trigger, 'Trigger'),
    k.touch === 1 ? mark(k.you, k.you ? 'Says who you are' : 'Fill in your company line') : null,
    k.touch === 1 ? mark(k.trust, k.trust ? 'Real proof' : 'Fill in proof') : null,
    mark(k.softAsk, k.softAsk ? 'Soft ask' : 'Hard ask (meeting/time)'),
    k.placeholders ? null : el('span', { class: 'bad' }, '✗ unfilled {placeholder}'),
    k.buzzwords ? el('span', { class: 'bad' }, '✗ buzzwords') : null,
    el('span', { class: 'muted' }, `${k.length} chars`));
}

// Last-second check right before sending: refresh Outlook (if set up), stop on
// any reply, then hand off to the profile page, where the content script reads
// the live LinkedIn conversation before typing anything.
async function checkAndOpen(r, text) {
  const p = r.person;
  const fresh = freshOutlook(r.key);
  if (fresh) status(`Using the Outlook check from ${Math.max(1, Math.round((Date.now() - Date.parse(fresh.checkedAt)) / 36e5))}h ago for ${p.name}…`);
  else status(`Checking Outlook for ${p.name}…`);
  try {
    if (!fresh) {
      S.contactChecks = { ...(S.contactChecks || {}), [r.key]: await checkOutlook(p) };
      await save({ contactChecks: S.contactChecks });
    }
  } catch (e) {
    if (!confirm(`Couldn't check Outlook for ${p.name}: ${e.message}\n\nContinue to LinkedIn anyway?`)) { status(''); return; }
  }
  const h = LP.history(r.key, S);
  if (h.skip && !confirm(`Stop: ${h.skip}\n\nOpen their profile anyway?`)) { render(); return; }
  await navigator.clipboard.writeText(text);
  if (!p.profileUrl) {
    status(`${p.name} has no LinkedIn profile link (Sales Nav only), so the live conversation check can't run. Draft copied; check the thread yourself.`);
    window.open(profileLink(p), '_blank');
    return;
  }
  await chrome.storage.local.set({ pendingSend: {
    key: r.key, name: p.name, text, touch: r.touch, myName: S.settings.myName, at: Date.now(),
  } });
  status(`Opening ${p.name}'s profile to check your LinkedIn conversation…`);
  window.open(p.profileUrl, '_blank');
}

chrome.runtime.onMessage.addListener(async m => {
  if (m.type !== 'lp:liveCheck') return;
  S.liveChecks = { ...(S.liveChecks || {}), [m.key]: { result: m.result, at: new Date().toISOString() } };
  await save({ liveChecks: S.liveChecks });
  render();
});

// ---------- Staggered LinkedIn inbox check ----------
// Searches your LinkedIn inbox for each person, one at a time, with a random
// 20-45s pause between searches so it looks like a person working through a
// list. Only reads; never types or sends.
let liStop = false;
async function linkedinTab() {
  let [tab] = await chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' });
  if (!tab) tab = await chrome.tabs.create({ url: 'https://www.linkedin.com/messaging/', active: false });
  for (let i = 0; i < 60; i++) {
    tab = await chrome.tabs.get(tab.id);
    if (tab.status === 'complete') break;
    await sleep(500);
  }
  return tab;
}

async function liCheckOne(tab, p) {
  let res;
  for (let attempt = 0; attempt < 5 && !res; attempt++) {
    try { res = await chrome.tabs.sendMessage(tab.id, { type: 'lp:liSearch', name: p.name, myName: S.settings.myName }); }
    catch (_) { await sleep(2000); }
  }
  if (!res) throw new Error("LinkedIn messaging tab didn't respond");
  if (res.error) throw new Error(res.error);
  if (!res.found) return 'clear';
  if (!res.readable) return 'unclear';
  return res.theirs > 0 ? 'replied' : res.mine > 0 ? 'messaged' : 'unclear';
}

$('#li-check').onclick = async () => {
  const wanted = ['review', 'ready'].includes(filter) ? [filter] : ['review', 'ready'];
  const rows = LP.buildRows(S).filter(r => wanted.includes(r.status));
  if (!rows.length) { status('Nobody to check in this view.'); return; }
  const mins = Math.round(rows.length * 32 / 60);
  if (!confirm(`Check LinkedIn messages for ${rows.length} people?\n\nIt searches one person every 20-45 seconds (about ${mins} min). Leave the LinkedIn messaging tab open; you can keep working in other tabs.`)) return;
  liStop = false;
  $('#li-check').hidden = true; $('#li-stop').hidden = false;
  let tab;
  try { tab = await linkedinTab(); } catch (e) { status(e.message); }
  let i = 0, errors = 0;
  for (const r of rows) {
    if (liStop || !tab) break;
    status(`LinkedIn: ${++i}/${rows.length} — ${r.person.name}…`);
    try {
      const result = await liCheckOne(tab, r.person);
      S.liveChecks = { ...(S.liveChecks || {}), [r.key]: { result, at: new Date().toISOString() } };
      await save({ liveChecks: S.liveChecks });
      render();
    } catch (e) {
      errors++;
      status(`LinkedIn check for ${r.person.name} failed: ${e.message}`);
      if (errors >= 3) { status(`Stopped after 3 failed searches (${e.message}). Check that the LinkedIn messaging tab is open and signed in.`); break; }
    }
    const [lo, hi] = S.settings.liDelaySec || [20, 45];   // seconds between searches
    if (i < rows.length && !liStop) await sleep((lo + Math.random() * (hi - lo)) * 1000);
  }
  if (errors < 3) status(liStop ? `Stopped after ${i} of ${rows.length}.` : `Checked LinkedIn messages for ${i} people.`);
  $('#li-check').hidden = false; $('#li-stop').hidden = true;
};
$('#li-stop').onclick = () => { liStop = true; status('Stopping after the current search…'); };

// ---------- Hand-off to your work Claude (no API key needed) ----------
// Builds one prompt with the rules + every prospect in view, copies it, and
// opens Claude. You paste it into your work Claude (which can search UiPath's
// case studies through Glean/Highspot/SharePoint if connected), copy Claude's
// JSON answer, then click "Paste Claude's drafts".
function claudePrompt(rows) {
  const people = rows.map(r => ({
    id: r.key, name: r.person.name, headline: r.person.title || r.person.headline || '',
    company: r.cls.company || r.person.company || '', account_vertical: r.cls.account?.vertical || '',
    sub_vertical: r.cls.account?.subVertical || '', location: [r.cls.account?.city, r.cls.account?.state].filter(Boolean).join(', '),
    persona: r.persona.label, touch: r.touch, current_draft: r.draft,
  }));
  return `I'm ${S.settings.myName || 'an account executive'} at UiPath. Please write LinkedIn messages for people who recently accepted my connection request.

Rules (Triple T, from 30 Minutes to President's Club):
- Touch 1 = one short message with: a specific Trigger (why this person, why now: their role, company, industry, or something timely; use anything you can find about them or their company), the Tension it creates (the problem, in plain words), Trust (one line on UiPath plus ONE real UiPath customer result), then a soft, interest-based question. No hard ask: no "15 minutes", no calendar link, no "book a call".
- Touch 2 = short follow-up with a new angle and a curious question. Touch 3 = short, gracious close-the-loop note.
- Customer proof must come from real UiPath sources you can actually see (case studies, Highspot, Glean, SharePoint, uipath.com). Never invent a customer, number, or quote. If you can't find a fitting one, keep the literal text [TRUST: needs a real customer result] in the message.
- Only name a customer if the source is public or approved for external use; otherwise describe them anonymously (e.g. "a Canadian manufacturer").
- No buzzwords ("single source of truth", "all-in-one", "AI-powered", "seamless", "best-in-class"). No emojis, no sign-off.
- Touch 1: 300-600 characters in short paragraphs. Touches 2-3: under 300 characters.
- Write the touch number given for each person. Use the current draft as a starting point, not a script.

Reply with ONLY a JSON array, one object per person, in this exact shape:
[{"id": "...", "message": "...", "proof_source": "link or title of the source you used, or none"}]

People:
${JSON.stringify(people, null, 1)}`;
}

$('#claude-copy').onclick = async () => {
  const wanted = ['review', 'ready'].includes(filter) ? [filter] : ['ready', 'review'];
  const rows = LP.buildRows(S).filter(r => wanted.includes(r.status)).slice(0, 25);
  if (!rows.length) { status('Nobody to draft in this view.'); return; }
  await navigator.clipboard.writeText(claudePrompt(rows));
  window.open(S.settings.claudeUrl || 'https://claude.ai/new', '_blank');
  status(`Copied a prompt for ${rows.length} people${rows.length === 25 ? ' (max 25 per batch)' : ''}. Paste it into Claude, copy Claude's JSON reply, then click "Paste Claude's drafts".`);
};

$('#claude-paste').onclick = async () => {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch (_) {}
  if (!/^\s*\[|```/.test(text)) text = prompt("Paste Claude's JSON reply here:") || '';
  const json = (text.match(/\[[\s\S]*\]/) || [])[0];
  let items;
  try { items = JSON.parse(json); } catch (_) { status("Couldn't read that. Copy Claude's whole JSON reply (it starts with [ ) and try again."); return; }
  const rows = Object.fromEntries(LP.buildRows(S).map(r => [r.key, r]));
  let n = 0;
  S.drafts = { ...(S.drafts || {}) };
  S.claudeNotes = { ...(S.claudeNotes || {}) };
  for (const it of items) {
    const r = rows[it.id];
    if (!r || !it.message) continue;
    S.drafts[r.key] = { text: String(it.message).trim(), touch: r.touch };
    S.claudeNotes[r.key] = `Drafted by your work Claude. Proof source: ${it.proof_source || 'none'}`;
    n++;
  }
  await save({ drafts: S.drafts, claudeNotes: S.claudeNotes });
  status(`Loaded ${n} drafts from Claude. Read each one before sending; check the proof sources.`);
  render();
};

const msCfg = () => ({ clientId: S.settings.msClientId, tenant: S.settings.msTenant });
const status = t => { $('#status').textContent = t; };

// ---------- Outlook on the web (default, no setup) ----------
const OUTLOOK_TABS = ['https://outlook.office.com/*', 'https://outlook.office365.com/*',
  'https://outlook.cloud.microsoft/*', 'https://outlook.live.com/*'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function outlookTab() {
  let [tab] = await chrome.tabs.query({ url: OUTLOOK_TABS });
  if (!tab) {
    tab = await chrome.tabs.create({ url: S.settings.outlookUrl || 'https://outlook.office.com/mail/', active: false });
    status('Opened Outlook in a background tab. If it asks you to sign in, do that, then try again.');
  }
  for (let i = 0; i < 60; i++) {           // wait up to ~30s for it to load
    tab = await chrome.tabs.get(tab.id);
    if (tab.status === 'complete') break;
    await sleep(500);
  }
  return tab;
}

async function outlookWebCheck(person) {
  const tab = await outlookTab();
  let res, lastErr = '';
  for (let attempt = 0; attempt < 6 && !res; attempt++) {   // content script may still be starting
    try {
      res = await chrome.tabs.sendMessage(tab.id, { type: 'lp:outlookSearch', name: person.name, email: person.email || '', myName: S.settings.myName });
    } catch (e) { lastErr = e.message; await sleep(2000); }
  }
  if (!res) throw new Error(`Outlook tab didn't respond (${lastErr}); make sure you're signed in to Outlook on the web.`);
  if (res.error) throw new Error(res.error);
  return {
    mail: { fromThem: res.fromThem, toThem: res.toThem }, calendar: { past: [], upcoming: [] },
    via: 'outlook-web', unreadable: !res.readable && res.total !== 0, checkedAt: new Date().toISOString(),
  };
}

// A recent, successful Outlook result is reused instead of searching again.
function freshOutlook(key) {
  const c = S.contactChecks?.[key];
  const hours = Number(S.settings.outlookFreshHours ?? 24);
  return c && !c.error && !c.unreadable && c.checkedAt && (Date.now() - Date.parse(c.checkedAt)) < hours * 36e5 ? c : null;
}

// Graph if an app registration was configured, otherwise Outlook on the web.
async function checkOutlook(person) {
  return S.settings.msClientId ? LP.checkPerson(person, msCfg()) : outlookWebCheck(person);
}

async function checkOne(r) {
  status(`Checking Outlook for ${r.person.name}…`);
  try {
    S.contactChecks = { ...(S.contactChecks || {}), [r.key]: await checkOutlook(r.person) };
  } catch (e) { status(e.message); return; }
  await save({ contactChecks: S.contactChecks });
  status(`Checked ${r.person.name}.`);
  render();
}

// Only check people who could actually get a message (skips non-prospects).
$('#outlook-check').onclick = async () => {
  const all = LP.buildRows(S).filter(r => ['ready', 'review'].includes(r.status));
  const rows = all.filter(r => !freshOutlook(r.key));
  const skipped = all.length - rows.length;
  if (!rows.length) { status(`Everyone here was checked in the last ${S.settings.outlookFreshHours ?? 24}h. Use a row's "Check Outlook" to force a re-check.`); return; }
  const btn = $('#outlook-check');
  btn.disabled = true;
  try {
    if (S.settings.msClientId) await LP.msGetToken(msCfg());
    else await outlookTab();
    S.contactChecks = { ...(S.contactChecks || {}) };
    let i = 0;
    for (const r of rows) {
      status(`Outlook: ${++i}/${rows.length} — ${r.person.name}`);
      try { S.contactChecks[r.key] = await checkOutlook(r.person); }
      catch (e) { S.contactChecks[r.key] = { error: e.message, checkedAt: new Date().toISOString() }; }
    }
    await save({ contactChecks: S.contactChecks });
    status(`Checked ${rows.length} people against Outlook${skipped ? ` (skipped ${skipped} checked in the last ${S.settings.outlookFreshHours ?? 24}h)` : ''}.`);
  } catch (e) { status(e.message); }
  btn.disabled = false;
  render();
};

async function claudeDraft(r) {
  const out = await LP.draftWithClaude(r, S.settings);
  S.drafts = { ...(S.drafts || {}), [r.key]: { text: out.message, touch: r.touch } };
  S.claudeNotes = { ...(S.claudeNotes || {}), [r.key]: out.story_id === 'none' ? `No story fit: ${out.why}` : `Story: ${out.story} — ${out.why}` };
  await save({ drafts: S.drafts, claudeNotes: S.claudeNotes });
}

async function claudeOne(r) {
  status(`Claude is drafting for ${r.person.name}…`);
  try { await claudeDraft(r); status(`Drafted ${r.person.name}.`); }
  catch (e) { status(e.message); }
  render();
}

// Skips drafts you've already edited by hand or that Claude already wrote.
$('#claude-all').onclick = async () => {
  const rows = LP.buildRows(S).filter(r => ['ready', 'review'].includes(r.status) && !r.edited);
  const btn = $('#claude-all');
  btn.disabled = true;
  let i = 0, failed = 0;
  for (const r of rows) {
    status(`Claude: ${++i}/${rows.length} — ${r.person.name}`);
    try { await claudeDraft(r); } catch (e) { failed++; status(e.message); if (/API key|stories/.test(e.message)) break; }
  }
  if (!failed) status(`Claude drafted ${rows.length} messages. Read each one before sending.`);
  btn.disabled = false;
  render();
};

$('#cutoff').onchange = async e => {
  S.settings.cutoff = e.target.value;
  await save({ settings: S.settings }); render();
};

$('#export').onclick = () => {
  const rows = LP.buildRows(S).map(r => ({
    status: STATUS_LABEL[r.status], name: r.person.name, headline: r.person.headline || r.person.title || '',
    company: r.cls.company || r.person.company || '', matched_account: r.cls.account?.name || '',
    match_reason: r.cls.reason, prior_contact: r.history.skip || r.history.flag || '',
    connected_on: r.person.connectedOn || '', profile: profileLink(r.person), draft: r.draft,
  }));
  const csv = LP.toCSV(rows, Object.keys(rows[0] || { status: 1 }));
  const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `linkedin-outreach-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
};

// ---------- import ----------
// Salesforce exports are often Windows-1252, not UTF-8 ("Québec" breaks otherwise).
async function readText(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (_) { return new TextDecoder('windows-1252').decode(buf); }
}

$('#f-accounts').onchange = async e => {
  const text = await readText(e.target.files[0]);
  S.accounts = LP.csvObjects(text, 'Account Name').map(LP.accountFromRow).filter(a => a.name);
  await save({ accounts: S.accounts });
  importStatus(); render();
};

$('#f-connections').onchange = async e => {
  const rows = LP.csvObjects(await readText(e.target.files[0]), 'First Name');
  S.connections = { ...(S.connections || {}) };
  let n = 0;
  for (const r of rows) {
    const name = `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim();
    const key = LP.personKey(name);
    if (!key) continue;
    const prev = S.connections[key] || {};
    S.connections[key] = {
      ...prev, name: LP.cleanName(name), key,
      company: r['Company'] || prev.company || '', title: r['Position'] || prev.title || '',
      profileUrl: r['URL'] || prev.profileUrl || '', email: r['Email Address'] || prev.email || '',
      connectedOn: LP.parseDate(r['Connected On']) || prev.connectedOn || '',
      sources: [...new Set([...(prev.sources || []), 'export'])],
    };
    n++;
  }
  await save({ connections: S.connections });
  $('#s-connections').textContent = `Imported ${n} connections.`;
  importStatus(); render();
};

$('#f-messages').onchange = async e => {
  const rows = LP.csvObjects(await readText(e.target.files[0]), 'FROM');
  S.liMessages = LP.parseMessages(rows, S.settings.myName);
  await save({ liMessages: S.liMessages });
  $('#s-messages').textContent = `Read ${rows.length} messages with ${Object.keys(S.liMessages).length} people.`;
  render();
};

$('#clear-captures').onclick = async () => {
  if (!confirm('Clear captured connections and inbox threads? Imports from Connections.csv are cleared too; your sent log is kept.')) return;
  S.connections = {}; S.inbox = {};
  await save({ connections: {}, inbox: {} });
  importStatus(); render();
};

function importStatus() {
  const nAcc = (S.accounts || []).length;
  if (!nAcc) $('#s-accounts').textContent = 'No account list loaded.';
  else {
    const rows = LP.buildRows(S);
    const matched = rows.filter(r => r.cls.account);
    const accts = new Set(matched.map(r => r.cls.account.name));
    $('#s-accounts').textContent = `${nAcc} accounts loaded. ${matched.length} of ${rows.length} captured connections ` +
      `match ${accts.size} accounts (${rows.filter(r => r.cls.status === 'prospect').length} clean matches, ` +
      `${matched.filter(r => r.cls.status !== 'prospect').length} to review).`;
  }
  const inbox = Object.keys(S.inbox || {}).length;
  $('#s-captures').textContent = `${Object.keys(S.connections || {}).length} connections, ${inbox} inbox threads captured.`;
}

// ---------- settings ----------
$('#f-stories').onchange = async e => {
  $('#s-stories').value = await readText(e.target.files[0]);
  $('#saved').textContent = 'Loaded. Click Save settings to keep it.';
};

function renderSettings() {
  $('#s-myname').value = S.settings.myName || '';
  $('#s-outlookurl').value = S.settings.outlookUrl || '';
  $('#s-outlookfresh').value = S.settings.outlookFreshHours ?? 24;
  $('#s-msclient').value = S.settings.msClientId || '';
  $('#s-mstenant').value = S.settings.msTenant || '';
  $('#s-anthropic').value = S.settings.anthropicKey || '';
  $('#s-stories').value = S.settings.stories || '';
  $('#redirect').textContent = chrome.identity.getRedirectURL();
  $('#s-followup').value = S.settings.followupDays ?? 3;
  const touches = { ...LP.DEFAULT_TOUCHES, ...(S.settings.touches || {}) };
  const trust = { ...LP.DEFAULT_TRUST, ...(S.settings.trust || {}) };
  const personas = [...LP.PERSONAS, { id: 'general', label: 'Everyone else' }];
  const touchEls = LP.TOUCHES.map(t => {
    const ta = el('textarea', { 'data-touch': t.n }); ta.value = touches[t.n];
    return el('div', { class: 'tpl' }, el('h2', {}, t.label), ta);
  });
  const LINE_LABELS = {
    trigger: '{trigger}: why them, why now (touch 1)',
    tension: '{tension}: the problem that trigger creates (touch 1)',
    question: '{question}: the soft ask (touch 1)',
    thought: '{thought}: a new angle for the follow-up (touch 2)',
    topic: '{topic}: 2-4 word name for the problem (touch 3)',
  };
  const personaEls = personas.map(p => {
    const lines = { ...LP.DEFAULT_LINES[p.id], ...(S.settings.lines?.[p.id] || {}) };
    const fields = Object.entries(LINE_LABELS).map(([k, label]) => {
      const t = el(k === 'topic' ? 'input' : 'textarea', { 'data-line': p.id, 'data-kind': k });
      t.value = lines[k] || '';
      if (k !== 'topic') t.style.minHeight = '54px';
      return el('label', {}, label, t);
    });
    const tr = el('input', { 'data-trust': p.id }); tr.value = trust[p.id];
    return el('div', { class: 'tpl' }, el('h2', {}, p.label), ...fields,
      el('label', {}, '{trust}: one real customer result (touch 1)', tr));
  });
  const you = el('input', { id: 's-you' }); you.value = S.settings.you || LP.DEFAULT_YOU;
  $('#templates').replaceChildren(
    el('label', {}, '{you}: your company + one line on what you help with', you),
    el('h2', {}, 'Messages'), ...touchEls, el('h2', {}, 'Lines by persona'), ...personaEls);
}

$('#save-settings').onclick = async () => {
  S.settings.myName = $('#s-myname').value.trim();
  S.settings.outlookUrl = $('#s-outlookurl').value.trim() || 'https://outlook.office.com/mail/';
  S.settings.outlookFreshHours = Math.max(0, Number($('#s-outlookfresh').value) || 0);
  S.settings.msClientId = $('#s-msclient').value.trim();
  S.settings.msTenant = $('#s-mstenant').value.trim();
  S.settings.anthropicKey = $('#s-anthropic').value.trim();
  S.settings.stories = $('#s-stories').value;
  S.settings.followupDays = Math.max(1, Number($('#s-followup').value) || 3);
  S.settings.you = $('#s-you').value.trim();
  S.settings.touches = Object.fromEntries([...document.querySelectorAll('[data-touch]')].map(t => [t.dataset.touch, t.value]));
  S.settings.lines = {};
  for (const t of document.querySelectorAll('[data-line]')) {
    (S.settings.lines[t.dataset.line] ||= {})[t.dataset.kind] = t.value;
  }
  S.settings.trust = Object.fromEntries([...document.querySelectorAll('[data-trust]')].map(t => [t.dataset.trust, t.value]));
  await save({ settings: S.settings });
  $('#saved').textContent = 'Saved. Drafts you hand-edited keep your edits; use "Reset draft" to regenerate.';
  render();
};

$('#reset-templates').onclick = async () => {
  delete S.settings.templates; delete S.settings.touches; delete S.settings.lines;
  await save({ settings: S.settings });
  renderSettings(); render();
};

// Re-render when the popup captures more while the dashboard is open.
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.connections || changes.inbox) { await load(); importStatus(); render(); }
});

load().then(() => { importStatus(); renderSettings(); render(); });
