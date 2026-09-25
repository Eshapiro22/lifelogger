# Triple Touch Email Writer (Chrome extension)

A side-panel Chrome extension that writes the **subject line and body for each email step** of a Triple Touch outbound sequence, or a **full plan** for one contact: call opener, discovery questions, voicemails, emails, LinkedIn copy and objection responses. It follows 30 Minutes to President's Club (30MPC) and Ian Koniak's *Untap Your Sales Potential* (UYSP). On Triple Touch steps it also writes the matching voicemail, so the voicemail names the email's subject line. It calls Claude with your own Anthropic API key.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this `email-writer-extension/` folder.
3. Click the extension icon to open the side panel, then open **Settings**:
   - paste your Anthropic API key
   - paste your **playbook** (persona tracks, pains, proof, rules). It goes to the model as system context on every email and overrides the built-in defaults.
   - add one entry per sequence you run: persona track, Pain A, Pain B, what you do about it, approved proof points, and an optional mid-sequence asset

Your API key and playbook are stored only in this browser (`chrome.storage.local`). They are never committed to this repo.

## Email steps (`methodology.js`)

| Day | Step | Thread | Angle |
|---|---|---|---|
| 1 | Triple Touch #1 email + voicemail | new | Problem proposition, Pain A |
| 3 | Email #2 | reply | New angle: Pain B or a customer story |
| 7 | Triple Touch #2 email + voicemail | new | Trigger / insight, one optional asset |
| 10 | Email #4 | new | Peer proof as a short story |
| 14 | Triple Touch #3 email + voicemail | new | "Wrong person?" referral ask |
| 21 | Breakup | reply (Day 14 thread) | Permission to close the loop |
| any | Exec reverse-selling email | new | Bottom-up insight from colleague intel, ≤50 words |

## Full Triple Touch plan mode

Switch **Mode** to *Full Triple Touch plan* to get the playbook's Section 10 output for one contact:
- research summary
- Triple Touch #1: call opener with problem proposition, 3 discovery questions, voicemail, email, LinkedIn note
- every touch from Day 1 to Day 21 (calls, voicemails, emails, LinkedIn)
- the top 3 objections for the persona, with responses
- flags for placeholders that need real data

Each email in the plan gets the same playbook checks plus Copy and Insert buttons. **Copy plan as Markdown** exports the whole plan.

## Using it

1. Pick the sequence and step, then fill in the prospect: title, industry, relationship and triggers. Add colleague intel for snowball or reverse-selling emails. **Grab selection / page text** pulls text from the current tab.
2. A title with "Chief" or a C-level acronym (CFO, CIO, etc.) checks **Executive**, which sets a 50-word limit.
3. Click **Write email**. You get the angle chosen, subject, body, voicemail (Triple Touch steps), flags for placeholders that need real data, and a **Playbook check**:
   - word limit (90, or 50 for executives)
   - subject is 1–4 words with a lowercase feel
   - new thread vs. reply
   - opens with the prospect's world, not your company
   - banned phrases ("just following up", "leverage", "I'd love to"…)
   - you/your count vs. I/we count
   - one ask, and at most one asset (none on early touches)
   - the email mentions the voicemail, and the voicemail is ≤25 seconds and names the subject
   - `{placeholders}` that still need data (`{{merge_fields}}` are left alone)
4. Copy, or use **Insert into page**.

Each draft is added to **Earlier emails** and the step moves forward, so later touches change the angle. **Start a new prospect** clears the form.

## Using it with Outreach

The extension has permission to read and write on `*.outreach.io`, so it keeps working as you move between Outreach pages.

1. Open the email step (sequence step template or one-off email) in Outreach and **click into the email body**.
2. Click **Insert into page** in the side panel. It writes the subject into the Subject field (not for reply steps, which keep the existing thread) and replaces the body in the editor you clicked. The editor can be inside an iframe. The insert tries a paste first, which editors handle natively, then falls back to direct insertion.
3. Review it in Outreach before saving or sending.

If you're writing a reusable sequence template, enter an Outreach variable such as `{{first_name}}` as the prospect's first name. Variables in double braces are left untouched. Check the exact variable names in your Outreach instance.

**Grab selection / page text** works on an Outreach prospect page too. Select the part you want (their title, notes, recent activity) before clicking.
