/* Reads the Nooks dialer list and sends the rows to the side panel.
 *
 * Nooks' internal markup isn't documented, so this goes by what's visible instead of class names:
 * 1. Find the column headers by their text (Status, Name, Phone, Persona, Title, Account, ...).
 * 2. Find every phone number on screen; each one marks a prospect row.
 * 3. Assign the text around each phone number to a column by horizontal position.
 * If Nooks renames a column header, update HEADERS below.
 */
(() => {
  if (globalThis.__callCopilotScraper) return; // already injected into this frame
  globalThis.__callCopilotScraper = true;

  const HEADERS = {
    status: "status", name: "name", phone: "phone", persona: "persona", title: "title",
    account: "account", step: "sequence step", sequence: "sequence", due: "due at",
  };
  const PHONE_RE = /^\+?[\d\s().-]{10,20}$/;
  const ROW_HALF_HEIGHT = 32; // px above/below the phone number that still counts as the same row

  function textNodes(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      // Drop icon glyphs (checkboxes, chevrons, speaker icons) so only words and numbers remain.
      const text = n.nodeValue.replace(/[^\p{L}\p{N}\s.,&'()#+\-\/@:\[\]]/gu, " ").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width && r.height) out.push({ text, x: r.left + r.width / 2, y: r.top + r.height / 2, r });
    }
    return out;
  }

  function findHeaders(nodes) {
    const wanted = Object.entries(HEADERS);
    // Header labels sit on one line; group candidates by their y position and keep the best line.
    const lines = new Map();
    for (const n of nodes) {
      const hit = wanted.find(([, label]) => n.text.toLowerCase() === label);
      if (!hit) continue;
      const key = Math.round(n.y / 8);
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push({ col: hit[0], left: n.r.left, y: n.y });
    }
    const best = [...lines.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    const cols = new Set(best.map((h) => h.col));
    if (!cols.has("name") || !cols.has("phone")) return null;
    // Each column runs from its header's left edge to the next header's left edge.
    best.sort((a, b) => a.left - b.left);
    return best.map((h, i) => ({ col: h.col, from: i === 0 ? -Infinity : h.left - 12, to: best[i + 1] ? best[i + 1].left - 12 : Infinity, y: h.y }));
  }

  function scrape() {
    const nodes = textNodes(document.body);
    const cols = findHeaders(nodes);
    if (!cols) return { ok: false, reason: "Couldn't find the Name / Phone column headers on this page." };
    const headerY = cols[0].y;
    const colFor = (x) => cols.find((c) => x >= c.from && x < c.to)?.col;

    const phoneCol = cols.find((c) => c.col === "phone");
    const phones = nodes.filter((n) => n.y > headerY + 5 && PHONE_RE.test(n.text) && n.x >= phoneCol.from && n.x < phoneCol.to);

    const rows = phones.map((ph) => {
      const row = {};
      for (const n of nodes) {
        if (Math.abs(n.y - ph.y) > ROW_HALF_HEIGHT) continue;
        const col = colFor(n.x);
        if (col) row[col] = row[col] ? `${row[col]} ${n.text}` : n.text;
      }
      row.phone = ph.text;
      return row;
    });
    return { ok: true, rows };
  }

  let last = "";
  let timer;
  function report(force) {
    let result;
    try { result = scrape(); } catch (e) { result = { ok: false, reason: String(e) }; }
    const json = JSON.stringify(result);
    if (!force && json === last) return;
    last = json;
    chrome.runtime.sendMessage({ type: "nooks-rows", url: location.href, ...result }).catch(() => {});
  }

  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(report, 300);
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "nooks-rescan") report(true);
  });

  report(true);
})();
