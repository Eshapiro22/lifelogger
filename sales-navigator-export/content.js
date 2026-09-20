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
        '[data-anonymize="job-title"]',
        '.artdeco-entity-lockup__metadata',
      ],
      degree: [
        '.artdeco-entity-lockup__degree',
        '[class*="degree"]',
      ],
      // Sales Navigator's CRM-sync badge ("In CRM" / "Not in CRM")
      crmIn: ['[data-x--crm-badge-in-crm]', '[class*="in-crm-icon"]:not([class*="not-in-crm"])'],
      crmNotIn: ['[data-x--crm-badge-not-in-crm]', '[class*="not-in-crm-icon"]'],
      crmBadge: [
        '[data-x-crm-badge] .artdeco-button__text',
        '[class*="crm-badge"]',
      ],
      blurb: [
        '[data-anonymize="person-blurb"]',
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

      // "Save search results to a list" flow. All have text-based fallbacks.
      selectAllCheckbox: [
        'input[type="checkbox"][aria-label*="select all" i]',
        'input[type="checkbox"][id*="select-all" i]',
        'input[type="checkbox"][id*="multi-selector"][id*="all" i]',
        '.search-results__select-all input[type="checkbox"]',
        '[data-x--select-all] input[type="checkbox"]',
        'thead input[type="checkbox"]',
      ],
      rowCheckbox: [
        'input[type="checkbox"][id^="multi-selector-checkbox"]',
        'input[type="checkbox"]',
      ],
      saveToListButton: [
        'button[aria-label*="save to list" i]',
        'button[aria-label*="add to list" i]',
        '[data-x--hue-list-dropdown--trigger]',
        'button[class*="save-to-list"]',
        '[data-control-name*="save_to_list"]',
      ],
      listMenu: [
        '[id^="hue-menu-"]',
        '[class*="hue-menu"]',
        '.artdeco-dropdown__content--is-open',
        '[class*="save-to-list"][class*="content"]',
        '[role="menu"]',
        '[role="listbox"]',
        '[role="dialog"]',
      ],
      listMenuItem: [
        '[role="menuitem"]', '[role="option"]', '[role="menuitemcheckbox"]', 'label', 'button', 'li',
      ],
      createListInput: [
        'input[type="text"]', 'input:not([type])', 'textarea',
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
    const container = getScrollContainer();
    for (const a of qa(document, S.leadLink)) {
      if (container && !container.contains(a)) continue;
      const row = rowForLink(a);
      if (!seen.has(row)) { seen.add(row); rows.push(row); }
    }
    if (rows.length) return rows;
    // Secondary: configured row selectors.
    return qa(document, S.resultRow).filter((r) => q(r, S.leadLink));
  }

  // ─── DOM: text-based field parsing (used when field selectors miss) ──────
  const JUNK_LINE = /^(1st|2nd|3rd|•|·|save|saved|unsave|message|add to list|save to list|view profile|connect|follow|more|see more|…|premium|linkedin member|open link|in your network|in crm|not in crm|\d+\s+(mutual|shared)\s+connections?|\d+\s+(new|recent)\s+.*|list of .*|remove from list)$/i;
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
    // The name link is the profile link with real text; skip CTA links like "View profile".
    const CTA = /^(view profile|save|saved|message|connect|follow|view|open)\b/i;
    const named = leadLinks.filter((a) => txt(a) && !CTA.test(txt(a)));
    const link = (named.length ? named : leadLinks).slice().sort((a, b) => txt(b).length - txt(a).length)[0] || null;
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
    const degree = txt(q(row, S.degree)).replace(/[^0-9a-z+]/gi, '');
    // Yes/No from the badge's own markers; fall back to the badge text.
    const inCrm = q(row, S.crmIn) ? 'Yes' : q(row, S.crmNotIn) ? 'No' : txt(q(row, S.crmBadge));
    const blurb = txt(q(row, S.blurb));

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
      degree,
      in_crm: inCrm,
      blurb,
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
    const isVisible = (el) => !!el && el.getClientRects().length > 0;
    let cands = [];
    for (const sel of S.nextButton) {
      try { cands.push(...document.querySelectorAll(sel)); } catch (_) { /* skip */ }
    }
    for (const b of document.querySelectorAll('button')) {
      if (/^\s*next\s*$/i.test(b.textContent || '')) cands.push(b);
    }
    cands = Array.from(new Set(cands));
    if (!cands.length) return null;
    const rank = (b) => (isVisible(b) ? 4 : 0) + (!nextIsDisabled(b) ? 2 : 0) + (b.closest('.artdeco-pagination, [class*="pagination"], nav') ? 1 : 0);
    // Highest rank wins; ties go to the later one in document order (pagination sits at the bottom).
    let best = null;
    for (const b of cands) if (!best || rank(b) >= rank(best)) best = b;
    return best;
  }
  function findPageNumberButton(n) {
    const S = CONFIG.selectors;
    const items = qa(document, S.pageIndicator);
    for (const li of items) {
      if (parseInt(txt(li), 10) !== n) continue;
      return li.querySelector('button, a') || li;
    }
    for (const b of document.querySelectorAll('.artdeco-pagination button, [class*="pagination"] button')) {
      if (txt(b) === String(n)) return b;
    }
    return null;
  }
  // Move to the next page: Next button → numbered page button → URL page param.
  // Returns 'clicked' / 'numbered' when the page changed in place, 'reload'
  // when a full navigation was issued (the loop resumes on load), or null.
  async function advancePage(pageNum, prevFirstKey) {
    const prevUrl = location.href;
    const nextBtn = findNextButton();
    if (nextBtn && !nextIsDisabled(nextBtn)) {
      nextBtn.scrollIntoView({ block: 'center' });
      await sleep(300);
      nextBtn.click();
      if (await waitForPageChange(prevFirstKey, prevUrl, 10000)) return 'clicked';
      // Ember sometimes wants a real pointer sequence.
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        nextBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
      if (await waitForPageChange(prevFirstKey, prevUrl, 8000)) return 'clicked';
    }
    const numBtn = pageNum ? findPageNumberButton(pageNum + 1) : null;
    if (numBtn) {
      numBtn.scrollIntoView({ block: 'center' });
      await sleep(300);
      numBtn.click();
      if (await waitForPageChange(prevFirstKey, prevUrl, 10000)) return 'numbered';
    }
    if (pageNum) {
      const u = new URL(location.href);
      u.searchParams.set('page', String(pageNum + 1));
      if (u.toString() !== location.href) {
        location.href = u.toString();
        return 'reload';
      }
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

  // ─── Save all search results to a lead list ──────────────────────────────
  const SAVE_KEY = 'snx_save_state';
  const visible = (el) => {
    if (!el || !el.getClientRects().length) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.opacity !== '0';
  };
  // An open popover has content; LinkedIn keeps the empty container around.
  const isOpenMenu = (el) => visible(el) && el.childElementCount > 0;
  function findByText(root, tags, re) {
    for (const el of root.querySelectorAll(tags)) {
      if (visible(el) && re.test(txt(el))) return el;
    }
    return null;
  }
  // Prefer the innermost element whose text matches (a <li> wrapping a <label>
  // wrapping the text all "match"; we want the label).
  function findAllByText(root, tags, re) {
    return Array.from(root.querySelectorAll(tags)).filter((el) => visible(el) && re.test(txt(el)));
  }
  function innermost(els) {
    return els.filter((el) => !els.some((o) => o !== el && el.contains(o)));
  }

  function findSelectAll() {
    const S = CONFIG.selectors;
    const rows = findRows();
    const inRow = (el) => rows.some((r) => r.contains(el));
    const cb = qa(document, S.selectAllCheckbox).find((el) => visible(el) && !inRow(el));
    if (cb) return cb;
    // Fallback: a visible checkbox outside every lead card, positioned before
    // the first card in document order (the header "select all" box).
    const firstRow = rows[0];
    if (!firstRow) return null;
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter((b) => visible(b) && !inRow(b));
    const before = boxes.filter((b) => b.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before.length ? before[before.length - 1] : null;
  }
  function rowCheckboxes() {
    return findRows().map((r) => q(r, CONFIG.selectors.rowCheckbox)).filter(visible);
  }
  function selectedCount() {
    return rowCheckboxes().filter((cb) => cb.checked).length;
  }
  async function toggleCheckbox(cb, want) {
    if (cb.checked === want) return true;
    cb.click();
    await sleep(250);
    if (cb.checked !== want) {
      // Some UIs listen on the label / wrapper rather than the input.
      const label = cb.closest('label') || (cb.id && document.querySelector(`label[for="${cb.id}"]`));
      if (label) { label.click(); await sleep(250); }
    }
    return cb.checked === want;
  }
  async function selectAllOnPage() {
    const master = findSelectAll();
    const total = rowCheckboxes().length;
    let method = master ? 'select-all' : 'per-row (no select-all found)';
    if (master) {
      await toggleCheckbox(master, true);
      await sleep(400);
    }
    let n = selectedCount();
    if (n < total) {
      // Top up whatever the header box missed (or everything, if none).
      for (const cb of rowCheckboxes()) if (!cb.checked) await toggleCheckbox(cb, true);
      const n2 = selectedCount();
      if (n2 > n) method = master ? `select-all + ${n2 - n} per-row` : method;
      n = n2;
    }
    return { method, selected: n, total };
  }
  async function deselectAllOnPage() {
    const master = findSelectAll();
    if (master && master.checked) await toggleCheckbox(master, false);
    for (const cb of rowCheckboxes()) if (cb.checked) await toggleCheckbox(cb, false);
  }

  function findSaveToList() {
    const S = CONFIG.selectors;
    return (
      qa(document, S.saveToListButton).find(visible) ||
      findByText(document, 'button, a, [role="button"]', /^\s*(save|add) to list\s*$/i) ||
      findByText(document, 'button, a, [role="button"]', /(save|add) to list/i) ||
      Array.from(document.querySelectorAll('button[aria-label], [role="button"][aria-label]')).find((b) => visible(b) && /(save|add) to list/i.test(b.getAttribute('aria-label')))
    );
  }
  function findOpenMenu(anchor) {
    const S = CONFIG.selectors;
    const menus = qa(document, S.listMenu).filter(isOpenMenu);
    // Prefer a menu that is not an ancestor of the trigger (i.e. a popover).
    return menus.find((m) => !anchor || !m.contains(anchor)) || menus[0] || null;
  }
  const ROW_SEL = 'label, li, [role="menuitem"], [role="option"], [role="menuitemcheckbox"], [role="menuitemradio"], button, a, [role="button"]';
  function rowOf(el) {
    return el.closest(ROW_SEL) || el;
  }
  function menuItems(menu) {
    const S = CONFIG.selectors;
    const els = Array.from(menu.querySelectorAll(S.listMenuItem.join(','))).filter((el) => visible(el) && txt(el));
    // Rows that own a checkbox/radio count even if they're plain <div>s.
    for (const box of menu.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
      if (!visible(box)) continue;
      const row = box.closest('label, li, [role], div') || box.parentElement;
      if (row && txt(row)) els.push(row);
    }
    return innermost(els);
  }
  const normName = (t) => t.toLowerCase().replace(/\s+/g, ' ').replace(/\s*\(\d[\d,]*\)\s*$/, '').replace(/\s*·?\s*\d[\d,]*\s*(leads?|members?|people)\s*$/, '').trim();
  function findListItem(menu, name) {
    const n = normName(name);
    if (!n) return null;
    const items = menuItems(menu);
    const hit =
      items.find((el) => normName(txt(el)) === n) ||
      items.find((el) => normName(txt(el)).startsWith(n)) ||
      null;
    if (hit) return hit;
    // Text scan: any visible descendant whose own text is the name, then its row.
    const all = Array.from(menu.querySelectorAll('*')).filter((el) => visible(el) && el.children.length <= 2 && normName(txt(el)) === n);
    const inner = innermost(all);
    return inner.length ? rowOf(inner[0]) : null;
  }
  // The popover we opened, as long as it's still visible; otherwise whatever is open now.
  function currentMenu(menu) {
    return menu && visible(menu) ? menu : findOpenMenu();
  }
  // If the menu has a search box, filter by the name and look again.
  async function findListItemWithSearch(menu, name) {
    let item = findListItem(menu, name);
    if (item) return { item, menu };
    const box = findMenuInput(menu);
    if (!box) return { item: null, menu };
    box.focus();
    setInputValue(box, name);
    await sleep(900);
    const scope = currentMenu(menu) || menu;
    await waitFor(() => findListItem(scope, name) || findCreateControl(scope), 5000);
    return { item: findListItem(scope, name), menu: scope };
  }
  // Pick a list in the menu. If the item wraps a checkbox/radio, toggle that
  // input directly (clicking the label can fire twice and un-tick it) and
  // verify; then press a Save/Done/Apply button if the menu has one.
  async function pickListItem(item, menu) {
    const input = item.querySelector('input[type="checkbox"], input[type="radio"]') ||
      (item.tagName === 'INPUT' ? item : null) ||
      (item.id && document.querySelector(`input[aria-labelledby="${item.id}"]`)) || null;
    if (input) {
      if (input.checked) {
        // Already ticked for this selection = these leads are already in the
        // list. Clicking would remove them, so leave it.
        return 'already-in-list';
      }
      input.click(); await sleep(250);
      if (!input.checked) { item.click(); await sleep(250); }
    } else {
      item.click();
      await sleep(250);
    }
    const scope = currentMenu(menu) || menu;
    const confirmBtn = scope && findByText(scope, 'button, [role="button"]', /^\s*(save|done|apply)\s*$/i);
    if (confirmBtn && !confirmBtn.disabled) { confirmBtn.click(); await sleep(400); }
    return 'picked';
  }
  // Text of an element for matching purposes: visible text, aria-label, title, placeholder.
  function labelOf(el) {
    return [txt(el), el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('placeholder')]
      .filter(Boolean).join(' | ');
  }
  const CREATE_RE = /create|new\s+list|add\s+(a\s+)?(new\s+)?list|\+\s*list|^\s*new\s*$/i;
  const CLICKABLE = 'button, a, [role="button"], [role="menuitem"], [role="option"], li, label';
  function findCreateControl(menu, menuOnly = false) {
    const dialog = Array.from(document.querySelectorAll('[role="dialog"], [class*="modal"]')).find(isOpenMenu);
    const scopes = menuOnly ? [menu] : [menu, dialog];
    for (const scope of scopes) {
      if (!scope) continue;
      const hits = Array.from(scope.querySelectorAll('button, a, [role="button"], [role="menuitem"], [role="option"], li, label, span, div, p'))
        .filter((el) => visible(el) && CREATE_RE.test(labelOf(el)) && labelOf(el).length < 80);
      const inner = innermost(hits);
      for (const el of inner) {
        const clickable = el.closest(CLICKABLE) || el;
        if (visible(clickable)) return clickable;
      }
    }
    return null;
  }
  // A text box inside the menu (search lists / new list name).
  function findMenuInput(menu) {
    return Array.from(menu.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea')).find(visible) || null;
  }
  // What's in the open menu, for the preview report and error snapshots.
  function menuSnapshot(menu) {
    const controls = Array.from(menu.querySelectorAll('button, a, [role="button"], [role="menuitem"], [role="option"], input, textarea, label'))
      .filter(visible)
      .map((el) => ({
        el: describe(el),
        text: txt(el).slice(0, 60),
        aria: el.getAttribute('aria-label') || '',
        placeholder: el.getAttribute('placeholder') || '',
        type: el.getAttribute('type') || '',
      }));
    return { controls: controls.slice(0, 60), html: redactedHtml(menu, 5000) };
  }
  async function waitFor(fn, timeoutMs = 6000, step = 200) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }
  function setInputValue(input, value) {
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const CONTAINER_SEL = 'div, ul, ol, section, form, nav, aside, [role="menu"], [role="listbox"], [role="dialog"]';
  function visibleContainers() {
    return Array.from(document.querySelectorAll(CONTAINER_SEL)).filter(visible);
  }
  // Rank a candidate menu: rows with checkboxes and text beat bare boxes.
  function menuScore(el) {
    const boxes = el.querySelectorAll('input[type="checkbox"], input[type="radio"]').length;
    const inputs = el.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea').length;
    const textLen = (el.innerText || '').length;
    return boxes * 10 + inputs * 5 + Math.min(textLen, 400) / 40;
  }
  async function openListMenu() {
    const btn = findSaveToList();
    if (!btn) throw new Error('"Save to list" button not found (select leads first, or update selectors)');
    const before = new Set(visibleContainers());
    const locate = () => {
      // a. aria-controls / aria-owns points straight at the popover
      for (const attr of ['aria-controls', 'aria-owns']) {
        const id = btn.getAttribute(attr);
        const el = id && document.getElementById(id);
        if (el && isOpenMenu(el)) return el;
      }
      // b. whatever became visible after the click (outermost new containers)
      const fresh = visibleContainers().filter((el) => !before.has(el) && !el.contains(btn) && isOpenMenu(el));
      const outer = fresh.filter((el) => !fresh.some((o) => o !== el && o.contains(el)));
      if (outer.length) return outer.sort((a, b) => menuScore(b) - menuScore(a))[0];
      // c. configured selectors
      return findOpenMenu(btn);
    };
    let menu = null;
    for (let attempt = 0; attempt < 3 && !menu; attempt++) {
      if (attempt === 0) btn.click();
      else {
        // The first click can be swallowed right after a page change, or it
        // toggled a menu LinkedIn still thought was open. Try a real pointer
        // sequence, then keyboard activation.
        btn.focus();
        for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        }
        if (attempt === 2) btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      }
      menu = await waitFor(locate, attempt === 0 ? 3000 : 2500);
    }
    if (!menu) throw new Error('"Save to list" menu did not open (popover stayed empty/hidden after 3 clicks)');
    // Let the list rows render before reading them; a search box alone
    // doesn't count, the lists load after it right after a page change.
    await waitFor(() => menuItems(menu).length > 0 || findCreateControl(menu, true), 8000);
    await sleep(400);
    return { btn, menu };
  }
  async function closeMenus() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.click();
    await sleep(300);
  }
  async function createListNamed(menu, name) {
    const S = CONFIG.selectors;
    let ctl = findCreateControl(menu);
    if (!ctl) {
      // Some menus have a "search or create" box: typing a new name reveals a
      // "Create <name>" option.
      const box = findMenuInput(menu);
      if (box) {
        box.focus();
        setInputValue(box, name);
        await sleep(800);
        const scope = currentMenu(menu) || menu;
        const item = findListItem(scope, name);
        if (item) { await pickListItem(item, scope); await sleep(800); return; }
        ctl = findCreateControl(scope);
      }
    }
    if (!ctl) {
      const snap = menuSnapshot(currentMenu(menu) || menu);
      const err = new Error(`List "${name}" not in the menu and no "Create new list" control found. Menu controls: ${snap.controls.map((c) => c.text || c.aria || c.placeholder || c.el).filter(Boolean).join(' | ') || '(none)'}`);
      err.snapshot = snap;
      throw err;
    }
    ctl.click();
    const input = await waitFor(() => {
      const scope = currentMenu(menu) || findOpenMenu(ctl) || document;
      return qa(scope, S.createListInput).find(visible) || qa(document, S.createListInput).find(visible);
    });
    if (!input) throw new Error('Clicked "Create new list" but no name input appeared');
    input.focus();
    setInputValue(input, name);
    await sleep(300);
    const scope = input.closest('[role="dialog"], form, [class*="dropdown"], [class*="modal"]') || document;
    const submit =
      findByText(scope, 'button, [role="button"]', /^\s*(create|save|done|add)\s*$/i) ||
      findByText(document, 'button, [role="button"]', /^\s*(create|save|done|add)(\s+list)?\s*$/i);
    if (submit && !submit.disabled) submit.click();
    else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    await sleep(1200);
  }

  // Dry run: touches the UI (selects, opens the menu) but saves nothing, then
  // puts everything back. Returns what it found so the popup can show it.
  async function previewSaveFlow(listName) {
    const report = { listName, rows: 0, selectAll: null, selected: 0, saveButton: false, menuOpened: false, menuItems: [], listFound: false, createFound: false, error: null };
    try {
      await waitForRows();
      report.rows = (await scrollToRenderAll()).length;
      const master = findSelectAll();
      report.selectAll = master ? describe(master) : null;
      const sel = await selectAllOnPage();
      report.selected = sel.selected;
      report.selectMethod = sel.method;
      const btn = findSaveToList();
      report.saveButton = btn ? describe(btn) : false;
      if (btn) {
        const { menu } = await openListMenu();
        report.menuOpened = describe(menu);
        report.menuItems = menuItems(menu).map(txt).slice(0, 40);
        const found = listName ? await findListItemWithSearch(menu, listName) : { item: null, menu };
        report.listFound = found.item ? describe(found.item) : false;
        report.selectedOfTotal = `${sel.selected} of ${sel.total}`;
        const create = findCreateControl(menu);
        report.createFound = create ? describe(create) + ` "${labelOf(create).slice(0, 40)}"` : false;
        const box = findMenuInput(menu);
        report.menuInput = box ? describe(box) + (box.placeholder ? ` placeholder="${box.placeholder}"` : '') : false;
        report.menu = menuSnapshot(menu);
      }
    } catch (e) {
      report.error = String(e && e.message ? e.message : e);
    } finally {
      await closeMenus();
      await deselectAllOnPage();
    }
    return report;
  }

  // Open the menu and look for the list, retrying a couple of times because
  // the list rows load lazily (slowest right after a page change).
  async function locateList(listName, attempts = 3) {
    let last = null;
    for (let i = 0; i < attempts; i++) {
      const opened = await openListMenu();
      const found = await findListItemWithSearch(opened.menu, listName);
      if (found.item) return { ...found, attempts: i + 1 };
      last = found;
      if (i < attempts - 1) {
        await closeMenus();
        await sleep(1500 + i * 1500);
      }
    }
    return { item: null, menu: last ? last.menu : null, attempts };
  }

  async function loadSaveState() {
    const { [SAVE_KEY]: s } = await chrome.storage.local.get(SAVE_KEY);
    return s || { running: false, searchKey: null, listName: '', listCreated: false, page: 0, totalPages: null, pagesDone: 0, saved: 0, log: [], error: null, finishedAt: null };
  }
  async function saveSaveState(s) {
    await chrome.storage.local.set({ [SAVE_KEY]: s });
    chrome.runtime.sendMessage({ type: 'snx:save-progress' }).catch(() => {});
  }
  function pushSaveLog(s, msg) {
    s.log.push(`${new Date().toLocaleTimeString()}  ${msg}`);
    if (s.log.length > 200) s.log.shift();
    log('[save]', msg);
  }

  let saveLoopActive = false;
  async function runSaveToList() {
    if (saveLoopActive) return;
    saveLoopActive = true;
    try {
      for (let guard = 0; guard < CONFIG.maxPages; guard++) {
        const s = await loadSaveState();
        if (!s.running) return;
        const rows0 = await waitForRows();
        if (!rows0.length) { s.error = 'No lead rows found on this page.'; pushSaveLog(s, s.error); s.running = false; s.finishedAt = Date.now(); await saveSaveState(s); return; }
        const rows = await scrollToRenderAll();
        const pageNum = readCurrentPageOrNull() ?? (s.page || 0) + 1;
        s.page = pageNum;
        s.totalPages = readTotalPages() || s.totalPages;

        const sel = await selectAllOnPage();
        if (!sel.selected) { s.error = 'Could not select any leads on this page.'; pushSaveLog(s, s.error); s.running = false; s.finishedAt = Date.now(); await saveSaveState(s); return; }

        const found = await locateList(s.listName, s.pagesDone === 0 && !s.listCreated ? 1 : 3);
        const menu = found.menu;
        let item = found.item;
        let outcome = 'picked';
        if (item && found.attempts > 1) pushSaveLog(s, `List found on attempt ${found.attempts} (menu loaded slowly).`);
        if (!item && !s.listCreated && s.pagesDone === 0) {
          // First page of the run and the list doesn't exist yet: create it in
          // LinkedIn via the menu's "Create new list" control. Sales Navigator
          // saves the current selection into the new list as part of creation.
          pushSaveLog(s, `List "${s.listName}" does not exist yet; creating it in LinkedIn.`);
          await createListNamed(menu, s.listName);
          s.listCreated = true;
          await saveSaveState(s);
          await sleep(800);
          // If the menu is still open (or can be re-opened with the selection
          // intact), tick the new list in case creation didn't save it.
          const stillOpen = currentMenu(menu);
          const menu2 = stillOpen || (findSaveToList() ? (await openListMenu()).menu : null);
          item = menu2 ? findListItem(menu2, s.listName) : null;
          if (item) {
            await pickListItem(item, menu2);
            await sleep(1200);
          }
          outcome = 'created';
        } else if (!item) {
          // After page 1 the list must exist; never create a second one.
          const snapMenu = currentMenu(menu) || menu;
          s.snapshot = snapMenu ? menuSnapshot(snapMenu) : null;
          s.snapshotVersion = chrome.runtime.getManifest().version;
          const seen = snapMenu ? menuItems(snapMenu).map(txt).slice(0, 15).join(' | ') : '(no menu)';
          s.error = `List "${s.listName}" was not in the "Save to list" menu on page ${pageNum} after ${found.attempts} attempts` +
            (s.listCreated ? ' even though it was created on the first page. Stopped to avoid creating a duplicate; check the list in LinkedIn and resume.' : '. Stopped.') +
            ` Menu showed: ${seen || '(no rows)'}`;
          pushSaveLog(s, s.error);
          await closeMenus();
          await deselectAllOnPage();
          s.running = false; s.finishedAt = Date.now();
          await saveSaveState(s);
          return;
        } else {
          outcome = await pickListItem(item, menu);
          await sleep(1500);
        }
        await closeMenus();
        s.saved += sel.selected;
        s.pagesDone += 1;
        const verb = outcome === 'created' ? `created list "${s.listName}" and saved` : outcome === 'already-in-list' ? 'already in list:' : 'saved';
        pushSaveLog(s, `Page ${pageNum}${s.totalPages ? ` of ${s.totalPages}` : ''}: ${verb} ${sel.selected} of ${sel.total} leads (${sel.method}). Total ${s.saved}.`);
        await saveSaveState(s);

        const nextBtn = findNextButton();
        const lastPage = s.totalPages && pageNum >= s.totalPages;
        if (lastPage || nextIsDisabled(nextBtn)) { pushSaveLog(s, 'Reached last page. Done.'); s.running = false; s.finishedAt = Date.now(); await saveSaveState(s); return; }
        const prevFirstKey = scrapeRow(rows[0], pageNum).key;
        const how = await advancePage(pageNum, prevFirstKey);
        if (how === 'reload') return; // resumes on load
        if (!how) { pushSaveLog(s, 'Could not move to the next page (Next button, page number and URL all failed); stopping.'); s.running = false; s.finishedAt = Date.now(); await saveSaveState(s); return; }
        await randDelay();
      }
    } catch (err) {
      const s = await loadSaveState();
      s.error = String(err && err.message ? err.message : err);
      s.snapshot = err && err.snapshot ? err.snapshot : (findOpenMenu() ? menuSnapshot(findOpenMenu()) : null);
      s.snapshotVersion = chrome.runtime.getManifest().version;
      pushSaveLog(s, `Error: ${s.error}`);
      s.running = false; s.finishedAt = Date.now();
      await saveSaveState(s);
      await closeMenus();
      await deselectAllOnPage();
    } finally {
      saveLoopActive = false;
    }
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
        if ((s.totalPages && pageNum >= s.totalPages) || nextIsDisabled(nextBtn)) {
          pushLog(s, nextBtn ? 'Reached last page. Done.' : 'No "Next" button found; assuming single page. Done.');
          s.running = false;
          s.finishedAt = Date.now();
          await saveState(s);
          return;
        }

        const prevFirstKey = scrapeRow(rows[0], pageNum).key;
        const how = await advancePage(pageNum, prevFirstKey);
        if (how === 'reload') return; // full navigation; the loop resumes on load
        if (!how) {
          pushLog(s, 'Could not move to the next page (Next button, page number and URL all failed); stopping.');
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
            isSearch: location.pathname.startsWith('/sales/search/'),
            listKey: listKeyFromLocation(),
            listName: readListName(),
            state: summarize(s),
            saveState: await loadSaveState(),
          });
          break;
        }
        case 'snx:save-preview': {
          sendResponse({ ok: true, report: await previewSaveFlow(msg.listName || '') });
          break;
        }
        case 'snx:save-start': {
          const s = await loadSaveState();
          const key = listKeyFromLocation();
          if (s.searchKey !== key || msg.reset || s.listName !== msg.listName) { s.log = []; s.page = 0; s.totalPages = null; s.pagesDone = 0; s.saved = 0; s.listCreated = false; }
          s.searchKey = key; s.listName = msg.listName; s.running = true; s.error = null; s.finishedAt = null;
          // The same name doubles as the export label for the list later.
          const es = await loadState();
          if (!es.running) { es.listName = msg.listName; await saveState(es); }
          pushSaveLog(s, `Saving all results of ${key} to list "${msg.listName}"`);
          await saveSaveState(s);
          runSaveToList();
          sendResponse({ ok: true });
          break;
        }
        case 'snx:save-stop': {
          const s = await loadSaveState();
          s.running = false; pushSaveLog(s, 'Stop requested…');
          await saveSaveState(s);
          sendResponse({ ok: true });
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
        case 'snx:set-label': {
          const s = await loadState();
          s.listName = (msg.label || '').trim() || readListName();
          await saveState(s);
          sendResponse({ ok: true });
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
          if (msg.label && msg.label.trim()) s.listName = msg.label.trim();
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
    const ss = await loadSaveState();
    if (ss.running && ss.searchKey === listKeyFromLocation()) {
      log('Resuming save-to-list after page load');
      await sleep(1500);
      runSaveToList();
    }
  })();
})();
