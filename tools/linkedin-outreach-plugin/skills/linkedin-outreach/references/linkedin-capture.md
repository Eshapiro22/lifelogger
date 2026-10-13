# Capturing connections from LinkedIn (Claude in Chrome)

LinkedIn's layout changes often. Navigate by visible text and links, not by remembered
positions. If a page doesn't match what's described here, describe what you see to the
user and ask before improvising.

## My Network › Connections

URL: `https://www.linkedin.com/mynetwork/invite-connect/connections/`

1. Make sure the sort is **Recently added** (it's the default; check the "Sort by" control).
2. Each card shows: **name** (links to `/in/<slug>/`), a **headline** line, and
   **"Connected on <Month D, YYYY>"**.
3. Scroll down. Read the cards in batches of about 20–30. If a **Show more results**
   button appears, click it.
4. Stop when a card's "Connected on" date is earlier than the window start.
   The list is newest-first, so nothing further down is in range.
5. For each card, record:
   - `name`: as shown, minus emoji and credentials such as ", MBA" or ", CPA"
   - `headline`: the full text of the line under the name
   - `connected_on`: the date in YYYY-MM-DD format
   - `profile_url`: the `/in/` link, without its query string

Expect a few hundred cards over a couple of months. Save progress to `connections.json`
every ~50 cards, so a lost tab doesn't mean starting over.

## Sales Navigator lead list

The user's list is called **"Recently Accepted Connections and InMails"**. Open it from
Sales Navigator › Lead lists, or from the saved search the user gives you.

1. Each row shows the **name** (links to `/sales/lead/...`), **title**, and **company**
   (links to `/sales/company/...`). Company is usually exact, so prefer it over parsing a headline.
2. The results are paged (25 per page). Go through each page in order.
3. Rows have no connect date. Include them all, and note "from Sales Nav (no connect date)".
   The matcher keeps rows with no date.
4. Record: `name`, `title`, `company`, `profile_url` (the lead URL).

Merge with the Connections capture by name. When both have a value, keep the Sales Nav
`company` and the Connections `headline` and `connected_on`.

## Signs to stop and tell the user

- A CAPTCHA, a "We've restricted your account" or "unusual activity" notice, or a request to sign in again.
- Search or list pages coming back empty when they shouldn't be.
- Anything asking you to confirm a purchase, InMail credits, or connection requests.
