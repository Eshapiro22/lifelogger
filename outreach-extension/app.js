import { parseCsv, guessMapping, toLead, leadKey, toCsv, FIELDS } from './lib/csv.js';
import { DEFAULT_RECIPES } from './lib/recipes.js';
import { getOutreachTab, runSteps } from './lib/runner.js';

const $ = sel => document.querySelector(sel);
const store = chrome.storage.local;

const state = {
  headers: [],
  records: [],
  mapping: {},
  leads: [],        // { lead, key, selected, status, detail }
  recipes: structuredClone(DEFAULT_RECIPES),
  history: {},
  running: false,
  stop: false,
  recording: false,
};

// ---------- Logging ----------
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  $('#log').textContent = line + $('#log').textContent;
}

// ---------- Settings persistence ----------
const SETTING_IDS = ['sequenceName', 'templateName', 'dryRun', 'confirmEach', 'includeDone', 'delayMin', 'delayMax', 'maxLeads'];

async function loadSettings() {
  const saved = await store.get(['settings', 'recipes', 'history']);
  const s = saved.settings || {};
  for (const id of SETTING_IDS) {
    const el = $('#' + id);
    if (!(id in s)) continue;
    if (el.type === 'checkbox') el.checked = s[id];
    else el.value = s[id];
  }
  if (s.mode) document.querySelector(`input[name=mode][value=${s.mode}]`).checked = true;
  // Dry run always starts on — a fresh page should never send by surprise.
  $('#dryRun').checked = true;
  if (saved.recipes) state.recipes = { ...state.recipes, ...saved.recipes };
  state.history = saved.history || {};
  updateModeFields();
}

function saveSettings() {
  const s = { mode: mode() };
  for (const id of SETTING_IDS) {
    const el = $('#' + id);
    s[id] = el.type === 'checkbox' ? el.checked : el.value;
  }
  store.set({ settings: s });
}

const mode = () => document.querySelector('input[name=mode]:checked').value;

function updateModeFields() {
  $('#sequenceField').classList.toggle('hidden', mode() !== 'sequence');
  $('#templateField').classList.toggle('hidden', mode() !== 'email');
}

// ---------- CSV ----------
$('#csvFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const { headers, records } = parseCsv(await file.text());
  state.headers = headers;
  state.records = records;
  state.mapping = guessMapping(headers);
  $('#csvInfo').textContent = `${records.length} rows, ${headers.length} columns in ${file.name}. Check the column mapping below.`;
  renderMapping();
  buildLeads();
});

function renderMapping() {
  const box = $('#mapping');
  box.classList.remove('hidden');
  box.innerHTML = '';
  for (const field of Object.keys(FIELDS)) {
    const label = document.createElement('label');
    label.textContent = field;
    const select = document.createElement('select');
    select.innerHTML = `<option value="">— none —</option>` +
      state.headers.map(h => `<option>${escapeHtml(h)}</option>`).join('');
    select.value = state.mapping[field] || '';
    select.addEventListener('change', () => { state.mapping[field] = select.value; buildLeads(); });
    label.append(select);
    box.append(label);
  }
}

function buildLeads() {
  state.leads = state.records.map(rec => {
    const lead = toLead(rec, state.mapping);
    const key = leadKey(lead);
    const prev = state.history[key];
    const unusable = !lead.firstName || !lead.lastName;
    return {
      lead, key,
      selected: !unusable,
      status: unusable ? 'skipped' : prev?.status === 'done' ? 'done' : 'pending',
      detail: unusable ? 'Missing first/last name' : prev?.status === 'done' ? `Processed ${new Date(prev.at).toLocaleDateString()}` : '',
    };
  });
  renderLeads();
}

function renderLeads() {
  const tbody = $('#leadTable tbody');
  tbody.innerHTML = '';
  state.leads.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" data-i="${i}" ${row.selected ? 'checked' : ''}></td>
      <td>${escapeHtml(row.lead.fullName)}</td>
      <td>${escapeHtml(row.lead.company)}</td>
      <td>${escapeHtml(row.lead.email)}</td>
      <td class="status-${row.status}">${row.status}</td>
      <td class="detail">${escapeHtml(row.detail)}</td>`;
    tbody.append(tr);
  });
  const done = state.leads.filter(l => ['done', 'dry-run'].includes(l.status)).length;
  $('#progress').textContent = state.leads.length ? `${done}/${state.leads.length} processed` : '';
  $('#startBtn').disabled = state.running || !state.leads.length;
  $('#stopBtn').disabled = !state.running;
  $('#exportBtn').disabled = !state.leads.length;
}

$('#leadTable').addEventListener('change', e => {
  const i = e.target.dataset.i;
  if (i != null) state.leads[i].selected = e.target.checked;
});
$('#selectAll').addEventListener('change', e => {
  state.leads.forEach(l => { l.selected = e.target.checked; });
  renderLeads();
});

// ---------- Run ----------
async function confirmSend(lead, step) {
  const me = await chrome.tabs.getCurrent();
  if (me) await chrome.tabs.update(me.id, { active: true });
  const dlg = $('#confirmDialog');
  $('#confirmText').textContent =
    `About to click "${[].concat(step.target?.text || 'final button').join(' / ')}" for ${lead.fullName} (${lead.company}). Continue?`;
  dlg.showModal();
  return new Promise(resolve => {
    $('#confirmYes').onclick = () => { dlg.close(); resolve(true); };
    $('#confirmNo').onclick = () => { dlg.close(); resolve(false); };
  });
}

function validateRun() {
  const m = mode();
  if (m === 'sequence' && !$('#sequenceName').value.trim()) return 'Enter the sequence name.';
  if (m === 'email' && !$('#templateName').value.trim()) return 'Enter the template name.';
  return null;
}

async function start() {
  const err = validateRun();
  if (err) { alert(err); return; }
  saveSettings();

  const dryRun = $('#dryRun').checked;
  if (!dryRun && !confirm('Dry run is OFF — this will really add prospects to sequences / send emails. Continue?')) return;

  const includeDone = $('#includeDone').checked;
  const max = Number($('#maxLeads').value) || 25;
  const queue = state.leads
    .filter(l => l.selected && l.status !== 'skipped' && (includeDone || l.status !== 'done'))
    .slice(0, max);
  if (!queue.length) { alert('No selected leads left to process.'); return; }

  state.running = true;
  state.stop = false;
  renderLeads();

  const m = mode();
  const steps = [...state.recipes.find, ...state.recipes[m]];
  const target = m === 'sequence' ? $('#sequenceName').value.trim() : $('#templateName').value.trim();
  const delayMin = Number($('#delayMin').value) || 0;
  const delayMax = Math.max(delayMin, Number($('#delayMax').value) || 0);

  log(`Starting ${dryRun ? 'DRY RUN' : 'LIVE run'}: ${queue.length} leads → ${m} "${target}"`);
  let tab;
  try {
    tab = await getOutreachTab();
  } catch (e) {
    log(`Could not open Outreach: ${e.message}`);
    state.running = false; renderLeads(); return;
  }

  for (let i = 0; i < queue.length; i++) {
    if (state.stop) break;
    const row = queue[i];
    row.status = 'running'; row.detail = ''; renderLeads();
    const vars = { ...row.lead, sequence: target, template: target };
    try {
      const stepLog = await runSteps(tab.id, steps, vars, {
        dryRun,
        shouldStop: () => state.stop,
        onFinal: $('#confirmEach').checked ? step => confirmSend(row.lead, step) : null,
      });
      row.status = dryRun ? 'dry-run' : 'done';
      row.detail = stepLog.filter(s => /matched|DRY RUN/.test(s)).join(' · ') || 'OK';
      if (!dryRun) {
        state.history[row.key] = { status: 'done', at: Date.now(), action: `${m}: ${target}`, name: row.lead.fullName };
        await store.set({ history: state.history });
      }
      log(`✓ ${row.lead.fullName}: ${row.detail}`);
    } catch (e) {
      const review = /No matching prospect|Ambiguous|Cancelled/.test(e.message);
      row.status = e.message === 'Stopped' ? 'pending' : review ? 'review' : 'failed';
      row.detail = e.message;
      log(`✗ ${row.lead.fullName}: ${e.message}`);
    }
    renderLeads();

    if (i < queue.length - 1 && !state.stop) {
      const wait = Math.round((delayMin + Math.random() * (delayMax - delayMin)) * 1000);
      log(`Waiting ${Math.round(wait / 1000)}s…`);
      const end = Date.now() + wait;
      while (Date.now() < end && !state.stop) await new Promise(r => setTimeout(r, 250));
    }
  }

  log(state.stop ? 'Stopped.' : 'Run finished.');
  state.running = false;
  renderHistory();
  renderLeads();
}

$('#startBtn').addEventListener('click', start);
$('#stopBtn').addEventListener('click', () => { state.stop = true; log('Stopping after current step…'); });
$('#exportBtn').addEventListener('click', () => {
  const rows = state.leads.map(l => ({
    name: l.lead.fullName, company: l.lead.company, email: l.lead.email,
    linkedinUrl: l.lead.linkedinUrl, status: l.status, detail: l.detail,
  }));
  const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `outreach-results-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
});

document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { updateModeFields(); saveSettings(); }));
SETTING_IDS.forEach(id => $('#' + id).addEventListener('change', saveSettings));

// ---------- Recipes tab ----------
function showRecipe() {
  $('#recipeEditor').value = JSON.stringify(state.recipes[$('#recipeName').value], null, 2);
  $('#recipeStatus').textContent = '';
}

function readEditor() {
  const parsed = JSON.parse($('#recipeEditor').value);
  if (!Array.isArray(parsed)) throw new Error('Recipe must be a JSON array of steps');
  return parsed;
}

$('#recipeName').addEventListener('change', showRecipe);
$('#saveBtn').addEventListener('click', async () => {
  try {
    state.recipes[$('#recipeName').value] = readEditor();
    await store.set({ recipes: state.recipes });
    $('#recipeStatus').textContent = 'Saved.';
  } catch (e) {
    $('#recipeStatus').textContent = `Not saved — ${e.message}`;
  }
});
$('#resetBtn').addEventListener('click', async () => {
  const name = $('#recipeName').value;
  if (!confirm(`Reset the "${name}" recipe to the built-in default?`)) return;
  state.recipes[name] = structuredClone(DEFAULT_RECIPES[name]);
  await store.set({ recipes: state.recipes });
  showRecipe();
});

async function setRecording(on) {
  const tab = await getOutreachTab();
  state.recording = on;
  state.recordTabId = tab.id;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'record', on });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'record', on });
  }
  $('#recordBtn').textContent = on ? '■ Stop recording' : '● Record in Outreach tab';
  $('#recordBtn').classList.toggle('recording', on);
  if (on) {
    await chrome.tabs.update(tab.id, { active: true });
    log('Recording — do the steps by hand in the Outreach tab, then come back and press Stop recording.');
  }
}

$('#recordBtn').addEventListener('click', () => setRecording(!state.recording).catch(e => log(`Recorder error: ${e.message}`)));

// Keep recording across full page reloads in the Outreach tab.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (state.recording && tabId === state.recordTabId && info.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { type: 'record', on: true }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'recorded' || !state.recording) return;
  let steps;
  try { steps = readEditor(); } catch { steps = []; }
  steps.push(msg.step);
  $('#recipeEditor').value = JSON.stringify(steps, null, 2);
  $('#recipeStatus').textContent = 'Recorded steps added — review, add {{variables}} and "final": true, then Save.';
});

$('#testBtn').addEventListener('click', async () => {
  const row = state.leads.find(l => l.selected && l.status !== 'skipped');
  if (!row) { alert('Upload a CSV and select at least one lead first.'); return; }
  let current;
  try { current = readEditor(); } catch (e) { alert(e.message); return; }
  const name = $('#recipeName').value;
  const steps = name === 'find' ? current : [...state.recipes.find, ...current];
  const target = name === 'email' ? $('#templateName').value.trim() : $('#sequenceName').value.trim();
  log(`Testing "${name}" recipe (dry run) on ${row.lead.fullName}…`);
  try {
    const tab = await getOutreachTab();
    await chrome.tabs.update(tab.id, { active: true });
    const out = await runSteps(tab.id, steps, { ...row.lead, sequence: target, template: target }, { dryRun: true });
    log(`Test passed:\n  ${out.join('\n  ')}`);
  } catch (e) {
    log(`Test failed: ${e.message}`);
  }
});

// ---------- History tab ----------
function renderHistory() {
  const tbody = $('#historyTable tbody');
  tbody.innerHTML = '';
  Object.entries(state.history)
    .sort((a, b) => b[1].at - a[1].at)
    .forEach(([key, h]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(h.name || key)}</td><td>${escapeHtml(h.status)}</td><td>${escapeHtml(h.action)}</td><td>${new Date(h.at).toLocaleString()}</td>`;
      tbody.append(tr);
    });
}
$('#clearHistoryBtn').addEventListener('click', async () => {
  if (!confirm('Clear history? Previously processed leads will no longer be skipped automatically.')) return;
  state.history = {};
  await store.set({ history: {} });
  renderHistory();
  if (state.records.length) buildLeads();
});

// ---------- Tabs ----------
document.querySelectorAll('nav .tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('nav .tab').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.id !== `tab-${btn.dataset.tab}`));
}));

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

await loadSettings();
showRecipe();
renderHistory();
renderLeads();
