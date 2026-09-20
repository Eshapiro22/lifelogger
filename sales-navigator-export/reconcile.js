/**
 * Reconcile page — wires file inputs and the extension's stored leads to
 * reconcile/match.js and renders the results.
 */
const M = window.SNXMatch;
const STORAGE_KEY = 'snx_state';
const $ = (id) => document.getElementById(id);

const state = {
  extLeads: [],            // from chrome.storage.local
  csvLeads: null,          // {headers, rows} from an uploaded leads CSV
  leadCols: null,
  accounts: null,          // {headers, rows}
  accountCols: null,
  contacts: null,
  contactCols: null,
  result: null,            // {rows, summary, owners}
  filter: 'all',
};

// ─── helpers ───────────────────────────────────────────────────────────────
function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file, 'utf-8');
  });
}
function notice(text, kind = '') {
  const n = $('runNotice');
  n.textContent = text;
  n.className = `notice ${kind}`;
}
function clearNotice() { $('runNotice').className = 'notice hidden'; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Render a column-mapping editor: one <select> per logical field.
function renderColMap(containerId, headers, cols, labels, onChange) {
  const box = $(containerId);
  box.innerHTML = '';
  for (const [key, label] of Object.entries(labels)) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="">— none —</option>` + headers.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
    sel.value = cols[key] || '';
    sel.addEventListener('change', () => { cols[key] = sel.value; onChange && onChange(); });
    wrap.appendChild(sel);
    box.appendChild(wrap);
  }
  box.classList.remove('hidden');
}

function currentLeads() {
  if ($('leadSrcCsv').checked) {
    if (!state.csvLeads) return null;
    return { rows: state.csvLeads.rows, cols: state.leadCols };
  }
  if (!state.extLeads.length) return null;
  return { rows: state.extLeads, cols: { name: 'name', company: 'company', title: 'title', profileUrl: 'profile_url' } };
}

function updateRunState() {
  const leads = currentLeads();
  const ok = !!(leads && leads.rows.length && state.accounts && state.accountCols && state.accountCols.name);
  $('runBtn').disabled = !ok;
  $('genQueriesBtn').disabled = !(leads && leads.rows.length);
}

function populateOwners(owners) {
  const sel = $('meSelect');
  sel.innerHTML = `<option value="">— pick your name —</option>` +
    owners.slice(0, 200).map((o) => `<option value="${esc(o.owner)}">${esc(o.owner)} (${o.count} accounts)</option>`).join('');
  // Remember the last choice.
  try {
    const saved = localStorage.getItem('snx_me');
    if (saved && owners.some((o) => o.owner === saved)) sel.value = saved;
    const savedUrl = localStorage.getItem('snx_sf_url');
    if (savedUrl && !$('sfUrl').value) $('sfUrl').value = savedUrl;
  } catch (_) {}
}

function me() {
  return ($('meText').value || $('meSelect').value || '').trim();
}

// ─── load leads from the extension ─────────────────────────────────────────
(async function loadExtLeads() {
  try {
    const { [STORAGE_KEY]: s } = await chrome.storage.local.get(STORAGE_KEY);
    state.extLeads = s && s.leads ? Object.values(s.leads) : [];
    $('extLeadInfo').textContent = state.extLeads.length
      ? `(${state.extLeads.length} leads from "${s.listName || 'unnamed list'}")`
      : '(none collected yet — run an export first, or upload a CSV below)';
    if (!state.extLeads.length) $('leadSrcCsv').checked = true;
  } catch (_) {
    $('extLeadInfo').textContent = '(unavailable)';
    $('leadSrcCsv').checked = true;
  }
  updateRunState();
})();

// ─── file inputs ───────────────────────────────────────────────────────────
$('leadsFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  state.csvLeads = M.parseCsv(await readFile(f));
  state.leadCols = M.detectLeadColumns(state.csvLeads.headers);
  $('leadSrcCsv').checked = true;
  renderColMap('leadCols', state.csvLeads.headers, state.leadCols,
    { name: 'Lead name', company: 'Company', title: 'Title', profileUrl: 'Profile URL' }, updateRunState);
  updateRunState();
});
document.querySelectorAll('input[name=leadSource]').forEach((r) => r.addEventListener('change', updateRunState));

$('accountsFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  state.accounts = M.parseCsv(await readFile(f));
  state.accountCols = M.detectAccountColumns(state.accounts.headers);
  renderColMap('accountCols', state.accounts.headers, state.accountCols,
    { name: 'Account name', owner: 'Account owner', id: 'Account ID', website: 'Website', parent: 'Parent account', type: 'Type' },
    () => { refreshOwners(); updateRunState(); });
  $('accountInfo').textContent = `${state.accounts.rows.length} accounts loaded.` +
    (state.accountCols.name ? '' : ' Could not detect the account-name column — pick it above.') +
    (state.accountCols.owner ? '' : ' No owner column detected — ownership will be "Unknown".');
  refreshOwners();
  updateRunState();
});
function refreshOwners() {
  if (!state.accounts || !state.accountCols.owner) { populateOwners([]); return; }
  const idx = M.buildAccountIndex(state.accounts.rows, state.accountCols);
  const owners = M.ownerCounts(idx.items);
  populateOwners(owners);
  // A single owner across the whole file almost always means a "My accounts" export.
  if (owners.length === 1) {
    $('myAccountsOnly').checked = true;
    $('meSelect').value = owners[0].owner;
  }
}

$('contactsFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  state.contacts = M.parseCsv(await readFile(f));
  state.contactCols = M.detectContactColumns(state.contacts.headers);
  renderColMap('contactCols', state.contacts.headers, state.contactCols,
    { name: 'Full name', firstName: 'First name', lastName: 'Last name', account: 'Account name', owner: 'Contact owner', id: 'Contact ID', title: 'Title', email: 'Email' });
  $('contactInfo').textContent = `${state.contacts.rows.length} contacts loaded.` +
    (state.contactCols.name || (state.contactCols.firstName && state.contactCols.lastName) ? '' : ' Could not detect a name column — pick one above.');
});

// ─── run ───────────────────────────────────────────────────────────────────
$('runBtn').addEventListener('click', () => {
  clearNotice();
  const leads = currentLeads();
  if (!leads) return;
  const who = me();
  const myAccountsOnly = $('myAccountsOnly').checked;
  if (!who && !myAccountsOnly) { notice('Pick or type your name (as it appears as Account Owner) before reconciling, or tick "contains only my accounts".', 'error'); return; }
  try { localStorage.setItem('snx_me', who); localStorage.setItem('snx_sf_url', $('sfUrl').value.trim()); } catch (_) {}

  const t0 = performance.now();
  state.result = M.reconcile({
    leads: leads.rows, leadCols: leads.cols,
    accounts: state.accounts.rows, accountCols: state.accountCols,
    contacts: state.contacts ? state.contacts.rows : null, contactCols: state.contactCols,
    me: who, sfBaseUrl: $('sfUrl').value.trim(), myAccountsOnly,
  });
  const ms = Math.round(performance.now() - t0);

  const meNorm = M.normalizePerson(who);
  if (myAccountsOnly) {
    // nothing to warn about: ownership is implied by presence in the file
  } else if (state.accountCols.owner && !state.result.owners.some((o) => M.normalizePerson(o.owner) === meNorm)) {
    notice(`"${who}" is not an Account Owner anywhere in this file, so every account shows as not yours. Check the spelling, or pick a name from the dropdown.`);
  } else if (state.accountCols.owner && state.result.owners.length === 1) {
    notice(`Every account in this file is owned by ${state.result.owners[0].owner}. The export looks scoped to one owner, so leads at other people's accounts will show as "no account found" instead of "on someone else's". Re-export Accounts without an owner filter for a full picture.`);
  }
  $('downloadBtn').disabled = false;
  renderResults(ms);
});

// ─── results ───────────────────────────────────────────────────────────────
function rowMatchesFilter(r, f) {
  switch (f) {
    case 'mine': return r.account_is_mine === 'Yes';
    case 'other': return !!r.sf_account_name && r.account_is_mine !== 'Yes';
    case 'unmatched': return !r.sf_account_name;
    case 'review': return r._needsReview;
    case 'contact': return r.sf_contact_exists === 'Yes';
    default: return true;
  }
}

function renderResults(ms) {
  const { rows, summary } = state.result;
  $('results').classList.remove('hidden');
  $('tTotal').textContent = summary.total;
  $('tMine').textContent = summary.mine;
  $('tOther').textContent = summary.notMine;
  $('tUnmatched').textContent = summary.unmatched;
  $('tReview').textContent = summary.review;
  $('tileOther').classList.toggle('hidden', state.result.myAccountsOnly);
  $('tUnmatchedLabel').textContent = state.result.myAccountsOnly ? 'not one of my accounts' : 'no account found';
  $('tileContact').classList.toggle('hidden', !state.contacts);
  $('tContact').textContent = summary.contactsFound;
  document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('active', t.dataset.filter === state.filter));

  const visible = rows.filter((r) => rowMatchesFilter(r, state.filter));
  const frag = document.createDocumentFragment();
  for (const r of visible) {
    const tr = document.createElement('tr');
    const lead = r.profile_url ? `<a href="${esc(r.profile_url)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name);
    const acct = r.sf_account_name
      ? (r.sf_account_url ? `<a href="${esc(r.sf_account_url)}" target="_blank" rel="noopener">${esc(r.sf_account_name)}</a>` : esc(r.sf_account_name))
      : '<span class="muted">—</span>';
    const mine = r.sf_account_name ? `<span class="pill ${r.account_is_mine.toLowerCase()}">${esc(r.account_is_mine)}</span>` : '';
    const match = r.sf_account_name
      ? `<span class="pill ${r.match_tier}">${esc(r.match_tier)}</span><span class="sub">${r.match_score}</span>`
      : `<span class="pill none">none</span>`;
    let contact = '';
    if (state.contacts) {
      contact = r.sf_contact_exists === 'Yes'
        ? `<span class="pill yes">Yes</span><span class="sub">${esc(r.sf_contact_owner)}${r.contact_is_mine === 'Yes' ? ' (me)' : ''}</span>`
        : `<span class="pill unknown">No</span>`;
    }
    const notes = [r.match_note, r.alt_candidates ? `Alternatives: ${r.alt_candidates}` : ''].filter(Boolean).join(' · ');
    tr.innerHTML =
      `<td>${lead}<span class="sub">${esc(r.title)}</span></td>` +
      `<td>${esc(r.company)}</td>` +
      `<td>${acct}${r.sf_account_type ? `<span class="sub">${esc(r.sf_account_type)}</span>` : ''}</td>` +
      `<td>${esc(r.sf_account_owner)}</td>` +
      `<td>${mine}</td><td>${match}</td><td>${contact}</td>` +
      `<td class="muted">${esc(notes)}</td>`;
    frag.appendChild(tr);
  }
  $('tbody').innerHTML = '';
  $('tbody').appendChild(frag);
  $('tableFoot').textContent = `Showing ${visible.length} of ${rows.length} leads${ms != null ? ` · matched in ${ms} ms` : ''}.`;
}

document.querySelectorAll('.tile').forEach((t) => t.addEventListener('click', () => {
  state.filter = t.dataset.filter;
  if (state.result) renderResults(null);
}));

// ─── download ──────────────────────────────────────────────────────────────
$('downloadBtn').addEventListener('click', () => {
  if (!state.result) return;
  const csv = M.toCsv(state.result.rows, M.OUTPUT_COLUMNS);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reconciled-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
});

// ─── lookup query generation (for orgs too big to export) ──────────────────
let lookup = null; // { queries, terms, skipped, format }
$('genQueriesBtn').addEventListener('click', () => {
  const leads = currentLeads();
  if (!leads) return;
  const format = $('lookupFormat').value;
  const names = leads.rows.map((r) => r[leads.cols.company] || '');
  const r = M.buildLookupQueries(names, { format });
  lookup = { ...r, format };
  $('lookupOut').value = M.lookupPromptFor(r.queries, format);
  $('lookupOut').classList.remove('hidden');
  $('copyPromptBtn').classList.remove('hidden');
  $('copyQueriesBtn').classList.remove('hidden');
  $('lookupInfo').textContent =
    `${r.terms.length} distinct company names from ${leads.rows.length} leads → ${r.queries.length} ${format.toUpperCase()} quer${r.queries.length === 1 ? 'y' : 'ies'}.` +
    (r.skipped.length ? ` Skipped ${r.skipped.length} too-generic name${r.skipped.length === 1 ? '' : 's'} (look these up by hand): ${r.skipped.slice(0, 8).join(', ')}${r.skipped.length > 8 ? '…' : ''}.` : '');
});
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const old = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = old; }, 1500);
  } catch (_) {
    $('lookupOut').select(); document.execCommand('copy');
  }
}
$('copyPromptBtn').addEventListener('click', () => lookup && copyText(M.lookupPromptFor(lookup.queries, lookup.format), $('copyPromptBtn')));
$('copyQueriesBtn').addEventListener('click', () => lookup && copyText(lookup.queries.join('\n\n'), $('copyQueriesBtn')));
