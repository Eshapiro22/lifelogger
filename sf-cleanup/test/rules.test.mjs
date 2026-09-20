import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, registrableDomain, parseCsv, toCsv, looksLikeUrl } from "../src/util.mjs";
import { loadAccountsFromCsv } from "../src/accounts.mjs";
import { checkDuplicates, checkNames, checkRequiredFields, pickMaster } from "../src/rules.mjs";
import { mergeFindings } from "../src/findings.mjs";
import { findingsFromResearch } from "../src/research.mjs";

const SAMPLE = new URL("../samples/accounts.sample.csv", import.meta.url).pathname;

test("normalizeName strips legal suffixes and punctuation", () => {
  assert.equal(normalizeName("The Acme Corporation, Inc."), "acme");
  assert.equal(normalizeName("Acme Corp."), "acme");
  assert.equal(normalizeName("Umbrella Limited"), "umbrella");
  assert.equal(normalizeName("Müller GmbH & Co. KG"), "muller and kg");
});

test("registrableDomain handles www, paths, and two-level TLDs", () => {
  assert.equal(registrableDomain("https://www.acme.com/x"), "acme.com");
  assert.equal(registrableDomain("acme.com"), "acme.com");
  assert.equal(registrableDomain("https://www.umbrella.co.uk/about"), "umbrella.co.uk");
  assert.equal(registrableDomain("sub.deep.example.org"), "example.org");
  assert.equal(registrableDomain(""), "");
});

test("csv round trip with quotes and newlines", () => {
  const csv = toCsv(["a", "b"], [{ a: 'say "hi"', b: "line1\nline2" }, { a: "x,y", b: "" }]);
  const rows = parseCsv(csv);
  assert.deepEqual(rows, [["a", "b"], ['say "hi"', "line1\nline2"], ["x,y", ""]]);
});

test("looksLikeUrl", () => {
  assert.ok(looksLikeUrl("acme.com"));
  assert.ok(looksLikeUrl("https://www.acme.co.uk/path"));
  assert.ok(!looksLikeUrl("notaurl"));
  assert.ok(!looksLikeUrl(""));
});

test("loadAccountsFromCsv skips report footer and maps headers", async () => {
  const accounts = await loadAccountsFromCsv(SAMPLE);
  // 8 data rows; the "Grand Totals" footer has a value in the ID column but no name -> skipped
  assert.equal(accounts.length, 8);
  assert.equal(accounts[0].id, "001Xx000003AAAAAA1");
  assert.equal(accounts[0].country, "United States");
  assert.equal(accounts[7].id, null);
});

test("checkDuplicates groups by name and by domain and picks the richest master", async () => {
  const accounts = await loadAccountsFromCsv(SAMPLE);
  const dups = checkDuplicates(accounts);
  const pairs = dups.map((f) => [f.relatedAccountId, f.accountId].join(">"));
  // Acme x3: master should be AAAAAA1 (most fields + recent activity)
  assert.ok(pairs.includes("001Xx000003AAAAAA1>001Xx000003AAAAAA2"));
  assert.ok(pairs.includes("001Xx000003AAAAAA1>001Xx000003AAAAAA3"));
  // Umbrella pair by name and domain -> emitted once
  const umbrella = dups.filter((f) => f.accountName.startsWith("Umbrella"));
  assert.equal(umbrella.length, 1);
  assert.equal(umbrella[0].relatedAccountId, "001Xx000003AAAAAA6");
  assert.equal(umbrella[0].proposal.requestType, "Merge");
  assert.equal(umbrella[0].proposal.fields["Master Account ID"], "001Xx000003AAAAAA6");
  assert.equal(umbrella[0].proposal.fields["Disappearing Account ID"], "001Xx000003AAAAAA7");
});

test("pickMaster penalizes placeholder names", () => {
  const a = { name: "Globex TEST", website: "x.com", industry: "T", country: "US", lastActivity: "2026-01-01" };
  const b = { name: "Globex", website: "", industry: "", country: "", lastActivity: "" };
  assert.equal(pickMaster([a, b]), b);
});

test("checkNames and checkRequiredFields", async () => {
  const accounts = await loadAccountsFromCsv(SAMPLE);
  const names = checkNames(accounts);
  assert.ok(names.some((f) => f.accountName.includes("TEST")));
  const req = checkRequiredFields(accounts);
  const initech = req.find((f) => f.accountName === "Initech");
  assert.equal(initech.kind, "bad_website");
  assert.ok(initech.evidence.some((e) => e.includes("not a valid URL")));
  assert.ok(req.find((f) => f.accountName === "Acme Corp.").evidence.includes("missing Industry"));
});

test("mergeFindings keeps reviewer decisions across re-scans", () => {
  const old = [{ id: "F-0001", kind: "duplicate", accountId: "A", relatedAccountId: "B", status: "approved", evidence: ["old"], confidence: 0.5 }];
  const fresh = [
    { id: "F-0001", kind: "duplicate", accountId: "A", relatedAccountId: "B", status: "proposed", evidence: ["new"], confidence: 0.7 },
    { id: "F-0002", kind: "missing_field", accountId: "C", status: "proposed", evidence: [], confidence: 0.9 },
  ];
  const merged = mergeFindings(old, fresh);
  assert.equal(merged[0].status, "approved");
  assert.deepEqual(merged[0].evidence, ["new"]);
  assert.equal(merged[1].status, "proposed");
});

test("findingsFromResearch maps acquisitions to Merge when the acquirer is in the list", () => {
  const acme = { id: "1", name: "Acme Corporation", website: "acme.com" };
  const small = { id: "2", name: "Small Co", website: "small.io" };
  const results = [
    { account: small, result: { status: "acquired", summary: "Bought.", acquirer: "Acme Corp", new_name: null, event_date: "2025", confidence: 0.9, sources: ["https://x"] } },
    { account: acme, result: { status: "active", summary: "", acquirer: null, new_name: null, event_date: null, confidence: 0.9, sources: [] } },
  ];
  const f = findingsFromResearch(results, [acme, small]);
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, "acquired");
  assert.equal(f[0].proposal.requestType, "Merge");
  assert.equal(f[0].proposal.fields["Master Account ID"], "1");
  assert.equal(f[0].proposal.fields["Disappearing Account ID"], "2");

  const gone = findingsFromResearch([{ account: small, result: { status: "defunct", summary: "Closed.", acquirer: null, new_name: null, event_date: null, confidence: 0.8, sources: [] } }], [small]);
  assert.equal(gone[0].proposal.requestType, "Delete");
  assert.equal(gone[0].proposal.verifyFields, true);
});
