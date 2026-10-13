# LinkedIn Outreach (Cowork plugin)

Say **"run my LinkedIn outreach"** in Cowork. Claude will:

1. Read your recent connections from LinkedIn (My Network › Connections) and your Sales Navigator
   "Recently Accepted Connections and InMails" list, using Claude in Chrome.
2. Match each person to your Salesforce account list. Anything it isn't sure about is flagged for review.
3. Check whether you're already in touch with each match:
   - LinkedIn and Sales Nav messages
   - Outlook mail and calendar (Microsoft 365 connector)
   - its own log of earlier runs
4. Find real customer stories in SharePoint, Glean, Highspot, and your company website.
5. Draft a Triple T message (Trigger, Tension, Trust) for each person who's ready, and show a review table in chat.
6. For the drafts you approve: open each message in its own browser tab, already written (the same approach as the Triple T email writer).
   **You click Send.** Claude never sends.

## What you need

- Cowork with **Claude in Chrome**, signed into LinkedIn and Sales Navigator.
- Connectors: **Microsoft 365** (Outlook + SharePoint). Also **Glean** and **Highspot** if your org has them.
- Your Salesforce account export saved as `accounts.csv` in the Cowork working folder.
- Optional: LinkedIn's data export `Connections.csv` (Settings › Data privacy › Get a copy of your data),
  which gives exact company names.

## Files it keeps in your working folder

- `outreach-log.csv`: everyone sent or skipped, so later runs never double-message.
- `story-library.md`: the customer stories it found, with source links. Edit this to add or remove stories.
- `last-run.txt`: the next run picks up from this date.

## Caveats

- LinkedIn's terms restrict automation. This plugin reads pages at a human pace and never clicks Send,
  but you're still using an automated assistant on LinkedIn, so keep the volume reasonable.
- Name matching across LinkedIn, Outlook, and the CRM isn't perfect. Read the *Review first* list.
