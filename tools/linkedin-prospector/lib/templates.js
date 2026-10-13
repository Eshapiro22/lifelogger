// Triple T drafting (Trigger -> Tension -> Trust), per Jason Bay's framework as
// written up by 30MPC. Prospects are bucketed into persona groups so each
// group gets a tailored message without writing one-by-one.
//
// Every default below is a starting point to edit on the dashboard's Settings
// tab. Trust lines ship as [TRUST: ...] placeholders on purpose: proof has to
// be a real customer story or number, and the dashboard won't mark a draft
// ready while a placeholder is still in it.
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

  const DEFAULT_TEMPLATES = {
    finance:
      'Hi {firstName}, thanks for connecting. Finance teams at {vertical} companies like {company} keep getting asked to close faster and absorb more volume without adding headcount, and a lot of that time still goes to manual reconciliations and chasing exceptions.\n\n{trust}\n\nWorth comparing notes on how {company} is handling it?',
    shared:
      'Hi {firstName}, thanks for connecting. Shared services leaders I talk to are being asked to take on more processes every year while the team stays flat, so the backlog of manual hand-offs keeps growing.\n\n{trust}\n\nOpen to a quick swap of notes on what that looks like at {company}?',
    it:
      'Hi {firstName}, thanks for connecting. IT leaders at {vertical} companies are getting a long list of "can we automate this?" requests from the business, and most of them stall between pilot and production.\n\n{trust}\n\nCurious whether that matches what you are seeing at {company}?',
    ops:
      'Hi {firstName}, thanks for connecting. Ops leaders at {vertical} companies I speak with are still re-keying orders, invoices and shipment data between systems, which slows everything down when volume spikes.\n\n{trust}\n\nIs that a headache at {company}, or have you solved it?',
    exec:
      'Hi {firstName}, thanks for connecting. Leaders at {vertical} companies like {company} are under pressure to grow without growing headcount at the same rate, and back-office work is usually where that gap shows up first.\n\n{trust}\n\nWould it be worth a short conversation?',
    general:
      'Hi {firstName}, thanks for connecting. I work with {vertical} companies across {region} and keep hearing that teams are stretched thin by manual, repetitive work that never makes the priority list.\n\n{trust}\n\nWould it be useful to compare notes on what that looks like at {company}?',
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

  // person + classification -> {persona, text, checks}
  function draft(person, cls, settings) {
    const persona = personaFor(person.title || person.headline);
    const templates = { ...DEFAULT_TEMPLATES, ...(settings.templates || {}) };
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
    const text = (templates[persona.id] || templates.general)
      .replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    // Checklist lives in review.js (LP.checksFor) so edited drafts are re-scored the same way.
    return { persona, text, checks: LP.checksFor(text, cls) };
  }

  // Strip legal suffixes for natural-sounding copy: "Shopify Inc" -> "Shopify".
  function displayCompany(name) {
    return String(name).replace(/[,.]?\s+(inc|inc\.|llc|ltd|ltd\.|limited|corp|corp\.|corporation|lp|ulc|plc)\.?$/i, '').trim();
  }

  Object.assign(LP, { PERSONAS, DEFAULT_TEMPLATES, DEFAULT_TRUST, personaFor, draft, displayCompany });
  if (typeof module !== 'undefined' && module.exports) module.exports = LP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
