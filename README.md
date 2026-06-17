# Dunkapedia

A static, GitHub Pages-friendly rebuild of Dunkapedia: a curated dunk catalog with filters, verified modal playback, and a no-setup YouTube clip finder.

## Features

- Curated dunk archive that works with no build step
- Filter by player, team, year, tag, or free-text search
- Embedded YouTube playback in a modal for verified clips
- Fallback YouTube clip-hunt flow for archive entries without a stable embeddable video
- No API key required for search

## Run Locally

Open `index.html` directly in a browser, or serve the folder with any static file server.

## Project Files

- `index.html` — App structure
- `style.css` — Visual design and layout
- `app.js` — Catalog data, filters, verified playback, and clip-finder logic
- `favicon.svg` — Site icon
- `social-preview.svg` — Social sharing preview image

## World Cup 2026 — Northeast Ticket Tracker

A standalone page (`tickets.html`) that shows the cheapest current get-in price for
each FIFA World Cup 2026 match at the three Northeast venues (MetLife, Lincoln
Financial Field, Gillette), with one-click links to every ticketing platform.

### How it works

Ticketing sites block direct scraping, so prices come from an **official API** on a
schedule, not from the browser:

1. `.github/workflows/update-tickets.yml` runs every 30 minutes.
2. It executes `scripts/fetch-tickets.mjs`, which reads the curated fixtures in
   `data/matches.json`, looks up live prices, and writes `tickets.json`.
3. `tickets.html` / `tickets.js` read `tickets.json` and render the dashboard.

Keys never reach the browser — they live in GitHub Actions secrets.

### Enabling live prices

Without a key the page still works as a **deep-link launcher** (all matches + links,
no in-app prices). To light up live prices, add **either** secret under
**Settings → Secrets and variables → Actions**:

- `SEATGEEK_CLIENT_ID` — SeatGeek Platform API (best price data; lowest/average/listing count)
- `TICKETMASTER_API_KEY` — Ticketmaster Discovery API (free; WC inventory is FIFA-managed, so resale lows may be limited)

The script auto-detects whichever key is present (SeatGeek preferred).

### Run locally

```bash
node scripts/fetch-tickets.mjs            # seed mode (no prices), regenerates tickets.json
SEATGEEK_CLIENT_ID=xxx node scripts/fetch-tickets.mjs   # with live prices
```

Then open `tickets.html` in a browser (or serve the folder).

### Notes

- Scheduled workflows only run from the repository's **default branch** — the workflow
  file must be on it to fire automatically (run it manually via "Actions" otherwise).
- One API = one marketplace's price. Other resellers (StubHub, Vivid, TickPick, FIFA)
  may differ; the per-match links are there to compare. Prices are dynamic.
- `data/matches.json` is the source of truth for fixtures, provider IDs, and links.
- The dashboard auto-refreshes: an open tab re-fetches `tickets.json` every 3 minutes
  (and on tab refocus), and ticks the "updated X ago" labels every 30s — so it reflects
  new cron runs without a manual reload. Tracking still happens server-side in the Action.
