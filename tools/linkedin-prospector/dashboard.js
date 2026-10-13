const $ = s => document.querySelector(s);
const KEYS = ['accounts', 'connections', 'inbox', 'liMessages', 'sentLog', 'googleChecks', 'overrides', 'settings', 'drafts'];
const STATUS_LABEL = {
  ready: 'Ready to message', review: 'Review first', sent: 'Sent', skip: "Don't message", not_prospect: 'Not a prospect',
};
let S = {};
let filter = 'ready';

async function load() {
  S = await chrome.storage.local.get(KEYS);
  S.settings = { cutoff: '2026-08-01', myName: 'Ethan Shapiro', clientId: '', ...(S.settings || {}) };
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
    S.drafts = { ...(S.drafts || {}), [r.key]: ta.value };
    await save({ drafts: S.drafts });
    checks.replaceWith(checks = checksEl(LP.checksFor(ta.value, c)));
  };
  let checks = checksEl(r.checks);
  const draft = el('td', { class: 'draft' }, ta, checks);

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
    el('button', { class: 'primary', onclick: async () => {
      await navigator.clipboard.writeText(ta.value);
      window.open(profileLink(p), '_blank');
    } }, 'Copy & open'),
    el('button', { onclick: async () => {
      S.sentLog = { ...(S.sentLog || {}), [r.key]: { date: new Date().toISOString(), text: ta.value } };
      await save({ sentLog: S.sentLog }); render();
    } }, 'Mark sent'),
    S.sentLog?.[r.key] ? el('button', { onclick: async () => {
      delete S.sentLog[r.key]; await save({ sentLog: S.sentLog }); render();
    } }, 'Undo sent') : null,
    el('button', { onclick: () => checkOne(r) }, 'Check email/cal'),
    S.drafts?.[r.key] != null ? el('button', { onclick: async () => {
      delete S.drafts[r.key]; await save({ drafts: S.drafts }); render();
    } }, 'Reset draft') : null,
    ov);

  return el('tr', {}, person, match, hist, draft, actions);
}

function checksEl(k) {
  const mark = (ok, label) => el('span', { class: ok ? 'ok' : 'bad' }, (ok ? '✓ ' : '✗ ') + label);
  return el('div', { class: 'checks' },
    mark(k.trigger, 'Trigger'), mark(k.tension, 'Tension'), mark(k.trust, k.trust ? 'Trust' : 'Trust (fill in proof)'),
    k.buzzwords ? el('span', { class: 'bad' }, '✗ buzzwords') : null,
    el('span', { class: 'muted' }, `${k.length} chars`));
}

async function checkOne(r) {
  $('#google-status').textContent = `Checking ${r.person.name}…`;
  try {
    const res = await LP.checkPerson(r.person, S.settings.clientId);
    S.googleChecks = { ...(S.googleChecks || {}), [r.key]: res };
  } catch (e) {
    $('#google-status').textContent = e.message;
    return;
  }
  await save({ googleChecks: S.googleChecks });
  $('#google-status').textContent = `Checked ${r.person.name}.`;
  render();
}

// Only check people who could actually get a message (skips non-prospects).
$('#google-check').onclick = async () => {
  const rows = LP.buildRows(S).filter(r => ['ready', 'review'].includes(r.status));
  const btn = $('#google-check');
  btn.disabled = true;
  try {
    await LP.getToken(S.settings.clientId);
    S.googleChecks = { ...(S.googleChecks || {}) };
    let i = 0;
    for (const r of rows) {
      $('#google-status').textContent = `Gmail & Calendar: ${++i}/${rows.length} — ${r.person.name}`;
      try { S.googleChecks[r.key] = await LP.checkPerson(r.person, S.settings.clientId); }
      catch (e) { S.googleChecks[r.key] = { error: e.message, checkedAt: new Date().toISOString() }; }
    }
    await save({ googleChecks: S.googleChecks });
    $('#google-status').textContent = `Checked ${rows.length} people against Gmail & Calendar.`;
  } catch (e) {
    $('#google-status').textContent = e.message;
  }
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
  $('#s-accounts').textContent = (S.accounts || []).length ? `${S.accounts.length} accounts loaded.` : 'No account list loaded.';
  const inbox = Object.keys(S.inbox || {}).length;
  $('#s-captures').textContent = `${Object.keys(S.connections || {}).length} connections, ${inbox} inbox threads captured.`;
}

// ---------- settings ----------
function renderSettings() {
  $('#s-myname').value = S.settings.myName || '';
  $('#s-clientid').value = S.settings.clientId || '';
  $('#redirect').textContent = chrome.identity.getRedirectURL();
  const tpl = { ...LP.DEFAULT_TEMPLATES, ...(S.settings.templates || {}) };
  const trust = { ...LP.DEFAULT_TRUST, ...(S.settings.trust || {}) };
  const personas = [...LP.PERSONAS, { id: 'general', label: 'Everyone else' }];
  $('#templates').replaceChildren(...personas.map(p => {
    const ta = el('textarea', { 'data-tpl': p.id }); ta.value = tpl[p.id];
    const tr = el('input', { 'data-trust': p.id }); tr.value = trust[p.id];
    return el('div', { class: 'tpl' }, el('h2', {}, p.label), ta,
      el('label', {}, 'Trust line ({trust}) — a real customer story or number', tr));
  }));
}

$('#save-settings').onclick = async () => {
  S.settings.myName = $('#s-myname').value.trim();
  S.settings.clientId = $('#s-clientid').value.trim();
  S.settings.templates = Object.fromEntries([...document.querySelectorAll('[data-tpl]')].map(t => [t.dataset.tpl, t.value]));
  S.settings.trust = Object.fromEntries([...document.querySelectorAll('[data-trust]')].map(t => [t.dataset.trust, t.value]));
  await save({ settings: S.settings });
  $('#saved').textContent = 'Saved. Drafts you hand-edited keep your edits; use "Reset draft" to regenerate.';
  render();
};

$('#reset-templates').onclick = async () => {
  delete S.settings.templates; delete S.settings.trust;
  await save({ settings: S.settings });
  renderSettings(); render();
};

// Re-render when the popup captures more while the dashboard is open.
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.connections || changes.inbox) { await load(); importStatus(); render(); }
});

load().then(() => { importStatus(); renderSettings(); render(); });
