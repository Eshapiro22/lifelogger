// Load accounts from either a Salesforce CSV export (report / list view) or the
// Salesforce REST API. Both paths return the same normalized shape:
//   { id, name, website, industry, country, city, state, type, owner, parentId,
//     employees, revenue, lastActivity, lastModified, created, raw }

import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseCsv } from "./util.mjs";

const execFileP = promisify(execFile);

// Header aliases -> normalized key. Matching is case/space/underscore-insensitive.
const HEADER_MAP = {
  id: ["account id", "accountid", "id", "account id (18)", "sfdc id", "salesforce id"],
  name: ["account name", "name", "account"],
  website: ["website", "web site", "url", "domain"],
  industry: ["industry"],
  country: ["billing country", "billingcountry", "country", "billing country/region"],
  city: ["billing city", "billingcity", "city"],
  state: ["billing state/province", "billing state", "billingstate", "state"],
  type: ["type", "account type"],
  owner: ["account owner", "owner", "owner name", "owner.name"],
  parentId: ["parent account id", "parentid", "parent id"],
  parentName: ["parent account", "parent account name", "parent.name"],
  employees: ["employees", "numberofemployees", "number of employees"],
  revenue: ["annual revenue", "annualrevenue"],
  lastActivity: ["last activity", "lastactivitydate", "last activity date"],
  lastModified: ["last modified date", "lastmodifieddate", "last modified"],
  created: ["created date", "createddate"],
};

function normHeader(h) {
  return String(h || "").toLowerCase().replace(/[_\s]+/g, " ").trim();
}

export async function loadAccountsFromCsv(path) {
  const rows = parseCsv(await readFile(path, "utf8"));
  if (!rows.length) return [];
  const headers = rows[0].map(normHeader);
  const index = {};
  for (const [key, aliases] of Object.entries(HEADER_MAP)) {
    const i = headers.findIndex((h) => aliases.includes(h));
    if (i >= 0) index[key] = i;
  }
  if (index.name == null) {
    throw new Error(`CSV has no recognizable "Account Name" column. Headers: ${rows[0].join(", ")}`);
  }
  const out = [];
  for (const row of rows.slice(1)) {
    const get = (k) => (index[k] == null ? "" : (row[index[k]] ?? "").trim());
    const name = get("name");
    // Salesforce report exports end with footer lines (totals, copyright); skip anything without a name.
    if (!name) continue;
    const raw = {};
    rows[0].forEach((h, i) => { raw[h] = row[i] ?? ""; });
    out.push({
      id: get("id") || null,
      name,
      website: get("website"),
      industry: get("industry"),
      country: get("country"),
      city: get("city"),
      state: get("state"),
      type: get("type"),
      owner: get("owner"),
      parentId: get("parentId") || null,
      parentName: get("parentName"),
      employees: get("employees"),
      revenue: get("revenue"),
      lastActivity: get("lastActivity"),
      lastModified: get("lastModified"),
      created: get("created"),
      raw,
    });
  }
  return out;
}

/**
 * Resolve Salesforce credentials.
 *  1. SF_INSTANCE_URL + SF_ACCESS_TOKEN env vars, or
 *  2. `sf org display --target-org <alias> --json` from the Salesforce CLI
 *     (log in first with `sf org login web --alias <alias>`).
 */
export async function resolveSalesforceAuth({ org } = {}) {
  if (process.env.SF_INSTANCE_URL && process.env.SF_ACCESS_TOKEN) {
    return { instanceUrl: process.env.SF_INSTANCE_URL.replace(/\/$/, ""), accessToken: process.env.SF_ACCESS_TOKEN };
  }
  const args = ["org", "display", "--json"];
  if (org) args.push("--target-org", org);
  try {
    const { stdout } = await execFileP("sf", args, { maxBuffer: 4 * 1024 * 1024 });
    const json = JSON.parse(stdout);
    const r = json.result || {};
    if (!r.instanceUrl || !r.accessToken) throw new Error("sf org display returned no instanceUrl/accessToken");
    return { instanceUrl: r.instanceUrl.replace(/\/$/, ""), accessToken: r.accessToken };
  } catch (e) {
    throw new Error(
      `No Salesforce credentials. Set SF_INSTANCE_URL + SF_ACCESS_TOKEN, or install the Salesforce CLI and run ` +
        `"sf org login web --alias <alias>" then pass --sf-org <alias>. (${e.message})`,
    );
  }
}

export const DEFAULT_SOQL =
  "SELECT Id, Name, Website, Industry, BillingCountry, BillingCity, BillingState, Type, Owner.Name, ParentId, " +
  "Parent.Name, NumberOfEmployees, AnnualRevenue, LastActivityDate, LastModifiedDate, CreatedDate " +
  "FROM Account WHERE OwnerId = :me AND IsDeleted = false ORDER BY Name";

/** Query accounts via the REST API. `:me` in the SOQL is replaced with the current user's Id. */
export async function loadAccountsFromSalesforce({ org, soql = DEFAULT_SOQL, apiVersion = "v61.0" } = {}) {
  const { instanceUrl, accessToken } = await resolveSalesforceAuth({ org });
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

  async function get(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Salesforce ${res.status} for ${url}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }

  let query = soql;
  if (query.includes(":me")) {
    // Identity endpoint from the token's org; simplest reliable way to get the running user's Id.
    const me = await get(`${instanceUrl}/services/oauth2/userinfo`);
    query = query.replace(/:me\b/g, `'${me.user_id}'`);
  }

  const records = [];
  let url = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent(query)}`;
  while (url) {
    const page = await get(url);
    records.push(...(page.records || []));
    url = page.nextRecordsUrl ? `${instanceUrl}${page.nextRecordsUrl}` : null;
  }
  return records.map((r) => ({
    id: r.Id,
    name: r.Name,
    website: r.Website || "",
    industry: r.Industry || "",
    country: r.BillingCountry || "",
    city: r.BillingCity || "",
    state: r.BillingState || "",
    type: r.Type || "",
    owner: r.Owner?.Name || "",
    parentId: r.ParentId || null,
    parentName: r.Parent?.Name || "",
    employees: r.NumberOfEmployees ?? "",
    revenue: r.AnnualRevenue ?? "",
    lastActivity: r.LastActivityDate || "",
    lastModified: r.LastModifiedDate || "",
    created: r.CreatedDate || "",
    raw: r,
  }));
}
