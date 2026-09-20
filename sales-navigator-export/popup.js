/**
 * Sales Navigator List Exporter — popup
 *
 * Talks to the content script in the active tab, mirrors the persisted state
 * from chrome.storage.local, and builds/downloads the CSV.
 */
const STORAGE_KEY = 'snx_state';
const $ = (id) => document.getElementById(id);

let activeTabId = null;
let pageInfo = null; // response from snx:ping

// ─── messaging ─────────────────────────────────────────────────────────────
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(msg) {
  if (activeTabId == null) throw new Error('No active tab');
  try {
    return await chrome.tabs.sendMessage(activeTabId, msg);
  } catch (err) {
    // Most common cause: the content script isn't in this tab yet (extension
    // installed/reloaded after the page loaded). Try injecting it once.
    if (msg.type === 'snx:ping' && !msg._retried) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] });
        return await chrome.tabs.sendMessage(activeTabId, { ...msg, _retried: true });
      } catch (_) { /* fall through */ }
    }
    throw err;
  }
}

// ─── rendering ─────────────────────────────────────────────────────────────
function showNotice(text, kind = '') {
  const n = $('notice');
  n.textContent = text;
  n.className = `notice ${kind}`;
}
function hideNotice() { $('notice').className = 'notice hidden'; }

function render(state) {
  const count = state ? state.count ?? Object.keys(state.leads || {}).length : 0;
  const running = !!(state && state.running);

  const badge = $('badge');
  badge.textContent = running ? 'running' : state && state.error ? 'error' : state && state.finishedAt ? 'done' : 'idle';
  badge.className = `pill ${running ? 'running' : state && state.error ? 'error' : state && state.finishedAt ? 'done' : ''}`;

  $('listName').textContent = (state && state.listName) || (pageInfo && pageInfo.listName) || '—';
  $('listName').title = (state && state.listKey) || '';
  $('count').textContent = String(count);

  if (state && state.page) {
    $('progress').textContent = state.totalPages
      ? `page ${state.page} of ${state.totalPages}`
      : `page ${state.page}`;
    $('barFill').style.width = state.totalPages
      ? `${Math.min(100, Math.round((state.page / state.totalPages) * 100))}%`
      : running ? '15%' : '100%';
  } else {
    $('progress').textContent = '—';
    $('barFill').style.width = '0';
  }

  $('log').textContent = state && state.log && state.log.length ? state.log.join('\n') : '—';
  $('log').scrollTop = $('log').scrollHeight;

  const supported = pageInfo && pageInfo.supported;
  $('startBtn').classList.toggle('hidden', running);
  $('stopBtn').classList.toggle('hidden', !running);
  $('startBtn').disabled = !supported;
  $('previewBtn').disabled = !supported || running;
  $('downloadBtn').disabled = count === 0;
  $('clearBtn').disabled = count === 0 || running;

  // If there's data from a *different* list than the current tab, say so.
  if (state && count && pageInfo && state.listKey && state.listKey !== pageInfo.listKey && !running) {
    showNotice('The stored leads are from a different list than this tab. Starting an export here will replace them; download first if you need them.');
  } else if (state && state.error) {
    showNotice(state.error, 'error');
  } else if (pageInfo && !supported) {
    showNotice('Open a Sales Navigator lead list or people search (linkedin.com/sales/lists/… or /sales/search/people…) to export.');
  } else {
    hideNotice();
  }
}

async function refresh() {
  const { [STORAGE_KEY]: s } = await chrome.storage.local.get(STORAGE_KEY);
  render(s ? { ...s, count: Object.keys(s.leads || {}).length } : null);
}

// ─── CSV ───────────────────────────────────────────────────────────────────
const COLUMNS = [
  'name', 'title', 'company', 'location', 'tenure',
  'profile_url', 'company_url', 'list_name', 'page', 'scraped_at', 'raw_text',
];
function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function buildCsv(state) {
  const rows = Object.values(state.leads || {});
  const lines = [COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(COLUMNS.map((c) => csvEscape(c === 'list_name' ? state.listName : r[c])).join(','));
  }
  // BOM so Excel opens UTF-8 names correctly.
  return '﻿' + lines.join('\r\n');
}
function safeFilename(s) {
  return (s || 'sales-navigator-leads').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'sales-navigator-leads';
}

async function download() {
  const { [STORAGE_KEY]: s } = await chrome.storage.local.get(STORAGE_KEY);
  if (!s || !Object.keys(s.leads || {}).length) return;
  const csv = buildCsv(s);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  await chrome.downloads.download({
    url,
    filename: `${safeFilename(s.listName)}-${stamp}.csv`,
    saveAs: true,
  });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ─── wiring ────────────────────────────────────────────────────────────────
$('previewBtn').addEventListener('click', async () => {
  $('previewBtn').disabled = true;
  try {
    const r = await sendToTab({ type: 'snx:preview' });
    $('previewBox').classList.remove('hidden');
    $('previewRows').textContent = r.rows;
    $('previewMeta').textContent =
      `Current page: ${r.currentPage}${r.totalPages ? ` of ${r.totalPages}` : ''} · ` +
      `Next button: ${r.nextFound ? 'found' : 'NOT found'}`;
    $('previewSample').textContent = r.sample.length
      ? r.sample.map((l) => `${l.name || '(no name)'} — ${l.title || '?'} @ ${l.company || '?'}\n   ${l.location || ''}  ${l.profile_url || ''}`).join('\n')
      : 'No rows found. See README → "Fixing selectors".';
    if (!r.rows) showNotice('No lead rows detected on this page. The selectors probably need updating (see README).', 'error');
  } catch (err) {
    showNotice(`Could not reach the page: ${err.message}. Reload the LinkedIn tab and try again.`, 'error');
  } finally {
    $('previewBtn').disabled = false;
  }
});

$('startBtn').addEventListener('click', async () => {
  const { [STORAGE_KEY]: s } = await chrome.storage.local.get(STORAGE_KEY);
  const hasData = s && Object.keys(s.leads || {}).length > 0;
  const sameList = s && pageInfo && s.listKey === pageInfo.listKey;
  let reset = true;
  if (hasData && sameList) {
    // Same list: offer to resume (keeps what's collected; re-scrapes from the
    // current page so navigate to where you want to continue first).
    reset = !confirm(`You already have ${Object.keys(s.leads).length} leads from this list.\n\nOK = keep them and continue from the current page\nCancel = start over from scratch`);
  }
  try {
    await sendToTab({ type: 'snx:start', reset });
  } catch (err) {
    showNotice(`Could not start: ${err.message}. Reload the LinkedIn tab and try again.`, 'error');
  }
  refresh();
});

$('stopBtn').addEventListener('click', async () => {
  try { await sendToTab({ type: 'snx:stop' }); } catch (_) {
    // Content script gone? Flip the flag directly so a reload doesn't resume.
    const { [STORAGE_KEY]: s } = await chrome.storage.local.get(STORAGE_KEY);
    if (s) { s.running = false; await chrome.storage.local.set({ [STORAGE_KEY]: s }); }
  }
  refresh();
});

$('downloadBtn').addEventListener('click', download);

$('diagBtn').addEventListener('click', async () => {
  try {
    const r = await sendToTab({ type: 'snx:diagnose' });
    const text = JSON.stringify(r.report, null, 2);
    $('diagBox').classList.remove('hidden');
    $('diagOut').value = text;
    try { await navigator.clipboard.writeText(text); $('diagBtn').textContent = 'Copied ✓'; }
    catch (_) { $('diagOut').select(); $('diagBtn').textContent = 'Select & copy above'; }
    setTimeout(() => { $('diagBtn').textContent = 'Copy diagnostics'; }, 2000);
  } catch (err) {
    showNotice(`Could not reach the page: ${err.message}. Reload the LinkedIn tab and try again.`, 'error');
  }
});

$('reconcileBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('reconcile.html') });
});

$('clearBtn').addEventListener('click', async () => {
  if (!confirm('Delete all collected leads from this extension\'s storage?')) return;
  await chrome.storage.local.remove(STORAGE_KEY);
  $('previewBox').classList.add('hidden');
  refresh();
});

// Live updates while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) refresh();
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'snx:progress') refresh();
});

(async function init() {
  const tab = await getActiveTab();
  activeTabId = tab && tab.id;
  const onLinkedIn = tab && /^https:\/\/www\.linkedin\.com\/sales\//.test(tab.url || '');
  if (onLinkedIn) {
    try {
      pageInfo = await sendToTab({ type: 'snx:ping' });
    } catch (err) {
      pageInfo = { supported: false };
      showNotice('Could not connect to the page. Reload the LinkedIn tab, then reopen this popup.', 'error');
    }
  } else {
    pageInfo = { supported: false };
  }
  await refresh();
})();
