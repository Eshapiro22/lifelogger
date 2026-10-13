// Pure decision logic: who to message, who to flag, who to skip.
// Kept free of DOM/chrome APIs so it can be tested in Node.
(function (root) {
  const LP = root.LP || (root.LP = {});

  // LinkedIn messages.csv -> { personKey: {iMessaged, theyMessaged, lastMine, lastTheirs} }
  // Columns (as of LinkedIn's export format; verify against your file):
  // CONVERSATION ID, FROM, SENDER PROFILE URL, TO, DATE, CONTENT, FOLDER ...
  function parseMessages(rows, myName) {
    const me = LP.personKey(myName);
    const out = {};
    const touch = (k) => (out[k] = out[k] || { iMessaged: false, theyMessaged: false, lastMine: '', lastTheirs: '' });
    for (const r of rows) {
      const from = r['FROM'] || r['From'] || '';
      const to = r['TO'] || r['To'] || '';
      const date = (r['DATE'] || r['Date'] || '').slice(0, 10);
      const fromKey = LP.personKey(from);
      if (!fromKey) continue;
      if (fromKey === me) {
        for (const name of to.split(/,(?![^(]*\))/)) {
          const k = LP.personKey(name);
          if (!k || k === me) continue;
          const e = touch(k);
          e.iMessaged = true;
          if (date > e.lastMine) e.lastMine = date;
        }
      } else {
        const e = touch(fromKey);
        e.theyMessaged = true;
        if (date > e.lastTheirs) e.lastTheirs = date;
      }
    }
    return out;
  }

  // Prior-contact verdict for one person.
  function history(key, s) {
    const notes = [];
    let skip = null, flag = null;
    const li = s.liMessages?.[key];
    const inbox = s.inbox?.[key] || {};
    const sent = s.sentLog?.[key];
    const g = s.googleChecks?.[key];

    if (li?.theyMessaged) skip = skip || `They've messaged you on LinkedIn (last ${li.lastTheirs || 'date unknown'})`;
    for (const [src, t] of Object.entries(inbox)) {
      const where = src === 'salesnav-inbox' ? 'Sales Nav' : 'LinkedIn';
      if (t.group) { notes.push(`In a ${where} group thread — check`); continue; }
      if (!t.lastFromMe) skip = skip || `Existing ${where} thread, latest message is theirs: "${(t.preview || '').slice(0, 60)}"`;
      else flag = flag || `You have a ${where} thread with them; latest message is yours — follow-up rather than a first touch?`;
    }
    if (g?.gmail?.fromThem?.length) {
      const m = g.gmail.fromThem[0];
      skip = skip || `Emailed you: "${m.subject}" (${m.date.slice(0, 16)})`;
    }
    if (g?.calendar?.past?.length) {
      const m = g.calendar.past[g.calendar.past.length - 1];
      skip = skip || `Met: "${m.summary}" on ${m.date}`;
    }
    if (g?.calendar?.upcoming?.length) {
      const m = g.calendar.upcoming[0];
      skip = skip || `Meeting scheduled: "${m.summary}" on ${m.date}`;
    }
    if (li?.iMessaged && !li.theyMessaged) flag = flag || `You messaged them on LinkedIn ${li.lastMine || ''}, no reply — follow-up rather than a first touch?`;
    if (sent) flag = flag || `Already sent from this tool on ${sent.date.slice(0, 10)}`;
    if (g?.gmail?.toThem?.length) flag = flag || `You emailed them ("${g.gmail.toThem[0].subject}"), no reply found`;
    if (g?.error) notes.push(`Gmail/Calendar check failed: ${g.error}`);
    if (!g) notes.push('Gmail & Calendar not checked yet');
    if (!s.liMessages) notes.push('No messages.csv imported — LinkedIn reply check is limited to inbox captures');
    return { skip, flag, notes, sent: !!sent };
  }

  // Build the outreach table rows from everything in storage.
  function buildRows(s) {
    const index = LP.buildIndex(s.accounts || []);
    const cutoff = s.settings?.cutoff || '2026-08-01';
    const rows = [];
    for (const [key, p] of Object.entries(s.connections || {})) {
      if (p.connectedOn && p.connectedOn < cutoff) continue;
      let cls = LP.classify(p, index);
      const ov = s.overrides?.[key];
      if (ov === 'prospect' && cls.status !== 'prospect') cls = { ...cls, status: 'prospect', reason: 'Marked as prospect by you. ' + cls.reason };
      if (ov === 'not') cls = { ...cls, status: 'not_prospect', reason: 'Marked not a prospect by you' };
      const h = history(key, s);
      if (ov === 'contacted') h.skip = 'Marked as already in touch by you';
      if (!p.connectedOn) h.notes.push('No connect date (from Sales Nav) — included regardless of cutoff');

      let status;
      if (cls.status === 'not_prospect') status = 'not_prospect';
      else if (h.skip) status = 'skip';
      else if (h.sent) status = 'sent';
      else if (cls.status === 'unsure' || h.flag) status = 'review';
      else status = 'ready';

      const d = LP.draft(p, cls, s.settings || {});
      const text = s.drafts?.[key] ?? d.text;
      rows.push({ key, person: p, cls, history: h, status, persona: d.persona,
        draft: text, checks: LP.checksFor(text, cls) });
    }
    const order = { ready: 0, review: 1, sent: 2, skip: 3, not_prospect: 4 };
    rows.sort((a, b) => order[a.status] - order[b.status] ||
      (b.person.connectedOn || '9999').localeCompare(a.person.connectedOn || '9999'));
    return rows;
  }

  LP.checksFor = function (text, cls) {
    return {
      trigger: !!(cls.company || cls.account),
      tension: !/\{\w+\}/.test(text) && text.length > 120,
      trust: !/\[TRUST/i.test(text),
      buzzwords: /(single source of truth|all-in-one|ai-powered|best-in-class|synergy|cutting-edge|seamless)/i.test(text),
      length: text.length,
    };
  };

  Object.assign(LP, { parseMessages, history, buildRows });
  if (typeof module !== 'undefined' && module.exports) module.exports = LP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
