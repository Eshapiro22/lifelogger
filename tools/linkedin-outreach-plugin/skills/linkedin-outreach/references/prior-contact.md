# Prior-contact checks and decision rules

The goal: never double-reach-out to someone who is already in conversation with the user.

## How to check each source

**LinkedIn messaging** (`https://www.linkedin.com/messaging/`)
- Type the person's full name in the "Search messages" box. Ignore results that are only
  name look-alikes; confirm the thread is with the same person (same photo, headline, or profile link).
- If there's a thread, open it and scan the whole thread, not just the preview line.
  Record whether **they** ever sent a message, and the date of the most recent message from each side.
- Group threads count only when they wrote something addressed to the user.

**Sales Navigator inbox** (`https://www.linkedin.com/sales/inbox/`)
- Same as above. InMails they never answered count as "you messaged, no reply".

**Outlook email** (Microsoft 365 connector)
- Search the full name in quotes. Also search their email address, if known.
- Classify each hit by its headers, not its body:
  - **From them**: the sender is this person.
  - **To them**: the user sent it with this person in To/Cc.
  - **Mention only**: their name is in the body. Ignore it, unless it says something
    like an intro was made, in which case flag it.
- Same-name collisions happen. If the company or domain clearly doesn't match, ignore the hit.

**Outlook calendar** (Microsoft 365 connector)
- Look from 12 months back to 90 days ahead.
- Count an event when this person is an attendee or organizer, or when their name is in
  the event title. Their company name in the title counts as "Review first", because
  the user may have met someone else there.

**`outreach-log.csv`**
- Any row for this person means this workflow already handled them.

## Decision rules (first match wins)

| Evidence | Bucket | What to tell the user |
|---|---|---|
| They wrote to the user on LinkedIn or Sales Nav | Don't message | "Replied on LinkedIn (date)" |
| An email from them | Don't message | "Emailed you: '<subject>' (date)" |
| A past or upcoming meeting with them as attendee | Don't message | "Met: '<event>' (date)" / "Meeting booked (date)" |
| Already in `outreach-log.csv` as sent | Review first | "Messaged via this workflow on (date): follow-up?" |
| The user messaged on LinkedIn or Sales Nav, no reply | Review first | "You messaged (date), no reply: follow-up instead?" |
| The user emailed them, no reply | Review first | "You emailed '<subject>' (date), no reply" |
| An event mentions their company but not them | Review first | "Your calendar has '<event>' with <company>; same deal?" |
| A check couldn't run (connector error, page didn't load) | Review first | "Couldn't check <source>" |
| Nothing found anywhere | Ready | — |

Always tell the user which sources were checked. If a whole source failed for the run
(for example the Microsoft 365 connector isn't connected), say so at the top of the review
and put everyone who would have been *Ready* into *Review first*.
