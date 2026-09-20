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

test("registrableDomain treats provincial/country second-level labels as public suffixes", () => {
  assert.equal(registrableDomain("corem.qc.ca"), "corem.qc.ca");
  assert.equal(registrableDomain("www.gouv.qc.ca"), "gouv.qc.ca");
  assert.equal(registrableDomain("city.on.ca"), "city.on.ca");
  assert.equal(registrableDomain("foo.bar.io"), "bar.io");
});

test("domain-only matches with unrelated names are low-confidence same_domain, hierarchies are skipped, shared domains ignored", () => {
  const parent = { id: "P", name: "Iron Mountain Inc", website: "ironmountain.com", parentName: "" };
  const child = { id: "C", name: "Iron Mountain France", website: "ironmountain.com", parentName: "Iron Mountain Inc" };
  const cousin = { id: "X", name: "Iron Mountain Polska", website: "ironmountain.com", parentName: "" };
  const other = { id: "O", name: "Twenty-four seven Inc", website: "ironmountain.com", parentName: "" };
  const f = checkDuplicates([parent, child, cousin, other]);
  assert.ok(!f.some((x) => x.accountId === "C"), "parent/child pair must be skipped");
  const cousinF = f.find((x) => x.accountId === "X");
  assert.equal(cousinF.kind, "duplicate");
  assert.equal(cousinF.confidence, 0.6);
  const otherF = f.find((x) => x.accountId === "O");
  assert.equal(otherF.kind, "same_domain");
  assert.equal(otherF.severity, "low");
  const shared = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Org ${i}`, website: "shared.qc.ca" }));
  assert.equal(checkDuplicates(shared).length, 0);
});

test("checkNames flags mojibake with a decoded fix and ignores ALL CAPS", () => {
  const f = checkNames([{ name: "CHU de QuÃ©bec" }, { name: "COREM" }, { name: "Old Colony Y" }, { name: "Aerorepair duplicate to be deleted" }]);
  assert.equal(f.length, 2);
  assert.equal(f[0].proposal.fields["Account Name"], "CHU de Québec");
  assert.ok(f[1].accountName.startsWith("Aerorepair"));
});

test("phone and address normalization", async () => {
  const { normalizePhone, normalizeAddress } = await import("../src/util.mjs");
  assert.equal(normalizePhone("+1 (617) 555-0100"), "6175550100");
  assert.equal(normalizePhone("617.555.0100 x204"), "6175550100");
  assert.equal(normalizePhone("555"), "");
  assert.equal(normalizeAddress({ street: "100 Main Street, Suite 500", postalCode: "02110-1234" }), "100 main st|02110");
  assert.equal(normalizeAddress({ street: "100 Main St.\nSuite 500", postalCode: "02110" }), "100 main st|02110");
  assert.equal(normalizeAddress({ street: "1 Rue Sainte-Catherine O", postalCode: "H2X 1K4" }), "1 rue sainte catherine o|H2X1K");
  assert.equal(normalizeAddress({ street: "", postalCode: "02110" }), "");
});

test("duplicates by phone and address, with corroboration boosting confidence", () => {
  const a = { id: "A", name: "Acme Widgets Inc", phone: "(617) 555-0100", street: "100 Main St", postalCode: "02110" };
  const b = { id: "B", name: "ACME Widget Co", phone: "617-555-0100", street: "100 Main Street Suite 5", postalCode: "02110" };
  const c = { id: "C", name: "Totally Different LLC", phone: "1 617 555 0100", street: "", postalCode: "" };
  const f = checkDuplicates([a, b, c]);
  const ab = f.find((x) => x.accountId === "B" || x.relatedAccountId === "B");
  assert.equal(ab.kind, "duplicate");
  assert.ok(ab.confidence >= 0.75, `expected corroborated confidence, got ${ab.confidence}`);
  assert.ok(ab.evidence.some((e) => e.startsWith("Also matches on")));
  const c1 = f.find((x) => x.accountId === "C");
  assert.equal(c1.kind, "same_phone");
  assert.equal(c1.severity, "low");
  // A switchboard number shared by many accounts is ignored
  const many = Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: `Tenant ${i}`, phone: "4165550000" }));
  assert.equal(checkDuplicates(many).length, 0);
});
