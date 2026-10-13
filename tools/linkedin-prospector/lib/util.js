// Shared helpers. Loaded as a plain script in the content script and extension
// pages (attaches to `LP`), and via require() in Node tests.
(function (root) {
  const LP = root.LP || (root.LP = {});

  const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  };

  function stripAccents(s) {
    return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '');
  }

  // "Vanessa Green, MBA" -> "Vanessa Green"; drops emoji, credentials, pronouns.
  function cleanName(raw) {
    let s = String(raw || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');
    s = s.split(/,|\(|\||–| - /)[0];
    s = s.replace(/\b(MBA|CPA|CMA|CFA|PMP|PhD|CGA|CA|P\.?Eng|CIA|CISA|CSCP|Jr\.?|Sr\.?)\b\.?/g, '');
    return s.replace(/\s+/g, ' ').trim();
  }

  // Stable key for matching the same person across sources.
  function personKey(raw) {
    const parts = stripAccents(cleanName(raw)).toLowerCase()
      .replace(/[^a-z\s'-]/g, ' ').replace(/['-]/g, '').split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    return parts[0] + ' ' + parts[parts.length - 1];
  }

  // Accepts "Connected on August 31, 2026", "August 31, 2026", "31 Aug 2026",
  // "2026-08-31", "08/31/2026". Returns "YYYY-MM-DD" or "".
  function parseDate(raw) {
    const s = String(raw || '').replace(/^connected on\s*/i, '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) {
      return iso(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
    }
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/);
    if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
      return iso(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
    }
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2]);
    return '';
  }

  function iso(y, mo, d) {
    return `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // RFC-4180-ish CSV parser (quoted fields, embedded commas/newlines, "" escapes).
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(v => v.trim() !== ''));
  }

  // LinkedIn export CSVs have a "Notes:" preamble; find the real header row.
  function csvObjects(text, mustHave) {
    const rows = parseCSV(text.replace(/^﻿/, ''));
    let h = 0;
    if (mustHave) {
      const idx = rows.findIndex(r => r.some(v => v.trim().toLowerCase() === mustHave.toLowerCase()));
      if (idx >= 0) h = idx;
    }
    const header = (rows[h] || []).map(v => v.trim());
    return rows.slice(h + 1).map(r => Object.fromEntries(header.map((k, i) => [k, (r[i] || '').trim()])));
  }

  function toCSV(objs, cols) {
    const esc = v => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.join(','), ...objs.map(o => cols.map(c => esc(o[c])).join(','))].join('\n');
  }

  Object.assign(LP, { stripAccents, cleanName, personKey, parseDate, parseCSV, csvObjects, toCSV });
  if (typeof module !== 'undefined' && module.exports) module.exports = LP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
