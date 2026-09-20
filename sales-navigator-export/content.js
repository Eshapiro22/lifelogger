/**
 * Sales Navigator List Exporter — content script
 *
 * Runs on https://www.linkedin.com/sales/* pages. It:
 *   1. Scrolls the current results page so every lazily-rendered lead row exists in the DOM
 *   2. Scrapes each lead row into a plain object
 *   3. Clicks "Next" and repeats until the last page
 *   4. Persists everything in chrome.storage.local so the export survives page
 *      reloads and the popup being closed, and so it can be resumed.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IMPORTANT: LinkedIn changes its markup frequently and I cannot verify the
 * current DOM from here. Everything DOM-related lives in CONFIG below. Each
 * selector is a *list of candidates* tried in order; the first one that
 * matches wins. If exporting stops finding leads, open DevTools on a list
 * page, inspect a lead row, and add the new selector to the front of the
 * relevant list. Use the popup's "Preview this page" button to check results.
 * ────────────────────────────────────────────────────────────────────────────
 */
(() => {
  if (window.__snxInjected) return; // guard against double injection
  window.__snxInjected = true;

  const CONFIG = {
    // Human-ish pacing between pages. Going faster raises the chance LinkedIn
    // rate-limits or flags the account. Don't go below ~1500ms.
    minDelayMs: 2500,
    maxDelayMs: 5000,

    // How long to wait for rows to appear after navigation before giving up.
    rowWaitTimeoutMs: 20000,
    // Lazy-render scrolling: step size and pause between steps.
    scrollStepPx: 700,
    scrollPauseMs: 400,
    // Stop scrolling when the row count hasn't changed for this many steps.
    scrollStableSteps: 3,

    // Safety valve so a broken "Next" detector can't loop forever.
    maxPages: 500,

    selectors: {
      // The scrollable element that holds the result list. Falls back to the
      // window if none of these match.
      scrollContainer: [
        '#search-results-container',
        '.search-results-container',
        '[data-x--search-results-container]',
        'div[class*="search-results"]',
      ],

      // One element per lead. If none of these match we fall back to finding
      // every link to /sales/lead/ and walking up to its <li>.
      resultRow: [
        'li.artdeco-list__item[data-x-search-result]',
        'li[data-x-search-result]',
        'ol.artdeco-list > li.artdeco-list__item',
        'ol[class*="search-results"] > li',
        'li[class*="search-results__result-item"]',
        'li.artdeco-list__item',
      ],

      // Link to the lead's Sales Navigator profile. /sales/lead/ has been the
      // stable URL pattern; /sales/people/ is an older variant.
      leadLink: [
        'a[href*="/sales/lead/"]',
        'a[href*="/sales/people/"]',
      ],

      // Field selectors *within a row*. data-anonymize attributes are what
      // LinkedIn uses for its own "anonymize" demo mode and have been fairly
      // stable, but verify them.
      name: [
        '[data-anonymize="person-name"]',
        'span[class*="result-lockup__name"]',
        '.artdeco-entity-lockup__title',
      ],
      title: [
        '[data-anonymize="title"]',
        'span[class*="result-lockup__highlight-keyword"]',
        '.artdeco-entity-lockup__subtitle',
      ],
      company: [
        '[data-anonymize="company-name"]',
        'a[href*="/sales/company/"]',
        'a[href*="/sales/account/"]',
      ],
      companyLink: [
        'a[href*="/sales/company/"]',
        'a[href*="/sales/account/"]',
      ],
      location: [
        '[data-anonymize="location"]',
        '.artdeco-entity-lockup__caption',
      ],
      // Time in role / time at company usually sits in a "metadata" block.
      tenure: [
        '[data-anonymize="job-title"] ~ *',
        '.artdeco-entity-lockup__metadata',
      ],

      // Pagination
      nextButton: [
        'button[aria-label="Next"]',
        'button.artdeco-pagination__button--next',
        'button[aria-label*="next" i]',
      ],
      pageIndicator: [
        '.artdeco-pagination__indicator--number',
        'li[data-test-pagination-page-btn]',
      ],
      currentPage: [
        '.artdeco-pagination__indicator--number.active',
        'li[data-test-pagination-page-btn].active',
        '.artdeco-pagination__indicator--number[aria-current]',
      ],

      // List title (for the list_name column)
      listTitle: [
        'h1',
        '[data-anonymize="list-name"]',
        '.lists-nav__list-name',
      ],
    },
  };

  const STORAGE_KEY = 'snx_state';

  // ─── small helpers ───────────────────────────────────────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randDelay = () =>
    sleep(CONFIG.minDelayMs + Math.random() * (CONFIG.maxDelayMs - CONFIG.minDelayMs));

  function q(root, candidates) {
    for (const sel of candidates) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch (_) { /* invalid selector, skip */ }
    }
    return null;
  }
  function qa(root, candidates) {
    for (const sel of candidates) {
      try {
        const els = root.querySelectorAll(sel);
        if (els.length) return Array.from(els);
      } catch (_) { /* invalid selector, skip */ }
    }
    return [];
  }
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  function log(...args) {
    console.log('[SNX]', ...args);
  }

  // Which list/search are we on? Strip the page param so every page of the
  // same list shares a key.
  function listKeyFromLocation() {
    const u = new URL(location.href);
    u.searchParams.delete('page');
    u.hash = '';
    return u.toString();
  }

  function isSupportedPage() {
    const p = location.pathname;
    return (
      p.startsWith('/sales/lists/people') ||
      p.startsWith('/sales/search/people') ||
      p.startsWith('/sales/lists/') ||
      p.startsWith('/sales/search/')
    );
  }

  function normalizeProfileUrl(href) {
    if (!href) return '';
    try {
      const u = new URL(href, location.origin);
      // Drop tracking params; keep the path (which contains the lead id).
      return `${u.origin}${u.pathname}`;
    } catch (_) {
      return href;
    }
  }

  // ─── state (persisted) ───────────────────────────────────────────────────
  async function loadState() {
    const { [STORAGE_KEY]: s } = await chrome.storage.local.get(STORAGE_KEY);
    return (
      s || {
        running: false,
        listKey: null,
        listName: '',
        page: 0,
        totalPages: null,
        leads: {}, // keyed by profile URL (or name|company fallback)
        log: [],
        startedAt: null,
        finishedAt: null,
        error: null,
      }
    );
  }
  async function saveState(s) {
    await chrome.storage.local.set({ [STORAGE_KEY]: s });
    // Fire-and-forget progress notifications. The popup may be closed, and
    // sendMessage throws if there's no listener; that's fine.
    chrome.runtime
      .sendMessage({ type: 'snx:progress', state: summarize(s) })
      .catch(() => {});
  }
  function summarize(s) {
    return {
      running: s.running,
      listKey: s.listKey,
      listName: s.listName,
      page: s.page,
      totalPages: s.totalPages,
      count: Object.keys(s.leads).length,
      log: s.log.slice(-30),
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      error: s.error,
    };
  }
  function pushLog(s, msg) {
    const line = `${new Date().toLocaleTimeString()}  ${msg}`;
    s.log.push(line);
    if (s.log.length > 200) s.log.shift();
    log(msg);
  }

  // ─── DOM: rows ───────────────────────────────────────────────────────────
  const leadKeyOf = (a) => normalizeProfileUrl(a.getAttribute('href'));

  // Climb from a lead link to the largest ancestor that still contains exactly
  // one distinct lead. That ancestor is the lead's card, whatever LinkedIn
  // calls it this month. Stops at the list container (many leads) or at a
  // text-length ceiling so a single-lead page can't swallow the whole document.
  function rowForLink(a) {
    const S = CONFIG.selectors;
    let node = a;
    let best = a;
    for (let depth = 0; depth < 20 && node.parentElement; depth++) {
      node = node.parentElement;
      if (node === document.body || node === document.documentElement) break;
      const keys = new Set(qa(node, S.leadLink).map(leadKeyOf));
      if (keys.size !== 1) break;
      if ((node.innerText || '').length > 2500) break;
      best = node;
    }
    return best;
  }

  function findRows() {
    const S = CONFIG.selectors;
    // Primary: DOM-agnostic climb from every lead link.
    const seen = new Set();
    let rows = [];
    for (const a of qa(document, S.leadLink)) {
      const row = rowForLink(a);
      if (!seen.has(row)) { seen.add(row); rows.push(row); }
    }
    if (rows.length) return rows;
    // Secondary: configured row selectors.
    return qa(document, S.resultRow).filter((r) => q(r, S.leadLink));
  }

  // ─── DOM: text-based field parsing (used when field selectors miss) ──────
  const JUNK_LINE = /^(1st|2nd|3rd|•|·|save|saved|unsave|message|add to list|view profile|connect|follow|more|see more|…|premium|linkedin member|open link|in your network|\d+\s+(mutual|shared)\s+connections?|\d+\s+(new|recent)\s+.*|list of .*|remove from list)$/i;
  const DEGREE = /(^|\s)[•·]?\s*(1st|2nd|3rd|3rd\+)(\s|$)/gi;
  const LEGAL_TAIL = /\b(inc|llc|llp|lp|ltd|limited|plc|corp|corporation|co|company|gmbh|ag|sa|bv|pty|pte|s\.?e\.?n\.?c\.?r\.?l|pc|p\.c)\.?$/i;
  function parseFieldsFromText(row, name, known = {}) {
    const lines = (row.innerText || '')
      .split('\n')
      .map((l) => l.replace(DEGREE, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((l) => !JUNK_LINE.test(l))
      .filter((l) => !name || (l !== name && !l.startsWith(name + ' ') && !l.startsWith(name + "'")))
      .filter((l) => !known.company || l !== known.company)
      .filter((l) => !known.title || l !== known.title);
    const out = { title: '', company: '', location: '', tenure: '' };
    const rest = [];
    for (const l of lines) {
      if (!out.tenure && /\b\d+\s*(years?|months?|yrs?|mos?)\b/i.test(l)) { out.tenure = l; continue; }
      const at = l.match(/^(.+?)\s+at\s+(.+)$/);
      if (at && !out.title && !out.company && !known.company) { out.title = at[1]; out.company = at[2]; continue; }
      rest.push(l);
    }
    // Location: prefer "… Area/Region", then "City, Region[, Country]" that
    // doesn't look like a company name (no legal suffix, short).
    const isLoc = (l) => l.length < 70 && !LEGAL_TAIL.test(l) && !/[&]/.test(l) &&
      (/\b(area|region|metropolitan|greater)\b/i.test(l) || /^[^,]{2,},\s*[^,]{2,}(,\s*[^,]{2,})?$/.test(l));
    let locIdx = rest.findIndex((l) => /\b(area|region|metropolitan|greater)\b/i.test(l) && l.length < 70);
    if (locIdx < 0) locIdx = rest.findIndex(isLoc);
    if (locIdx >= 0) { out.location = rest[locIdx]; rest.splice(locIdx, 1); }
    if (!out.title && rest.length) out.title = rest.shift();
    if (!out.company && !known.company && rest.length) out.company = rest.shift();
    return out;
  }

  function scrapeRow(row, pageNum) {
    const S = CONFIG.selectors;
    const leadLinks = qa(row, S.leadLink);
    const link = leadLinks.slice().sort((a, b) => txt(b).length - txt(a).length)[0] || null;
    const nameEl = q(row, S.name) || (link && txt(link) ? link : null);
    const imgAlt = (() => { const img = row.querySelector('img[alt]'); return img ? img.getAttribute('alt').trim() : ''; })();
    const companyEl = q(row, S.company);
    const companyLinkEl = q(row, S.companyLink);

    const name = txt(nameEl) || imgAlt;
    let title = txt(q(row, S.title));
    let company = txt(companyEl);
    let locationStr = txt(q(row, S.location));
    let tenure = txt(q(row, S.tenure));
    if (!title || !company || !locationStr) {
      const t = parseFieldsFromText(row, name, { company, title });
      title = title || t.title;
      company = company || t.company;
      locationStr = locationStr || t.location;
      tenure = tenure || t.tenure;
    }
    const profileUrl = normalizeProfileUrl(link && link.getAttribute('href'));
    const companyUrl = normalizeProfileUrl(companyLinkEl && companyLinkEl.getAttribute('href'));

    // Keep the row's full text so nothing is lost if a field selector breaks.
    const rawText = (row.innerText || row.textContent || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' | ');

    const key = profileUrl || `${name}|${company}`.toLowerCase();
    return {
      key,
      name,
      title,
      company,
      company_url: companyUrl,
      location: locationStr,
      tenure,
      profile_url: profileUrl,
      page: pageNum,
      scraped_at: new Date().toISOString(),
      raw_text: rawText,
    };
  }

  function getScrollContainer() {
    return q(document, CONFIG.selectors.scrollContainer);
  }

  // Scroll through the list until no new rows appear, so lazy-rendered rows
  // are all in the DOM. Returns the final row list.
  async function scrollToRenderAll() {
    const container = getScrollContainer();
    let lastCount = -1;
    let stable = 0;
    for (let i = 0; i < 60; i++) {
      if (container) container.scrollTop += CONFIG.scrollStepPx;
      else window.scrollBy(0, CONFIG.scrollStepPx);
      await sleep(CONFIG.scrollPauseMs);

      const count = findRows().length;
      if (count === lastCount) {
        stable++;
        const atBottom = container
          ? container.scrollTop + container.clientHeight >= container.scrollHeight - 5
          : window.innerHeight + window.scrollY >= document.body.scrollHeight - 5;
        if (stable >= CONFIG.scrollStableSteps && atBottom) break;
      } else {
        stable = 0;
        lastCount = count;
      }
    }
    // Back to the top so the pagination controls / next rows render normally.
    if (container) container.scrollTop = 0;
    else window.scrollTo(0, 0);
    await sleep(300);
    return findRows();
  }

  async function waitForRows(timeoutMs = CONFIG.rowWaitTimeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const rows = findRows();
      if (rows.length) return rows;
      await sleep(400);
    }
    return [];
  }

  // ─── DOM: pagination ─────────────────────────────────────────────────────
  function findNextButton() {
    const S = CONFIG.selectors;
    let btn = q(document, S.nextButton);
    if (btn) return btn;
    // Text-based fallback.
    for (const b of document.querySelectorAll('button')) {
      if (/^\s*next\s*$/i.test(b.textContent || '')) return b;
    }
    return null;
  }
  function nextIsDisabled(btn) {
    return (
      !btn ||
      btn.disabled ||
      btn.getAttribute('aria-disabled') === 'true' ||
      btn.classList.contains('artdeco-button--disabled')
    );
  }
  function readTotalPages() {
    const nums = qa(document, CONFIG.selectors.pageIndicator)
      .map((li) => parseInt(txt(li), 10))
      .filter((n) => !Number.isNaN(n));
    return nums.length ? Math.max(...nums) : null;
  }
  // Returns null when neither the pagination pill nor the URL says which page
  // this is; callers fall back to counting.
  function readCurrentPageOrNull() {
    const el = q(document, CONFIG.selectors.currentPage);
    const n = parseInt(txt(el), 10);
    if (!Number.isNaN(n)) return n;
    const fromUrl = parseInt(new URL(location.href).searchParams.get('page') || '', 10);
    return Number.isNaN(fromUrl) ? null : fromUrl;
  }
  function readCurrentPage() {
    return readCurrentPageOrNull() ?? 1;
  }
  function readListName() {
    return txt(q(document, CONFIG.selectors.listTitle)) || document.title;
  }

  // After clicking Next, wait until the page actually changed.
  async function waitForPageChange(prevFirstKey, prevUrl, timeoutMs = CONFIG.rowWaitTimeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await sleep(500);
      const rows = findRows();
      const firstKey = rows.length ? scrapeRow(rows[0], 0).key : null;
      if (location.href !== prevUrl || (firstKey && firstKey !== prevFirstKey)) {
        return true;
      }
    }
    return false;
  }

  // ─── diagnostics ─────────────────────────────────────────────────────────
  // Structure only: text nodes become "…", record ids in hrefs become "ID",
  // so the report can be shared without leaking lead data.
  function describe(el) {
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 6).join('.') : '';
    const data = Array.from(el.attributes || []).filter((a) => a.name.startsWith('data-') || a.name.startsWith('aria-')).map((a) => `[${a.name}]`).join('');
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}${data}`;
  }
  function redactedHtml(el, limit = 7000) {
    const clone = el.cloneNode(true);
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const t of texts) if (t.nodeValue.trim()) t.nodeValue = '…';
    for (const n of clone.querySelectorAll('*')) {
      for (const a of Array.from(n.attributes)) {
        if (a.name === 'href' || a.name === 'src') n.setAttribute(a.name, a.value.replace(/[A-Za-z0-9_%-]*\d[A-Za-z0-9_%-]*|[A-Za-z0-9_%-]{14,}/g, 'ID').slice(0, 80));
        else if (/^(alt|title|aria-label)$/.test(a.name) && a.value) n.setAttribute(a.name, '…');
        else if (a.value.length > 60) n.setAttribute(a.name, a.value.slice(0, 60) + '…');
      }
      if (n.tagName === 'svg' || n.tagName === 'SVG' || n.tagName === 'IMG') n.replaceWith(document.createComment(n.tagName.toLowerCase()));
    }
    const html = clone.outerHTML.replace(/>\s+</g, '><');
    return html.length > limit ? html.slice(0, limit) + `\n<!-- truncated, ${html.length} chars total -->` : html;
  }
  function buildDiagnostics() {
    const S = CONFIG.selectors;
    const links = qa(document, S.leadLink);
    const rep = {
      extensionVersion: chrome.runtime.getManifest().version,
      path: location.pathname.replace(/\d{5,}/g, 'ID'),
      leadLinks: links.length,
      distinctLeads: new Set(links.map(leadKeyOf)).size,
      rowSelectorHits: Object.fromEntries(S.resultRow.map((sel) => { try { return [sel, document.querySelectorAll(sel).length]; } catch (_) { return [sel, 'invalid']; } })),
      fieldSelectorHits: {},
      nextButton: (() => { const b = findNextButton(); return b ? { found: true, desc: describe(b), disabled: nextIsDisabled(b) } : { found: false }; })(),
      pageIndicators: readTotalPages(),
      ancestors: [],
      rowHtml: '',
    };
    for (const key of ['name', 'title', 'company', 'companyLink', 'location', 'tenure']) {
      rep.fieldSelectorHits[key] = S[key].map((sel) => { try { return `${sel} → ${document.querySelectorAll(sel).length}`; } catch (_) { return `${sel} → invalid`; } });
    }
    if (links.length) {
      let node = links[0];
      for (let i = 0; i < 20 && node && node !== document.body; i++) {
        rep.ancestors.push({
          depth: i, el: describe(node),
          distinctLeads: new Set(qa(node, S.leadLink).map(leadKeyOf)).size,
          textLen: (node.innerText || '').length,
          textLines: (node.innerText || '').split('\n').filter((l) => l.trim()).length,
        });
        node = node.parentElement;
      }
      rep.rowHtml = redactedHtml(rowForLink(links[0]));
    }
    return rep;
  }

  // ─── main loop ───────────────────────────────────────────────────────────
  let loopActive = false;

  async function runExport() {
    if (loopActive) return;
    loopActive = true;
    try {
      let s = await loadState();
      if (!s.running) return;

      for (let guard = 0; guard < CONFIG.maxPages; guard++) {
        s = await loadState();
        if (!s.running) {
          pushLog(s, 'Stopped by user.');
          await saveState(s);
          return;
        }

        const rows0 = await waitForRows();
        if (!rows0.length) {
          s.error = 'No lead rows found on this page. Selectors may need updating (see README).';
          pushLog(s, s.error);
          s.running = false;
          s.finishedAt = Date.now();
          await saveState(s);
          return;
        }

        const rows = await scrollToRenderAll();
        // Prefer what the page says; otherwise count up from the last page seen.
        const pageNum = readCurrentPageOrNull() ?? (s.page || 0) + 1;
        s.page = pageNum;
        s.totalPages = readTotalPages() || s.totalPages;
        if (!s.listName) s.listName = readListName();

        let added = 0;
        for (const row of rows) {
          const lead = scrapeRow(row, pageNum);
          if (!lead.name && !lead.profile_url) continue;
          if (!s.leads[lead.key]) added++;
          s.leads[lead.key] = lead;
        }
        pushLog(
          s,
          `Page ${pageNum}${s.totalPages ? ` of ${s.totalPages}` : ''}: ${rows.length} rows, ${added} new (total ${Object.keys(s.leads).length}).`
        );
        await saveState(s);

        const nextBtn = findNextButton();
        if (nextIsDisabled(nextBtn)) {
          pushLog(s, nextBtn ? 'Reached last page. Done.' : 'No "Next" button found; assuming single page. Done.');
          s.running = false;
          s.finishedAt = Date.now();
          await saveState(s);
          return;
        }

        const prevUrl = location.href;
        const prevFirstKey = scrapeRow(rows[0], pageNum).key;
        nextBtn.scrollIntoView({ block: 'center' });
        await sleep(300);
        nextBtn.click();

        const changed = await waitForPageChange(prevFirstKey, prevUrl);
        if (!changed) {
          pushLog(s, 'Clicked Next but the page did not change; stopping to avoid a loop.');
          s.running = false;
          s.finishedAt = Date.now();
          await saveState(s);
          return;
        }
        await randDelay();
      }

      s = await loadState();
      pushLog(s, `Hit the ${CONFIG.maxPages}-page safety limit; stopping.`);
      s.running = false;
      s.finishedAt = Date.now();
      await saveState(s);
    } catch (err) {
      const s = await loadState();
      s.error = String(err && err.message ? err.message : err);
      pushLog(s, `Error: ${s.error}`);
      s.running = false;
      s.finishedAt = Date.now();
      await saveState(s);
    } finally {
      loopActive = false;
    }
  }

  // ─── messages from popup ─────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      switch (msg && msg.type) {
        case 'snx:ping': {
          const s = await loadState();
          sendResponse({
            ok: true,
            supported: isSupportedPage(),
            listKey: listKeyFromLocation(),
            listName: readListName(),
            state: summarize(s),
          });
          break;
        }
        case 'snx:diagnose': {
          sendResponse({ ok: true, report: buildDiagnostics() });
          break;
        }
        case 'snx:preview': {
          const rows = await scrollToRenderAll();
          const leads = rows.map((r) => scrapeRow(r, readCurrentPage()));
          sendResponse({
            ok: true,
            rows: rows.length,
            totalPages: readTotalPages(),
            currentPage: readCurrentPage(),
            nextFound: !!findNextButton(),
            sample: leads.slice(0, 5),
          });
          break;
        }
        case 'snx:start': {
          const s = await loadState();
          const key = listKeyFromLocation();
          // Starting on a different list (or with reset requested) clears old data.
          if (msg.reset || s.listKey !== key) {
            s.leads = {};
            s.log = [];
            s.page = 0;
            s.totalPages = null;
            s.listName = '';
          }
          s.listKey = key;
          s.running = true;
          s.error = null;
          s.finishedAt = null;
          s.startedAt = s.startedAt && !msg.reset ? s.startedAt : Date.now();
          pushLog(s, `Starting export of ${key}`);
          await saveState(s);
          runExport(); // don't await; respond immediately
          sendResponse({ ok: true });
          break;
        }
        case 'snx:stop': {
          const s = await loadState();
          s.running = false;
          pushLog(s, 'Stop requested…');
          await saveState(s);
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: 'unknown message' });
      }
    })().catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // keep the channel open for the async response
  });

  // ─── resume after a full page load ───────────────────────────────────────
  // If the export was running and the tab reloaded (or LinkedIn did a hard
  // navigation), pick up where we left off.
  (async () => {
    const s = await loadState();
    if (s.running && s.listKey === listKeyFromLocation()) {
      log('Resuming export after page load');
      await sleep(1500);
      runExport();
    }
  })();
})();
