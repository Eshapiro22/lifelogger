---
name: linkedin-outreach
description: >
  This skill should be used when the user asks to "run my LinkedIn outreach",
  "message my new LinkedIn connections", "who should I reach out to on LinkedIn",
  "go through my recent connections", "do my daily/weekly LinkedIn prospecting",
  or wants to find which recent LinkedIn / Sales Navigator connections are on their
  account list, check they haven't already been in touch (LinkedIn, Sales Nav,
  Outlook email, Outlook calendar), and draft Triple T messages using real customer stories.
metadata:
  version: "0.1.0"
---

# LinkedIn outreach to recent connections

Find recent LinkedIn connections who work at accounts on the user's Salesforce account
list, rule out anyone already in conversation, draft a Triple T message for each
(with a real customer story as proof), and type approved drafts into LinkedIn for the
user to send.

## Hard rules

- **Never click Send** on LinkedIn or Sales Navigator, and never send email. Type the
  draft into the message box, then stop and let the user click Send.
- **Never message someone who has replied, emailed, or met with the user.** When in
  doubt, put them in *Review first*, not *Ready*.
- **Never invent proof.** Customer names, numbers, and outcomes in a message must come
  from a story found in this run's sources, with its link. If no story fits, leave
  the Trust line as `[TRUST: no matching story found]` and say so.
- **Flag uncertainty.** If it's unclear whether someone is a prospect, put them in
  *Review first* with the reason. Don't guess.
- Work at a human pace in the browser: one page at a time, no rapid-fire actions.
  Stop and tell the user if LinkedIn shows a CAPTCHA, warning, or restriction notice.

## Files in the working folder

Keep state in the user's Cowork working folder so daily/weekly runs build on each other:

| File | Purpose |
|---|---|
| `accounts.csv` | Latest Salesforce account export. Ask for a fresh one if it's older than ~30 days. |
| `outreach-log.csv` | Every person contacted or skipped by this workflow: `date,name,company,account,profile_url,status,message,story_source` |
| `story-library.md` | Customer stories found so far, each with source link (see step 4) |
| `last-run.txt` | Date of the last completed run (YYYY-MM-DD) |
| `connections.json` | This run's captured connections (overwritten each run) |

If `accounts.csv` is missing, ask the user to attach their account export before going further.

## Step 1: Pick the date window

Use connections made after the date in `last-run.txt`. On the first run, ask for a start
date (the user's original list started at 2026-08-01). Tell the user the window up front.

## Step 2: Collect recent connections (Claude in Chrome)

Read `references/linkedin-capture.md` for page-by-page instructions. In short:

1. **My Network › Connections** (`https://www.linkedin.com/mynetwork/invite-connect/connections/`),
   sorted by *Recently added*. Scroll until the "Connected on" dates pass the window start.
   Capture name, headline, connected date, and profile URL.
2. **Sales Navigator lead list** "Recently Accepted Connections and InMails". Go through each
   results page and capture name, title, company, and lead URL.
3. If the user attached LinkedIn's `Connections.csv` export, use it as well. It has
   exact company names.

Merge by person and write `connections.json` as a list of
`{name, headline, title, company, connected_on, profile_url}` (leave unknown fields empty).

## Step 3: Match against the account list

Run:

```bash
python3 -I "${CLAUDE_PLUGIN_ROOT}/skills/linkedin-outreach/scripts/match_accounts.py" \
  --accounts accounts.csv --connections connections.json \
  --cutoff <window start> --log outreach-log.csv > matches.json
```

Each result has a `status`:
- `prospect`: a clean match to an account.
- `unsure`: a possible match, no company found, or the account is a customer, partner,
  reseller, or competitor. Goes to *Review first*.
- `not_prospect`: not on the account list.

A result with `already_logged` was handled in an earlier run; don't draft a new first touch.

For `unsure` results with no company, open the profile in Chrome to read their current
company, then decide. If the match is still not clean, leave them in *Review first*.

## Step 4: Check for prior contact

For every `prospect` and `unsure` person, run all of these checks. The decision rules are
in `references/prior-contact.md`.

1. **LinkedIn messaging.** Search their name in the inbox at `https://www.linkedin.com/messaging/`.
   If there's a thread, open it and note whether *they* have ever written.
2. **Sales Navigator inbox.** Same search at `https://www.linkedin.com/sales/inbox/`.
3. **Outlook email** (Microsoft 365 connector). Search mail for their full name, and their
   email if known. Note any message *from* them, and any message *to* them that got no reply.
4. **Outlook calendar** (Microsoft 365 connector). Look for events in the past 12 months
   or the next 90 days with them as an attendee, or with their name or company in the title.
5. **`outreach-log.csv`**: anyone already messaged by this workflow.

Outcome per person:
- **Don't message**: they replied, emailed, or met with the user.
- **Review first**: the user reached out and got no reply (suggest a follow-up rather than a
  first touch), or a result is ambiguous.
- **Ready**: nothing found.

## Step 5: Find customer stories

Read `references/customer-stories.md`. Build or refresh `story-library.md` by searching,
in this order:
1. SharePoint / OneDrive (Microsoft 365 connector)
2. Glean
3. Highspot
4. The company's public website (customer stories / case studies)

Only search for the verticals and personas on today's *Ready* list. Reuse stories already
in the library (refresh it weekly). Record each story's source link, and whether the
customer can be named publicly. If that's unclear, describe the customer anonymously.

## Step 6: Draft Triple T messages

Read `references/triple-t.md` and draft one message per *Ready* person, picking the
best-fitting story (same vertical first, then persona, then problem).

## Step 7: Present the review in chat

Show:
1. A one-line summary: the window, how many captured, and counts per bucket.
2. **Ready** table: name (linked), company → matched account, persona, story used (with
   source link), and the full draft.
3. **Review first** table: name, the reason, and the suggested next step.
4. **Don't message** table: name and the evidence (e.g. "Emailed you 'Re: intro' on 2026-09-10").
5. Not a prospect: just the count, and the names in a collapsed list.

Then ask which drafts to send, and for any edits. Don't type anything into LinkedIn yet.

## Step 8: Fill in approved messages (Claude in Chrome)

Use the same approach as the user's Triple T email writer: each message opens in its own
browser tab, already written, ready for the user to review and send.

For each approved person, in order:
1. Open a **new tab** on their profile (or Sales Nav lead page) and click **Message**.
   If LinkedIn only offers InMail or "Connect", close that tab, note it, and move on.
2. Type the approved draft into the message box exactly as approved.
3. **Do not click Send.** Leave the tab open and move to the next person in a new tab.

When every tab is ready, list them for the user in tab order (name, company, first line of
the message) and tell them to go tab by tab: edit if needed, click Send, close the tab.
Also list anyone who couldn't be messaged and why. Then ask which were sent and which were
skipped, and append a row for each to `outreach-log.csv` with status `sent` or `skipped`.
Anyone the user doesn't confirm stays out of the log, so the next run brings them up again.

Open at most ~10 tabs per batch. If more were approved, do the next batch after the user
confirms the first.

After all batches, write today's date to `last-run.txt` and give a short wrap-up: how many
were sent, skipped, or are waiting for review.
