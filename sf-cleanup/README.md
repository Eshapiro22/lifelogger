# sf-cleanup — Salesforce account list cleanup agent

Crawls your Salesforce account list, flags accounts that are duplicates, acquired, merged,
renamed, defunct, or carrying bad/missing data, and drafts the matching **Sales Technologies →
Salesforce → Data quality issue** requests. **You review and approve every finding before
anything is submitted**, and `submit` is a dry run unless you pass `--live`.

```
scan  ──►  research  ──►  review / approve  ──►  submit (--live)
offline     Claude +       you decide           Playwright fills the
checks      web search                          portal form (or JSM API)
```

## Setup (once)

```bash
cd sf-cleanup
npm install
npx playwright install chromium          # browser for the portal submitter
cp sf-cleanup.config.example.json sf-cleanup.config.json
```

Edit `sf-cleanup.config.json`:

- `portal.createUrl` — open the "Data quality issue" form in your browser (the page in your
  screenshot) and paste its URL. It should look like
  `https://<site>.atlassian.net/servicedesk/customer/portal/<n>/group/<n>/create/<n>`.
- Everything else can stay at the defaults for a first run.

For the `research` step you need an Anthropic API key: `export ANTHROPIC_API_KEY=...`
(or log in with the `ant` CLI). `scan`, `review`, `approve`, and `submit` don't use the API.

## 1. Get your accounts in

**Option A — CSV export (no API access needed).** In Salesforce, build a report or list view
of your accounts and export it as CSV. Include at least these columns:
`Account ID` (the 18-character ID — required for Merge/Delete requests), `Account Name`,
`Website`, `Phone`, `Billing Street`, `Billing City`, `Billing Zip/Postal Code`, `Billing Country`,
`Industry`, `Type`, `Parent Account`, `Last Activity`, `Last Modified Date`. Extra columns are
kept but ignored; checks for columns that aren't in the export are skipped. Report footers are skipped.

```bash
node src/cli.mjs scan --csv ~/Downloads/my-accounts.csv
```

**Option B — Salesforce API.** Install the Salesforce CLI, run `sf org login web --alias work`,
then:

```bash
node src/cli.mjs scan --sf-org work
# custom query (":me" = your user id):
node src/cli.mjs scan --sf-org work --soql "SELECT Id, Name, Website, Industry, BillingCountry, ... FROM Account WHERE OwnerId = :me"
```

Or set `SF_INSTANCE_URL` and `SF_ACCESS_TOKEN` directly.

### What `scan` checks (offline, free)

| kind               | signal                                                                 | proposal          |
|--------------------|------------------------------------------------------------------------|-------------------|
| `duplicate`        | same name after stripping Inc/Ltd/GmbH/… and punctuation; or same website domain / phone / street address **and** overlapping names. A second matcher agreeing raises confidence. | **Merge** (picks the richer / more recently active record as master) |
| `same_domain` / `same_phone` / `same_address` | same domain, phone, or address but unrelated names — often a subsidiary, shared switchboard, or office tower | Merge proposal at low confidence; review carefully |
| `suspicious_name`  | "test", "do not use", "duplicate", "old", ALL CAPS, stray spaces        | Mass Update row   |
| `missing_field`    | missing website / industry / billing country (configurable)             | Mass Update row   |
| `bad_website`      | website value isn't a URL                                               | Mass Update row   |
| `website_dead`     | domain doesn't resolve, 404/5xx, or a domain-parking page              | feeds `research`  |
| `website_redirects`| website redirects to a *different* company's domain (acquisition hint)  | feeds `research`  |
| `stale`            | no activity for `rules.staleDays` (default 540)                         | informational     |

Use `--no-web` to skip the website probes.

## 2. Research acquisitions / closures (Claude + web search)

```bash
node src/cli.mjs research --flagged      # only accounts with dead/redirecting sites, stale, odd names
node src/cli.mjs research --all          # every account
node src/cli.mjs research --ids 001...,001...
node src/cli.mjs research --all --limit 20   # try a small batch first
```

For each account Claude runs up to `research.maxWebSearches` web searches and classifies the
company as `active | acquired | merged | renamed | defunct | unknown` with a confidence score and
source URLs. Results are cached in `work/research-cache.json`, so re-running is free
(`--force` to refresh). Findings map to portal requests:

- **acquired / merged**, acquirer already in your list → **Merge** into the acquirer's account
- **acquired / merged**, acquirer not in your list, or **renamed** → **Legal Entity Name Change**
- **defunct** → **Delete**

Cost: roughly one model call plus a handful of web searches per account. I am not certain of the
exact per-account cost; check your usage after a `--limit 20` run before researching a large list.
The model defaults to `claude-opus-5`; change `research.model` in the config if you prefer another.

## 3. Review and approve

```bash
node src/cli.mjs review                          # everything, highest severity first
node src/cli.mjs review --severity high          # only high
node src/cli.mjs review --kind duplicate,acquired
node src/cli.mjs review --csv work/review.csv    # open in Excel / Sheets

node src/cli.mjs approve F-0001 F-0007 F-0012
node src/cli.mjs approve --all --severity high --min-confidence 0.75
node src/cli.mjs reject  F-0002
```

Decisions live in `work/findings.json` and survive re-scans. Nothing is submitted until a finding
is `approved`. For a duplicate, double-check the proposed master: the tool prefers the record with
more fields filled and more recent activity, but it can't see opportunities or contacts.

## 4. Submit

**Portal (matches your screenshots).** One-time SSO login, then dry-run, then live:

```bash
node src/cli.mjs login          # opens the portal; sign in; profile is saved in .pw-profile/
node src/cli.mjs form-check     # prints the real field labels for Merge / Delete / Legal Entity Name Change
node src/cli.mjs submit         # DRY RUN: fills each form, saves work/screenshots/F-xxxx-dryrun.png, never presses Send
node src/cli.mjs submit --live  # presses Send; ticket key + URL saved on the finding
node src/cli.mjs submit --live F-0001      # just one
node src/cli.mjs submit --live --limit 5   # first five approved
```

Only the **Merge** form's fields were visible in the screenshots. The **Delete** and
**Legal Entity Name Change** field labels in the config are guesses — run `form-check` once and
correct `form.requestTypes.*.fields` (proposal key → label the portal shows) before submitting
those types. Every ticket is saved to `work/findings.json` immediately after it's created, so an
interrupted run never double-submits.

**Field corrections (Mass Update).** Missing/incorrect field findings don't go through single
requests. Instead:

```bash
node src/cli.mjs mass-update      # writes work/mass-update.csv for all approved field findings
```

Fill in the corrected values, then raise **one** request with Action = *Mass Update* and attach
the CSV. (I couldn't see that form's fields, so this step is manual.)

**JSM REST API (optional).** If you'd rather not drive a browser: create an Atlassian API token,
set `JSM_EMAIL` / `JSM_API_TOKEN`, then run `node src/cli.mjs jsm-fields` three times (it walks
service desk → request type → fields) and fill `jsm.*` in the config. Then `submit --via api`.
The endpoints used are listed at the top of `src/submit-jsm.mjs`; verify them against Atlassian's
current Service Desk REST docs and confirm your admin allows API tokens with SSO.

## Files

```
src/cli.mjs            commands
src/accounts.mjs       CSV / Salesforce REST loaders
src/rules.mjs          offline checks + proposal builders
src/research.mjs       Claude + web search classification
src/findings.mjs       finding model, merge/persist
src/submit-portal.mjs  Playwright portal submitter (+ login, form-check)
src/submit-jsm.mjs     JSM REST submitter (+ jsm-fields)
samples/accounts.sample.csv   tiny fixture used by the tests
work/                  (git-ignored) accounts.json, findings.json, research-cache.json, screenshots/
```

`npm test` runs the unit tests (CSV parsing, normalization, duplicate detection, research → proposal mapping).

## Caveats

- Name normalization and the "registrable domain" logic are heuristics, not a full
  public-suffix list; expect a few false duplicate pairs (that's what review is for).
- Website probes run from your machine; corporate proxies can make live sites look dead.
- The portal submitter was tested against a mock of the form, not the real UiPath portal.
  If a selector misses, the dry run fails loudly and takes a screenshot — adjust the helpers at
  the top of `src/submit-portal.mjs`.
- Research results are only as good as what's public on the web. Treat `confidence` below ~0.7
  as "worth a look", not a fact.
