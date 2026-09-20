// Finding model + persistence. A finding is one proposed change for one account.
// Lifecycle: proposed -> approved | rejected -> submitted (or failed).

import { readJson, writeJson } from "./util.mjs";

let counter = 0;

export function makeFinding({ kind, severity = "medium", confidence = 0.5, account, related = null, evidence = [], sources = [], proposal = null }) {
  counter += 1;
  return {
    id: `F-${String(counter).padStart(4, "0")}`,
    kind,
    severity,
    confidence,
    accountId: account.id || null,
    accountName: account.name,
    relatedAccountId: related?.id || null,
    relatedAccountName: related?.name || null,
    evidence,
    sources,
    proposal,
    status: "proposed",
    createdAt: new Date().toISOString(),
    submission: null,
  };
}

export function resetCounter(n = 0) { counter = n; }

/** Merge new findings into an existing set: keep reviewer decisions for findings that already exist. */
export function mergeFindings(existing, fresh) {
  const key = (f) => `${f.kind}|${f.accountId || f.accountName}|${f.relatedAccountId || f.relatedAccountName || ""}`;
  const byKey = new Map(existing.map((f) => [key(f), f]));
  const out = [];
  for (const f of fresh) {
    const prev = byKey.get(key(f));
    if (prev && prev.status !== "proposed") {
      // Reviewer already decided (or it was submitted): keep their record, refresh evidence only.
      out.push({ ...prev, evidence: f.evidence, sources: f.sources?.length ? f.sources : prev.sources, confidence: f.confidence });
      byKey.delete(key(f));
    } else {
      out.push(prev ? { ...f, id: prev.id } : f);
      if (prev) byKey.delete(key(f));
    }
  }
  // Findings that no longer reproduce but were already submitted stay for the audit trail.
  for (const leftover of byKey.values()) if (leftover.status === "submitted") out.push(leftover);
  return renumber(out);
}

function renumber(findings) {
  // Keep ids stable-ish: only assign ids to findings lacking one; ensure uniqueness.
  const used = new Set();
  let n = 0;
  for (const f of findings) {
    if (!f.id || used.has(f.id)) {
      do { n += 1; f.id = `F-${String(n).padStart(4, "0")}`; } while (used.has(f.id));
    }
    used.add(f.id);
  }
  resetCounter(findings.length);
  return findings;
}

export async function loadFindings(path) {
  const data = await readJson(path, { findings: [] });
  resetCounter(data.findings.length);
  return data;
}

export async function saveFindings(path, data) {
  await writeJson(path, { ...data, updatedAt: new Date().toISOString() });
}

export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function sortFindings(findings) {
  return [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.confidence - a.confidence || a.accountName.localeCompare(b.accountName),
  );
}
