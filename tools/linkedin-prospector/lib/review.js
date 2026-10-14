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
    const live = s.liveChecks?.[key];
    const g = s.contactChecks?.[key];

    if (live?.result === 'replied') skip = `Replied on LinkedIn (seen in the conversation on ${live.at.slice(0, 10)})`;
    if (li?.theyMessaged) skip = skip || `They've messaged you on LinkedIn (last ${li.lastTheirs || 'date unknown'})`;
    for (const [src, t] of Object.entries(inbox)) {
      const where = src === 'salesnav-inbox' ? 'Sales Nav' : 'LinkedIn';
      if (t.group) { notes.push(`In a ${where} group thread — check`); continue; }
      if (!t.lastFromMe) skip = skip || `Existing ${where} thread, latest message is theirs: "${(t.preview || '').slice(0, 60)}"`;
      else flag = flag || `You have a ${where} thread with them; latest message is yours — follow-up rather than a first touch?`;
    }
    if (g?.mail?.fromThem?.length) {
      const m = g.mail.fromThem[0];
      skip = skip || `Emailed you: "${m.subject}" (${m.date})`;
    }
    if (g?.calendar?.past?.length) {
      const m = g.calendar.past[g.calendar.past.length - 1];
      skip = skip || `Met: "${m.summary}" on ${m.date}`;
    }
    if (g?.calendar?.upcoming?.length) {
      const m = g.calendar.upcoming[0];
      skip = skip || `Meeting scheduled: "${m.summary}" on ${m.date}`;
    }
    if (live?.result === 'unclear') flag = flag || `Found a LinkedIn conversation but couldn't read who wrote it (${live.at.slice(0, 10)}); check it`;
    if (live?.result === 'clear') notes.push(`No LinkedIn conversation found (checked ${live.at.slice(0, 10)})`);
    // Messages you sent outside this tool: treat as touch 1 already done.
    const priorOutside = !sent && (live?.result === 'messaged' || (li?.iMessaged && !li.theyMessaged));
    if (live?.result === 'messaged' && !sent) flag = flag || `You've messaged them before with no reply (seen ${live.at.slice(0, 10)}): draft below is a follow-up`;
    else if (li?.iMessaged && !li.theyMessaged && !sent) flag = flag || `You messaged them on LinkedIn ${li.lastMine || ''}, no reply: draft below is a follow-up`;
    if (g?.mail?.toThem?.length && !g.mail.fromThem?.length) flag = flag || `You emailed them ("${g.mail.toThem[0].subject}", ${g.mail.toThem[0].date}), no reply found`;
    if (g?.error) flag = flag || `Couldn't check Outlook (${g.error}); check before sending`;
    if (g?.unreadable) flag = flag || "Outlook search showed results the extension couldn't read; check the Outlook tab";
    if (g?.via === 'outlook-web') notes.push('Outlook checked via mail search (meeting invites included; calendar not checked directly)');
    if (!g) notes.push('Outlook mail & calendar not checked yet');
    if (!s.liMessages) notes.push('No messages.csv imported — LinkedIn reply check is limited to inbox captures');
    return { skip, flag, notes, sent: !!sent, priorOutside };
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

      // Where they are in the 3-touch sequence.
      const seq = sequence(s.sentLog?.[key], h.priorOutside, s.settings?.followupDays ?? 3);

      let status;
      if (cls.status === 'not_prospect') status = 'not_prospect';
      else if (h.skip) status = 'skip';
      else if (seq.done || seq.waiting) status = 'sent';
      else if (cls.status === 'unsure' || h.flag || seq.followupDue) status = 'review';
      else status = 'ready';
      if (seq.note) h.notes.unshift(seq.note);

      const d = LP.draft(p, cls, s.settings || {}, seq.touch);
      const saved = s.drafts?.[key];
      const text = saved && saved.touch === seq.touch ? saved.text : d.text;
      rows.push({ key, person: p, cls, history: h, status, persona: d.persona, touch: seq.touch,
        draft: text, edited: !!(saved && saved.touch === seq.touch), checks: LP.checksFor(text, cls, seq.touch) });
    }
    const order = { ready: 0, review: 1, sent: 2, skip: 3, not_prospect: 4 };
    rows.sort((a, b) => order[a.status] - order[b.status] ||
      (b.person.connectedOn || '9999').localeCompare(a.person.connectedOn || '9999'));
    return rows;
  }

  // sentLog entry -> {touch, followupDue, waiting, done, note}
  function sequence(entry, priorOutside, followupDays) {
    const sends = entry?.sends || (entry ? [{ date: entry.date }] : []);
    const count = sends.length + (priorOutside ? 1 : 0);
    if (count >= 3) return { touch: 3, done: true, note: 'All 3 touches sent: sequence complete' };
    const touch = count + 1;
    if (!sends.length) return { touch, followupDue: priorOutside };
    const last = sends[sends.length - 1].date;
    const days = (Date.now() - Date.parse(last)) / 864e5;
    if (days < followupDays) {
      return { touch, waiting: true, note: `Touch ${count} sent ${last.slice(0, 10)}; touch ${touch} due in ${Math.ceil(followupDays - days)} day(s)` };
    }
    return { touch, followupDue: true, note: `Touch ${count} sent ${last.slice(0, 10)}, no reply: touch ${touch} is due` };
  }

  // Pre-send checklist. Touch 1 must be context only (no pitch); touch 3
  // must carry real proof; every touch is checked for buzzwords.
  const PITCHY = /\b(we help|our (platform|solution|product|software|customers)|i work with|demo|book a (call|meeting)|15 minutes|quick call|calendar|case study)\b/i;
  LP.checksFor = function (text, cls, touch = 1) {
    return {
      touch,
      trigger: !!(cls.company || cls.account),
      noPitch: touch !== 1 || !PITCHY.test(text),
      trust: touch !== 3 || !/\[TRUST/i.test(text),
      placeholders: !/\{\w+\}/.test(text),
      buzzwords: /(single source of truth|all-in-one|ai-powered|best-in-class|synergy|cutting-edge|seamless)/i.test(text),
      length: text.length,
    };
  };

  Object.assign(LP, { parseMessages, history, buildRows });
  if (typeof module !== 'undefined' && module.exports) module.exports = LP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
