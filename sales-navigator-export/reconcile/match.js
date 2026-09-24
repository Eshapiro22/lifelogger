/**
 * Sales Navigator ⇄ Salesforce reconciliation — matching logic.
 *
 * Pure functions, no DOM, no dependencies. Loaded both by the extension's
 * reconcile page (as a classic <script>, exposing window.SNXMatch) and by the
 * Node CLI (require()). Keep it that way so the two never drift.
 *
 * Pipeline:
 *   parseCsv → detectColumns → buildAccountIndex → reconcile()
 *
 * Matching is by company name only, because a Sales Navigator list row does
 * not expose the company's website/domain. Names are normalised (case,
 * accents, punctuation, legal suffixes like Inc/LLC/GmbH) and compared with a
 * blend of token overlap and character-bigram similarity, with a boost when
 * one name is a whole-token prefix of the other ("Acme" vs "Acme Technologies").
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SNXMatch = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── CSV ─────────────────────────────────────────────────────────────────
  /** RFC 4180-ish parser: quotes, escaped quotes, CRLF/LF, leading BOM. */
  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }

    // Drop fully-empty lines and Salesforce's trailing report footer
    // ("Copyright (c) 2000-20xx salesforce.com…" / blank / "Filtered By…").
    const cleaned = rows.filter((r) => r.some((v) => v.trim() !== ''));
    if (!cleaned.length) return { headers: [], rows: [] };
    const headers = cleaned[0].map((h) => h.trim());
    const out = [];
    for (let i = 1; i < cleaned.length; i++) {
      const r = cleaned[i];
      if (r.length === 1 && /^(copyright|filtered by|grand totals|total)/i.test(r[0].trim())) continue;
      if (r.length < headers.length / 2) continue; // footer fragments
      const obj = {};
      headers.forEach((h, j) => { obj[h] = (r[j] ?? '').trim(); });
      out.push(obj);
    }
    return { headers, rows: out };
  }

  function csvEscape(v) {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function toCsv(rows, columns) {
    const lines = [columns.join(',')];
    for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(','));
    return '﻿' + lines.join('\r\n');
  }

  // ─── normalisation ───────────────────────────────────────────────────────
  function stripDiacritics(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Legal/entity suffixes that carry no identity. Matched as whole tokens at
  // the END of the name only, repeatedly ("Acme Holdings Ltd" → "acme holdings").
  const LEGAL_SUFFIXES = new Set([
    'inc', 'incorporated', 'llc', 'llp', 'lp', 'ltd', 'limited', 'plc', 'pllc',
    'corp', 'corporation', 'co', 'company', 'gmbh', 'ag', 'sa', 'sas', 'sarl',
    'srl', 'spa', 'bv', 'nv', 'oy', 'ab', 'as', 'kk', 'pty', 'pte', 'pvt',
    'sdn', 'bhd', 'kg', 'mbh', 'ou', 'ltda', 'sl', 'se',
  ]);
  // Tokens too generic to be useful for candidate *blocking* (still used in scoring).
  const BLOCKING_STOPWORDS = new Set([
    'the', 'and', 'of', 'group', 'technologies', 'technology', 'tech', 'solutions',
    'services', 'service', 'systems', 'international', 'global', 'holdings',
    'partners', 'consulting', 'software', 'digital', 'labs', 'industries',
    'enterprises', 'worldwide', 'usa', 'us', 'uk', 'north', 'america', 'europe',
  ]);

  function baseNormalize(s) {
    return stripDiacritics(String(s || ''))
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\+/g, ' plus ')
      .replace(/[’'`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function normalizeCompany(s) {
    let toks = baseNormalize(s).split(' ').filter(Boolean);
    if (toks[0] === 'the') toks = toks.slice(1);
    while (toks.length > 1 && LEGAL_SUFFIXES.has(toks[toks.length - 1])) toks.pop();
    return toks.join(' ');
  }

  function normalizePerson(s) {
    let str = String(s || '');
    str = str.replace(/\(.*?\)/g, ' ');        // "(he/him)", "(she/her)"
    str = str.split(',')[0];                    // "Jane Doe, MBA, PMP"
    str = str.replace(/\b(mba|phd|ph\.d|cpa|pmp|md|jr|sr|ii|iii|esq|dr|mr|mrs|ms)\b\.?/gi, ' ');
    return baseNormalize(str);
  }

  // ─── similarity ──────────────────────────────────────────────────────────
  function tokenSet(s) { return new Set(s.split(' ').filter(Boolean)); }
  function diceSets(a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return (2 * inter) / (a.size + b.size);
  }
  function bigrams(s) {
    const str = s.replace(/ /g, '');
    const out = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const g = str.slice(i, i + 2);
      out.set(g, (out.get(g) || 0) + 1);
    }
    return out;
  }
  function diceBigrams(a, b) {
    let total = 0, inter = 0;
    for (const n of a.values()) total += n;
    for (const n of b.values()) total += n;
    if (!total) return 0;
    for (const [g, n] of a) if (b.has(g)) inter += Math.min(n, b.get(g));
    return (2 * inter) / total;
  }
  function isTokenPrefix(shortToks, longToks) {
    if (!shortToks.length || shortToks.length > longToks.length) return false;
    for (let i = 0; i < shortToks.length; i++) if (shortToks[i] !== longToks[i]) return false;
    return true;
  }

  /**
   * 0..1 similarity between a *normalised* lead company name (a) and account
   * name (b). Prefix matches are boosted asymmetrically: when the lead name is
   * a prefix of the account ("ntt data mexico" → "ntt data mexico s de rl")
   * the account is the more specific record and scores 0.88; when the account
   * is a prefix of the lead ("ntt data" → "ntt data mexico") it is the generic
   * record and scores 0.85, so the specific one wins ties.
   */
  function companySimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const ta = a.split(' '), tb = b.split(' ');
    const tokenScore = diceSets(new Set(ta), new Set(tb));
    const charScore = diceBigrams(bigrams(a), bigrams(b));
    let score = 0.5 * tokenScore + 0.5 * charScore;
    if (a.length >= 4 && isTokenPrefix(ta, tb)) score = Math.max(score, 0.88);
    else if (b.length >= 4 && isTokenPrefix(tb, ta)) score = Math.max(score, 0.85);
    // Space-insensitive prefix: "nttdata" vs "ntt data international services",
    // "pcconnection" vs "pc connection".
    const ca = a.replace(/ /g, ''), cb = b.replace(/ /g, '');
    if (ca === cb) score = Math.max(score, 0.95);
    else if (ca.length >= 5 && cb.startsWith(ca)) score = Math.max(score, 0.88);
    else if (cb.length >= 5 && ca.startsWith(cb)) score = Math.max(score, 0.85);
    return Math.round(score * 1000) / 1000;
  }

  function tierForScore(score) {
    if (score >= 0.999) return 'exact';
    if (score >= 0.9) return 'high';
    if (score >= 0.75) return 'medium';
    if (score >= 0.6) return 'low';
    return 'none';
  }

  // ─── column detection ────────────────────────────────────────────────────
  function pickHeader(headers, patterns, exclude = []) {
    for (const p of patterns) {
      const hit = headers.find((h) => p.test(h) && !exclude.some((x) => x.test(h)));
      if (hit) return hit;
    }
    return '';
  }

  /** Best-guess column mapping for a Salesforce Accounts export. */
  function detectAccountColumns(headers) {
    return {
      id: pickHeader(headers, [/^account id( \(18\))?$/i, /^account: id$/i, /^id$/i, /account.*id/i]),
      name: pickHeader(headers, [/^account[\s._]*name$/i, /^account: account name$/i, /^name$/i, /^account$/i, /account[\s._]*name/i]),
      owner: pickHeader(headers, [/^account owner$/i, /^owner( full)? name$/i, /^owner\.name$/i, /^account owner: full name$/i, /owner/i], [/id$/i, /alias/i, /role/i, /email/i]),
      website: pickHeader(headers, [/^website$/i, /website/i, /domain/i]),
      parent: pickHeader(headers, [/^parent account$/i, /parent.*name/i, /parent/i], [/id$/i]),
      type: pickHeader(headers, [/^type$/i, /^account type$/i]),
    };
  }

  /** Best-guess column mapping for a Salesforce Contacts (or Leads) export. */
  function detectContactColumns(headers) {
    const first = pickHeader(headers, [/^first name$/i, /firstname/i]);
    const last = pickHeader(headers, [/^last name$/i, /lastname/i]);
    return {
      id: pickHeader(headers, [/^contact id( \(18\))?$/i, /^lead id( \(18\))?$/i, /^id$/i, /(contact|lead).*id/i]),
      name: pickHeader(headers, [/^full name$/i, /^name$/i, /^contact name$/i, /^contact$/i, /^lead name$/i, /full name/i]),
      firstName: first,
      lastName: last,
      account: pickHeader(headers, [/^account[\s._]*name$/i, /^account$/i, /^company$/i, /account[\s._]*name/i, /company/i], [/id$/i]),
      owner: pickHeader(headers, [/^contact owner$/i, /^lead owner$/i, /^owner( full)? name$/i, /owner/i], [/id$/i, /alias/i, /role/i, /email/i]),
      title: pickHeader(headers, [/^title$/i, /title/i]),
      email: pickHeader(headers, [/^email$/i, /email/i]),
    };
  }

  /** Column mapping for the Sales Navigator export (or any leads CSV). */
  function detectLeadColumns(headers) {
    return {
      name: pickHeader(headers, [/^name$/i, /^full name$/i, /name/i], [/company/i, /account/i, /list/i]),
      company: pickHeader(headers, [/^company$/i, /^company name$/i, /^account$/i, /company/i, /account/i], [/url/i]),
      title: pickHeader(headers, [/^title$/i, /title/i]),
      profileUrl: pickHeader(headers, [/^profile_url$/i, /profile.*url/i, /linkedin/i]),
    };
  }

  // ─── indexing ────────────────────────────────────────────────────────────
  function buildAccountIndex(accounts, cols) {
    const byNorm = new Map();     // normalised name → [account]
    const byToken = new Map();    // token → Set(account idx)
    const byCompact = new Map();  // first 5 chars of the space-less name → Set(account idx)
    const items = accounts.map((row, i) => ({
      i,
      row,
      id: cols.id ? row[cols.id] : '',
      name: row[cols.name] || '',
      norm: normalizeCompany(row[cols.name] || ''),
      owner: cols.owner ? row[cols.owner] : '',
      ownerNorm: normalizePerson(cols.owner ? row[cols.owner] : ''),
      website: cols.website ? row[cols.website] : '',
      parent: cols.parent ? row[cols.parent] : '',
      type: cols.type ? row[cols.type] : '',
    }));
    for (const it of items) {
      if (!it.norm) continue;
      if (!byNorm.has(it.norm)) byNorm.set(it.norm, []);
      byNorm.get(it.norm).push(it);
      for (const t of it.norm.split(' ')) {
        if (!byToken.has(t)) byToken.set(t, new Set());
        byToken.get(t).add(it.i);
      }
      const c5 = it.norm.replace(/ /g, '').slice(0, 5);
      if (c5.length === 5) {
        if (!byCompact.has(c5)) byCompact.set(c5, new Set());
        byCompact.get(c5).add(it.i);
      }
    }
    return { items, byNorm, byToken, byCompact };
  }

  function buildContactIndex(contacts, cols) {
    const byPerson = new Map(); // normalised person name → [contact]
    const items = contacts.map((row, i) => {
      const fullName = cols.name
        ? row[cols.name]
        : [row[cols.firstName], row[cols.lastName]].filter(Boolean).join(' ');
      return {
        i, row,
        id: cols.id ? row[cols.id] : '',
        name: fullName || '',
        nameNorm: normalizePerson(fullName || ''),
        account: cols.account ? row[cols.account] : '',
        accountNorm: normalizeCompany(cols.account ? row[cols.account] : ''),
        owner: cols.owner ? row[cols.owner] : '',
        ownerNorm: normalizePerson(cols.owner ? row[cols.owner] : ''),
        title: cols.title ? row[cols.title] : '',
        email: cols.email ? row[cols.email] : '',
      };
    });
    for (const it of items) {
      if (!it.nameNorm) continue;
      if (!byPerson.has(it.nameNorm)) byPerson.set(it.nameNorm, []);
      byPerson.get(it.nameNorm).push(it);
    }
    return { items, byPerson };
  }

  // ─── matching ────────────────────────────────────────────────────────────
  /**
   * Find the best Salesforce account for a company name.
   * Returns { best, candidates, score, tier, note } where candidates is the
   * top few alternatives (for the "needs review" UI).
   */
  function matchCompany(companyName, index) {
    const norm = normalizeCompany(companyName);
    if (!norm) return { best: null, candidates: [], score: 0, tier: 'none', note: 'No company on lead' };

    // 1. Exact normalised match.
    const exact = index.byNorm.get(norm);
    if (exact && exact.length) {
      const note = exact.length > 1 ? `${exact.length} accounts share this name` : '';
      return { best: exact[0], candidates: exact.slice(0, 5), score: 1, tier: 'exact', note };
    }

    // 2. Blocking: candidates share at least one meaningful token.
    let toks = norm.split(' ').filter((t) => !BLOCKING_STOPWORDS.has(t) && t.length > 1);
    if (!toks.length) toks = norm.split(' ');
    const candIdx = new Set();
    for (const t of toks) {
      const s = index.byToken.get(t);
      if (s) for (const i of s) candIdx.add(i);
    }
    // Space-less prefix block: "nttdata" ↔ "ntt data …", "pcconnection" ↔ "pc connection".
    const c5 = norm.replace(/ /g, '').slice(0, 5);
    const cs = c5.length === 5 && index.byCompact ? index.byCompact.get(c5) : null;
    if (cs) for (const i of cs) candIdx.add(i);
    if (!candIdx.size) return { best: null, candidates: [], score: 0, tier: 'none', note: '' };

    // 3. Score and rank.
    const scored = [];
    for (const i of candIdx) {
      const it = index.items[i];
      const score = companySimilarity(norm, it.norm);
      if (score >= 0.5) scored.push({ it, score });
    }
    scored.sort((a, b) => b.score - a.score);
    if (!scored.length) return { best: null, candidates: [], score: 0, tier: 'none', note: '' };

    const top = scored[0];
    const tier = tierForScore(top.score);
    let note = '';
    // Ambiguity: runner-up is nearly as good → force review.
    if (scored.length > 1 && scored[1].score >= top.score - 0.05 && scored[1].it.norm !== top.it.norm) {
      note = `Ambiguous: also matches "${scored[1].it.name}"`;
    }
    return {
      best: tier === 'none' ? null : top.it,
      candidates: scored.slice(0, 5).map((s) => s.it),
      score: top.score,
      tier,
      note,
    };
  }

  function matchContact(leadName, accountNorm, cIndex) {
    if (!cIndex) return null;
    const norm = normalizePerson(leadName);
    if (!norm) return null;
    const hits = cIndex.byPerson.get(norm);
    if (!hits || !hits.length) return null;
    // Prefer a contact on the matched account; otherwise same-name anywhere.
    const onAccount = accountNorm ? hits.find((h) => h.accountNorm === accountNorm) : null;
    if (onAccount) return { contact: onAccount, sameAccount: true };
    return { contact: hits[0], sameAccount: false, others: hits.length };
  }

  function sfRecordUrl(baseUrl, objectName, id) {
    if (!baseUrl || !id) return '';
    const base = baseUrl.replace(/\/+$/, '');
    return `${base}/lightning/r/${objectName}/${id}/view`;
  }

  const OUTPUT_COLUMNS = [
    'name', 'title', 'company', 'location', 'profile_url', 'in_crm',
    'sf_account_name', 'sf_account_id', 'sf_account_owner', 'sf_account_type', 'sf_account_website', 'sf_parent_account',
    'account_is_mine', 'match_tier', 'match_score', 'match_note', 'sf_account_url',
    'sf_contact_exists', 'sf_contact_name', 'sf_contact_owner', 'sf_contact_account', 'sf_contact_id', 'contact_is_mine', 'sf_contact_url',
    'alt_candidates',
  ];

  /**
   * @param {object} p
   * @param {object[]} p.leads             rows from the Sales Navigator export
   * @param {object}   p.leadCols          detectLeadColumns() result
   * @param {object[]} p.accounts          rows from the Salesforce Accounts CSV
   * @param {object}   p.accountCols       detectAccountColumns() result (user-corrected)
   * @param {object[]} [p.contacts]        rows from a Salesforce Contacts CSV
   * @param {object}   [p.contactCols]
   * @param {string}   [p.me]              your name as it appears in Salesforce (Owner)
   * @param {string}   [p.sfBaseUrl]       e.g. https://acme.lightning.force.com
   * @param {object}   [p.overrides]       confirmed matches: { "<company as on LinkedIn>": "<Salesforce account name or Id>" }.
   *                                       Matched case-insensitively after normalisation; wins over fuzzy matching.
   * @param {boolean}  [p.myAccountsOnly]  the accounts file contains ONLY accounts you own
   *                                       (e.g. a "My accounts" report). Then any match is
   *                                       yours and no match means "not one of my accounts";
   *                                       `me` is optional and only used for contact ownership.
   */
  function reconcile(p) {
    const aIndex = buildAccountIndex(p.accounts, p.accountCols);
    const cIndex = p.contacts && p.contacts.length ? buildContactIndex(p.contacts, p.contactCols) : null;
    const owners = ownerCounts(aIndex.items);
    // In my-accounts-only mode, infer "me" from the file when the caller gave nothing.
    const meName = p.me || (p.myAccountsOnly && owners.length === 1 ? owners[0].owner : '');
    const meNorm = normalizePerson(meName);
    const isMe = (ownerNorm) => (meNorm && ownerNorm ? (ownerNorm === meNorm ? 'Yes' : 'No') : 'Unknown');
    const accountIsMine = (acct, tier) => {
      if (p.myAccountsOnly) return acct ? 'Yes' : 'No';
      if (!acct) return '';
      if (tier === 'low') return 'Unverified';
      return isMe(acct.ownerNorm);
    };

    // Confirmed matches: normalised company → account item. A key ending in
    // "*" is a prefix rule ("Harcourt*" covers every Harcourt spelling).
    const overrides = new Map();
    const prefixRules = [];
    for (const [company, target] of Object.entries(p.overrides || {})) {
      const isPrefix = /\*\s*$/.test(company);
      const key = normalizeCompany(company.replace(/\*\s*$/, ''));
      const t = String(target || '').trim();
      const acct = aIndex.items.find((it) => it.id && it.id === t) ||
        (aIndex.byNorm.get(normalizeCompany(t)) || [])[0] ||
        aIndex.items.find((it) => it.name.toLowerCase() === t.toLowerCase());
      if (!key || !acct) continue;
      if (isPrefix) prefixRules.push({ key, acct });
      else overrides.set(key, acct);
    }
    prefixRules.sort((a, b) => b.key.length - a.key.length); // longest prefix wins
    const findOverride = (norm) => {
      if (!norm) return null;
      if (overrides.has(norm)) return overrides.get(norm);
      const compact = norm.replace(/ /g, '');
      for (const r of prefixRules) {
        if (norm === r.key || norm.startsWith(r.key + ' ') || compact === r.key.replace(/ /g, '')) return r.acct;
      }
      return null;
    };

    const rows = [];
    const summary = { total: 0, mine: 0, notMine: 0, unmatched: 0, review: 0, contactsFound: 0, confirmed: 0 };

    for (const lead of p.leads) {
      const company = lead[p.leadCols.company] || '';
      const ov = findOverride(normalizeCompany(company));
      const m = ov
        ? { best: ov, candidates: [ov], score: 1, tier: 'confirmed', note: '' }
        : matchCompany(company, aIndex);
      const acct = m.best;
      const needsReview = acct && m.tier !== 'confirmed' && (m.tier === 'low' || m.tier === 'medium' || !!m.note);
      const c = matchContact(lead[p.leadCols.name], acct ? acct.norm : '', cIndex);

      const out = {
        name: lead[p.leadCols.name] || lead.name || '',
        title: lead[p.leadCols.title] || lead.title || '',
        company,
        location: lead.location || '',
        profile_url: lead[p.leadCols.profileUrl] || lead.profile_url || '',
        in_crm: lead.in_crm || '',
        tenure: lead.tenure || '',
        sf_account_name: acct ? acct.name : '',
        sf_account_id: acct ? acct.id : '',
        sf_account_owner: acct ? acct.owner : '',
        sf_account_type: acct ? acct.type : '',
        sf_account_website: acct ? acct.website : '',
        sf_parent_account: acct ? acct.parent : '',
        account_is_mine: accountIsMine(acct, m.tier),
        match_tier: m.tier,
        match_score: m.score,
        match_note: m.note + (needsReview && !m.note ? 'Fuzzy match, please verify' : ''),
        sf_account_url: acct ? sfRecordUrl(p.sfBaseUrl, 'Account', acct.id) : '',
        sf_contact_exists: cIndex ? (c ? 'Yes' : 'No') : '',
        sf_contact_name: c ? c.contact.name : '',
        sf_contact_owner: c ? c.contact.owner : '',
        sf_contact_account: c ? c.contact.account : '',
        sf_contact_id: c ? c.contact.id : '',
        contact_is_mine: c ? isMe(c.contact.ownerNorm) : '',
        sf_contact_url: c ? sfRecordUrl(p.sfBaseUrl, 'Contact', c.contact.id) : '',
        alt_candidates: m.candidates
          .filter((x) => x !== acct)
          .slice(0, 3)
          .map((x) => `${x.name}${x.owner ? ` (${x.owner})` : ''}`)
          .join('; '),
        _needsReview: !!needsReview,
      };
      if (c && !c.sameAccount) {
        out.match_note = [out.match_note, `Contact with this name exists on "${c.contact.account}"`].filter(Boolean).join(' · ');
      }

      summary.total++;
      if (m.tier === 'confirmed') summary.confirmed++;
      if (!acct) summary.unmatched++;
      else if (out.account_is_mine === 'Yes') summary.mine++;
      else if (out.account_is_mine === 'Unverified') { /* counted under review only */ }
      else summary.notMine++;
      if (p.myAccountsOnly && !acct && !out.match_note) out.match_note = 'Not one of my accounts';
      if (needsReview) summary.review++;
      if (c) summary.contactsFound++;
      rows.push(out);
    }
    return { rows, summary, owners, me: meName, myAccountsOnly: !!p.myAccountsOnly, overridesApplied: overrides.size + prefixRules.length };
  }

  /** Distinct account owners with counts, most common first (for the "I am" picker). */
  function ownerCounts(items) {
    const m = new Map();
    for (const it of items) if (it.owner) m.set(it.owner, (m.get(it.owner) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([owner, count]) => ({ owner, count }));
  }

  // ─── lookup query generation ─────────────────────────────────────────────
  // For orgs too big to export whole: build Salesforce queries that fetch only
  // the accounts whose names resemble the companies in the lead list.
  const ACCOUNT_FIELDS = 'Id, Name, Owner.Name, Website, Parent.Name, Type';

  /**
   * Company name as Salesforce would store it (original characters, accents and
   * apostrophes kept) with legal suffixes removed. Returns { term, hadThe } so
   * SOQL can try both "The Acme…" and "Acme…".
   */
  const NOT_A_COMPANY = /^(retired|semi.?retired|self.?employed|freelance(r)?|independent|consultant|unemployed|n\/a|none|student|various)$/i;
  function searchTermFor(name) {
    const str = String(name || '').replace(/[\u2018\u2019`]/g, "'").replace(/\u201c|\u201d/g, '"')
      .replace(/\s*\(.*$/, '')  // drop "(formerly …)" style tails
      .trim();
    let toks = str.split(/\s+/).filter(Boolean);
    let hadThe = false;
    if (toks.length > 1 && /^the$/i.test(toks[0])) { toks = toks.slice(1); hadThe = true; }
    while (toks.length > 1 && LEGAL_SUFFIXES.has(toks[toks.length - 1].toLowerCase().replace(/[.,;:]+$/g, ''))) toks.pop();
    const term = toks.join(' ').replace(/[,.;:()"]+$/g, '').trim();
    return { term, hadThe };
  }

  /**
   * @param {string[]} companyNames  raw company names from the leads
   * @param {object}   [opts]
   * @param {'soql'|'sosl'} [opts.format='soql']
   * @param {number}   [opts.batchSize]  names per query (default 50 SOQL / 30 SOSL)
   * @returns {{ queries: string[], terms: string[], skipped: string[] }}
   */
  function buildLookupQueries(companyNames, opts = {}) {
    const format = opts.format === 'sosl' ? 'sosl' : 'soql';
    const batchSize = opts.batchSize || (format === 'sosl' ? 30 : 50);
    const seen = new Set();
    const terms = [];
    const skipped = [];
    const entries = [];
    for (const raw of companyNames) {
      const { term, hadThe } = searchTermFor(raw);
      const key = normalizeCompany(term);
      if (!term || seen.has(key)) continue;
      seen.add(key);
      // Too short / too generic to search for without flooding the result.
      const normToks = key.split(' ').filter(Boolean);
      if (term.length < 3 || !normToks.length || normToks.every((t) => BLOCKING_STOPWORDS.has(t)) || NOT_A_COMPANY.test(term)) { skipped.push(raw); continue; }
      entries.push({ term, hadThe });
      terms.push(term);
    }
    const queries = [];
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      if (format === 'sosl') {
        // SOSL: reserved characters are escaped with a backslash; a quoted
        // phrase matches the tokens in order anywhere in the name, so "The"
        // and suffixes don't matter.
        const esc = (t) => t.replace(/([?&|!{}\[\]()^~*:\\"'+-])/g, '\\$1');
        queries.push(`FIND {${batch.map((e) => `"${esc(e.term)}"`).join(' OR ')}} IN NAME FIELDS RETURNING Account(${ACCOUNT_FIELDS})`);
      } else {
        // SOQL: prefix match. If the lead's name began with "The", try both.
        const esc = (t) => t.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/%/g, '\\%').replace(/_/g, '\\_');
        const clauses = [];
        for (const e of batch) {
          clauses.push(`Name LIKE '${esc(e.term)}%'`);
          if (e.hadThe) clauses.push(`Name LIKE 'The ${esc(e.term)}%'`);
        }
        queries.push(`SELECT ${ACCOUNT_FIELDS} FROM Account WHERE ${clauses.join(' OR ')}`);
      }
    }
    return { queries, terms, skipped };
  }

  /** A paste-ready instruction for a Claude instance that has a Salesforce connector. */
  function lookupPromptFor(queries, format) {
    const n = queries.length;
    return [
      `Please run the following ${n} Salesforce ${format.toUpperCase()} quer${n === 1 ? 'y' : 'ies'} against our org and combine all the Account rows into ONE CSV file with exactly these columns, in this order: Id, Name, Owner.Name, Website, Parent.Name, Type.`,
      `De-duplicate by Id, keep every matching account (do not filter by owner), and tell me the total number of rows and how many distinct Owner.Name values there are. Then give me the CSV as a downloadable file named accounts-lookup.csv.`,
      '',
      ...queries.map((q, i) => `-- query ${i + 1} of ${n}\n${q}`),
    ].join('\n');
  }

  /** "Company => Account name or Id" per line (also accepts "Company = Account", or CSV company,account). */
  function parseOverrides(text) {
    const out = {};
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^(.+?)\s*(?:=>|\t| = )\s*(.+)$/);
      if (m) { out[m[1].trim().replace(/^"|"$/g, '')] = m[2].trim().replace(/^"|"$/g, ''); continue; }
      // CSV line "company,account" (quote-aware, so names with commas survive)
      const fields = parseCsv(line).headers;
      if (fields.length >= 2 && fields[0] && fields[1]) out[fields[0]] = fields[1];
    }
    return out;
  }

  // ─── contact import (leads → Salesforce Contact rows) ───────────────────
  const CREDENTIALS = /\b(mba|phd|ph\.d\.?|cpa|pmp|cfa|cissp|jd|j\.d\.?|md|m\.d\.?|esq|llb|llm|cpl|cscp|pe|ra|rn)\b\.?/gi;
  /** "Jane Q. Doe, MBA (she/her)" → { first: "Jane Q.", last: "Doe" }. Salesforce requires LastName. */
  function splitPersonName(name) {
    let str = String(name || '').replace(/\(.*?\)/g, ' ');
    str = str.split(',')[0];
    str = str.replace(CREDENTIALS, ' ').replace(/\s+/g, ' ').trim();
    const toks = str.split(' ').filter(Boolean);
    if (!toks.length) return { first: '', last: '' };
    if (toks.length === 1) return { first: '', last: toks[0] };
    const suffixes = /^(jr|sr|ii|iii|iv)\.?$/i;
    let last = toks.pop();
    if (suffixes.test(last) && toks.length > 1) last = `${toks.pop()} ${last}`;
    return { first: toks.join(' '), last };
  }
  /** "Boston, Massachusetts, United States" → city/state/country; "Greater Boston" → city only. */
  function splitLocation(loc) {
    const parts = String(loc || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts.slice(2).join(', ') };
    if (parts.length === 2) return { city: parts[0], state: parts[1], country: '' };
    return { city: parts[0] || '', state: '', country: '' };
  }

  const CONTACT_IMPORT_COLUMNS = [
    'FirstName', 'LastName', 'Title', 'AccountId', 'Account Name', 'LeadSource', 'Description',
    'MailingCity', 'MailingState', 'MailingCountry', 'LinkedIn URL', 'Source list', 'Skip reason',
  ];

  /**
   * Turn reconciled rows into Salesforce Contact import rows.
   * @param {object[]} reconciled   rows from reconcile().rows (must have sf_account_id)
   * @param {object} [opts]
   * @param {boolean} [opts.onlyMine=true]        only leads on accounts you own
   * @param {boolean} [opts.skipExisting=true]    skip leads already found as Salesforce contacts by name
   * @param {boolean} [opts.skipInCrm=true]       skip leads LinkedIn flags as "In CRM"
   * @param {string}  [opts.listName]             for the Description / Source list columns
   * @param {string}  [opts.leadSource='LinkedIn Sales Navigator']
   * @returns {{ rows: object[], skipped: object[], counts: object }}
   */
  function buildContactImport(reconciled, opts = {}) {
    const o = { onlyMine: true, skipExisting: true, skipInCrm: true, leadSource: 'LinkedIn Sales Navigator', listName: '', ...opts };
    const rows = [];
    const skipped = [];
    const counts = { total: reconciled.length, toCreate: 0, notMine: 0, noAccount: 0, existing: 0, inCrm: 0, noName: 0, duplicateInList: 0 };
    const seen = new Set();
    const today = new Date().toISOString().slice(0, 10);
    for (const r of reconciled) {
      const { first, last } = splitPersonName(r.name);
      const loc = splitLocation(r.location);
      let reason = '';
      if (!last) reason = 'no name';
      else if (!r.sf_account_id) reason = 'no Salesforce account';
      else if (o.onlyMine && r.account_is_mine !== 'Yes') reason = `account owned by ${r.sf_account_owner || 'someone else'}`;
      else if (o.skipExisting && r.sf_contact_exists === 'Yes') reason = `already a contact (${r.sf_contact_owner || 'owner unknown'})`;
      else if (o.skipInCrm && r.in_crm === 'Yes') reason = 'LinkedIn shows In CRM';
      const dupKey = `${first} ${last}|${r.sf_account_id}`.toLowerCase();
      if (!reason && seen.has(dupKey)) reason = 'duplicate within this list';
      seen.add(dupKey);
      const row = {
        FirstName: first,
        LastName: last,
        Title: r.title || '',
        AccountId: r.sf_account_id || '',
        'Account Name': r.sf_account_name || '',
        LeadSource: o.leadSource,
        Description: `Imported from Sales Navigator${o.listName ? ` "${o.listName}"` : ''} on ${today}.` +
          (r.title ? ` Title on LinkedIn: ${r.title}.` : '') + (r.tenure ? ` ${r.tenure}.` : ''),
        MailingCity: loc.city, MailingState: loc.state, MailingCountry: loc.country,
        'LinkedIn URL': r.profile_url || '',
        'Source list': o.listName,
        'Skip reason': reason,
      };
      if (reason) {
        skipped.push(row);
        if (reason === 'no name') counts.noName++;
        else if (reason === 'no Salesforce account') counts.noAccount++;
        else if (reason.startsWith('account owned')) counts.notMine++;
        else if (reason.startsWith('already')) counts.existing++;
        else if (reason.startsWith('LinkedIn')) counts.inCrm++;
        else counts.duplicateInList++;
      } else {
        rows.push(row);
        counts.toCreate++;
      }
    }
    return { rows, skipped, counts };
  }

  /** Paste-ready instruction for a Claude with a Salesforce connector. */
  function contactImportPrompt(count, listName, fileName = 'contacts-to-create.csv') {
    return [
      `I'm attaching ${fileName}: ${count} people from a LinkedIn Sales Navigator${listName ? ` list "${listName}"` : ' export'} who work at accounts I own in Salesforce but do not exist there as Contacts yet.`,
      `Please create one Contact per row in our Salesforce org, with me as the Contact Owner. Map the columns as follows: FirstName, LastName, Title, AccountId (the 18-character Id of the Account to attach to), LeadSource, Description, MailingCity, MailingState, MailingCountry. Ignore "Account Name", "Source list" and "Skip reason" (they are for humans). If our org has a custom field for LinkedIn profile URL on Contact, put "LinkedIn URL" there; otherwise append it to Description.`,
      `Before creating each Contact, check for an existing Contact with the same first and last name on the same AccountId and skip it if found. Work in batches, and when finished give me a CSV of every row with the created Contact Id (or "skipped: <reason>"), plus totals created / skipped / failed.`,
      `These rows have no email or phone: leave those fields blank rather than guessing.`,
    ].join('\n');
  }

  return {
    parseCsv, toCsv, csvEscape, parseOverrides,
    splitPersonName, splitLocation, buildContactImport, contactImportPrompt, CONTACT_IMPORT_COLUMNS,
    searchTermFor, buildLookupQueries, lookupPromptFor, ACCOUNT_FIELDS,
    normalizeCompany, normalizePerson, companySimilarity, tierForScore,
    detectAccountColumns, detectContactColumns, detectLeadColumns,
    buildAccountIndex, buildContactIndex, matchCompany, matchContact,
    reconcile, ownerCounts, sfRecordUrl, OUTPUT_COLUMNS,
  };
});
