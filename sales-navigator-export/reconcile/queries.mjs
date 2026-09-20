#!/usr/bin/env node
/**
 * Print Salesforce lookup queries for the companies in a leads CSV, for orgs
 * too large to export whole.
 *
 *   node reconcile/queries.mjs --leads leads.csv [--format sosl|soql] [--batch 30] [--prompt]
 *
 * --prompt wraps the queries in a paste-ready instruction for a Claude that has
 * a Salesforce connector.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const M = createRequire(import.meta.url)(join(dirname(fileURLToPath(import.meta.url)), 'match.js'));
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true';
}
if (!args.leads) { console.error('Usage: node reconcile/queries.mjs --leads leads.csv [--format sosl|soql] [--batch N] [--prompt]'); process.exit(1); }

const leads = M.parseCsv(readFileSync(args.leads, 'utf8'));
const cols = M.detectLeadColumns(leads.headers);
if (!cols.company) { console.error(`No company column found in ${args.leads}`); process.exit(2); }
const format = args.format === 'soql' ? 'soql' : 'sosl';
const r = M.buildLookupQueries(leads.rows.map((row) => row[cols.company]), { format, batchSize: args.batch ? Number(args.batch) : undefined });

console.error(`${r.terms.length} distinct companies from ${leads.rows.length} leads → ${r.queries.length} ${format.toUpperCase()} queries` +
  (r.skipped.length ? `; skipped ${r.skipped.length} generic names: ${r.skipped.join(', ')}` : ''));
console.log(args.prompt === 'true' ? M.lookupPromptFor(r.queries, format) : r.queries.join('\n\n'));
