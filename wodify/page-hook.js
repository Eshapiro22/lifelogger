// Runs inside the Wodify page itself (MAIN world) so it can see the app's own
// network requests and replay them with the same session.
(() => {
  if (window.__wodifyExporter) return;
  window.__wodifyExporter = true;

  const FROM_EXT = 'wodify-export-ext';
  const FROM_PAGE = 'wodify-export-page';
  const BUFFER_SIZE = 40;
  const MAX_TEXT = 500000;

  const origFetch = window.fetch.bind(window);
  const recent = [];
  let armed = null; // { match, date } while looking for the workout request
  let stopRequested = false;
  let running = false;

  const post = (msg) => window.postMessage({ source: FROM_PAGE, ...msg }, '*');

  // ---------- dates ----------

  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const parseIso = (s) => new Date(`${s}T00:00:00Z`);

  // Every textual form a date might take inside a request URL or body.
  function dateForms(d) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return {
      iso: `${y}-${pad(m)}-${pad(day)}`,
      us: `${pad(m)}/${pad(day)}/${y}`,
      usEnc: encodeURIComponent(`${pad(m)}/${pad(day)}/${y}`),
      usShort: `${m}/${day}/${y}`,
      compact: `${y}${pad(m)}${pad(day)}`,
    };
  }

  function findDateFormat(text, d) {
    const forms = dateForms(d);
    for (const key of ['iso', 'us', 'usEnc', 'usShort', 'compact']) {
      if (text.includes(forms[key])) return key;
    }
    return null;
  }

  const fillDate = (text, fromDate, toDate, fmt) =>
    text.split(dateForms(fromDate)[fmt]).join(dateForms(toDate)[fmt]);

  // ---------- watching the app's requests ----------

  // Headers the browser sets itself; fetch() refuses or ignores them.
  const SKIP_HEADERS = new Set(['cookie', 'content-length', 'host', 'origin', 'referer', 'user-agent', 'connection', 'accept-encoding']);

  function normHeaders(h) {
    const out = {};
    if (!h) return out;
    const entries = h instanceof Headers ? [...h.entries()] : Array.isArray(h) ? h : Object.entries(h);
    for (const [k, v] of entries) if (!SKIP_HEADERS.has(k.toLowerCase())) out[k] = String(v);
    return out;
  }

  function record(entry) {
    if (!entry.text) return;
    entry.text = entry.text.slice(0, MAX_TEXT);
    recent.push(entry);
    if (recent.length > BUFFER_SIZE) recent.shift();
    if (armed) tryCapture(entry);
  }

  function tryCapture(entry) {
    if (!entry.text.toLowerCase().includes(armed.match.toLowerCase())) return false;
    const anchor = parseIso(armed.date);
    const fmt = findDateFormat(entry.url + '\n' + (entry.body || ''), anchor);
    if (!fmt) {
      post({ type: 'status', message: `Found "${armed.match}", but ${armed.date} isn't in that request. Check the date matches the day on screen.` });
      return false;
    }
    const template = { url: entry.url, method: entry.method, headers: entry.headers, body: entry.body, dateFormat: fmt, anchorDate: armed.date };
    armed = null;
    post({ type: 'captured', template });
    return true;
  }

  window.fetch = async function (input, init) {
    let meta = null;
    try {
      const req = input instanceof Request ? input : null;
      const body = init && typeof init.body === 'string' ? init.body
        : req && !(init && init.body) ? await req.clone().text().catch(() => null) : null;
      meta = {
        url: new URL(req ? req.url : String(input), location.href).href,
        method: ((init && init.method) || (req && req.method) || 'GET').toUpperCase(),
        headers: normHeaders((init && init.headers) || (req && req.headers)),
        body,
      };
    } catch { /* never break the app */ }
    const res = await origFetch(input, init);
    if (meta) res.clone().text().then((text) => record({ ...meta, text })).catch(() => {});
    return res;
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__wx = { method: String(method).toUpperCase(), url: new URL(url, location.href).href, headers: {} };
    return xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this.__wx && !SKIP_HEADERS.has(k.toLowerCase())) this.__wx.headers[k] = v;
    return xhrSetHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const meta = this.__wx;
    if (meta) {
      meta.body = typeof body === 'string' ? body : null;
      this.addEventListener('load', () => {
        try {
          const text = this.responseType === '' || this.responseType === 'text' ? this.responseText
            : this.responseType === 'json' ? JSON.stringify(this.response) : null;
          record({ ...meta, text });
        } catch { /* ignore */ }
      });
    }
    return xhrSend.apply(this, arguments);
  };

  // ---------- replaying for every date ----------

  async function replay(tpl, date) {
    const anchor = parseIso(tpl.anchorDate);
    const url = fillDate(tpl.url, anchor, date, tpl.dateFormat);
    const body = tpl.body ? fillDate(tpl.body, anchor, date, tpl.dateFormat) : undefined;
    const res = await origFetch(url, { method: tpl.method, headers: tpl.headers, body, credentials: 'include' });
    return { status: res.status, text: await res.text() };
  }

  async function runAll({ template, from, to, skip, delay, match }) {
    if (running) return;
    running = true;
    stopRequested = false;
    const skipSet = new Set(skip);
    let fetched = 0, failed = 0;
    try {
      const check = await replay(template, parseIso(template.anchorDate));
      if (check.status !== 200 || (match && !check.text.toLowerCase().includes(match.toLowerCase()))) {
        post({ type: 'error', message: `Test request failed (HTTP ${check.status}). Reload the Wodify tab and capture again.` });
        return;
      }
      for (let d = parseIso(to); d >= parseIso(from); d.setUTCDate(d.getUTCDate() - 1)) {
        if (stopRequested) { post({ type: 'stopped', fetched, failed }); return; }
        const day = isoDate(d);
        if (skipSet.has(day)) continue;
        try {
          const res = await replay(template, d);
          if (res.status === 401 || res.status === 403) {
            post({ type: 'error', message: `Wodify returned HTTP ${res.status} on ${day}; your login probably expired. Log in again, capture again, and press Start to resume.` });
            return;
          }
          if (res.status === 200) { fetched++; post({ type: 'day', date: day, text: res.text, fetched, failed }); }
          else { failed++; post({ type: 'progress', date: day, fetched, failed }); }
        } catch (e) {
          failed++;
          post({ type: 'progress', date: day, fetched, failed });
          if (failed > 25) { post({ type: 'error', message: `Too many failures (last: ${e.message}). Press Start to resume.` }); return; }
        }
        await new Promise((r) => setTimeout(r, delay));
      }
      post({ type: 'done', fetched, failed });
    } finally {
      running = false;
    }
  }

  // ---------- commands from the extension ----------

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== FROM_EXT) return;
    const msg = event.data;
    if (msg.type === 'arm') {
      armed = { match: msg.match, date: msg.date };
      // The workout may already be on screen; check what has loaded so far first.
      for (let i = recent.length - 1; i >= 0 && armed; i--) if (tryCapture(recent[i])) return;
      if (armed) post({ type: 'status', message: `Watching for "${msg.match}". Open the Workout tab and pick ${msg.date}.` });
    } else if (msg.type === 'start') {
      runAll(msg);
    } else if (msg.type === 'stop') {
      stopRequested = true;
    }
  });
})();
