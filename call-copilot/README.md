# Call Copilot

A Chrome side-panel extension that sits next to Nooks while you power dial. When someone picks up, find them in the panel and read a call track built from the Outbound Prospecting Playbook (30MPC + Untap Your Sales Potential).

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this `call-copilot/` folder.
3. Pin the extension and click its icon. The panel opens beside Nooks.

Some company-managed laptops block unpacked extensions. If so, IT would need to allow it.

## Daily use

1. **⚙ Settings → Import** a CSV exported from your Outreach sequence. Headers are matched loosely (First Name, Title, Company, Phone, and so on); the import note shows what was mapped. Optional columns: `Trigger`, `Last Touch` (email subject / LinkedIn topic), `Proof`, `Persona` (`cio`, `finops`, `coe`, `qa`, `bizline`). See `sample-prospects.csv`.
2. Lines **1–5** match Nooks' parallel lines. When someone connects, type their name, company, or the last digits of their phone number and press Enter.
3. Read the track: **opener → problem proposition → discovery → meeting ask**. Objections open with one click.
4. Log the outcome. The scoreboard tracks hang-up rate and "got 30s+" rate for each opener.

| Key | Action |
|---|---|
| H / G / C / M / X | Hung up / Got 30s / Conversation / Meeting / Opt-out |
| N | Next opener |
| P | Swap to the next pair of pains |
| 1–5 | Switch line |
| / | Focus search |

## Opener rotation

Settings → Rotation:
- **Auto** (default): switches to the next opener after N hang-ups in a row (default 3).
- **Round-robin**: a different opener every call, so you get clean A/B data.
- **Manual**: you choose.

The "Email / LinkedIn tie-back" opener is skipped for prospects with no last touch.

## Editing the content

Everything you say lives in `playbook.js`: personas, pains (write them in the buyer's words), discovery questions, openers, and objections. Anything missing, such as an approved customer proof point, shows as an amber `{placeholder}` rather than being made up. Reload the extension after editing.

## Data

Everything is stored locally in the browser (`chrome.storage.local`). Nothing is sent anywhere. Export the call log as CSV from Settings.
