/**
 * Sales Navigator List Exporter — background service worker
 *
 * Deliberately thin: the content script owns the export loop and persists
 * state to chrome.storage.local. This worker just mirrors progress onto the
 * toolbar badge so you can see the count with the popup closed.
 */
const STORAGE_KEY = 'snx_state';

function setBadge(state) {
  if (!state) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const count = state.leads ? Object.keys(state.leads).length : state.count || 0;
  const text = count ? (count > 9999 ? '9999+' : String(count)) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: state.running ? '#0a66c2' : '#2e7d32' });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    setBadge(changes[STORAGE_KEY].newValue);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const { [STORAGE_KEY]: s } = await chrome.storage.local.get(STORAGE_KEY);
  setBadge(s);
});
