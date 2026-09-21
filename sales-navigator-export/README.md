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
3. Optionally type a **label** for the export; it becomes the `list_name` column and the file
   name (otherwise the page's `<h1>` is used).
4. Click **Export all pages**. Keep the tab open and in the foreground. The extension
   scrolls each page to force all rows to render, scrapes them, waits a random 2.5–5 s,
   clicks Next, and repeats until Next is disabled. Progress is shown in the popup and on
   the toolbar badge.
5. Click **Download CSV**. You can also download partway through; **Stop** pauses it and
   **Export all pages** on the same list offers to resume from the current page.

If the page reloads mid-export the content script picks the export back up automatically
as long as you're still on the same list.

## Saving a whole search to a lead list

Sales Navigator only lets you select the 25 leads on the current page, so building a list from
a big search means clicking through every page by hand. On a people-search page the popup shows
**Save all search results to a lead list**:

1. Type the list name. If the list doesn't exist yet it is created in LinkedIn on the first
   page (through the menu's own "Create new list" control, which saves that page's leads into
   it); every later page ticks the existing list. Creation happens at most once per run: if the
   list is missing from the menu on a later page the run stops rather than creating a second
   one. The same name is pre-filled as the export label.
2. Click **Preview controls**. This selects the leads on the current page, opens the
   "Save to list" menu, and reports what it found (select-all checkbox, the button, the menu
   items, whether your list or a "Create new list" control is there), then deselects and closes
   the menu without saving anything. Don't run the real thing until the preview says all
   controls were found.
3. Click **Save all pages**. It walks every page: select all → Save to list → tick your list →
   Next, with the same random pacing as the exporter. Progress and a log show in the popup;
   **Stop** halts after the current page. If a page reloads mid-run it resumes on its own, and
   clicking **Save all pages** again with the same name offers to continue from the current page.
4. Open the list and run **Export all pages** on it.

Notes and caveats:

- A menu item that is already ticked means those leads are already in the list; the extension
  leaves it alone (clicking would remove them) and logs "already in list".
- I have not verified the current Sales Navigator lead-list size cap or whether "select all"
  covers only rendered rows; the extension scrolls the page fully before selecting to be safe.
- This automates *write* actions on LinkedIn, which is a bigger Terms-of-Service exposure than
  reading. Same advice as above: keep the pacing, don't run huge searches back to back.
- The controls are found by aria-labels and visible text ("Save to list", "Create new list",
  "Create"/"Save"/"Done"); the selector lists are `selectAllCheckbox`, `saveToListButton`,
  `listMenu`, `listMenuItem`, `createListInput` in `CONFIG.selectors`.

## CSV columns

| column | notes |
| --- | --- |
| `name`, `title`, `company`, `location`, `tenure` | parsed from the row |
| `degree` | connection degree (1st/2nd/3rd) |
| `in_crm` | `Yes` / `No` from Sales Navigator's CRM-sync badge, when your org has CRM sync. This is LinkedIn's view of whether the *person* exists in your CRM; the reconciliation answers who owns the *account*. |
| `blurb` | the short "about" line under the card, if shown |
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

Row detection no longer depends on selectors: for each link to `/sales/lead/…` the scraper
climbs to the largest ancestor that still contains exactly one lead, and treats that as the
card. Fields are read with the selectors above first, then parsed from the card's text
(name, degree badge stripped, "Title at Company", "City, Region", "N years in role") so the
export keeps working when class names change. `raw_text` always has the whole card.

**If fields still come back blank**, click **Copy diagnostics** in the popup while on a list
page. It copies a JSON report of the page structure (selector hit counts, the ancestor chain
of the first lead, and the card's HTML with all text and record ids redacted) that is safe to
share and enough to pin the selectors down.

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

### Org too big to export? Generate lookup queries from the leads

Exporting every account is impractical in a large org (hundreds of thousands of accounts). Flip
it around: fetch only the accounts whose names resemble the companies in your lead list. On the
reconcile page, open **"Org too big to export?"** under step 2 and click **Generate**. It turns
the distinct company names from your leads into batched Salesforce queries plus a paste-ready
prompt:

- **SOSL** (default, recommended): `FIND {"Canadian General Tower" OR "Swing Design" …} IN NAME
  FIELDS RETURNING Account(Id, Name, Owner.Name, Website, Parent.Name, Type)`. Uses the search
  index, so "The", legal suffixes and extra words in the Salesforce name don't matter.
- **SOQL**: `SELECT … FROM Account WHERE Name LIKE 'Acme%' OR …`. Prefix match; misses accounts
  whose Salesforce name starts differently from the LinkedIn name.

Paste the prompt into a Claude that has your Salesforce connector (or run the queries in
Developer Console / Workbench), save the combined result as a CSV, and load it as the Accounts
file with **"only my accounts" unticked**. The result contains every owner, so you get the full
three-way answer (mine / a colleague's, with their name / not in Salesforce) from a file of a
few hundred rows. Names too generic to search ("Global Solutions", two-letter names) are
listed for you to check by hand.

I have not verified the current SOSL/SOQL length limits; the generator batches conservatively
(30 names per SOSL query, 50 per SOQL). If Salesforce rejects a query as too long, lower the
batch size (`--batch` on the CLI) and regenerate. Command line:

```bash
node reconcile/queries.mjs --leads leads.csv --prompt            # SOSL + paste-ready prompt
node reconcile/queries.mjs --leads leads.csv --format soql       # raw SOQL only
```

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

### Confirmed matches

Generic names ("NTT DATA", "Goodwin") can match several Salesforce accounts equally well. Once
you know the right one, pin it in **Confirmed matches** on the page (or `--overrides file.txt`
on the CLI), one per line:

```
NTT DATA => Ntt Data International Services, Inc.
Goodwin => Goodwin Procter LLP
```

The right-hand side is the account's name or Id. Confirmed rows get `match_tier = confirmed`,
never land in "needs review", and the page remembers the list between runs. Low-confidence
matches now report `account_is_mine = Unverified` rather than a misleading No.

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
- `reconcile/cli.mjs`, `reconcile/queries.mjs`, `reconcile/test.mjs` — command-line runner, lookup-query generator, self-test
- `icons/` — generated PNG icons

## Limits and known gaps

- Sales Navigator caps search results around 2,500 (100 pages × 25). Lists are not
  capped the same way. `CONFIG.maxPages` (500) is just a safety valve; raise it if needed.
- Only fields visible in the list row are captured. Email/phone are not shown in list
  rows so they are not exported.
- One export at a time; starting on a different list replaces the stored data (the popup
  warns you first).
