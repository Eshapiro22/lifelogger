// Deterministic, offline checks that don't need an LLM:
//   duplicates (by normalized name and by website domain), suspicious names,
//   missing required fields, malformed websites, dead/redirecting websites, stale accounts.
// Each check emits findings in the shape defined in findings.mjs.

import { normalizeName, registrableDomain, looksLikeUrl, pool, daysSince } from "./util.mjs";
import { makeFinding } from "./findings.mjs";

const SUSPICIOUS_NAME = /\b(test|dummy|do not use|donotuse|duplicate|dup|delete|old|zz+|xx+|sample|unknown|tbd|n\/a)\b/i;

export function checkDuplicates(accounts) {
  const findings = [];
  const byName = new Map();
  const byDomain = new Map();
  for (const a of accounts) {
    const n = normalizeName(a.name);
    if (n) byName.set(n, [...(byName.get(n) || []), a]);
    const d = registrableDomain(a.website);
    if (d && !GENERIC_DOMAINS.has(d)) byDomain.set(d, [...(byDomain.get(d) || []), a]);
  }
  const seenPairs = new Set();
  const emit = (group, why) => {
    if (group.length < 2) return;
    const master = pickMaster(group);
    for (const dup of group) {
      if (dup === master) continue;
      const key = [master.id || master.name, dup.id || dup.name].sort().join("|");
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      findings.push(
        makeFinding({
          kind: "duplicate",
          severity: "high",
          confidence: why === "domain" ? 0.75 : 0.65,
          account: dup,
          related: master,
          evidence: [
            why === "name"
              ? `Same normalized name as "${master.name}" (${master.id || "no id"}): "${normalizeName(dup.name)}"`
              : `Same website domain as "${master.name}" (${master.id || "no id"}): ${registrableDomain(dup.website)}`,
            `Proposed master: "${master.name}" (${describeRichness(master)}); disappearing: "${dup.name}" (${describeRichness(dup)})`,
          ],
          proposal: mergeProposal(master, dup, `Duplicate account (same ${why}). Keeping ${master.id || master.name} as master.`),
        }),
      );
    }
  };
  for (const g of byName.values()) emit(g, "name");
  for (const g of byDomain.values()) emit(g, "domain");
  return findings;
}

const GENERIC_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "linkedin.com", "facebook.com", "google.com",
  "wixsite.com", "squarespace.com", "godaddysites.com", "example.com",
]);

/** Prefer the record with more data and more recent activity as the surviving master. */
export function pickMaster(group) {
  return [...group].sort((a, b) => score(b) - score(a))[0];
}
function score(a) {
  let s = 0;
  for (const k of ["website", "industry", "country", "city", "type", "employees", "revenue", "parentId"]) if (a[k]) s += 1;
  const la = daysSince(a.lastActivity);
  if (la != null) s += Math.max(0, 3 - la / 365);
  if (SUSPICIOUS_NAME.test(a.name)) s -= 100; // never keep a placeholder-named record as master
  if (a.id && a.id.length === 18) s += 0.1; // tiny tie-breaker for well-formed ids
  return s;
}
function describeRichness(a) {
  const filled = ["website", "industry", "country", "type"].filter((k) => a[k]).length;
  const la = a.lastActivity ? `last activity ${a.lastActivity}` : "no activity date";
  return `${filled}/4 key fields, ${la}`;
}

export function mergeProposal(master, dup, reason) {
  return {
    action: "Single Update Request",
    object: "Account",
    requestType: "Merge",
    fields: {
      "Master Account ID": master.id || "",
      "Disappearing Account ID": dup.id || "",
      Reason: reason,
    },
  };
}

export function checkNames(accounts) {
  const out = [];
  for (const a of accounts) {
    const problems = [];
    if (SUSPICIOUS_NAME.test(a.name)) problems.push(`name contains a placeholder word: "${a.name}"`);
    if (/\s{2,}|^\s|\s$/.test(a.name)) problems.push("leading/trailing/double spaces in name");
    if (a.name.length > 4 && a.name === a.name.toUpperCase() && /[A-Z]{4,}/.test(a.name)) problems.push("name is ALL CAPS");
    if (problems.length) {
      out.push(
        makeFinding({
          kind: "suspicious_name",
          severity: SUSPICIOUS_NAME.test(a.name) ? "medium" : "low",
          confidence: 0.6,
          account: a,
          evidence: problems,
          proposal: massUpdateProposal(a, { "Account Name": a.name.replace(/\s+/g, " ").trim() }, "Name cleanup"),
        }),
      );
    }
  }
  return out;
}

export function checkRequiredFields(accounts, required = ["website", "industry", "country"]) {
  const out = [];
  const labels = { website: "Website", industry: "Industry", country: "Billing Country", city: "Billing City", type: "Type" };
  for (const a of accounts) {
    const missing = required.filter((k) => !a[k]);
    const bad = [];
    if (a.website && !looksLikeUrl(a.website)) bad.push(`website is not a valid URL: "${a.website}"`);
    if (!missing.length && !bad.length) continue;
    out.push(
      makeFinding({
        kind: bad.length ? "bad_website" : "missing_field",
        severity: bad.length ? "medium" : "low",
        confidence: 0.9,
        account: a,
        evidence: [...missing.map((k) => `missing ${labels[k] || k}`), ...bad],
        proposal: massUpdateProposal(a, { ...Object.fromEntries(missing.map((k) => [labels[k] || k, ""])), ...(bad.length ? { Website: a.website } : {}) }, bad.length ? "Fix website / fill missing fields" : "Fill missing fields"),
      }),
    );
  }
  return out;
}

export function checkStale(accounts, staleDays = 540) {
  const out = [];
  for (const a of accounts) {
    const d = daysSince(a.lastActivity || a.lastModified);
    if (d == null || d < staleDays) continue;
    out.push(
      makeFinding({
        kind: "stale",
        severity: "low",
        confidence: 0.5,
        account: a,
        evidence: [`no activity for ${d} days (${a.lastActivity || a.lastModified})`],
        proposal: null,
      }),
    );
  }
  return out;
}

/**
 * Probe each account website. A dead domain is a defunct signal; a redirect to a
 * different registrable domain is an acquisition/rename signal. Both are weak on
 * their own, so they're emitted at low confidence and feed the LLM research step.
 */
export async function checkWebsites(accounts, { concurrency = 8, timeoutMs = 10_000, log = () => {} } = {}) {
  const targets = accounts.filter((a) => a.website && looksLikeUrl(a.website));
  const results = await pool(targets, concurrency, async (a) => {
    const r = await probe(a.website, timeoutMs);
    log(`  ${a.name}: ${r.status}`);
    return { a, r };
  });
  const out = [];
  for (const { a, r } of results) {
    if (r.status === "ok") continue;
    if (r.status === "redirect_other_domain") {
      out.push(
        makeFinding({
          kind: "website_redirects",
          severity: "medium",
          confidence: 0.45,
          account: a,
          evidence: [`website ${a.website} redirects to ${r.finalUrl} (different domain: ${r.finalDomain})`],
          sources: [r.finalUrl],
          proposal: null,
        }),
      );
    } else if (r.status === "dead" || r.status === "parked") {
      out.push(
        makeFinding({
          kind: "website_dead",
          severity: "medium",
          confidence: r.status === "parked" ? 0.5 : 0.35,
          account: a,
          evidence: [`website ${a.website} is ${r.status}${r.detail ? ` (${r.detail})` : ""}`],
          proposal: null,
        }),
      );
    }
  }
  return out;
}

async function probe(website, timeoutMs) {
  const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const origDomain = registrableDomain(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; sf-account-cleanup/0.1)" },
    });
    const finalDomain = registrableDomain(res.url);
    if (finalDomain && finalDomain !== origDomain) {
      return { status: "redirect_other_domain", finalUrl: res.url, finalDomain };
    }
    if (res.status >= 500 || res.status === 404 || res.status === 410) {
      return { status: "dead", detail: `HTTP ${res.status}` };
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const body = (await res.text()).slice(0, 200_000).toLowerCase();
      if (/domain (is )?for sale|buy this domain|this domain has expired|parked (free|domain)|sedo\.com|hugedomains|godaddy\.com\/domainsearch|afternic/.test(body)) {
        return { status: "parked", detail: "parking page" };
      }
    }
    return { status: "ok" };
  } catch (e) {
    const code = e?.cause?.code || e?.code || e?.name || "error";
    if (/ENOTFOUND|EAI_AGAIN/.test(code)) return { status: "dead", detail: "DNS does not resolve" };
    if (/ECONNREFUSED|CERT|ERR_TLS|ECONNRESET/.test(code)) return { status: "dead", detail: code };
    return { status: "unknown", detail: code };
  } finally {
    clearTimeout(t);
  }
}

export function massUpdateProposal(account, fields, reason) {
  return {
    action: "Mass Update",
    object: "Account",
    requestType: "Field update",
    fields: { "Account ID": account.id || "", "Account Name": account.name, ...fields, Reason: reason },
  };
}
