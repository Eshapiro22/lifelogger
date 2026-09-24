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

assert.deepEqual(summary, { total: 6, mine: 2, notMine: 2, unmatched: 2, review: 1, contactsFound: 2, confirmed: 0 });
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
{
  const accounts = [{ Id: '1', Name: 'Goodwin plc', Owner: 'John Smith' }, { Id: '2', Name: 'Goodwin Procter LLP', Owner: 'Ethan Shapiro' }];
  const cols = { id: 'Id', name: 'Name', owner: 'Owner' };
  const leadsG = [{ company: 'Goodwin', name: 'X' }];
  const lc = { name: 'name', company: 'company' };
  const plain = M.reconcile({ leads: leadsG, leadCols: lc, accounts, accountCols: cols, me: 'Ethan Shapiro' });
  assert.equal(plain.rows[0].sf_account_name, 'Goodwin plc', 'without override, exact-after-suffix-strip wins');
  const withOv = M.reconcile({ leads: leadsG, leadCols: lc, accounts, accountCols: cols, me: 'Ethan Shapiro', overrides: M.parseOverrides('Goodwin => Goodwin Procter LLP') });
  assert.equal(withOv.rows[0].sf_account_name, 'Goodwin Procter LLP');
  assert.equal(withOv.rows[0].match_tier, 'confirmed');
  assert.equal(withOv.rows[0].account_is_mine, 'Yes');
  assert.equal(withOv.summary.review, 0);
  assert.deepEqual(M.parseOverrides('A => B\n# comment\nC = D\n"E, Inc" , F'), { A: 'B', C: 'D', 'E, Inc': 'F' });
}
{
  const specific = M.companySimilarity('ntt data mexico', 'ntt data mexico s de r l de c v');
  const generic = M.companySimilarity('ntt data mexico', 'ntt data');
  assert.ok(specific > generic, `specific account should beat generic (${specific} vs ${generic})`);
  assert.ok(M.companySimilarity('harcourt', 'town of harcourt') < 0.75, 'containment without prefix is not boosted');
}
{
  const accounts = [{ Id: '1', Name: 'Town Of Harcourt', Owner: 'Rafa' }, { Id: '2', Name: 'Houghton Mifflin Harcourt Co.', Owner: 'Ethan Shapiro' }, { Id: '3', Name: 'Connection Inc.', Owner: 'Ethan Shapiro' }];
  const cols = { id: 'Id', name: 'Name', owner: 'Owner' };
  const lc = { name: 'name', company: 'company' };
  const leadsP = ['Harcourt', 'Harcourt Education Group', 'PCConnection Inc', 'PC Connection, Inc.', 'Harcourtside Bakery'].map((c) => ({ name: 'x', company: c }));
  const r = M.reconcile({ leads: leadsP, leadCols: lc, accounts, accountCols: cols, me: 'Ethan Shapiro',
    overrides: M.parseOverrides('Harcourt* => Houghton Mifflin Harcourt Co.\nPC Connection* => Connection Inc.\nPCConnection* => Connection Inc.') });
  assert.equal(r.rows[0].sf_account_name, 'Houghton Mifflin Harcourt Co.');
  assert.equal(r.rows[1].sf_account_name, 'Houghton Mifflin Harcourt Co.');
  assert.equal(r.rows[2].sf_account_name, 'Connection Inc.');
  assert.equal(r.rows[3].sf_account_name, 'Connection Inc.');
  assert.notEqual(r.rows[4].match_tier, 'confirmed', 'prefix rule needs a word boundary or compact prefix, not "harcourtside"');
}
assert.deepEqual(M.splitPersonName('Jane Q. Doe, MBA (she/her)'), { first: 'Jane Q.', last: 'Doe' });
assert.deepEqual(M.splitPersonName('Robert Smith Jr.'), { first: 'Robert', last: 'Smith Jr.' });
assert.deepEqual(M.splitPersonName('Madonna'), { first: '', last: 'Madonna' });
assert.deepEqual(M.splitLocation('Boston, Massachusetts, United States'), { city: 'Boston', state: 'Massachusetts', country: 'United States' });
assert.deepEqual(M.splitLocation('Greater Toronto Area'), { city: 'Greater Toronto Area', state: '', country: '' });
{
  const rec = [
    { name: 'Jane Doe', title: 'VP', location: 'Boston, Massachusetts, United States', sf_account_id: '001A', sf_account_name: 'Acme', account_is_mine: 'Yes', sf_contact_exists: 'No', in_crm: 'No', profile_url: 'u1' },
    { name: 'Jane Doe', title: 'VP', location: '', sf_account_id: '001A', sf_account_name: 'Acme', account_is_mine: 'Yes', sf_contact_exists: 'No', in_crm: 'No', profile_url: 'u1b' },
    { name: 'John Roe', sf_account_id: '001B', sf_account_name: 'Globex', account_is_mine: 'No', sf_account_owner: 'Pat Lee', sf_contact_exists: 'No', in_crm: 'No' },
    { name: 'Ann Poe', sf_account_id: '001A', sf_account_name: 'Acme', account_is_mine: 'Yes', sf_contact_exists: 'Yes', sf_contact_owner: 'Ethan', in_crm: 'No' },
    { name: 'Bob Loe', sf_account_id: '001A', sf_account_name: 'Acme', account_is_mine: 'Yes', sf_contact_exists: 'No', in_crm: 'Yes' },
    { name: 'Cy Moe', sf_account_id: '', account_is_mine: '', sf_contact_exists: 'No', in_crm: 'No' },
  ];
  const ci = M.buildContactImport(rec, { listName: 'L' });
  assert.deepEqual(ci.counts, { total: 6, toCreate: 1, held: 0, notMine: 1, noAccount: 1, existing: 1, inCrm: 1, noName: 0, duplicateInList: 1 });
  const heldRun = M.buildContactImport(rec, { listName: 'L', holdAccounts: ['acme'], ownerId: '005X' });
  assert.equal(heldRun.counts.held, 1); assert.equal(heldRun.counts.toCreate, 0);
  const dl = M.toDataLoaderRows(ci.rows, { ownerId: '005X', linkedInField: 'LinkedIn_Profile__c' });
  assert.deepEqual(Object.keys(dl[0]), M.dataLoaderColumns('LinkedIn_Profile__c'));
  assert.equal(dl[0].OwnerId, '005X'); assert.equal(dl[0].LinkedIn_Profile__c, 'u1');
  const dl2 = M.toDataLoaderRows(ci.rows, {});
  assert.match(dl2[0].Description, /LinkedIn: u1/);
  assert.equal(ci.rows[0].LastName, 'Doe');
  assert.equal(ci.rows[0].MailingState, 'Massachusetts');
  assert.equal(ci.rows[0].AccountId, '001A');
  assert.match(M.contactImportPrompt(1, 'L'), /1 people/);
}
console.log('all reconcile tests passed');
