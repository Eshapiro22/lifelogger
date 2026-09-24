#!/usr/bin/env node
/**
 * Build a Salesforce Contact import file from a reconciled CSV.
 *
 *   node reconcile/contact-import.mjs --reconciled reconciled.csv [--list "Tier 1 Account Leads"]
 *        [--owner-id 005…] [--linkedin-field LinkedIn_Profile__c] [--hold "Acct A;Acct B" | --hold-file hold.txt]
 *        [--include-not-mine] [--include-existing] [--include-in-crm] [--out contacts-dataloader.csv]
 *
 * Writes the Data Loader CSV (exact Contact API names), "-held.csv" for accounts on the hold
 * list, "-review.csv" with human columns, "-skipped.csv" with the reason per row, and prints a
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
const holdAccounts = args['hold-file'] ? readFileSync(args['hold-file'], 'utf8').split(/\r?\n/) : (args.hold ? args.hold.split(';') : []);
const { rows, held, skipped, counts } = M.buildContactImport(rec, {
  listName: args.list || '',
  ownerId: args['owner-id'] || '',
  holdAccounts,
  onlyMine: args['include-not-mine'] !== 'true',
  skipExisting: args['include-existing'] !== 'true',
  skipInCrm: args['include-in-crm'] !== 'true',
});
const lf = args['linkedin-field'] || '';
const out = args.out || 'contacts-dataloader.csv';
const base = out.replace(/\.csv$/i, '');
writeFileSync(out, M.toCsv(M.toDataLoaderRows(rows, { ownerId: args['owner-id'], linkedInField: lf }), M.dataLoaderColumns(lf)));
if (held.length) writeFileSync(base + '-held.csv', M.toCsv(M.toDataLoaderRows(held, { ownerId: args['owner-id'], linkedInField: lf }), M.dataLoaderColumns(lf)));
writeFileSync(base + '-review.csv', M.toCsv([...rows, ...held], M.CONTACT_IMPORT_COLUMNS));
writeFileSync(base + '-skipped.csv', M.toCsv(skipped, M.CONTACT_IMPORT_COLUMNS));
console.error(`${counts.toCreate} contacts in ${out}` + (counts.held ? `; ${counts.held} held back in ${base}-held.csv` : '') +
  `; skipped ${counts.notMine} at others' accounts, ${counts.existing} already contacts, ${counts.inCrm} shown In CRM, ${counts.noAccount} without an account, ${counts.duplicateInList} duplicates, ${counts.noName} without a name.`);
console.log(M.contactImportPrompt(counts.toCreate, args.list || '', out.split('/').pop()));
