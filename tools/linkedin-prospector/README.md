# LinkedIn Prospector (Chrome extension)

Goes through your recent LinkedIn connections, matches them against your
Salesforce account list, checks whether you've already been in touch, and
drafts a Triple T message for each real prospect. **You send every message
yourself.** The extension never clicks "Message", types into LinkedIn, or
sends anything.

## What it does

1. **Collects connections** from your LinkedIn data export (`Connections.csv`)
   or from pages you have open (My Network › Connections, Sales Nav lead lists
   such as "Recently Accepted Connections and InMails").
2. **Matches each person's company to your account list.**
   - *Ready*: the company is an exact match (or a website-domain match where the names also agree).
   - *Review first*: a possible match (partial name, similar spelling, a headline mention),
     no company found in the headline, or the account is a Customer, Partner, Reseller or Competitor.
   - *Not a prospect*: the company was found but isn't on your list.
3. **Checks prior contact** so you don't double-reach-out:
   - LinkedIn messages (from `messages.csv`, or from captures of the LinkedIn / Sales Nav inbox)
   - Gmail: emails from them or to them
   - Google Calendar: past or upcoming meetings with them
   - Anything sent through this tool before (the sent log)

   If they replied, emailed you, or met with you → *Don't message*.
   If you messaged or emailed them and got no reply → *Review first* (consider a follow-up instead).
4. **Drafts a Triple T message** for each person, by persona (Finance, Shared services, IT,
   Ops, Exec, everyone else). Each draft is scored against the 30MPC checklist:
   - Trigger: is it clearly meant for them?
   - Tension: does it name the problem the trigger creates?
   - Trust: is there one line of real proof?
   - It also flags buzzwords.

## Install (one time)

1. Download this `tools/linkedin-prospector` folder.
2. In Chrome, go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**,
   and pick the folder.
3. Pin the extension and click it → **Open dashboard** → **Import data** → load your account CSV.
4. On **Settings & templates**:
   - Check that your name matches your LinkedIn name exactly. It's used to read `messages.csv`.
   - Fill in the **Trust** lines with real customer proof. Drafts stay marked
     "✗ Trust" until the `[TRUST: …]` placeholders are replaced.

### Gmail & Calendar check (optional, one-time setup)

This uses your own Google OAuth client, so the data goes only from your browser to Google.

1. Go to <https://console.cloud.google.com>, create a project, and enable the
   **Gmail API** and the **Google Calendar API**.
2. Set up the OAuth consent screen: choose External, Testing mode, and add yourself as a test user.
3. Create credentials: **OAuth client ID** → type **Web application**. Under
   **Authorized redirect URIs**, paste the URI shown on the extension's Settings tab
   (it looks like `https://<extension-id>.chromiumapp.org/`).
4. Paste the client ID into Settings and save. The first check asks you to sign in.

It only requests read-only scopes (`gmail.readonly`, `calendar.readonly`).
It checks the Google account you sign in with. If your work email or calendar
is on another account or on Microsoft 365, that account isn't covered yet.

## Daily / weekly routine

1. **Weekly:** request a fresh LinkedIn data export (Connections + Messages) and
   import both CSVs. This is the most reliable source for "did they reply?".
2. **Daily (quick):** open My Network › Connections → extension → **Scroll & capture all**.
   It stops once it passes your "Connected since" date. Then open your Sales Nav lead
   list and capture each results page. Then open the LinkedIn inbox and the Sales Nav
   inbox and capture those too.
3. In the dashboard, click **Check Gmail & Calendar**.
4. Work the **Ready** tab: edit the draft → **Copy & open** (copies the draft and opens
   their profile) → paste and send in LinkedIn → **Mark sent**.
5. Work the **Review first** tab. Use **Override** to set someone as Is a prospect,
   Not a prospect, or Already in touch. Overrides are remembered for future runs.

Everything is stored locally in the extension (`chrome.storage.local`).

## Caveats

- **LinkedIn's terms** restrict automated tools on the site. This extension only
  reads pages you've opened and never sends anything, but page capture is still
  automation of a sort. The LinkedIn data export is the fully sanctioned path; prefer it.
- **Page capture depends on LinkedIn's markup**, which changes often. If a capture
  comes back empty, the functions to adjust are `scrapeConnections`,
  `scrapeSalesNavLeads`, and `scrapeInbox` in `content.js`.
- **Inbox captures only see the latest preview line** of each thread. "Latest
  message is yours" doesn't prove they never replied, so those people go to
  *Review first*, not *Ready*.
- **`messages.csv` column names** (`FROM`, `TO`, `DATE`) are based on LinkedIn's
  current export format. If the import reports 0 people, check your file's header row.
- **Matching is name-based.** Subsidiaries, rebrands, and acquisitions will show up
  as *Review first* or be missed.
