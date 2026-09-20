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
  function findRows() {
    const S = CONFIG.selectors;
    let rows = qa(document, S.resultRow).filter((r) => q(r, S.leadLink));
    if (rows.length) return rows;

    // Fallback: every lead link → nearest list item / card ancestor.
    const links = qa(document, S.leadLink);
    const seen = new Set();
    rows = [];
    for (const a of links) {
      const row =
        a.closest('li') ||
        a.closest('[class*="result"]') ||
        a.closest('article') ||
        a.parentElement;
      if (row && !seen.has(row)) {
        seen.add(row);
        rows.push(row);
      }
    }
    return rows;
  }

  function scrapeRow(row, pageNum) {
    const S = CONFIG.selectors;
    const link = q(row, S.leadLink);
    const nameEl = q(row, S.name) || link;
    const companyEl = q(row, S.company);
    const companyLinkEl = q(row, S.companyLink);

    const name = txt(nameEl);
    const title = txt(q(row, S.title));
    const company = txt(companyEl);
    const locationStr = txt(q(row, S.location));
    const tenure = txt(q(row, S.tenure));
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
