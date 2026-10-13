const LABELS = {
  connections: 'Connections page: captures name, headline, connected date.',
  'salesnav-leads': 'Sales Nav leads: captures name, title, company. Capture each results page.',
  messaging: 'LinkedIn inbox: records who you already have threads with.',
  'salesnav-inbox': 'Sales Nav inbox: records who you already have threads with.',
};
const $ = id => document.getElementById(id);
let tabId;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  let kind = null;
  try { kind = (await chrome.tabs.sendMessage(tabId, { type: 'lp:kind' }))?.kind; } catch (_) {}
  $('page').textContent = kind ? LABELS[kind] : 'Open one of the supported LinkedIn pages to capture. (If you just installed the extension, reload the LinkedIn tab.)';
  $('capture').disabled = $('auto').disabled = !kind;
}

$('capture').onclick = async () => {
  const r = await chrome.tabs.sendMessage(tabId, { type: 'lp:capture' });
  $('status').textContent = `Found ${r.total} on screen, ${r.added} new.`;
};
$('auto').onclick = async () => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.tabs.sendMessage(tabId, { type: 'lp:auto', cutoff: settings.cutoff || '2026-08-01' });
  $('auto').hidden = true; $('stop').hidden = false;
  $('status').textContent = 'Scrolling… keep this tab open. You can close this popup.';
};
$('stop').onclick = () => chrome.tabs.sendMessage(tabId, { type: 'lp:stop' });
$('dash').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });

chrome.runtime.onMessage.addListener(m => {
  if (m.type === 'lp:progress') $('status').textContent = `Pass ${m.rounds}: ${m.total} new so far${m.oldest ? `, back to ${m.oldest}` : ''}…`;
  if (m.type === 'lp:done') { $('status').textContent = `Done: ${m.total} new captured.`; $('auto').hidden = false; $('stop').hidden = true; }
});
init();
