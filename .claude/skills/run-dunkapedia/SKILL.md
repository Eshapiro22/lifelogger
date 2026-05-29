---
name: run-dunkapedia
description: Run, screenshot, and interact with the Dunkapedia static web app (NBA dunk encyclopedia). Use when asked to run, start, test, screenshot, or verify Dunkapedia / the dunk site.
---

Dunkapedia is a single-page static app (`index.html` + `app.js` + `style.css`). The driver at `.claude/skills/run-dunkapedia/driver.mjs` spins up an in-process Node HTTP server, launches headless Chromium via Playwright, exercises the catalog and all filters end-to-end, and writes four screenshots to disk.

## Prerequisites

Playwright and Chromium are pre-installed at:
- `/opt/node22/lib/node_modules/playwright/index.mjs`
- `/opt/pw-browsers/chromium`

No `npm install` needed.

## Run (agent path)

```bash
node .claude/skills/run-dunkapedia/driver.mjs [screenshot-dir]
```

Default screenshot dir is `/tmp`. Named outputs:
- `dunkapedia-home.png` — hero + stat bar
- `dunkapedia-filtered.png` — catalog with player filter active
- `dunkapedia-modal.png` — Surprise Me modal open
- `dunkapedia-search.png` — Clip Finder results

Expected output (all five lines indicate a healthy run):
```
Server ready on http://localhost:8765
Catalog: 53 dunks · 43 players · 33 eras
Player filter: Showing N dunks
...
No JS runtime errors
Screenshots → /tmp/dunkapedia-*.png
```

## Run (human path)

```bash
cd /home/user/lifelogger
python3 -m http.server 8080
# open http://localhost:8080 in browser
```

Useless headless; use the driver above for agent verification.

## Gotchas

- **Port 7474 is already in use** in this container. The driver uses 8765 instead. Don't change it back.
- **`ERR_CERT_AUTHORITY_INVALID` for all external requests** — YouTube thumbnails and Google Fonts all fail TLS in the sandbox. This is expected and does not affect JS execution or catalog behavior. The driver passes `--ignore-certificate-errors` to suppress these from Playwright's perspective.
- **`path.resolve(import.meta.url, '../../..')` gives the wrong ROOT** — driver.mjs is 4 levels deep in the repo (`lifelogger/.claude/skills/run-dunkapedia/driver.mjs`), so ROOT uses `'../../../..'`. Using three dots lands in `.claude/` and causes 404s with no obvious error.
- **Hash-link `.click()` inside `page.evaluate()` can confuse Playwright's navigation state** — use `element.scrollIntoView()` to scroll to sections instead of clicking `<a href="#section">` anchors programmatically.
- **`page.waitForFunction` hangs even when condition is already true** — use `$eval` right after `waitUntil: 'domcontentloaded'` instead; app.js runs synchronously and the DOM is fully populated at that point.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE` on 8765 | Kill stale process: `lsof -ti :8765 \| xargs kill` |
| `#stat-dunks` not found | Wrong ROOT path — check `resolve` depth is `'../../../..'` |
| `waitForFunction` times out | Replace with `$eval` after `domcontentloaded` |
| All screenshots black | Chromium crashed — check `--no-sandbox` flag is present |
