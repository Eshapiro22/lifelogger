// Runs inside Outreach tabs. Executes single steps sent by the dashboard
// and, when asked, records the user's clicks/typing as steps.
(() => {
  if (window.__outreachSenderLoaded) return;
  window.__outreachSenderLoaded = true;

  const CLICKABLE = "button, a, [role='button'], [role='menuitem'], [role='option'], [role='tab'], [role='link'], li, label, span, div";
  const INPUTS = "input:not([type='hidden']):not([type='checkbox']):not([type='radio']), textarea, [contenteditable='true'], [role='combobox'], [role='searchbox']";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function visible(el) {
    if (!el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return el.getClientRects().length > 0;
  }

  function labelOf(el) {
    const parts = [el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('name'), el.getAttribute('title')];
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) parts.push(lbl.innerText);
    }
    const by = el.getAttribute('aria-labelledby');
    if (by) by.split(/\s+/).forEach(id => parts.push(document.getElementById(id)?.innerText));
    return clean(parts.filter(Boolean).join(' '));
  }

  // Resolves a target description to one element, or null.
  function find(target, forInput = false) {
    const scope = target.within ? document.querySelector(target.within) : document;
    if (!scope) return null;
    let els = [...scope.querySelectorAll(target.selector || (target.text ? CLICKABLE : forInput ? INPUTS : '*'))].filter(visible);

    if (target.label) {
      const want = clean(target.label);
      els = els.filter(el => labelOf(el).includes(want));
    }
    if (target.text) {
      const options = [].concat(target.text).map(clean).filter(Boolean);
      let matched = [];
      // Try each alternative in order; exact text beats substring.
      for (const opt of options) {
        matched = els.filter(el => clean(el.innerText || el.value) === opt);
        if (!matched.length) matched = els.filter(el => clean(el.innerText || el.value).includes(opt));
        if (matched.length) break;
      }
      // Prefer the innermost match (a <span> inside a <button> -> the button's text is the same,
      // so keep elements that don't contain another match).
      els = matched.filter(el => !matched.some(o => o !== el && el.contains(o)));
      // Then climb to the nearest real clickable ancestor.
      els = els.map(el => el.closest("button, a, [role='button'], [role='menuitem'], [role='option'], [role='tab'], li") || el);
    }
    // When a modal/popover is open, the user would be clicking inside it, so prefer
    // matches there (e.g. the confirm "Add to sequence" over the page's own button).
    const overlay = "[role='dialog'], [aria-modal='true'], dialog[open], [role='listbox'], [role='menu']";
    const inOverlay = els.filter(el => el.closest(overlay));
    if (inOverlay.length) els = inOverlay;
    return els[target.nth || 0] || null;
  }

  async function waitFind(target, timeout = 10000, forInput = false) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const el = find(target, forInput);
      if (el) return el;
      await sleep(250);
    }
    throw new Error(`Element not found: ${JSON.stringify(target)}`);
  }

  function realClick(el) {
    el.scrollIntoView({ block: 'center' });
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  }

  function setValue(el, value) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand('selectAll');
      document.execCommand('insertText', false, value);
      return;
    }
    // Use the native setter so React/Ember-controlled inputs see the change.
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pressKey(key) {
    const el = document.activeElement || document.body;
    const codes = { Enter: 13, Escape: 27, Tab: 9 };
    const init = { key, code: key, keyCode: codes[key], which: codes[key], bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', init));
    el.dispatchEvent(new KeyboardEvent('keypress', init));
    el.dispatchEvent(new KeyboardEvent('keyup', init));
  }

  // Finds result "rows" without knowing the page's markup: each link to a
  // prospect (/prospects/<id>) is widened to the largest ancestor that still
  // links to only that one prospect.
  function rowsFromProspectLinks() {
    const idOf = a => (a.getAttribute('href') || '').match(/\/prospects\/(\d+)/)?.[1];
    const links = [...document.querySelectorAll("a[href*='/prospects/']")].filter(a => idOf(a) && visible(a));
    const rows = new Map();
    for (const a of links) {
      const id = idOf(a);
      if (rows.has(id)) continue;
      let row = a;
      while (row.parentElement && row.parentElement !== document.body) {
        const ids = new Set([...row.parentElement.querySelectorAll("a[href*='/prospects/']")].map(idOf).filter(Boolean));
        // Stop before a prospect's "row" grows into a whole page section.
        if (ids.size > 1 || row.parentElement.innerText.length > 600) break;
        row = row.parentElement;
      }
      rows.set(id, row);
    }
    return [...rows.values()];
  }

  function matchingRows(step, must) {
    const byText = r => must.every(m => clean(r.innerText).includes(m));
    let rows = step.rows ? [...document.querySelectorAll(step.rows)].filter(visible).filter(byText) : [];
    rows = rows.filter(r => !rows.some(o => o !== r && r.contains(o)));
    if (!rows.length) rows = rowsFromProspectLinks().filter(byText);
    return rows;
  }

  let lastTyped = null;

  async function pickResult(step) {
    const must = (step.mustContain || []).map(clean).filter(Boolean);
    const prefer = (step.prefer || []).map(clean).filter(Boolean);
    if (!must.length) throw new Error('pickResult has no non-empty mustContain values (missing name in CSV?)');
    const end = Date.now() + (step.timeout || 10000);
    let rows = [];
    while (Date.now() < end) {
      rows = matchingRows(step, must);
      if (rows.length) break;
      await sleep(300);
    }
    if (!rows.length) {
      const text = clean(document.body.innerText);
      const facts = [
        `page ${location.pathname}${location.search}`,
        lastTyped ? `typed "${lastTyped.value}" into ${lastTyped.desc}` : 'nothing typed',
        `${step.rows ? document.querySelectorAll(step.rows).length : 0} rows matched the rows selector`,
        `${rowsFromProspectLinks().length} prospect links on page`,
        `name ${must.every(m => text.includes(m)) ? 'IS' : 'is not'} visible on page`,
      ];
      throw new Error(`No matching prospect found in Outreach (${facts.join('; ')})`);
    }
    if (rows.length > 1 && prefer.length) {
      const narrowed = rows.filter(r => prefer.some(p => clean(r.innerText).includes(p)));
      if (narrowed.length) rows = narrowed;
    }
    if (rows.length > 1) throw new Error(`Ambiguous: ${rows.length} prospects match — skipped for manual review`);
    const row = rows[0];
    realClick((step.click && row.querySelector(step.click)) || row.querySelector("a[href*='/prospects/']") || row);
    return `matched: ${row.innerText.replace(/\s+/g, ' ').slice(0, 80)}`;
  }

  async function runStep(step, dryRun) {
    switch (step.action) {
      case 'waitFor':
        await waitFind(step.target, step.timeout);
        return;
      case 'click': {
        const el = await waitFind(step.target, step.timeout);
        if (step.final && dryRun) return `DRY RUN — would click "${(el.innerText || '').trim().slice(0, 40)}"`;
        realClick(el);
        return;
      }
      case 'type': {
        const el = await waitFind(step.target, step.timeout, true);
        if (step.clear !== false) setValue(el, '');
        setValue(el, step.value ?? '');
        const desc = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName.toLowerCase();
        lastTyped = { value: step.value ?? '', desc: `"${desc}"` };
        return `typed into ${lastTyped.desc}`;
      }
      case 'key':
        pressKey(step.key);
        return;
      case 'assertText': {
        const end = Date.now() + (step.timeout || 10000);
        while (Date.now() < end) {
          if (clean(document.body.innerText).includes(clean(step.text))) return;
          await sleep(300);
        }
        throw new Error(`Text not found on page: "${step.text}"`);
      }
      case 'pickResult':
        return pickResult(step);
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  // ---------- Recorder ----------
  let recording = false;
  let typeTimer = null;

  function emit(step) {
    chrome.runtime.sendMessage({ type: 'recorded', step }).catch(() => {});
  }

  function describeClickTarget(el) {
    const clickable = el.closest("button, a, [role='button'], [role='menuitem'], [role='option'], [role='tab'], [role='row'], li") || el;
    const text = (clickable.innerText || '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= 60) return { text };
    const aria = clickable.getAttribute('aria-label');
    if (aria) return { selector: `[aria-label="${CSS.escape(aria)}"]` };
    const testId = clickable.getAttribute('data-testid');
    if (testId) return { selector: `[data-testid="${CSS.escape(testId)}"]` };
    return { selector: cssPath(clickable) };
  }

  function cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 5) {
      let part = el.tagName.toLowerCase();
      if (el.id && !/\d{3,}/.test(el.id)) { parts.unshift(`#${CSS.escape(el.id)}`); break; }
      const siblings = el.parentElement ? [...el.parentElement.children].filter(s => s.tagName === el.tagName) : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(el) + 1})`;
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function onClick(e) {
    if (!recording || e.target.matches?.(INPUTS)) return;
    emit({ action: 'click', target: describeClickTarget(e.target) });
  }

  function onInput(e) {
    if (!recording || !e.target.matches?.(INPUTS)) return;
    const el = e.target;
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => {
      const label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name');
      const target = label ? { label } : { selector: cssPath(el) };
      emit({ action: 'type', target, value: el.isContentEditable ? el.innerText : el.value, clear: true });
    }, 800);
  }

  function onKey(e) {
    if (recording && (e.key === 'Enter' || e.key === 'Escape') && e.isTrusted) emit({ action: 'key', key: e.key });
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('keydown', onKey, true);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'ping') { sendResponse({ ok: true }); return; }
    if (msg.type === 'record') { recording = !!msg.on; sendResponse({ ok: true }); return; }
    if (msg.type === 'step') {
      runStep(msg.step, msg.dryRun)
        .then(detail => sendResponse({ ok: true, detail }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true; // async response
    }
  });
})();
