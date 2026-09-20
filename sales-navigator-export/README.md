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

## Files

- `manifest.json` — MV3 manifest; only runs on `https://www.linkedin.com/sales/*`
- `content.js` — scraping, scrolling, pagination loop, persistence, resume
- `popup.html` / `popup.css` / `popup.js` — UI, preview, CSV building and download
- `background.js` — mirrors the lead count onto the toolbar badge
- `icons/` — generated PNG icons

## Limits and known gaps

- Sales Navigator caps search results around 2,500 (100 pages × 25). Lists are not
  capped the same way. `CONFIG.maxPages` (500) is just a safety valve; raise it if needed.
- Only fields visible in the list row are captured. Email/phone are not shown in list
  rows so they are not exported.
- One export at a time; starting on a different list replaces the stored data (the popup
  warns you first).
