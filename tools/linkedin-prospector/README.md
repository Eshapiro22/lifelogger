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
   - Outlook mail (Microsoft 365): emails from them or to them
   - Outlook calendar: past meetings (last 12 months) or upcoming meetings (next 90 days) with them
   - Anything sent through this tool before (the sent log)

   If they replied, emailed you, or met with you → *Don't message*.
   If you messaged or emailed them and got no reply → *Review first* (consider a follow-up instead).
4. **Drafts a Triple T message** for each person, by persona (Finance, Shared services, IT,
   Ops, Exec, everyone else). **Draft with Claude** then picks the best-fitting
   story from *your* customer story library and writes the Trust line. Each draft is scored against the 30MPC checklist:
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

### Outlook check (Microsoft 365, one-time setup)

This uses an app registration in your company's Entra ID (Azure AD). Data only
goes between your browser and Microsoft.

1. Go to <https://entra.microsoft.com> → **App registrations** → **New registration**.
   For supported account types, choose *Accounts in this organizational directory only*.
2. Under **Authentication**, add a platform: **Single-page application**. Paste the
   redirect URI shown on the extension's Settings tab (it looks like `https://<extension-id>.chromiumapp.org/`).
3. Under **API permissions**, add Microsoft Graph *delegated* permissions:
   `Mail.Read`, `Calendars.Read`, `User.Read`, `offline_access`.
4. Copy the **Application (client) ID** and the **Directory (tenant) ID** into Settings and save.
   The first **Check Outlook** opens a Microsoft sign-in window.

**Admin consent:** many companies block users from consenting to apps that read
mail. If sign-in says *"Need admin approval"*, IT has to grant consent for this
app registration, or register it for you. The extension only needs read access
and never sends email.

The check matches people by name (and by email if it came from `Connections.csv`).
Someone who emails from an address that doesn't contain their name, and whose
display name differs from LinkedIn, can be missed.

### Claude customer stories (one-time setup)

The extension calls Claude through the Anthropic API, using the official SDK
bundled at `lib/vendor/anthropic-sdk.js`.

1. Get an API key from your company's Claude Console org (or ask whoever administers Claude at work).
   A Claude.ai Team/Enterprise *chat* login is not an API key. The extension
   can't sign into claude.ai or read your projects there.
2. Paste the key into Settings. It's stored only in this extension's local storage on your machine.
3. Build your **customer story library** in Settings (paste it or load a .txt/.md file).
   Separate stories with a line containing only `---`. For each story, include:
   - the customer's industry/vertical and size
   - who the buyer was (finance, IT, ops…)
   - the problem and the measurable outcome
   - whether you're allowed to name the customer

   Easy way to build it: ask your work Claude (the one with access to your case
   studies / enablement content) something like *"List every customer story you
   can find in our materials in this format: customer, vertical, size, persona,
   problem, outcome with numbers, can we name them (yes/no). Separate stories
   with a line containing only ---. Only include facts that are in the sources."*
   Then paste the result in.

Claude is instructed to use only facts from the library. If nothing fits a
prospect, it says so and the draft keeps its `[TRUST: …]` placeholder.
**Read every draft before sending**; the tool can't verify that a story is still approved for use.

Model: Claude Opus 5.5 at medium effort, with Anthropic's server-side
fallback enabled. Expect roughly one request per prospect.

To rebuild the vendored SDK (only needed to update it): `npm install && npm run build`.

## Daily / weekly routine

1. **Weekly:** request a fresh LinkedIn data export (Connections + Messages) and
   import both CSVs. This is the most reliable source for "did they reply?".
2. **Daily (quick):** open My Network › Connections → extension → **Scroll & capture all**.
   It stops once it passes your "Connected since" date. Then open your Sales Nav lead
   list and capture each results page. Then open the LinkedIn inbox and the Sales Nav
   inbox and capture those too.
3. In the dashboard, click **Check Outlook**, then **Draft Ready with Claude**.
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
