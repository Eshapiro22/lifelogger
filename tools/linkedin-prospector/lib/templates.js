// LinkedIn message drafting. Touch 1 is the full Triple T in one short
// message: a specific Trigger, the Tension it creates, who you are in one line
// plus real proof (Trust), and a soft, interest-based question. No hard ask
// (no "15 minutes?", no calendar link). Touches 2-3 are short bubble-up
// follow-ups a few days apart if there's no reply.
//
// Prospects are bucketed by persona so each group gets tailored lines without
// writing one-by-one. Everything is editable on the dashboard's Settings tab.
// {you} and {trust} ship as [YOU: ...] / [TRUST: ...] placeholders on purpose:
// they must be your real company line and a real customer result.
(function (root) {
  const LP = root.LP || (root.LP = {});

  const PERSONAS = [
    { id: 'finance', label: 'Finance (CFO / Controller / FP&A)',
      match: /\b(cfo|chief financial|finance|financial|controller|comptroller|fp&a|fp ?and ?a|accounting|accountant|treasur|cpa|payable|receivable|tax|audit)\b/i },
    { id: 'shared', label: 'Shared services / GBS',
      match: /\b(shared services?|gbs|global business services|center of excellence|coe)\b/i },
    { id: 'it', label: 'IT / Digital / Automation',
      match: /\b(cio|cto|cdo|chief (information|technology|digital|data)|it|information technology|digital|automation|transformation|data|engineering|architect|ai)\b/i },
    { id: 'ops', label: 'Operations / Supply chain',
      match: /\b(coo|chief operating|operations|supply chain|procurement|logistics|plant|manufacturing|sourcing)\b/i },
    { id: 'exec', label: 'CEO / President / Founder',
      match: /\b(ceo|chief executive|president|founder|owner|managing director|general manager)\b/i },
  ];
  const DEFAULT_PERSONA = { id: 'general', label: 'Everyone else' };

  const TOUCHES = [
    { n: 1, label: 'Touch 1 · Triple T (trigger, tension, proof, soft ask)' },
    { n: 2, label: 'Touch 2 · follow-up: new angle' },
    { n: 3, label: 'Touch 3 · follow-up: close the loop' },
  ];

  const DEFAULT_TOUCHES = {
    1: 'Hi {firstName}, thanks for connecting.\n\n{trigger} {tension}\n\n{you} {trust}\n\n{question}',
    2: 'Hi {firstName}, one more thought: {thought}',
    3: 'Hi {firstName}, I\'ll leave it here. If {topic} ends up on the list at {company}, happy to share what\'s worked for similar {vertical} teams.',
  };

  const DEFAULT_YOU = '[YOU: your company + one line, e.g. "At Acme, we help finance teams take the manual work out of close and AP."]';

  // Per persona. {trigger} = why them, why now. {tension} = the problem it
  // creates. {question} = the soft ask. {thought} = touch 2's new angle.
  // {topic} = a 2-4 word name for the problem, used in touch 3.
  const DEFAULT_LINES = {
    finance: {
      trigger: 'Saw you lead finance at {company}.',
      tension: 'Heading into year-end, the close usually gets heavier as volume grows, and the team doesn\'t.',
      question: 'Is close speed on your list for next year, or already handled?',
      thought: 'when I talk to {vertical} finance teams, the last few days of close are rarely the big entries. It\'s the hundreds of small reconciliations and exceptions. Is that where the time goes at {company} too?',
      topic: 'close speed',
    },
    shared: {
      trigger: 'Saw you run shared services at {company}.',
      tension: 'Most teams I talk to get handed more processes every year with the same headcount, so manual hand-offs quietly pile up.',
      question: 'Is that backlog something you\'re working on next year?',
      thought: 'the shared services teams that scale best tend to start with the highest-volume, most rules-based process rather than the most painful one. Curious which one you\'d pick at {company}.',
      topic: 'the hand-off backlog',
    },
    it: {
      trigger: 'Saw your role at {company}.',
      tension: 'IT teams at {vertical} companies keep getting "can we automate this?" requests from the business, and most stall between pilot and production.',
      question: 'Is getting automations into production a focus for you next year?',
      thought: 'the pilots that make it to production usually have an owner in the business, not just in IT. Is that how {company} is set up?',
      topic: 'automation in production',
    },
    ops: {
      trigger: 'Saw you\'re in operations at {company}.',
      tension: 'At a lot of {vertical} companies, orders, invoices and shipment data still get re-keyed between systems, which holds up fine until volume spikes.',
      question: 'Is that a headache at {company}, or already solved?',
      thought: 'the teams I see handle peak season best stopped re-keying the top 2-3 documents first, rather than trying to fix everything at once. Which documents eat the most time for your team?',
      topic: 're-keying between systems',
    },
    exec: {
      trigger: 'Saw you lead {company}.',
      tension: 'Most {vertical} leaders I talk to are asked to grow without headcount growing at the same rate, and the back office is usually where that gap shows up first.',
      question: 'Is that on your radar for next year?',
      thought: 'the companies that grow without adding back-office headcount usually start with one high-volume process and prove it out before expanding. Is there an obvious first candidate at {company}?',
      topic: 'back-office capacity',
    },
    general: {
      trigger: 'Saw your role at {company}.',
      tension: 'Teams across {region} keep telling me they\'re stretched thin by repetitive work that never makes the priority list.',
      question: 'Is that true at {company}, or are you in good shape?',
      thought: 'the repetitive work that hurts most is usually the stuff no one owns end to end. Is there a process like that on your team?',
      topic: 'the repetitive work',
    },
  };

  const DEFAULT_TRUST = {
    finance: '[TRUST: one real result, e.g. "We helped a SaaS finance team take month-end close from 9 days to 5 without adding headcount."]',
    shared: '[TRUST: one real result from a shared services customer]',
    it: '[TRUST: one real result, e.g. a peer IT team that got automations into production]',
    ops: '[TRUST: one real result from an ops / supply chain customer]',
    exec: '[TRUST: one real result from a peer company]',
    general: '[TRUST: one real result]',
  };

  function personaFor(text) {
    for (const p of PERSONAS) if (p.match.test(text || '')) return p;
    return DEFAULT_PERSONA;
  }

  function firstName(name) {
    return (LP.cleanName(name).split(' ')[0] || '').replace(/^\w/, c => c.toUpperCase());
  }

  // Strip legal suffixes for natural-sounding copy: "Shopify Inc" -> "Shopify".
  function displayCompany(name) {
    return String(name).replace(/[,.]?\s+(inc|inc\.|llc|ltd|ltd\.|limited|corp|corp\.|corporation|lp|ulc|plc)\.?$/i, '').trim();
  }

  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));

  // person + classification + touch (1-3) -> {persona, touch, text, checks}
  function draft(person, cls, settings, touch = 1) {
    const persona = personaFor(person.title || person.headline);
    const touches = { ...DEFAULT_TOUCHES, ...(settings.touches || {}) };
    const lines = { ...DEFAULT_LINES[persona.id], ...(settings.lines?.[persona.id] || {}) };
    const trustMap = { ...DEFAULT_TRUST, ...(settings.trust || {}) };
    const acct = cls.account || {};
    const vars = {
      firstName: firstName(person.name),
      company: acct.name ? displayCompany(cls.company || acct.name) : (cls.company || 'your team'),
      vertical: (acct.vertical || 'mid-market').toLowerCase().replace(/ and /g, ' & '),
      region: acct.state || 'the Northeast and Canada',
      title: person.title || '',
      trust: trustMap[persona.id] || trustMap.general,
      you: settings.you || DEFAULT_YOU,
    };
    // Lines can use the same placeholders, so fill them first.
    for (const k of ['trigger', 'tension', 'question', 'thought', 'topic']) vars[k] = fill(lines[k] || '', vars);
    const text = fill(touches[touch] || touches[1], vars);
    return { persona, touch, text, checks: LP.checksFor(text, cls, touch) };
  }

  Object.assign(LP, { PERSONAS, TOUCHES, DEFAULT_TOUCHES, DEFAULT_LINES, DEFAULT_TRUST, DEFAULT_YOU, personaFor, draft, displayCompany });
  if (typeof module !== 'undefined' && module.exports) module.exports = LP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
