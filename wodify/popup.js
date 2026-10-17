import { buildWorkouts, toCsv, toJson, toMarkdown } from './extract.js';

const $ = (id) => document.getElementById(id);
const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

async function findWodifyTab() {
  const tabs = await chrome.tabs.query({ url: '*://*.wodify.com/*' });
  return tabs.find((t) => t.active) || tabs[0] || null;
}

async function send(msg) {
  const tab = await findWodifyTab();
  if (!tab) throw new Error('Open Wodify in a tab first.');
  try {
    const res = await chrome.tabs.sendMessage(tab.id, msg);
    if (res && !res.ok) throw new Error(res.error);
  } catch (e) {
    if (/Receiving end does not exist/.test(e.message)) throw new Error('Reload the Wodify tab (it was open before the extension was installed).');
    throw e;
  }
}

async function render() {
  const all = await chrome.storage.local.get(null);
  const state = all.state || {};
  const days = Object.keys(all).filter((k) => k.startsWith('day:'));
  const running = state.status === 'running';

  const tab = await findWodifyTab();
  $('tab-status').textContent = tab ? `Using tab: ${new URL(tab.url).host}` : 'No Wodify tab open.';

  const status = $('status');
  status.className = state.status === 'error' ? 'error' : '';
  status.textContent = running
    ? `Downloading... ${state.fetched || 0} days so far${state.current ? `, at ${state.current}` : ''}${state.failed ? ` (${state.failed} failed)` : ''}`
    : state.message || (all.template ? 'Workout request captured. Press Start.' : '');

  $('count').textContent = `${days.length} days downloaded.`;
  $('start').disabled = running || !all.template;
  $('stop').disabled = !running;
  $('capture').disabled = running;
  document.querySelectorAll('[data-format]').forEach((b) => { b.disabled = days.length === 0; });
}

function showError(e) {
  $('status').className = 'error';
  $('status').textContent = e.message;
}

async function savePrefs() {
  await chrome.storage.local.set({ prefs: { match: $('match').value, date: $('date').value, from: $('from').value } });
}

$('capture').onclick = async () => {
  const match = $('match').value.trim();
  if (!match || !$('date').value) return showError(new Error('Enter the workout text and its date.'));
  await savePrefs();
  send({ type: 'arm', match, date: $('date').value }).catch(showError);
};

$('start').onclick = async () => {
  await savePrefs();
  send({ type: 'start', from: $('from').value, to: $('to').value || today, delay: 400, match: $('match').value.trim() }).catch(showError);
};

// Also resets the saved state, in case the tab was reloaded mid-run and nothing is left to answer.
$('stop').onclick = async () => {
  await send({ type: 'stop' }).catch(() => {});
  const { state } = await chrome.storage.local.get('state');
  await chrome.storage.local.set({ state: { ...state, status: 'stopped', message: 'Stopped. Press Start to resume.' } });
};

document.querySelectorAll('[data-format]').forEach((button) => {
  button.onclick = async () => {
    const all = await chrome.storage.local.get(null);
    const raw = {};
    for (const [k, v] of Object.entries(all)) if (k.startsWith('day:')) raw[k.slice(4)] = v;
    const workouts = buildWorkouts(raw);
    const fmt = button.dataset.format;
    const content = fmt === 'csv' ? toCsv(workouts) : fmt === 'json' ? toJson(workouts) : toMarkdown(workouts);
    const type = fmt === 'json' ? 'application/json' : fmt === 'csv' ? 'text/csv' : 'text/markdown';
    const url = URL.createObjectURL(new Blob([content], { type }));
    await chrome.downloads.download({ url, filename: `wodify-workouts-${today}.${fmt}`, saveAs: false });
    $('status').className = '';
    $('status').textContent = `Exported ${workouts.length} workouts.`;
  };
});

$('clear').onclick = async () => {
  if (!confirm('Delete all downloaded workouts and the captured request?')) return;
  const { prefs } = await chrome.storage.local.get('prefs');
  await chrome.storage.local.clear();
  if (prefs) await chrome.storage.local.set({ prefs });
  render();
};

chrome.storage.onChanged.addListener(render);

(async () => {
  const { prefs } = await chrome.storage.local.get('prefs');
  $('match').value = prefs?.match || '';
  $('date').value = prefs?.date || today;
  $('from').value = prefs?.from || '2012-01-01';
  $('to').value = today;
  render();
})();
