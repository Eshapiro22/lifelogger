// LinkedIn message drafting, following 30MPC's outbound sequence ("there's
// nothing people hate more than a connect and pitch"):
//
//   Touch 1  context only    - about them, no pitch, no product, no meeting ask
//   Touch 2  thoughts bubble - one observation about the problem (the Tension)
//   Touch 3  proof bubble    - one real customer story (the Trust), light ask
//
// The Triple T (Trigger -> Tension -> Trust) is spread across the touches
// instead of crammed into the first message. Prospects are bucketed by persona
// so each group gets tailored lines without writing one-by-one. Everything here
// is a default to edit on the dashboard's Settings tab. Trust lines ship as
// [TRUST: ...] placeholders on purpose: proof has to be a real customer story.
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
    { n: 1, label: 'Touch 1 · context only (no pitch)' },
    { n: 2, label: 'Touch 2 · thoughts bubble-up' },
    { n: 3, label: 'Touch 3 · proof bubble-up' },
  ];

  const DEFAULT_TOUCHES = {
    1: 'Hi {firstName}, thanks for connecting. {context}',
    2: 'Hi {firstName}, one thought since we connected: {thought}',
    3: '{firstName}, last note from me on this. {trust} If it would ever help to compare notes on how {company} handles it, happy to.',
  };

  // Per persona: {context} for touch 1 (about them, ends in an easy question,
  // no pitch) and {thought} for touch 2 (the problem, in plain words).
  const DEFAULT_LINES = {
    finance: {
      context: 'Saw you lead finance at {company}. With year-end coming up, is the close something your team is trying to tighten, or is it in a good spot?',
      thought: 'most {vertical} finance teams I talk to say the close isn\'t slow because of the big items, it\'s the hundreds of small reconciliations and exceptions that eat the last few days. Curious if that rings true at {company}.',
    },
    shared: {
      context: 'Saw you\'re running shared services at {company}. Is the team taking on new processes this year, or mostly holding steady?',
      thought: 'a lot of shared services leaders I talk to get handed more processes every year with the same headcount, so the manual hand-offs pile up quietly. Curious whether that\'s the case at {company}.',
    },
    it: {
      context: 'Saw your role at {company}. What\'s taking up most of your team\'s time heading into next year?',
      thought: 'IT teams at {vertical} companies keep telling me the business sends a long list of "can we automate this?" requests, and most stall between pilot and production. Curious if that matches what you see at {company}.',
    },
    ops: {
      context: 'Saw you\'re in operations at {company}. Is volume picking up for you this quarter?',
      thought: 'ops leaders at {vertical} companies I speak with are still re-keying orders, invoices and shipment data between systems, which is fine until volume spikes. Curious whether that\'s a headache at {company} or already solved.',
    },
    exec: {
      context: 'Saw you lead {company}. What\'s the big focus for the team going into next year?',
      thought: 'leaders at {vertical} companies keep telling me they\'re asked to grow without headcount growing at the same rate, and the back office is usually where that gap shows up first. Curious how you\'re thinking about it at {company}.',
    },
    general: {
      context: 'Saw your role at {company}. What\'s keeping your team busiest these days?',
      thought: 'teams I talk to across {region} keep saying they\'re stretched thin by repetitive work that never makes the priority list. Curious if that\'s true at {company} too.',
    },
  };

  const DEFAULT_TRUST = {
    finance: '[TRUST: one sentence of real proof, e.g. a peer finance team you helped and the result]',
    shared: '[TRUST: one sentence of real proof from a shared services customer]',
    it: '[TRUST: one sentence of real proof, e.g. a peer IT team that got automations into production]',
    ops: '[TRUST: one sentence of real proof from an ops / supply chain customer]',
    exec: '[TRUST: one sentence of real proof, e.g. a peer company result]',
    general: '[TRUST: one sentence of real proof]',
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
    };
    // Lines can use the same placeholders, so fill them first.
    vars.context = fill(lines.context, vars);
    vars.thought = fill(lines.thought, vars);
    const text = fill(touches[touch] || touches[1], vars);
    return { persona, touch, text, checks: LP.checksFor(text, cls, touch) };
  }

  Object.assign(LP, { PERSONAS, TOUCHES, DEFAULT_TOUCHES, DEFAULT_LINES, DEFAULT_TRUST, personaFor, draft, displayCompany });
  if (typeof module !== 'undefined' && module.exports) module.exports = LP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
