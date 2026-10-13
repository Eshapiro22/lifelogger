// Reads the LinkedIn page you are looking at and saves what it finds to
// chrome.storage. It never clicks "Message", types, or sends anything.
//
// LinkedIn changes its markup often, so this avoids class names and keys off
// stable things: profile/lead/thread link URLs, "Connected on" text, and the
// data-anonymize attributes Sales Navigator puts on names/titles/companies.
// If a capture comes back empty after a LinkedIn redesign, these are the
// functions to adjust.
(() => {
  const { cleanName, personKey, parseDate } = LP;

  function pageKind() {
    const p = location.pathname;
    if (p.startsWith('/mynetwork/invite-connect/connections')) return 'connections';
    if (p.startsWith('/sales/search/people') || p.startsWith('/sales/lists/people')) return 'salesnav-leads';
    if (p.startsWith('/sales/inbox')) return 'salesnav-inbox';
    if (p.startsWith('/messaging')) return 'messaging';
    return null;
  }

  const lines = el => (el.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
  const NOISE = /^(message|follow|connect|more|more actions|save|saved|view profile|·|•|\d+(st|nd|rd|th)|1st|2nd|3rd\+?|status is (online|offline|reachable)|open to work|hiring)$/i;

  // My Network > Connections. Each card shows name, headline, "Connected on <date>".
  function scrapeConnections() {
    const out = [];
    const seen = new Set();
    const stamps = [...document.querySelectorAll('body *')].filter(
      el => el.children.length === 0 && /^connected on /i.test((el.textContent || '').trim())
    );
    for (const stamp of stamps) {
      let card = stamp.parentElement;
      for (let i = 0; i < 8 && card && !card.querySelector('a[href*="/in/"]'); i++) card = card.parentElement;
      if (!card) continue;
      const link = card.querySelector('a[href*="/in/"]');
      const url = link.href.split('?')[0];
      if (seen.has(url)) continue;
      seen.add(url);
      const ls = lines(card).filter(l => !NOISE.test(l) && !/^connected on /i.test(l));
      const name = cleanName(ls[0] || '');
      if (!name) continue;
      out.push({
        name, key: personKey(name), headline: ls[1] || '', profileUrl: url,
        connectedOn: parseDate(stamp.textContent), source: 'linkedin',
      });
    }
    return out;
  }

  // Sales Navigator search results / lead lists.
  function scrapeSalesNavLeads() {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="/sales/lead/"]')) {
      const url = a.href.split('?')[0];
      if (seen.has(url)) continue;
      let row = a;
      for (let i = 0; i < 10 && row && !(row.tagName === 'LI' || row.tagName === 'TR'); i++) row = row.parentElement;
      if (!row) continue;
      const pick = attr => (row.querySelector(`[data-anonymize="${attr}"]`)?.innerText || '').trim();
      const name = cleanName(pick('person-name') || a.innerText);
      if (!name) continue;
      seen.add(url);
      const ls = lines(row).filter(l => !NOISE.test(l));
      out.push({
        name, key: personKey(name),
        title: pick('title') || ls[1] || '',
        company: pick('company-name') || '',
        headline: pick('headline') || '',
        salesNavUrl: url, connectedOn: '', source: 'salesnav',
      });
    }
    return out;
  }

  // Inbox list (LinkedIn messaging or Sales Nav inbox). Records that a thread
  // exists and whether the visible preview line is yours ("You: ...").
  // A preview only shows the latest message, so "lastFromMe" does not prove
  // they never replied; the dashboard treats these as "check before sending".
  function scrapeInbox(source) {
    const sel = source === 'salesnav-inbox'
      ? 'a[href*="/sales/inbox/"]'
      : 'a[href*="/messaging/thread/"]';
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll(sel)) {
      let li = a;
      for (let i = 0; i < 8 && li && li.tagName !== 'LI'; i++) li = li.parentElement;
      li = li || a;
      const ls = lines(li).filter(l => !NOISE.test(l));
      const name = cleanName(ls[0] || '');
      const key = personKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const preview = ls.find(l => /:\s/.test(l)) || ls[1] || '';
      out.push({
        name, key, preview, lastFromMe: /^you:/i.test(preview),
        // Group threads have several names; flag them rather than guess.
        group: /,| and \d+ others?/.test(ls[0] || ''), source,
      });
    }
    return out;
  }

  function scrape() {
    const kind = pageKind();
    if (kind === 'connections') return { kind, people: scrapeConnections() };
    if (kind === 'salesnav-leads') return { kind, people: scrapeSalesNavLeads() };
    if (kind === 'salesnav-inbox' || kind === 'messaging') return { kind, threads: scrapeInbox(kind) };
    return { kind: null };
  }

  async function save(result) {
    const store = await chrome.storage.local.get(['connections', 'inbox']);
    const connections = store.connections || {};
    const inbox = store.inbox || {};
    let added = 0;
    const now = new Date().toISOString();
    for (const p of result.people || []) {
      if (!p.key) continue;
      const prev = connections[p.key];
      if (!prev) added++;
      const merged = { ...(prev || {}), capturedAt: now };
      for (const [k, v] of Object.entries(p)) if (v) merged[k] = v;
      merged.sources = [...new Set([...(prev?.sources || []), p.source])];
      connections[p.key] = merged;
    }
    for (const t of result.threads || []) {
      if (!inbox[t.key]) added++;
      inbox[t.key] = { ...(inbox[t.key] || {}), [t.source]: { ...t, capturedAt: now } };
    }
    await chrome.storage.local.set({ connections, inbox });
    return { added, total: (result.people || result.threads || []).length };
  }

  // Scrolling container holding the list (Sales Nav and inbox scroll inside a
  // panel, the connections page scrolls the window).
  function scroller() {
    const cands = [...document.querySelectorAll('main, div, ul, section')].filter(el => {
      const s = getComputedStyle(el);
      return el.scrollHeight > el.clientHeight + 200 && /(auto|scroll)/.test(s.overflowY);
    });
    cands.sort((a, b) => b.scrollHeight - a.scrollHeight);
    return cands[0] || document.scrollingElement;
  }

  let stopFlag = false;
  async function autoCapture(cutoff, report) {
    stopFlag = false;
    let idle = 0, rounds = 0, total = 0;
    while (!stopFlag && idle < 4 && rounds < 300) {
      rounds++;
      const res = scrape();
      const { added } = await save(res);
      total += added;
      idle = added ? 0 : idle + 1;
      const dates = (res.people || []).map(p => p.connectedOn).filter(Boolean).sort();
      report({ rounds, total, oldest: dates[0] || '' });
      // Connections are newest-first, so stop once we're past the cutoff.
      if (cutoff && dates[0] && dates[0] < cutoff) break;
      const el = scroller();
      el.scrollTo({ top: el.scrollHeight });
      window.scrollTo({ top: document.body.scrollHeight });
      const more = [...document.querySelectorAll('button')].find(b => /^(show more results|load more|show more)$/i.test(b.innerText.trim()));
      if (more) more.click();
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    }
    return { total, rounds };
  }

  // ---------- Last-second check before sending ----------
  // The dashboard's "Check & open" stores a pending send and opens the
  // person's profile. Here we open their message box, read whatever
  // conversation history LinkedIn shows, and only insert the draft if they
  // have never written to you. We never click Send.

  function banner(kind, text) {
    document.getElementById('lp-banner')?.remove();
    const colors = { stop: '#b24020', warn: '#915907', ok: '#057642', info: '#0a66c2' };
    const b = document.createElement('div');
    b.id = 'lp-banner';
    b.style.cssText = `position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:99999;
      max-width:560px;padding:12px 40px 12px 16px;border-radius:8px;font:14px system-ui,sans-serif;
      color:#fff;background:${colors[kind]};box-shadow:0 4px 16px rgba(0,0,0,.25);white-space:pre-line`;
    b.textContent = 'LinkedIn Prospector: ' + text;
    const x = document.createElement('button');
    x.textContent = '×';
    x.style.cssText = 'position:absolute;top:6px;right:10px;background:none;border:0;color:#fff;font-size:20px;cursor:pointer';
    x.onclick = () => b.remove();
    b.append(x);
    document.body.append(b);
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(fn, timeout = 8000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await wait(250);
    }
    return null;
  }

  // The message composer: a contenteditable textbox inside the chat overlay.
  function composer() {
    const boxes = [...document.querySelectorAll('[contenteditable="true"][role="textbox"], div[contenteditable="true"]')]
      .filter(b => b.offsetParent && /message/i.test(b.getAttribute('aria-label') || b.closest('form')?.innerText || 'message'));
    return boxes[boxes.length - 1] || null;
  }

  // Read the conversation shown above the composer. Returns
  // {theirs, mine, readable}: counts of message groups by sender.
  function readHistory(box, personName, myName) {
    // Stay inside the chat window so profile-page lists ("People also viewed") don't count.
    const pane = box.closest('[role="dialog"], aside, [class*="overlay"], [class*="conversation"], [class*="msg-"]');
    if (!pane) return { theirs: 0, mine: 0, readable: false, sawList: true };
    const them = personKey(personName), me = personKey(myName);
    let theirs = 0, mine = 0;
    for (const li of pane.querySelectorAll('ul li')) {
      if (li.contains(box)) continue;
      // Sender name is usually a profile link or a short bold line at the top of each group.
      const nameEl = li.querySelector('a[href*="/in/"] span, [class*="name"], h3, h4');
      const who = personKey((nameEl?.innerText || '').trim());
      if (!who) continue;
      if (who === them) theirs++;
      else if (who === me || /^you$/i.test(nameEl.innerText.trim())) mine++;
    }
    return { theirs, mine, readable: true, sawList: !!pane.querySelector('ul li') };
  }

  async function insertDraft(box, text) {
    box.focus();
    if ((box.innerText || '').trim()) return false; // never overwrite something already typed
    document.execCommand('insertText', false, text);
    return true;
  }

  let pendingHandled = false;
  async function runPendingSend() {
    if (pendingHandled || !location.pathname.startsWith('/in/')) return;
    const { pendingSend: ps } = await chrome.storage.local.get('pendingSend');
    if (!ps || Date.now() - ps.at > 3 * 60000) return;
    pendingHandled = true;
    await chrome.storage.local.remove('pendingSend');

    banner('info', `Checking your conversation with ${ps.name}…`);
    const btn = await waitFor(() => [...document.querySelectorAll('main button, main a')].find(b =>
      /^message\b/i.test((b.getAttribute('aria-label') || b.innerText || '').trim()) && b.offsetParent));
    if (!btn) {
      banner('warn', `Couldn't find a Message button for ${ps.name} (they may need InMail or a connection request).\nThe draft is on your clipboard.`);
      return;
    }
    btn.click();
    const box = await waitFor(composer);
    if (!box) {
      banner('warn', 'The message box didn\'t open. The draft is on your clipboard; check the conversation yourself before sending.');
      return;
    }
    await wait(1500); // let history load
    const h = readHistory(box, ps.name, ps.myName);

    if (h.theirs > 0) {
      banner('stop', `STOP: ${ps.name} has written to you before in this conversation.\nRead the thread and reply to it instead of sending a first-touch message. Nothing was typed.`);
      chrome.runtime.sendMessage({ type: 'lp:liveCheck', key: ps.key, result: 'replied' }).catch(() => {});
      return;
    }
    if (h.mine > 0) {
      banner('warn', `You've messaged ${ps.name} before and they haven't replied.\nConsider a follow-up instead. Nothing was typed; the draft is on your clipboard.`);
      chrome.runtime.sendMessage({ type: 'lp:liveCheck', key: ps.key, result: 'messaged' }).catch(() => {});
      return;
    }
    if (h.sawList && !h.theirs && !h.mine) {
      banner('warn', `There's a conversation here, but I couldn't tell who wrote it.\nCheck it before sending. The draft is on your clipboard.`);
      return;
    }
    const typed = await insertDraft(box, ps.text);
    banner(typed ? 'ok' : 'warn', typed
      ? `No previous conversation with ${ps.name}. Draft typed in — review it and click Send yourself.`
      : 'The message box already had text in it, so I left it alone. The draft is on your clipboard.');
    chrome.runtime.sendMessage({ type: 'lp:liveCheck', key: ps.key, result: 'clear' }).catch(() => {});
  }

  // LinkedIn is a single-page app: re-check when the URL changes.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; pendingHandled = false; runPendingSend(); }
  }, 1000);
  runPendingSend();

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'lp:kind') { reply({ kind: pageKind() }); return; }
    if (msg.type === 'lp:capture') {
      const res = scrape();
      save(res).then(r => reply({ kind: res.kind, ...r }));
      return true;
    }
    if (msg.type === 'lp:auto') {
      autoCapture(msg.cutoff, p => chrome.runtime.sendMessage({ type: 'lp:progress', ...p }).catch(() => {}))
        .then(r => chrome.runtime.sendMessage({ type: 'lp:done', ...r }).catch(() => {}));
      reply({ started: true });
      return;
    }
    if (msg.type === 'lp:stop') { stopFlag = true; reply({ stopped: true }); }
  });
})();
