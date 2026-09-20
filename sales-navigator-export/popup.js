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
  $('saveSection').classList.toggle('hidden', !(pageInfo && pageInfo.isSearch));
  renderSave(pageInfo && pageInfo.saveState);
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
  const { [STORAGE_KEY]: s, snx_save_state: ss } = await chrome.storage.local.get([STORAGE_KEY, 'snx_save_state']);
  if (pageInfo) pageInfo.saveState = ss || null;
  render(s ? { ...s, count: Object.keys(s.leads || {}).length } : null);
}

let lastSnapshotText = '';
function renderSave(ss) {
  const running = !!(ss && ss.running);
  $('saveStartBtn').classList.toggle('hidden', running);
  $('saveStopBtn').classList.toggle('hidden', !running);
  $('savePreviewBtn').disabled = running;
  if (ss && ss.listName && !$('saveListName').value) $('saveListName').value = ss.listName;
  if (ss && ss.listName && !$('labelInput').value && !$('labelInput').dataset.touched) $('labelInput').value = ss.listName;
  if (ss && (ss.pagesDone || ss.error || running)) {
    $('saveStatus').textContent =
      `${running ? 'Running' : ss.error ? 'Stopped with error' : 'Done'}: ${ss.saved} leads saved across ${ss.pagesDone} page${ss.pagesDone === 1 ? '' : 's'}` +
      (ss.totalPages ? ` (page ${ss.page} of ${ss.totalPages})` : '') + (ss.error ? ` — ${ss.error}` : '');
    $('saveOut').textContent = (ss.log || []).slice(-12).join('\n');
    if (ss.snapshot) {
      lastSnapshotText = `${ss.error}\n\nMenu controls:\n` +
        ss.snapshot.controls.map((c) => `  ${c.el} ${c.type ? `[${c.type}] ` : ''}${JSON.stringify(c.text || c.aria || c.placeholder)}`).join('\n') +
        `\n\nMenu HTML (redacted):\n${ss.snapshot.html}`;
      $('saveOut').textContent += '\n\n' + lastSnapshotText;
      $('copySnapshotBtn').classList.remove('hidden');
    }
    $('saveOut').classList.remove('hidden');
  }
}
$('copySnapshotBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lastSnapshotText); $('copySnapshotBtn').textContent = 'Copied ✓'; }
  catch (_) { $('copySnapshotBtn').textContent = 'Select & copy the text above'; }
  setTimeout(() => { $('copySnapshotBtn').textContent = 'Copy menu snapshot'; }, 2000);
});

// ─── CSV ───────────────────────────────────────────────────────────────────
const COLUMNS = [
  'name', 'title', 'company', 'location', 'tenure', 'degree', 'in_crm', 'blurb',
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
    await sendToTab({ type: 'snx:start', reset, label: $('labelInput').value });
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

$('labelInput').addEventListener('input', () => { $('labelInput').dataset.touched = '1'; });
$('labelInput').addEventListener('change', async () => {
  try { await sendToTab({ type: 'snx:set-label', label: $('labelInput').value }); } catch (_) {}
  refresh();
});

$('downloadBtn').addEventListener('click', download);

// ─── save-all-search-results-to-list ───────────────────────────────────────
$('savePreviewBtn').addEventListener('click', async () => {
  const name = $('saveListName').value.trim();
  $('savePreviewBtn').disabled = true;
  $('saveStatus').textContent = 'Previewing… (selects leads and opens the menu, saves nothing)';
  try {
    const { report: r } = await sendToTab({ type: 'snx:save-preview', listName: name });
    const lines = [
      `Rows on page: ${r.rows}`,
      `Select-all checkbox: ${r.selectAll || 'NOT found'} → selected ${r.selected} (${r.selectMethod || 'n/a'})`,
      `"Save to list" button: ${r.saveButton || 'NOT found'}`,
      `Menu opened: ${r.menuOpened || 'no'}`,
      `Menu items: ${r.menuItems.length ? r.menuItems.join(' | ') : '(none)'}`,
      `Text box in menu: ${r.menuInput || 'none'}`,
      `Create control: ${r.createFound || 'NOT found'}`,
      name ? `List "${name}": ${r.listFound ? 'found' : 'not found' + (r.createFound || r.menuInput ? ' (will be created)' : ' (nothing to create it with!)')}` : 'Type a list name to check for it.',
      r.error ? `Error: ${r.error}` : '',
      r.menu ? `\nMenu controls:\n` + r.menu.controls.map((c) => `  ${c.el} ${c.type ? `[${c.type}] ` : ''}${JSON.stringify(c.text || c.aria || c.placeholder)}`).join('\n') : '',
      r.menu ? `\nMenu HTML (redacted):\n${r.menu.html}` : '',
    ].filter(Boolean);
    lastSnapshotText = lines.join('\n');
    $('copySnapshotBtn').classList.remove('hidden');
    $('saveOut').textContent = lines.join('\n');
    $('saveOut').classList.remove('hidden');
    const ready = r.selected > 0 && r.saveButton && r.menuOpened && (r.listFound || r.createFound || r.menuInput);
    $('saveStatus').textContent = ready ? 'Looks good: all controls found.' : 'Some controls were not found; see below and the README before running.';
  } catch (err) {
    $('saveStatus').textContent = `Preview failed: ${err.message}`;
  } finally {
    $('savePreviewBtn').disabled = false;
  }
});

$('saveStartBtn').addEventListener('click', async () => {
  const name = $('saveListName').value.trim();
  if (!name) { $('saveStatus').textContent = 'Type a lead list name first.'; return; }
  const ss = pageInfo && pageInfo.saveState;
  const resumable = ss && ss.pagesDone > 0 && ss.listName === name && ss.searchKey === pageInfo.listKey && !ss.running;
  let reset = true;
  if (resumable) {
    reset = !confirm(`A previous run saved ${ss.saved} leads from this search to "${name}" (${ss.pagesDone} pages).\n\nOK = continue from the current page (list already exists)\nCancel = start over from page 1`);
  } else if (!confirm(`Save every lead in this search to the list "${name}"?\n\nThe list is created in LinkedIn on the first page if it doesn't exist, then every page is saved into it. Keep the tab in the foreground.`)) return;
  try {
    await sendToTab({ type: 'snx:save-start', listName: name, reset });
  } catch (err) {
    $('saveStatus').textContent = `Could not start: ${err.message}`;
  }
  refresh();
});

$('saveStopBtn').addEventListener('click', async () => {
  try { await sendToTab({ type: 'snx:save-stop' }); } catch (_) {
    const { snx_save_state: ss } = await chrome.storage.local.get('snx_save_state');
    if (ss) { ss.running = false; await chrome.storage.local.set({ snx_save_state: ss }); }
  }
  refresh();
});

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
  if (area === 'local' && (changes[STORAGE_KEY] || changes.snx_save_state)) refresh();
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && (msg.type === 'snx:progress' || msg.type === 'snx:save-progress')) refresh();
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
