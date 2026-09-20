// Optional alternative submitter: Jira Service Management Cloud REST API.
//
// Requires an Atlassian API token (https://id.atlassian.com/manage-profile/security/api-tokens)
// in JSM_EMAIL / JSM_API_TOKEN, and the numeric serviceDeskId / requestTypeId plus the
// customfield ids of each form field in sf-cleanup.config.json (jsm section).
// Run `sf-cleanup jsm-fields` to discover them.
//
// Endpoints used (Atlassian "Service Desk" REST API; verify against current Atlassian docs):
//   GET  /rest/servicedeskapi/servicedesk
//   GET  /rest/servicedeskapi/servicedesk/{serviceDeskId}/requesttype
//   GET  /rest/servicedeskapi/servicedesk/{serviceDeskId}/requesttype/{requestTypeId}/field
//   POST /rest/servicedeskapi/request

function auth() {
  const email = process.env.JSM_EMAIL;
  const token = process.env.JSM_API_TOKEN;
  if (!email || !token) throw new Error("Set JSM_EMAIL and JSM_API_TOKEN (Atlassian API token) to use the API submitter.");
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

async function jsm(config, path, init = {}) {
  const base = (config.jsm?.baseUrl || "").replace(/\/$/, "");
  if (!base) throw new Error("jsm.baseUrl missing in config (e.g. https://yourcompany.atlassian.net)");
  const res = await fetch(base + path, {
    ...init,
    headers: { Authorization: auth(), Accept: "application/json", "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`JSM ${res.status} ${path}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

export async function listFields(config, log = console.log) {
  if (!config.jsm?.serviceDeskId) {
    const desks = await jsm(config, "/rest/servicedeskapi/servicedesk");
    log("Service desks (set jsm.serviceDeskId):");
    for (const d of desks.values || []) log(`  ${d.id}  ${d.projectKey}  ${d.projectName}`);
    return;
  }
  if (!config.jsm?.requestTypeId) {
    const rts = await jsm(config, `/rest/servicedeskapi/servicedesk/${config.jsm.serviceDeskId}/requesttype`);
    log("Request types (set jsm.requestTypeId to the 'Data quality issue' one):");
    for (const r of rts.values || []) log(`  ${r.id}  ${r.name}`);
    return;
  }
  const f = await jsm(config, `/rest/servicedeskapi/servicedesk/${config.jsm.serviceDeskId}/requesttype/${config.jsm.requestTypeId}/field`);
  log("Fields (map label -> fieldId in jsm.fieldIds):");
  for (const x of f.requestTypeFields || []) {
    log(`  ${x.fieldId.padEnd(20)} ${x.name}${x.required ? " *" : ""}  [${x.jiraSchema?.type}]`);
    for (const v of x.validValues || []) log(`      option: ${v.value}  (${v.label})`);
  }
}

/** Create a request. Field values come from finding.proposal.fields keyed by label; jsm.fieldIds maps label -> customfield id. */
export async function submitFindingViaApi(config, finding, { live = false, log = console.log } = {}) {
  const p = finding.proposal;
  const ids = config.jsm?.fieldIds || {};
  const values = {};
  const setField = (label, value) => {
    const id = ids[label];
    if (!id) throw new Error(`No jsm.fieldIds mapping for "${label}" (run sf-cleanup jsm-fields)`);
    values[id] = value;
  };
  // Select-type fields are sent as { value: "Option label" }; text fields as plain strings.
  setField("Action", { value: p.action });
  setField("Object", { value: p.object });
  setField(`Request Type (${p.object})`, { value: p.requestType });
  for (const [label, v] of Object.entries(p.fields)) if (v != null && v !== "") setField(label, String(v));
  if (ids.Summary) values[ids.Summary] = `${p.requestType}: ${finding.accountName}`;

  const body = { serviceDeskId: String(config.jsm.serviceDeskId), requestTypeId: String(config.jsm.requestTypeId), requestFieldValues: values };
  if (!live) {
    log(`  [dry-run] ${finding.id} would POST: ${JSON.stringify(body)}`);
    return { ticketKey: null, ticketUrl: null };
  }
  const r = await jsm(config, "/rest/servicedeskapi/request", { method: "POST", body: JSON.stringify(body) });
  const ticketKey = r.issueKey;
  const ticketUrl = r._links?.web || `${config.jsm.baseUrl}/browse/${ticketKey}`;
  log(`  submitted ${finding.id} -> ${ticketKey} ${ticketUrl}`);
  return { ticketKey, ticketUrl };
}
