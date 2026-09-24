import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, guessMapping, toLead, leadKey, toCsv } from '../lib/csv.js';
import { interpolate } from '../lib/runner.js';

const { headers, records } = parseCsv(readFileSync(new URL('./sample-leads.csv', import.meta.url), 'utf8'));
assert.equal(records.length, 5);
assert.equal(records[1]['Job Title'], 'Director, RevOps');

const m = guessMapping(headers);
assert.deepEqual(m, {
  firstName: 'First Name', lastName: 'Last Name', fullName: '', email: 'Email',
  company: 'Company Name', title: 'Job Title', linkedinUrl: 'LinkedIn Profile URL',
});

const jane = toLead(records[0], m);
assert.equal(jane.fullName, 'Jane Doe');
assert.equal(jane.email, 'jane@acme.com');
assert.equal(leadKey(jane), 'jane@acme.com');
assert.equal(jane['Job Title'], 'VP Sales');

// Full-name-only exports and multi-email cells
const alt = parseCsv('﻿Name,Emails\r\n"Ana María López","a@x.com; b@y.com"\r\n');
const ana = toLead(alt.records[0], guessMapping(alt.headers));
assert.equal(ana.firstName, 'Ana');
assert.equal(ana.lastName, 'María López');
assert.equal(ana.email, 'a@x.com');

assert.equal(interpolate('{{email|fullName}}', { email: '', fullName: 'John Smith' }), 'John Smith');
assert.deepEqual(interpolate({ t: ['{{a}}', 'x'], n: 5 }, { a: 'A' }), { t: ['A', 'x'], n: 5 });
assert.equal(toCsv([{ a: 'x,"y"', b: 1 }]), 'a,b\n"x,""y""",1');

console.log('unit tests passed');
