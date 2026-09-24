# Invite Ledger: weekly scan prompt

Paste everything below the line into a scheduled task in your **work** Claude
(weekly, e.g. Mondays 8am). It needs the Outlook/Microsoft 365 connector, the
Slack connector, and the Artifact tools.

**First run only:** attach `invite-ledger.html` to that conversation and add:
"Publish invite-ledger.html as an artifact with `capabilities: {db: {}}`, then
put its URL in LEDGER_URL below." After that, share the page from its Share
menu with "Can interact" so teammates can mark Going / Maybe / Pass.

---

You maintain the Invite Ledger, a shared calendar of events we've been invited to.

LEDGER_URL: <paste the artifact URL here after the first run>

## 1. Find invites (last 8 days)

- **Outlook:** search my inbox (including other/focused folders) for messages
  received in the last 8 days that mention an event with a specific date:
  invites, save-the-dates, "join us", RSVP, register, webinar, summit,
  conference, dinner, happy hour, meetup, reception, roundtable, workshop,
  and links to Eventbrite, Luma, Splash, Zoom/Teams webinar pages, Cvent, etc.
- **Slack:** search channels I'm in and my DMs from the last 8 days for the
  same terms and links.
- Include anything with a date. **Skip:** routine internal meetings (1:1s,
  standups, team syncs), meeting invites between coworkers with no external
  host, events already in the past, and bulk newsletters that just list many
  unrelated events.

## 2. Extract one record per event

Use these exact field names. Write dates as `YYYY-MM-DD` and times as 24h
`HH:MM`. Use `null` when the source doesn't say. **Never guess a date or
time.** If the date is unclear, leave it out and add the event to the
"needs a look" list in the summary.

```json
{
  "title": "string",
  "host": "who is putting it on",
  "category": "conference | webinar | dinner | meetup | workshop | partner event | other",
  "startDate": "YYYY-MM-DD", "startTime": "HH:MM or null",
  "endDate": "YYYY-MM-DD or null", "endTime": "HH:MM or null",
  "timezone": "IANA name like America/New_York, or null",
  "location": "venue/city or 'Online'",
  "url": "event page URL or null",
  "rsvpDeadline": "YYYY-MM-DD or null", "rsvpUrl": "URL or null",
  "summary": "1–2 sentences: what it is and why we were invited",
  "source": { "type": "email | slack", "from": "sender name",
              "where": "email subject or #channel / DM",
              "link": "permalink to the message or null" },
  "outreach": { ... see step 3 ... },
  "decision": "undecided",
  "foundAt": "ISO timestamp of this run", "updatedAt": "ISO timestamp of this run"
}
```

Document id: lowercase `slug(title)-startDate`, using only letters, digits
and `-`, max 120 characters. Example: `cloud-partner-summit-2026-10-17`.

## 3. Outreach: the partner's sequence, or ours

Read the invite thread, including attachments and links in it, and check
whether the host already provided outreach materials: email templates,
promo copy, social posts, a "bring a customer" or tracked registration link,
or a co-marketing kit.

- **If they did:**
  `"outreach": {"mode": "partner", "partnerNote": "what they provided, in one or two sentences", "partnerLink": "URL or null", "steps": []}`
- **If they didn't:** write a suggested sequence tailored to the event type,
  `"outreach": {"mode": "suggested", "steps": [...]}`. Each step has
  `{"label", "sendOn": "YYYY-MM-DD", "audience", "subject", "body"}`.
  Usually 2–3 steps: an invite or heads-up to relevant customers/prospects,
  a reminder shortly before, and a follow-up after. Space the steps sensibly
  around the event date and RSVP deadline, and never schedule a step before
  today. Keep emails short and plain, and use `{first name}`, `{your name}`,
  etc. as placeholders. These are suggestions only. Do not send anything.

## 4. Write to the ledger

1. `ArtifactData list` the `events` collection at LEDGER_URL (page through
   with the cursor) so you know what already exists.
2. Treat the same event arriving from email and from Slack as one record.
   Match on id, or on the same host and date with a near-identical title.
3. **New events:** `set` the full record.
4. **Existing events:** `update` only fields whose facts changed (date,
   time, location, RSVP deadline, links, outreach mode if a partner kit
   showed up), plus `updatedAt`. Pass `if_version`. **Never overwrite
   `decision` or `decisionAt`**: teammates set those on the page.
5. Delete events whose end date is more than 90 days ago.
6. `set` the doc `meta/lastRun` to
   `{"ranAt": "<ISO now>", "newEvents": N, "updatedEvents": N, "needsLook": N}`.
7. Use `batch` (max 50 writes per call) instead of many single writes.

## 5. Send me a short summary

- New events this week (title, date, host, source)
- RSVP deadlines in the next 14 days
- Suggested-sequence steps due to send this week
- "Needs a look": anything with an unclear date or that might be a duplicate
- The LEDGER_URL link
