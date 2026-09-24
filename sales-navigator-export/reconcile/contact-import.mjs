#!/usr/bin/env node
/**
 * Build a Salesforce Contact import file from a reconciled CSV.
 *
 *   node reconcile/contact-import.mjs --reconciled reconciled.csv [--list "Tier 1 Account Leads"]
 *        [--include-not-mine] [--include-existing] [--include-in-crm] [--out contacts-to-create.csv]
 *
 * Writes the import CSV, a "-skipped.csv" beside it with the reason per row, and prints a
 * paste-ready prompt for a Claude with a Salesforce connector.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const M = createRequire(import.meta.url)(join(dirname(fileURLToPath(import.meta.url)), 'match.js'));
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true';
}
if (!args.reconciled) { console.error('Usage: node reconcile/contact-import.mjs --reconciled reconciled.csv [--list NAME] [--include-not-mine] [--include-existing] [--include-in-crm] [--out FILE]'); process.exit(1); }

const rec = M.parseCsv(readFileSync(args.reconciled, 'utf8')).rows;
const { rows, skipped, counts } = M.buildContactImport(rec, {
  listName: args.list || '',
  onlyMine: args['include-not-mine'] !== 'true',
  skipExisting: args['include-existing'] !== 'true',
  skipInCrm: args['include-in-crm'] !== 'true',
});
const out = args.out || 'contacts-to-create.csv';
writeFileSync(out, M.toCsv(rows, M.CONTACT_IMPORT_COLUMNS));
writeFileSync(out.replace(/\.csv$/i, '') + '-skipped.csv', M.toCsv(skipped, M.CONTACT_IMPORT_COLUMNS));
console.error(`${counts.toCreate} contacts to create; skipped ${counts.notMine} at others' accounts, ${counts.existing} already contacts, ${counts.inCrm} shown In CRM, ${counts.noAccount} without an account, ${counts.duplicateInList} duplicates, ${counts.noName} without a name.\nWrote ${out}`);
console.log(M.contactImportPrompt(counts.toCreate, args.list || '', out.split('/').pop()));
