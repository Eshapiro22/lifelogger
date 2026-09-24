// Default step recipes for driving the Outreach web app.
//
// These are BEST GUESSES — they have not been checked against the live
// Outreach UI. Expect to adjust labels/selectors on the Recipes tab (the
// recorder there captures your own clicks as steps).
//
// Step reference (all string values support {{var}} and {{a|b}} fallbacks):
//   navigate    { url }
//   pause       { ms }
//   waitFor     { target, timeout? }
//   click       { target, final?, timeout? }  final = the irreversible click (skipped in dry run)
//   type        { target, value, clear? }
//   key         { key }                        e.g. "Enter", "Escape"
//   assertText  { text, timeout? }
//   pickResult  { rows, mustContain[], prefer[]?, click?, timeout? }
// Target: { selector?, text? (string or list of alternatives), label?, within?, nth? }
// Any step may also have: optional (don't fail the lead), if / unless (var name),
// dryRunOnly (only runs in dry run), note (free text).

export const DEFAULT_RECIPES = {
  find: [
    { action: 'navigate', url: 'https://app.outreach.io/prospects' },
    { action: 'type', target: { label: 'Search' }, value: '{{email|fullName}}', clear: true },
    { action: 'key', key: 'Enter' },
    {
      action: 'pickResult',
      note: 'Opens the prospect only if exactly one row contains the lead\'s first and last name.',
      rows: "[role='row'], tbody tr, [data-testid*='prospect-row']",
      mustContain: ['{{firstName}}', '{{lastName}}'],
      prefer: ['{{company}}', '{{email}}'],
      click: "a[href*='prospects/']",
      timeout: 15000,
    },
    { action: 'pause', ms: 1500 },
  ],
  sequence: [
    { action: 'click', target: { text: ['Add to sequence', 'Sequence'] } },
    { action: 'type', target: { label: 'Search' }, value: '{{sequence}}', clear: true },
    { action: 'click', target: { text: '{{sequence}}', selector: "[role='option'], [role='menuitem'], li" } },
    { action: 'click', target: { text: ['Add to sequence', 'Add', 'Start', 'Confirm'], selector: 'button' }, final: true },
    { action: 'key', key: 'Escape', dryRunOnly: true, optional: true },
    { action: 'pause', ms: 1500 },
  ],
  email: [
    { action: 'click', target: { text: ['Email', 'Compose'] } },
    { action: 'click', target: { text: ['Templates', 'Template', 'Insert template'] } },
    { action: 'type', target: { label: 'Search' }, value: '{{template}}', clear: true },
    { action: 'click', target: { text: '{{template}}', selector: "[role='option'], [role='menuitem'], li" } },
    { action: 'pause', ms: 1000 },
    { action: 'click', target: { text: 'Send', selector: 'button' }, final: true },
    { action: 'key', key: 'Escape', dryRunOnly: true, optional: true },
    { action: 'pause', ms: 1500 },
  ],
};
