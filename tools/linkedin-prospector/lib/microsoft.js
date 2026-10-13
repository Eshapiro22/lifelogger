// Read-only Outlook mail + calendar lookups through Microsoft Graph:
// "have I emailed with or met this person?"
//
// Sign-in uses your own Entra ID (Azure AD) app registration with the
// authorization-code + PKCE flow via chrome.identity.launchWebAuthFlow, so
// tokens stay in this browser and data only flows between it and Microsoft.
(function (root) {
  const LP = root.LP || (root.LP = {});
  const SCOPES = 'openid offline_access User.Read Mail.Read Calendars.Read';
  const GRAPH = 'https://graph.microsoft.com/v1.0';

  let token = null, tokenExp = 0;
  let calendarCache = null, calendarCachedAt = 0;

  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  async function pkce() {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    return { verifier, challenge };
  }

  async function tokenRequest(cfg, params) {
    const r = await fetch(`https://login.microsoftonline.com/${cfg.tenant || 'organizations'}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg.clientId, scope: SCOPES, ...params }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Microsoft sign-in failed: ${j.error_description || j.error || r.status}`);
    token = j.access_token;
    tokenExp = Date.now() + (j.expires_in || 3600) * 1000;
    if (j.refresh_token) await chrome.storage.session.set({ msRefresh: j.refresh_token });
    return token;
  }

  // cfg: {clientId, tenant}
  async function getToken(cfg, interactive = true) {
    if (token && Date.now() < tokenExp - 60000) return token;
    if (!cfg.clientId) throw new Error('Add your Microsoft app (client) ID in Settings first.');
    const redirect = chrome.identity.getRedirectURL();
    const { msRefresh } = await chrome.storage.session.get('msRefresh');
    if (msRefresh) {
      try { return await tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: msRefresh, redirect_uri: redirect }); }
      catch (_) { await chrome.storage.session.remove('msRefresh'); }
    }
    const { verifier, challenge } = await pkce();
    const url = `https://login.microsoftonline.com/${cfg.tenant || 'organizations'}/oauth2/v2.0/authorize?` +
      new URLSearchParams({
        client_id: cfg.clientId, response_type: 'code', redirect_uri: redirect, scope: SCOPES,
        response_mode: 'query', code_challenge: challenge, code_challenge_method: 'S256',
      });
    const resp = await chrome.identity.launchWebAuthFlow({ url, interactive });
    const q = new URL(resp).searchParams;
    if (q.get('error')) throw new Error(`Microsoft sign-in failed: ${q.get('error_description') || q.get('error')}`);
    return tokenRequest(cfg, { grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirect, code_verifier: verifier });
  }

  async function graph(url) {
    const r = await fetch(url.startsWith('http') ? url : GRAPH + url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) { token = null; throw new Error('Microsoft token expired; run the check again.'); }
    if (r.status === 429) {
      await new Promise(res => setTimeout(res, 1000 * Number(r.headers.get('Retry-After') || 5)));
      return graph(url);
    }
    if (!r.ok) throw new Error(`Microsoft Graph ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  function nameParts(person) {
    const parts = LP.stripAccents(LP.cleanName(person.name)).toLowerCase().split(' ');
    return { first: parts[0], last: parts[parts.length - 1], email: (person.email || '').toLowerCase() };
  }

  // Does an Outlook recipient ({emailAddress:{name,address}}) belong to this person?
  function isPerson(rec, { first, last, email }) {
    const name = LP.stripAccents(rec?.emailAddress?.name || '').toLowerCase();
    const addr = (rec?.emailAddress?.address || '').toLowerCase();
    if (email && addr === email) return true;
    if (name.includes(first) && name.includes(last)) return true;
    const local = addr.split('@')[0];
    return !!last && local.includes(last) && (local.includes(first) || local.startsWith(first[0]));
  }

  async function checkMail(person) {
    const p = nameParts(person);
    if (!p.first || !p.last || p.first === p.last) return { error: 'name too short to search', fromThem: [], toThem: [] };
    const terms = [`"${p.first} ${p.last}"`];
    if (p.email) terms.push(`"${p.email}"`);
    const res = { fromThem: [], toThem: [] };
    const seen = new Set();
    for (const term of terms) {
      const j = await graph(`/me/messages?${new URLSearchParams({
        $search: term, $top: '25',
        $select: 'subject,from,toRecipients,ccRecipients,receivedDateTime,webLink',
      })}`);
      for (const m of j.value || []) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        const row = { date: (m.receivedDateTime || '').slice(0, 10), subject: m.subject || '(no subject)', link: m.webLink };
        if (isPerson(m.from, p)) res.fromThem.push(row);
        else if ([...(m.toRecipients || []), ...(m.ccRecipients || [])].some(r => isPerson(r, p))) res.toThem.push(row);
      }
    }
    const byDate = (a, b) => b.date.localeCompare(a.date);
    res.fromThem.sort(byDate); res.toThem.sort(byDate);
    return res;
  }

  // Calendar events can't be text-searched in Graph, so pull the window once
  // (last 12 months + next 3) and match attendees locally.
  async function calendarEvents() {
    if (calendarCache && Date.now() - calendarCachedAt < 10 * 60000) return calendarCache;
    const start = new Date(Date.now() - 365 * 864e5).toISOString();
    const end = new Date(Date.now() + 90 * 864e5).toISOString();
    let url = `/me/calendarView?${new URLSearchParams({
      startDateTime: start, endDateTime: end, $top: '200',
      $select: 'subject,start,attendees,organizer,webLink,isCancelled',
    })}`;
    const all = [];
    while (url) {
      const j = await graph(url);
      all.push(...(j.value || []).filter(e => !e.isCancelled));
      url = j['@odata.nextLink'] || null;
    }
    calendarCache = all; calendarCachedAt = Date.now();
    return all;
  }

  async function checkCalendar(person) {
    const p = nameParts(person);
    const now = Date.now();
    const hits = (await calendarEvents())
      .filter(e => [...(e.attendees || []), e.organizer].some(a => isPerson(a, p)))
      .map(e => {
        const start = e.start?.dateTime ? e.start.dateTime + 'Z' : '';
        return { date: start.slice(0, 10), summary: e.subject || '(no title)', past: Date.parse(start) < now, link: e.webLink };
      });
    return { past: hits.filter(h => h.past), upcoming: hits.filter(h => !h.past) };
  }

  async function checkPerson(person, cfg) {
    await getToken(cfg);
    const [mail, calendar] = await Promise.all([checkMail(person), checkCalendar(person)]);
    return { mail, calendar, checkedAt: new Date().toISOString() };
  }

  Object.assign(LP, { msGetToken: getToken, checkPerson });
})(typeof globalThis !== 'undefined' ? globalThis : this);
