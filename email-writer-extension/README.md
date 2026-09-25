# Triple Touch Email Writer (Chrome extension)

A side-panel Chrome extension that writes the **subject line and body for each email step** of a Triple Touch outbound sequence. It follows 30 Minutes to President's Club (30MPC) and Ian Koniak's *Untap Your Sales Potential* (UYSP). On Triple Touch steps it also writes the matching voicemail, so the voicemail names the email's subject line. It calls Claude with your own Anthropic API key.

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
| 21 | Breakup | new | Permission to close the loop |
| any | Exec reverse-selling email | new | Bottom-up insight from colleague intel, ≤50 words |

Calls, LinkedIn touches and call scripts aren't generated. The tool writes emails, plus voicemails on Triple Touch steps.

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
4. Copy, or use **Insert into page**. Insert is best-effort and may not work in every email tool, so always review before sending.

Each draft is added to **Earlier emails** and the step moves forward, so later touches change the angle. **Start a new prospect** clears the form.
