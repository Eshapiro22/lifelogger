// Company -> account matching. Deliberately conservative: anything that isn't a
// clean match is returned as "medium" so the dashboard flags it for review.
(function (root) {
  const LP = root.LP || (root.LP = {});
  const { stripAccents } = LP;

  const SUFFIXES = new Set([
    'inc', 'incorporated', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company',
    'plc', 'lp', 'llp', 'ulc', 'gmbh', 'sa', 'ag', 'nv', 'bv', 'the', 'ltee', 'holdings',
    'holding', 'group', 'enterprises',
  ]);
  // Single-word names that are too generic to match by containment alone.
  const GENERIC = new Set([
    'canada', 'services', 'solutions', 'systems', 'technologies', 'technology', 'international',
    'global', 'energy', 'partners', 'consulting', 'capital', 'management', 'financial', 'digital',
    'health', 'industries', 'manufacturing', 'logistics', 'media', 'foods', 'apex', 'summit',
    'north', 'american', 'national', 'first', 'united', 'premier', 'pacific', 'atlantic',
  ]);
  const NOT_PROSPECT_TYPES = new Set(['customer', 'competitor', 'business partner', 'reseller', 'service', 'other']);

  function tokens(s) {
    const t = stripAccents(s).toLowerCase()
      .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ')
      .split(' ').filter(Boolean);
    const kept = t.filter(w => !SUFFIXES.has(w));
    return kept.length ? kept : t;
  }

  function domainRoot(website) {
    const host = String(website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    return host ? host.split('.')[0].replace(/[^a-z0-9]/g, '') : '';
  }

  function bigrams(s) {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const b = s.slice(i, i + 2);
      out.set(b, (out.get(b) || 0) + 1);
    }
    return out;
  }
  function dice(a, b) {
    if (a.length < 2 || b.length < 2) return 0;
    const A = bigrams(a), B = bigrams(b);
    let inter = 0;
    for (const [k, v] of A) inter += Math.min(v, B.get(k) || 0);
    return (2 * inter) / (a.length - 1 + b.length - 1);
  }

  function containsPhrase(hay, needle) {
    return (' ' + hay.join(' ') + ' ').includes(' ' + needle.join(' ') + ' ');
  }

  // A name is specific enough to match inside a longer string.
  function distinctive(tok) {
    if (tok.length >= 2) return tok.join('').length >= 5;
    return tok[0].length >= 5 && !GENERIC.has(tok[0]) && !/^\d+$/.test(tok[0]);
  }

  function buildIndex(accounts) {
    return accounts
      .filter(a => a.name)
      .map(a => {
        const tok = tokens(a.name);
        return { account: a, tok, key: tok.join(' '), compact: tok.join(''), domain: domainRoot(a.website) };
      })
      // Numbered companies ("1057922 Ontario Inc") can't be matched from LinkedIn text.
      .filter(x => !/^\d{5,}/.test(x.compact));
  }

  // Score one company string against the index. Returns best {entry, score, how}.
  function scoreCompany(company, index) {
    const tok = tokens(company);
    if (!tok.length) return null;
    const key = tok.join(' '), compact = tok.join('');
    let best = null;
    const consider = (entry, score, how) => {
      if (!best || score > best.score) best = { entry, score, how };
    };
    for (const e of index) {
      if (e.key === key || e.compact === compact) { consider(e, 1, 'exact name'); continue; }
      if (e.domain && e.domain.length >= 4 && e.domain === compact) {
        // CRM websites are sometimes wrong (another company's domain), so only
        // trust a domain hit when the names also agree on the first word.
        consider(e, e.tok[0] === tok[0] ? 0.95 : 0.8, `website domain ${e.domain}`);
        continue;
      }
      if (distinctive(e.tok) && containsPhrase(tok, e.tok)) {
        consider(e, 0.8, `"${company}" contains account name`);
        continue;
      }
      if (distinctive(tok) && containsPhrase(e.tok, tok)) {
        consider(e, 0.75, `account name contains "${company}"`);
        continue;
      }
      const d = dice(compact, e.compact);
      if (d >= 0.88 && compact.length >= 5) consider(e, 0.7, `similar spelling (${Math.round(d * 100)}%)`);
    }
    return best;
  }

  // Pull company names out of a LinkedIn headline.
  // "CFO at HubSpot | Board Member" -> explicit ["HubSpot"]
  function companiesFromHeadline(headline) {
    const explicit = [], weak = [];
    const parts = String(headline || '').split(/\s*[|•·]\s*|\s+-\s+|\s+–\s+/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const m = p.match(/(?:\bat\b|@)\s+(.+)$/i);
      if (m) explicit.push(m[1].replace(/[,.;]+$/, '').trim());
      else weak.push(p);
    }
    return { explicit, weak };
  }

  // person: {company?, headline?, title?}. Returns a classification object.
  function classify(person, index) {
    const fromField = person.company ? [person.company] : [];
    const { explicit, weak } = companiesFromHeadline(person.headline || person.title || '');
    const strong = [...fromField, ...explicit];
    let best = null;
    for (const c of strong) {
      const r = scoreCompany(c, index);
      if (r && (!best || r.score > best.score)) best = { ...r, company: c };
    }
    // Headline fragments without "at": only allow phrase containment, capped as uncertain.
    if (!best || best.score < 0.9) {
      for (const c of weak) {
        const tok = tokens(c);
        for (const e of index) {
          if (distinctive(e.tok) && e.tok.join(' ').length >= 6 && containsPhrase(tok, e.tok)) {
            const r = { entry: e, score: 0.65, how: `headline mentions "${e.account.name}"`, company: c };
            if (!best || r.score > best.score) best = r;
          }
        }
      }
    }

    const company = strong[0] || '';
    if (!best || best.score < 0.65) {
      return company
        ? { status: 'not_prospect', confidence: 'none', company, reason: `"${company}" is not on your account list` }
        : { status: 'unsure', confidence: 'none', company: '', reason: 'Could not tell their company from the headline — check profile' };
    }
    const a = best.entry.account;
    const type = (a.type || '').toLowerCase();
    const base = { company: best.company, account: a, how: best.how, score: best.score };
    if (a.active === '1' || NOT_PROSPECT_TYPES.has(type)) {
      return { ...base, status: 'unsure', confidence: best.score >= 0.9 ? 'high' : 'medium',
        reason: `Matches ${a.name}, but the account is marked ${a.active === '1' ? 'an active customer' : a.type}` };
    }
    if (best.score >= 0.9) {
      return { ...base, status: 'prospect', confidence: 'high', reason: `Matches account ${a.name} (${best.how})` };
    }
    return { ...base, status: 'unsure', confidence: 'medium',
      reason: `Possible match: "${best.company}" ≈ ${a.name} (${best.how}) — confirm` };
  }

  // Map a CRM export row to the account shape used above. Header names follow
  // the Salesforce report you exported; unknown columns are ignored.
  function accountFromRow(r) {
    return {
      name: r['Account Name'] || r['Company'] || r['Name'] || '',
      type: r['Type'] || '',
      active: r['Active Customer'] || '',
      vertical: r['Vertical'] || '',
      subVertical: r['Sub-Vertical'] || '',
      city: r['Billing City'] || '',
      state: r['Billing State/Province (text only)'] || '',
      website: r['Website'] || '',
      employees: r['Employees'] || '',
      parent: r['Parent Account'] || '',
    };
  }

  Object.assign(LP, { tokens, buildIndex, scoreCompany, companiesFromHeadline, classify, accountFromRow });
  if (typeof module !== 'undefined' && module.exports) module.exports = LP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
