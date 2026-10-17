# Wodify workout exporter

Downloads every workout posted to your gym's Wodify **Workout** tab, one day at a time, and saves them as JSON, CSV and Markdown.

It runs on **your computer** (Mac or Windows), not your phone. You log in yourself in the browser window it opens, so your password never goes into the script.

## Setup (once)

1. Install Node.js 18+ from https://nodejs.org
2. In a terminal, from this `wodify/` folder:
   ```
   npm install
   npx playwright install chromium
   ```

## Run

```
node export-workouts.mjs run --match "Squat clean" --date 2026-10-17
```

- `--match`: a few words from a workout you can see in the app.
- `--date`: the day that workout is from (YYYY-MM-DD).
- Optional: `--from 2015-01-01` (default 2012-01-01), `--to YYYY-MM-DD` (default today),
  `--delay 400` (milliseconds between requests), `--url` (Wodify web address, default `https://app.wodify.com`).

A browser window opens. Log in, open **Workout**, and pick the `--date` day. When that workout loads,
the script picks it up and starts fetching every date on its own, newest first. Leave the window open until it finishes.

If it stops partway (closed laptop, expired login), run the same command again. Days already downloaded are skipped.

## Output (`output/`)

- `workouts.md`: easy to read, newest first
- `workouts.csv`: open in Excel or Google Sheets
- `workouts.json`: for other tools
- `raw/YYYY-MM-DD.txt`: the untouched response for each day

`node export-workouts.mjs extract` rebuilds the three files from `raw/` without downloading again.

## Notes

- It only fetches the program selected in the dropdown (for example "WOD"). For another program,
  such as a competition class, pick it in the dropdown before the script captures the request, and
  move the old `output/` folder out of the way first.
- The text cleanup is generic. If the output has junk lines, send one file from `raw/` and the cleanup can be tuned for it.
- `output/` and `.browser-profile/` (which holds your login session) are git-ignored. Don't commit or share them.
