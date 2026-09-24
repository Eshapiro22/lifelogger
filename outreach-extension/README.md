# LinkedIn → Outreach Sender (Chrome extension)

Upload a Sales Navigator CSV. For each lead, the extension finds the matching
prospect in Outreach and then either **adds them to a sequence** or **sends a
one-off email from one of your Outreach templates**. It does this by clicking
through the Outreach web app in your own logged-in browser. It does not use the
Outreach API.

> **Heads-up:** the built-in click steps ("recipes") are guesses. They have
> **not** been tested against the real Outreach UI. Plan on one setup session
> using the recorder (below) before your first real run. Outreach UI changes
> can also break a recipe later. Automating a web app may also be restricted
> by your Outreach contract or terms of use, so check that first.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `outreach-extension/` folder.
3. Log in to Outreach in a normal tab.
4. Click the extension's toolbar icon to open the dashboard.

## Use

1. **Leads**: upload the CSV. Columns are detected automatically (First/Last
   Name, Full Name, Email, Company, Title, LinkedIn URL) and can be changed
   with the dropdowns. Rows with no first and last name are skipped.
2. **Action**: pick *Add to sequence* or *Send one-off email*. Type the
   sequence or template name exactly as it appears in Outreach.
3. **Safety**:
   - **Dry run** is on every time the dashboard opens. It does every step
     except the final Add/Send click.
   - *Confirm each send* stops before every live send and asks you.
   - Leads get a random delay between them, and each run has a maximum number
     of leads.
   - Leads sent in earlier live runs are skipped (see the History tab).
4. **Run**: each lead ends in one of these states:
   - `done`
   - `dry-run`
   - `review`: no prospect matched, or more than one did. These are never
     guessed.
   - `failed`: a step broke. The detail column says which one.
   - `skipped`

   Click **Export results CSV** to download the results.

### How matching works

The default `find` recipe searches Outreach for the lead's email, or for their
full name if there's no email. It then opens a result only if **exactly one**
result row contains both the first and last name. If several rows match, the
company (and email) are used to narrow it down. If there are still several,
the lead goes to `review`.

## Calibrating the recipes (do this first)

Open the **Recipes** tab:

1. Choose `find`, click **● Record in Outreach tab**, and in Outreach search
   for a prospect and open it by hand. Click **■ Stop recording**.
2. Edit the recorded steps:
   - Replace the literal text you typed with variables such as
     `{{email|fullName}}`.
   - Replace the click on the result row with a `pickResult` step. See the
     default recipe for an example.
3. Do the same for `sequence` and `email`:
   - Replace the sequence/template name you clicked with `{{sequence}}` or
     `{{template}}`.
   - Add `"final": true` to the last Add/Send click.
4. Click **Save**, then **Test … (dry run)** to try it on the first selected
   lead.

Variables available to recipes:
- `firstName`, `lastName`, `fullName`, `email`, `company`, `title`,
  `linkedinUrl`, `sequence`, `template`
- any original CSV column header, e.g. `{{Job Title}}`
- `{{a|b}}` uses the first of the two that isn't empty

Step types are documented at the top of `lib/recipes.js`.

## Development

```
npm test   # unit tests + end-to-end test in headless Chromium against test/mock-outreach.html
```

The end-to-end test loads the unpacked extension. It serves a **fake**
Outreach page (`test/mock-outreach.html`) in place of `app.outreach.io`, so it
checks the extension's own logic (CSV → match → dry run vs. live, ambiguous
and not-found handling). It does not check compatibility with the real
Outreach.
