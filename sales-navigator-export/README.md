# Sales Navigator List Exporter (Chrome extension)

Exports **every lead in a Sales Navigator lead list or people search to CSV**, walking
through all pages automatically instead of only grabbing the 25 leads visible on screen.

No build step, no external dependencies, nothing leaves your browser: leads are stored
in `chrome.storage.local` and downloaded as a CSV file.

## Before you use it

- **LinkedIn's User Agreement prohibits scraping and browser automation**, including on
  your own account. Accounts running tools like this have been restricted. Use it at your
  own risk, keep the pacing conservative (see `CONFIG` in `content.js`), and don't run it
  on huge lists back to back.
- **I could not verify Sales Navigator's current HTML while writing this.** LinkedIn changes
  its markup often. The scraper is built around things that have historically been stable
  (links to `/sales/lead/…`, a "Next" pagination button, `data-anonymize` attributes), with
  fallbacks, but you should run **Preview this page** first and expect to update a
  selector or two over time. See [Fixing selectors](#fixing-selectors).

## Install (unpacked)

1. Open `chrome://extensions`, turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `sales-navigator-export/` folder.
3. Pin the extension so the badge (lead count) is visible.

## Use

1. Open a lead list (`linkedin.com/sales/lists/people/…`) or a people search
   (`linkedin.com/sales/search/people…`) and go to page 1.
2. Click the extension icon → **Preview this page**. It should report the number of rows
   on the page, whether it found the **Next** button, and show five sample leads with
   name / title / company / location / profile URL. If names or URLs are blank, fix the
   selectors before exporting (below).
3. Click **Export all pages**. Keep the tab open and in the foreground. The extension
   scrolls each page to force all rows to render, scrapes them, waits a random 2.5–5 s,
   clicks Next, and repeats until Next is disabled. Progress is shown in the popup and on
   the toolbar badge.
4. Click **Download CSV**. You can also download partway through; **Stop** pauses it and
   **Export all pages** on the same list offers to resume from the current page.

If the page reloads mid-export the content script picks the export back up automatically
as long as you're still on the same list.

## CSV columns

| column | notes |
| --- | --- |
| `name`, `title`, `company`, `location`, `tenure` | parsed from the row |
| `profile_url` | Sales Navigator lead URL (tracking params stripped). Used to de-duplicate. |
| `company_url` | Sales Navigator company/account URL if present |
| `list_name` | the list's `<h1>` (or the tab title) |
| `page` | page number the lead was scraped from |
| `scraped_at` | ISO timestamp |
| `raw_text` | the whole row's text, `|`-separated. A safety net: if a field selector breaks, the data is still here. |

The file is UTF-8 with a BOM so Excel opens accented names correctly.

## Fixing selectors

Everything DOM-specific is in the `CONFIG.selectors` block at the top of `content.js`.
Each entry is a list of CSS selectors tried in order; the first match wins.

1. On a list page, right-click a lead's name → **Inspect**.
2. Find the `<li>` (or card) that wraps one lead, and the elements for name, title,
   company, location.
3. Add the new selectors to the **front** of the matching list (`resultRow`, `name`,
   `title`, …). Prefer attributes like `data-anonymize="…"` or `aria-label` over class
   names, which change more often.
4. For pagination, inspect the **Next** button and update `nextButton`; the page-number
   pills feed `pageIndicator` / `currentPage` (only used for the progress display).
5. Reload the extension on `chrome://extensions`, reload the LinkedIn tab, and run
   **Preview this page** again.

If `resultRow` matches nothing, the scraper falls back to "find every link to
`/sales/lead/` and use its nearest `<li>` ancestor", which is usually enough to keep
`name` (link text), `profile_url` and `raw_text` working even when everything else breaks.

## Reconciling leads with Salesforce

Once you have a list exported, the **Reconcile with Salesforce…** button in the popup opens
a page that matches each lead's company to a Salesforce Account and tells you whether the
Account Owner is you. Salesforce is the source of truth; the page never writes to it and
nothing leaves your browser.

### Getting the Salesforce data

The page takes CSV exports, so it works for any Salesforce user without a Connected App or
admin help. Any of these produce a usable file:

1. **A Salesforce report** (simplest). Reports → New Report → *Accounts*. Add the columns
   **Account ID, Account Name, Account Owner, Website, Parent Account, Type**. Remove the
   default "My accounts" scope so it covers all accounts. Export → *Details Only* → CSV.
   Optionally do the same for *Contacts & Accounts* with **Contact ID, First Name, Last Name,
   Account Name, Contact Owner, Title, Email** to also learn which leads already exist in
   Salesforce and who owns them.
2. **Claude with a Salesforce connector.** If your Claude instance is connected to Salesforce,
   ask it to run these queries and save the results as CSV files, then drop them into the page:
   ```sql
   SELECT Id, Name, Owner.Name, Website, Parent.Name, Type FROM Account
   SELECT Id, FirstName, LastName, Account.Name, Owner.Name, Title, Email FROM Contact
   ```
   The column detector recognises the `Owner.Name` / `Account.Name` style headers.
3. **Salesforce CLI** (`sf data query --query "…" --result-format csv`). I have not verified the
   current CLI flags; check `sf data query --help`.

### Two ways to answer "is this lead mine?"

- **Only my accounts** (simplest). Export just the accounts you own (a "My accounts" report, or
  a query with an owner filter) and tick **"The accounts file contains only my accounts"**.
  The page ticks it for you when every row has the same owner. Any match is yours; no match
  means *not one of my accounts*. You don't need to pick your name. The trade-off: it can't tell
  "a colleague owns this account" apart from "this company isn't in Salesforce at all".
- **All accounts.** Export every account and pick your name from the Owner dropdown. You get
  three buckets: mine, someone else's (with the owner's name), and not in Salesforce.

### Running it

1. Pick the leads: the ones the extension just collected, or upload the CSV it downloaded.
2. Upload the Accounts CSV. The page guesses which columns are name / owner / ID; correct them
   in the dropdowns if it guessed wrong.
3. Pick your name from the **Account Owner** dropdown (it lists every owner in the file with
   their account counts), optionally paste your Salesforce URL for clickable record links.
4. **Reconcile**. Tiles at the top filter the table: on my accounts, on someone else's, no
   account found, needs review, already in Salesforce as a contact.
5. **Download reconciled CSV**: the original lead columns plus `sf_account_name`,
   `sf_account_owner`, `account_is_mine`, `match_tier`, `match_score`, `match_note`,
   `alt_candidates`, and the contact columns if you supplied a contacts file.

### How matching works, and what to double-check

Sales Navigator list rows expose the company **name** only (no website/domain), so matching is
by name. Names are normalised (case, accents, punctuation, "The", and legal suffixes such as
Inc/LLC/Ltd/GmbH) and compared with a blend of word overlap and character-bigram similarity.

| `match_tier` | meaning |
| --- | --- |
| `exact` | identical after normalisation ("Acme Corp" = "Acme Corporation, Inc.") |
| `high` | score ≥ 0.9, or one name is a whole-word prefix of the other ("Acme" → "Acme Technologies") |
| `medium` / `low` | fuzzy; shown under **needs review** with the runner-up candidates |
| `none` | nothing scored above 0.6 |

Rows are also flagged for review when two Salesforce accounts normalise to the same name
(duplicates), when the runner-up scores within 0.05 of the winner, or when a contact with the
lead's name exists on a *different* account. Treat "needs review" rows as suggestions, not
answers, and skim the "no account found" bucket for companies Salesforce spells very
differently (subsidiaries, DBAs, acquisitions).

### Command line

Same logic, for big files or scripting:

```bash
node reconcile/cli.mjs --leads leads.csv --accounts accounts.csv --my-accounts-only \
  [--contacts contacts.csv] [--sf-url https://yourorg.lightning.force.com] [--out reconciled.csv]
# or, with an all-accounts export:
node reconcile/cli.mjs --leads leads.csv --accounts all-accounts.csv --me "Your Name"
node reconcile/test.mjs   # runs the matcher's self-test
```

## Files

- `manifest.json` — MV3 manifest; only runs on `https://www.linkedin.com/sales/*`
- `content.js` — scraping, scrolling, pagination loop, persistence, resume
- `popup.html` / `popup.css` / `popup.js` — UI, preview, CSV building and download
- `background.js` — mirrors the lead count onto the toolbar badge
- `reconcile.html` / `reconcile.css` / `reconcile.js` — Salesforce reconciliation page
- `reconcile/match.js` — CSV parsing, name normalisation and matching (shared by page and CLI)
- `reconcile/cli.mjs`, `reconcile/test.mjs` — command-line runner and self-test
- `icons/` — generated PNG icons

## Limits and known gaps

- Sales Navigator caps search results around 2,500 (100 pages × 25). Lists are not
  capped the same way. `CONFIG.maxPages` (500) is just a safety valve; raise it if needed.
- Only fields visible in the list row are captured. Email/phone are not shown in list
  rows so they are not exported.
- One export at a time; starting on a different list replaces the stored data (the popup
  warns you first).
