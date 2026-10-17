// Isolated-world content script: relays commands from the popup to page-hook.js,
// and saves what page-hook.js sends back into extension storage.
const FROM_EXT = 'wodify-export-ext';
const FROM_PAGE = 'wodify-export-page';

const setState = (patch) =>
  chrome.storage.local.get('state').then(({ state }) => chrome.storage.local.set({ state: { ...(state || {}), ...patch } }));

window.addEventListener('message', async (event) => {
  if (event.source !== window || !event.data || event.data.source !== FROM_PAGE) return;
  const msg = event.data;
  switch (msg.type) {
    case 'status':
      await setState({ message: msg.message });
      break;
    case 'captured':
      await chrome.storage.local.set({ template: msg.template });
      await setState({ status: 'captured', message: 'Workout request captured. Press Start.' });
      break;
    case 'day':
      await chrome.storage.local.set({ [`day:${msg.date}`]: msg.text });
      await setState({ status: 'running', current: msg.date, fetched: msg.fetched, failed: msg.failed, message: '' });
      break;
    case 'progress':
      await setState({ status: 'running', current: msg.date, fetched: msg.fetched, failed: msg.failed });
      break;
    case 'done':
      await setState({ status: 'done', message: `Finished: ${msg.fetched} new days, ${msg.failed} failed.` });
      break;
    case 'stopped':
      await setState({ status: 'stopped', message: 'Stopped. Press Start to resume.' });
      break;
    case 'error':
      await setState({ status: 'error', message: msg.message });
      break;
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'arm') {
      await setState({ status: 'capturing', message: 'Looking for the workout request...' });
      window.postMessage({ source: FROM_EXT, type: 'arm', match: msg.match, date: msg.date }, '*');
    } else if (msg.type === 'start') {
      const all = await chrome.storage.local.get(null);
      if (!all.template) throw new Error('Capture the workout request first.');
      const skip = Object.keys(all).filter((k) => k.startsWith('day:')).map((k) => k.slice(4));
      await setState({ status: 'running', message: 'Checking the captured request...' });
      window.postMessage({ source: FROM_EXT, type: 'start', template: all.template, from: msg.from, to: msg.to,
        delay: msg.delay, match: msg.match, skip }, '*');
    } else if (msg.type === 'stop') {
      window.postMessage({ source: FROM_EXT, type: 'stop' }, '*');
    }
    sendResponse({ ok: true });
  })().catch((e) => sendResponse({ ok: false, error: e.message }));
  return true;
});
