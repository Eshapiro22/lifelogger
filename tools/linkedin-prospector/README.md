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
   - Outlook (searched in your own Outlook tab): emails from them or to them, including meeting invites and replies
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

## How the messages are written

No connect-and-pitch. Following 30MPC's outbound sequence ("there's nothing people hate
more than a connect and pitch"), each person gets up to three touches, a few days apart:

1. **Touch 1, context only.** About them (role, company, timing) and an easy question. No product, no meeting ask.
2. **Touch 2, thoughts bubble-up.** One observation about the problem their role usually has (the *Tension*).
3. **Touch 3, proof bubble-up.** One real customer story (the *Trust*) and a light close.

The dashboard works out which touch each person is on from **Mark sent** and from any earlier
LinkedIn messages it finds. A follow-up becomes due after 3 days, which you can change in
Settings. Every line is editable per persona in Settings. Touch 1 is flagged if it starts
to sound like a pitch.

## Install (one time)

1. Download this `tools/linkedin-prospector` folder.
2. In Chrome, go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**,
   and pick the folder.
3. Pin the extension and click it → **Open dashboard** → **Import data** → load your account CSV.
4. On **Settings & templates**:
   - Check that your name matches your LinkedIn name exactly. It's used to read `messages.csv`.
   - Fill in the **Trust** lines with real customer proof. Drafts stay marked
     "✗ Trust" until the `[TRUST: …]` placeholders are replaced.

### Outlook check (no setup)

The extension uses **Outlook on the web in a Chrome tab where you're already signed in**.
For each person it types their name into Outlook's search box and reads who the results
are from:

- **An email from them** (including meeting invites or accept/decline replies) → *Don't message*
- **Only emails from you, no reply** → *Review first*
- **Nothing found** → no Outlook flag
- **Couldn't search or read the results** → *Review first*, never *Ready*

If Outlook isn't open, the extension opens it in a background tab. If your company uses a
different Outlook address (for example `https://outlook.cloud.microsoft/mail/`), set it in Settings.
Leave the Outlook tab on the mail view while checks run.

Speed: each search finishes as soon as Outlook finishes drawing its results. A result is
reused for 24 hours (changeable in Settings), so the batch skips people checked recently,
and **Check & open** doesn't search again right after a batch. To force a fresh search,
use the row's **Check Outlook** button.

Limits: this checks mail search, not the calendar directly. Meetings normally leave an invite or
reply email that the search finds, but a meeting someone else booked with no email to you can be missed.

**Advanced (optional):** with an Entra ID app registration from IT, the extension can use
Microsoft Graph instead, which also checks the calendar directly. Settings → Outlook check →
*Advanced* has the fields. Register a *Single-page application* redirect URI (shown there) with
delegated `Mail.Read`, `Calendars.Read`, `User.Read`, `offline_access`.

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
2. **Review first → Check LinkedIn messages.** Searches your LinkedIn inbox for each person in the
   current view, one at a time, with a random 20–45 second pause between searches. It opens each
   matching conversation and reads who wrote: they replied → *Don't message*; only you → follow-up
   (touch 2/3); nothing → stays put. It only reads; it never types or sends. Leave the LinkedIn
   messaging tab open while it runs. Stop anytime.
3. **Daily (quick):** open My Network › Connections → extension → **Scroll & capture all**.
   It stops once it passes your "Connected since" date. Then open your Sales Nav lead
   list and capture each results page. Then open the LinkedIn inbox and the Sales Nav
   inbox and capture those too.
3. In the dashboard, click **Check Outlook**, then **Draft Ready with Claude**.
4. Work the **Ready** tab: edit the draft → **Check & open** → review → click Send in LinkedIn → **Mark sent**.
   **Check & open** runs a last-second check before anything is typed:
   - searches Outlook (in your Outlook tab) and stops if they've emailed you or sent/accepted a meeting
   - opens their profile and their LinkedIn message box, and reads the conversation:
     - **they've written to you before** → red STOP banner, nothing typed, and the dashboard moves them to *Don't message*
     - **you've written, no reply** → amber banner, nothing typed, moved to *Review first* as a follow-up
     - **no history** → the draft is typed into the message box for you to review and send
     - **can't tell** → amber banner, nothing typed
   It never clicks Send.
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
