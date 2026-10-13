// Read-only Gmail + Google Calendar lookups: "have I emailed with or met this
// person?" Uses chrome.identity.launchWebAuthFlow with an OAuth client ID you
// create yourself (see README), so no data leaves your browser except the
// calls to Google's own APIs.
(function (root) {
  const LP = root.LP || (root.LP = {});
  const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
  ].join(' ');

  let token = null, tokenExp = 0;

  async function getToken(clientId, interactive = true) {
    if (token && Date.now() < tokenExp - 60000) return token;
    if (!clientId) throw new Error('Add your Google OAuth client ID in Settings first.');
    const redirect = chrome.identity.getRedirectURL();
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId, response_type: 'token', redirect_uri: redirect, scope: SCOPES,
    });
    const resp = await chrome.identity.launchWebAuthFlow({ url, interactive });
    const params = new URLSearchParams(new URL(resp).hash.slice(1));
    token = params.get('access_token');
    tokenExp = Date.now() + Number(params.get('expires_in') || 3600) * 1000;
    if (!token) throw new Error('Google sign-in did not return a token.');
    return token;
  }

  async function api(url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) { token = null; throw new Error('Google token expired; run the check again.'); }
    if (!r.ok) throw new Error(`Google API ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  const header = (msg, name) =>
    (msg.payload?.headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Does a From/To header plausibly belong to this person?
  function mentions(headerVal, first, last, email) {
    const v = LP.stripAccents(headerVal).toLowerCase();
    if (email && v.includes(email.toLowerCase())) return true;
    return v.includes(last) && (v.includes(first) || v.includes(first[0] + last) || v.includes(first + '.' + last));
  }

  async function checkGmail(person) {
    const parts = LP.stripAccents(LP.cleanName(person.name)).toLowerCase().split(' ');
    const first = parts[0], last = parts[parts.length - 1];
    if (!first || !last || first === last) return { error: 'name too short to search' };
    const email = person.email || '';
    const q = (email ? `{"${first} ${last}" ${email}}` : `"${first} ${last}"`) + ' -in:chats';
    const list = await api('https://gmail.googleapis.com/gmail/v1/users/me/messages?' +
      new URLSearchParams({ q, maxResults: '15' }));
    const res = { fromThem: [], toThem: [] };
    for (const m of (list.messages || []).slice(0, 15)) {
      const msg = await api(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?` +
        'format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date&metadataHeaders=Subject');
      const row = { date: header(msg, 'Date'), subject: header(msg, 'Subject'),
        link: `https://mail.google.com/mail/#all/${msg.threadId}` };
      if (mentions(header(msg, 'From'), first, last, email)) res.fromThem.push(row);
      else if (mentions(header(msg, 'To') + ' ' + header(msg, 'Cc'), first, last, email)) res.toThem.push(row);
    }
    return res;
  }

  async function checkCalendar(person) {
    const parts = LP.stripAccents(LP.cleanName(person.name)).toLowerCase().split(' ');
    const first = parts[0], last = parts[parts.length - 1];
    const since = new Date(Date.now() - 2 * 365 * 864e5).toISOString();
    const list = await api('https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
      new URLSearchParams({ q: `${first} ${last}`, timeMin: since, singleEvents: 'true', maxResults: '20', orderBy: 'startTime' }));
    const now = Date.now();
    const hits = (list.items || []).filter(ev => {
      const who = (ev.attendees || []).map(a => `${a.displayName || ''} ${a.email || ''}`).join(' ');
      return mentions(who + ' ' + (ev.summary || ''), first, last, person.email);
    }).map(ev => {
      const start = ev.start?.dateTime || ev.start?.date || '';
      return { date: start.slice(0, 10), summary: ev.summary || '(no title)', past: Date.parse(start) < now, link: ev.htmlLink };
    });
    return { past: hits.filter(h => h.past), upcoming: hits.filter(h => !h.past) };
  }

  async function checkPerson(person, clientId) {
    await getToken(clientId);
    const [gmail, calendar] = await Promise.all([checkGmail(person), checkCalendar(person)]);
    return { gmail, calendar, checkedAt: new Date().toISOString() };
  }

  Object.assign(LP, { getToken, checkPerson });
})(typeof globalThis !== 'undefined' ? globalThis : this);
