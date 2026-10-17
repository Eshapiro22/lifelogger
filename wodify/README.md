# Wodify Workout Exporter (Chrome extension)

Downloads every workout posted to your gym's Wodify **Workout** tab and exports them as Markdown, CSV or JSON.
It uses the Wodify tab you're already logged into, so there's nothing to install besides the extension.

## Install

1. Download this `wodify/` folder.
2. In Chrome, go to `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `wodify/` folder.
4. Pin the extension from the puzzle-piece menu so its icon is easy to reach.

## Use

1. Log in to Wodify in Chrome and open the **Workout** tab. If Wodify was already open, reload it.
2. Pick a day whose workout you can see, for example Sat, Oct 17.
3. Click the extension icon:
   - **Text from that workout**: a few words you can see, e.g. `Squat clean`
   - **Date of that workout**: that day
   - Click **Capture workout request**. If it doesn't say "captured", switch to another day and back in Wodify.
4. Set **From** (default 2012-01-01) and click **Start**. Keep the Wodify tab open. You can close the popup;
   it keeps going and you can reopen the popup to check progress.
5. When it says **Finished**, click **Markdown**, **CSV** or **JSON** to download.

If it stops (closed tab, expired login), log in again, capture again, and press **Start**. Days already
downloaded are skipped.

## How it works

The extension watches the requests the Wodify page makes. When a response contains your text, it takes that
request as "load the workout for this date" and sends it again for each date from newest to oldest,
about 2–3 per second. Everything stays in your browser. Nothing is sent anywhere else.

## Limits

- It only grabs the program selected in Wodify's dropdown (e.g. "WOD"). For another program, pick it in the
  dropdown, click **Clear all saved data** (export first!), and repeat.
- The text cleanup is generic. If the export has junk lines, share a sample and it can be tuned.
- It only runs on `*.wodify.com` pages.
