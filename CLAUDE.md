# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo (`lifelogger`) is a zero-build, static GitHub Pages site. There is **no
package.json, no bundler, no test runner, and no lint config** — files are served
as-is. It hosts two independent apps that share nothing but the deployment:

1. **Dunkapedia** (`index.html`, `app.js`, `style.css`) — a curated basketball
   dunk catalog with filtering, a verified-clip modal, and a no-API-key YouTube
   clip-hunt flow.
2. **World Cup 2026 Northeast Ticket Tracker** (`tickets.html`, `tickets.js`,
   `tickets.css`) — a dashboard of cheapest get-in prices for FIFA World Cup 2026
   matches at MetLife / Lincoln Financial Field / Gillette, fed by a scheduled
   GitHub Action.

## Running & developing

There is no build step. To work locally, open the HTML directly or serve the
folder with any static server:

```bash
python3 -m http.server      # then open http://localhost:8000/ or /tickets.html
```

Regenerate the ticket data (see pipeline below):

```bash
node scripts/fetch-tickets.mjs                          # seed mode (no prices)
SEATGEEK_CLIENT_ID=xxx node scripts/fetch-tickets.mjs   # live prices (SeatGeek)
TICKETMASTER_API_KEY=xxx node scripts/fetch-tickets.mjs # live prices (Ticketmaster)
```

`fetch-tickets.mjs` requires **Node 18+** (uses global `fetch`) and has no
dependencies.

## Dunkapedia architecture

- The entire catalog is a hardcoded `curatedDunks` array at the top of `app.js`
  (~750 lines of data before any logic). Each entry has `id`, `title`, `player`,
  `team`, `year`, `type`, `youtubeId`, `description`, and `tags`. To add a dunk,
  append an object here — nothing else reads from a database or fetches remotely.
- Filter dropdowns are populated at runtime from the data via `hydrateFilters()` /
  `uniqueValues()`, so new players/teams/tags appear automatically.
- The "YouTube search" is **not a real API call** — `searchYouTube()` filters the
  local `curatedDunks` array for matches and builds a plain
  `youtube.com/results?search_query=...` deep link. No API key is ever needed.
- Verified clips play in an embedded modal (`openModal`); the `youtubeId` is the
  only thing that makes a clip "verified."

## Ticket tracker architecture (data pipeline)

Ticketing sites block browser scraping, so prices are fetched **server-side on a
schedule**, never from the client:

```
data/matches.json ──(node scripts/fetch-tickets.mjs)──► tickets.json ──(tickets.js)──► tickets.html
        ▲                        ▲                            ▲
  source of truth        runs in GitHub Action        generated — do NOT hand-edit
  (fixtures, provider     every 10 min via
   IDs, deep links)       .github/workflows/update-tickets.yml
```

- **`data/matches.json` is the source of truth** for fixtures, venues,
  `providerIds` (drive the API lookup), and per-platform `links`. Edit this to
  change matches or links.
- **`tickets.json` is a generated artifact** — the Action commits it with
  `[skip ci]`. Never edit it by hand; run the script instead.
- `fetch-tickets.mjs` picks a provider by which env var is set (SeatGeek preferred,
  then Ticketmaster, else `"seed"` = no prices). With no key it still emits a valid
  `tickets.json` so the page works as a deep-link launcher. API keys live only in
  GitHub Actions secrets and never reach the browser.
- `tickets.js` reads `tickets.json` and re-fetches it every 3 minutes (and on tab
  refocus) so an open tab reflects new cron runs without reload; the `PLATFORM_*`
  constants control which reseller links render and in what order.

## Deployment & workflow gotchas

- **Two workflows, two different branch assumptions:**
  - `.github/workflows/static.yml` deploys to GitHub Pages, but is pinned to
    `branches: ["devin/1778245885-personal-landing-page"]` — the site publishes
    from *that* branch, not `main`. Adjust the branch here if the deploy source
    changes.
  - `.github/workflows/update-tickets.yml` runs the ticket refresh on a
    `*/10 * * * *` cron.
- **Scheduled workflows only fire from the repository's default branch.** The
  cron in `update-tickets.yml` will not run automatically unless that file exists
  on the default branch; use "Actions → Run workflow" to trigger it from a feature
  branch.
- All internal asset paths are relative and the site is served under the
  `/lifelogger/` path (see canonical URLs in `index.html`) — keep links relative.

## Conventions

Write and follow instructions that are specific and actionable — name the exact
file, command, or value, not a general goal. The rules below apply to this repo:

- **Indentation is per-app, not repo-wide.** Dunkapedia files (`app.js`,
  `index.html`, `style.css`) use **4 spaces**; ticket-tracker files (`tickets.js`,
  `tickets.css`, `scripts/fetch-tickets.mjs`) use **2 spaces**. Match the file
  you're editing rather than reformatting to a single style.
- **There is no test runner.** Before committing a change to the ticket pipeline,
  run `node scripts/fetch-tickets.mjs` and confirm it exits 0 and regenerates a
  valid `tickets.json`. For page changes, load `index.html` / `tickets.html` in a
  browser (`python3 -m http.server`) and verify the affected view renders.
- **Match data and links go in `data/matches.json`; new dunks go in the
  `curatedDunks` array in `app.js`.** Do not hand-edit `tickets.json` — it is
  regenerated by the fetch script.
