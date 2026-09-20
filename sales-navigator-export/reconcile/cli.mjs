#!/usr/bin/env node
/**
 * Reconcile a Sales Navigator export against Salesforce exports from the terminal.
 *
 *   node reconcile/cli.mjs \
 *     --leads    sales-navigator-leads.csv \
 *     --accounts salesforce-accounts.csv \
 *     --me       "Ethan Shapiro" \
 *     [--contacts salesforce-contacts.csv] \
 *     [--sf-url   https://yourorg.lightning.force.com] \
 *     [--out      reconciled.csv]
 *
 * Same logic as the extension's "Reconcile with Salesforce" page (reconcile/match.js).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const M = require(join(dirname(fileURLToPath(import.meta.url)), 'match.js'));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.leads || !args.accounts || !args.me) {
  console.error('Usage: node reconcile/cli.mjs --leads leads.csv --accounts accounts.csv --me "Your Name" [--contacts contacts.csv] [--sf-url https://…] [--out out.csv]');
  process.exit(1);
}

const leadsCsv = M.parseCsv(readFileSync(args.leads, 'utf8'));
const acctsCsv = M.parseCsv(readFileSync(args.accounts, 'utf8'));
const contactsCsv = args.contacts ? M.parseCsv(readFileSync(args.contacts, 'utf8')) : null;

const leadCols = M.detectLeadColumns(leadsCsv.headers);
const accountCols = M.detectAccountColumns(acctsCsv.headers);
const contactCols = contactsCsv ? M.detectContactColumns(contactsCsv.headers) : null;

console.error('Detected columns:');
console.error('  leads   ', leadCols);
console.error('  accounts', accountCols);
if (contactCols) console.error('  contacts', contactCols);
if (!accountCols.name) { console.error('Could not find an account-name column in the accounts CSV.'); process.exit(2); }
if (!accountCols.owner) console.error('WARNING: no owner column detected; account_is_mine will be "Unknown".');

const { rows, summary, owners } = M.reconcile({
  leads: leadsCsv.rows, leadCols,
  accounts: acctsCsv.rows, accountCols,
  contacts: contactsCsv ? contactsCsv.rows : null, contactCols,
  me: args.me,
  sfBaseUrl: args['sf-url'] || '',
});

if (owners.length === 1) {
  console.error(`WARNING: every account in the file is owned by ${owners[0].owner}; the export looks scoped to one owner, so leads at other people's accounts will show as unmatched rather than "not mine".`);
}
if (!owners.some((o) => M.normalizePerson(o.owner) === M.normalizePerson(args.me))) {
  console.error(`WARNING: "${args.me}" does not appear as an owner in the accounts file. Top owners: ${owners.slice(0, 5).map((o) => `${o.owner} (${o.count})`).join(', ')}`);
}

const out = args.out || 'reconciled.csv';
writeFileSync(out, M.toCsv(rows, M.OUTPUT_COLUMNS));
console.error(`\n${summary.total} leads → ${summary.mine} on my accounts, ${summary.notMine} on others', ${summary.unmatched} unmatched, ${summary.review} need review` +
  (contactsCsv ? `, ${summary.contactsFound} already in Salesforce as contacts` : '') + `\nWrote ${out}`);
