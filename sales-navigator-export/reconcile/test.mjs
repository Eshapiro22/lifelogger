// Synthetic smoke test for reconcile/match.js. Run: node reconcile/test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const M = createRequire(import.meta.url)('./match.js');

// normalisation
assert.equal(M.normalizeCompany('The Acme Corporation, Inc.'), 'acme');
assert.equal(M.normalizeCompany('Müller & Söhne GmbH'), 'muller and sohne');
assert.equal(M.normalizeCompany('Acme Holdings Ltd'), 'acme holdings');
assert.equal(M.normalizeCompany('Co'), 'co'); // never strip the only token
assert.equal(M.normalizePerson('Jane Doe, MBA (she/her)'), 'jane doe');
assert.equal(M.normalizePerson('José Álvarez Jr.'), 'jose alvarez');

// similarity tiers
assert.equal(M.tierForScore(M.companySimilarity('acme', 'acme')), 'exact');
assert.ok(M.companySimilarity('acme', 'acme technologies') >= 0.85, 'prefix boost');
assert.ok(M.companySimilarity('salesforce', 'salesforce com') >= 0.85);
assert.ok(M.companySimilarity('acme', 'zenith bank') < 0.3);

// CSV with Salesforce footer + quoted fields
const accountsCsv = `Account ID,Account Name,Account Owner,Website,Parent Account,Type
001A,Acme Corporation,Ethan Shapiro,acme.com,,Customer
001B,"Globex, Inc.",Pat Lee,globex.com,,Prospect
001C,Initech LLC,Ethan Shapiro,initech.com,,Customer
001D,Acme Bank,Pat Lee,acmebank.com,,Prospect
001E,Umbrella Corp,Sam Kim,umbrella.com,,Customer
001F,Umbrella Corporation,Sam Kim,umbrella.com,,Customer

Copyright (c) 2000-2026 salesforce.com, inc. All rights reserved.
`;
const accts = M.parseCsv(accountsCsv);
assert.equal(accts.rows.length, 6, 'footer dropped');
const accountCols = M.detectAccountColumns(accts.headers);
assert.deepEqual(accountCols, { id: 'Account ID', name: 'Account Name', owner: 'Account Owner', website: 'Website', parent: 'Parent Account', type: 'Type' });

const leadsCsv = `name,title,company,location,profile_url
Jane Doe,VP Sales,Acme Corp,NYC,https://www.linkedin.com/sales/lead/1
John Roe,CTO,"Globex, Inc",SF,https://www.linkedin.com/sales/lead/2
Ann Poe,CFO,Initech,LA,https://www.linkedin.com/sales/lead/3
Bob Loe,CEO,Umbrella,Boston,https://www.linkedin.com/sales/lead/4
Cy Moe,CMO,Zenith Widgets,Austin,https://www.linkedin.com/sales/lead/5
Di Noe,COO,,Denver,https://www.linkedin.com/sales/lead/6
`;
const leads = M.parseCsv(leadsCsv);
const leadCols = M.detectLeadColumns(leads.headers);
assert.equal(leadCols.company, 'company');
assert.equal(leadCols.name, 'name');

const contactsCsv = `Contact ID,First Name,Last Name,Account Name,Contact Owner,Title
003A,Jane,Doe,Acme Corporation,Ethan Shapiro,VP Sales
003B,Bob,Loe,Some Other Co,Pat Lee,CEO
`;
const contacts = M.parseCsv(contactsCsv);
const contactCols = M.detectContactColumns(contacts.headers);
assert.equal(contactCols.firstName, 'First Name');

const { rows, summary, owners } = M.reconcile({
  leads: leads.rows, leadCols, accounts: accts.rows, accountCols,
  contacts: contacts.rows, contactCols, me: 'ethan shapiro', sfBaseUrl: 'https://x.lightning.force.com/',
});
const by = Object.fromEntries(rows.map((r) => [r.name, r]));

assert.equal(by['Jane Doe'].sf_account_name, 'Acme Corporation');
assert.equal(by['Jane Doe'].match_tier, 'exact');
assert.equal(by['Jane Doe'].account_is_mine, 'Yes');
assert.equal(by['Jane Doe'].sf_contact_exists, 'Yes');
assert.equal(by['Jane Doe'].contact_is_mine, 'Yes');
assert.equal(by['Jane Doe'].sf_account_url, 'https://x.lightning.force.com/lightning/r/Account/001A/view');

assert.equal(by['John Roe'].sf_account_name, 'Globex, Inc.');
assert.equal(by['John Roe'].account_is_mine, 'No');
assert.equal(by['John Roe'].sf_contact_exists, 'No');

assert.equal(by['Ann Poe'].sf_account_name, 'Initech LLC');
assert.equal(by['Ann Poe'].account_is_mine, 'Yes');

// "Umbrella" → two accounts that normalise identically → exact, flagged as duplicates
assert.equal(by['Bob Loe'].match_tier, 'exact');
assert.match(by['Bob Loe'].match_note, /2 accounts share this name/);
assert.match(by['Bob Loe'].match_note, /Contact with this name exists on "Some Other Co"/);

assert.equal(by['Cy Moe'].match_tier, 'none');
assert.equal(by['Cy Moe'].sf_account_name, '');
assert.equal(by['Di Noe'].match_note, 'No company on lead');

assert.deepEqual(summary, { total: 6, mine: 2, notMine: 2, unmatched: 2, review: 1, contactsFound: 2 });
assert.equal(owners[0].owner, 'Ethan Shapiro');

// CSV round-trip keeps quoting intact
const csv = M.toCsv(rows, M.OUTPUT_COLUMNS);
const back = M.parseCsv(csv);
assert.equal(back.rows.length, 6);
assert.equal(back.rows[1].company, 'Globex, Inc');

// SOQL-style headers (what a Salesforce connector / CLI query produces)
assert.deepEqual(
  M.detectAccountColumns(['Id', 'Name', 'Owner.Name', 'Website', 'Parent.Name', 'Type']),
  { id: 'Id', name: 'Name', owner: 'Owner.Name', website: 'Website', parent: 'Parent.Name', type: 'Type' });
const soqlContact = M.detectContactColumns(['Id', 'FirstName', 'LastName', 'Account.Name', 'Owner.Name', 'Title', 'Email']);
assert.equal(soqlContact.account, 'Account.Name');
assert.equal(soqlContact.owner, 'Owner.Name');
assert.equal(soqlContact.firstName, 'FirstName');

// my-accounts-only mode: presence in the file == mine, absence == not mine, `me` optional
const mineOnly = M.reconcile({
  leads: leads.rows, leadCols,
  accounts: accts.rows.filter((r) => r['Account Owner'] === 'Ethan Shapiro'), accountCols,
  contacts: contacts.rows, contactCols, me: '', myAccountsOnly: true,
});
const mo = Object.fromEntries(mineOnly.rows.map((r) => [r.name, r]));
assert.equal(mineOnly.me, 'Ethan Shapiro', 'me inferred from single owner');
assert.equal(mo['Jane Doe'].account_is_mine, 'Yes');
assert.equal(mo['Jane Doe'].contact_is_mine, 'Yes', 'inferred me still drives contact ownership');
assert.equal(mo['John Roe'].account_is_mine, 'No');
assert.equal(mo['John Roe'].match_note, 'Not one of my accounts');
assert.equal(mineOnly.summary.mine, 2);
assert.equal(mineOnly.summary.unmatched, 4);
assert.equal(mineOnly.summary.notMine, 0);

// lookup query generation keeps real characters, drops suffixes, dedupes, skips generic names
const lq = M.buildLookupQueries(["O'Reilly Media, LLC", 'Müller & Söhne GmbH', 'The Acme Corporation', 'Acme Corp', 'Global Solutions', 'AB', '', 'Swing Design Inc.']);
assert.deepEqual(lq.terms, ["O'Reilly Media", 'Müller & Söhne', 'Acme', 'Swing Design']);
assert.deepEqual(lq.skipped, ['Global Solutions', 'AB']);
assert.equal(lq.queries.length, 1);
assert.match(lq.queries[0], /Name LIKE 'O\\'Reilly Media%'/);
assert.match(lq.queries[0], /Name LIKE 'Müller & Söhne%'/);
assert.match(lq.queries[0], /Name LIKE 'Acme%' OR Name LIKE 'The Acme%'/);
const sosl = M.buildLookupQueries(["O'Reilly Media", 'Acme'], { format: 'sosl' }).queries[0];
assert.equal(sosl, `FIND {"O\\'Reilly Media" OR "Acme"} IN NAME FIELDS RETURNING Account(Id, Name, Owner.Name, Website, Parent.Name, Type)`);
assert.equal(M.buildLookupQueries(Array.from({ length: 120 }, (_, i) => `Company ${i} Widgets`)).queries.length, 3, 'batched at 50');
assert.match(M.lookupPromptFor(['Q1'], 'sosl'), /1 Salesforce SOSL query/);

assert.ok(M.companySimilarity('nttdata', 'ntt data international services') >= 0.85, 'space-insensitive prefix');
assert.ok(M.companySimilarity('pcconnection', 'connection') < 0.85, 'no false prefix the other way');
assert.equal(M.searchTermFor('NTT DATA Switzerland (vormals Cirquent / Softlab)').term, 'NTT DATA Switzerland');
assert.deepEqual(M.buildLookupQueries(['Retired', 'Self-employed', 'Acme']).skipped, ['Retired', 'Self-employed']);
{
  const idx = M.buildAccountIndex([{ N: 'Ntt Data International Services, Inc.' }, { N: 'PC Connection Inc' }], { name: 'N' });
  assert.equal(M.matchCompany('NTTData', idx).best.name, 'Ntt Data International Services, Inc.', 'one-word variant blocks via compact prefix');
  assert.equal(M.matchCompany('PCConnection Inc', idx).best.name, 'PC Connection Inc');
}
console.log('all reconcile tests passed');
