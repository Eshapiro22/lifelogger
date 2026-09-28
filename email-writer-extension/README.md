# Triple Touch Email Writer (Chrome extension)

A side-panel Chrome extension that writes the **subject line and body for each email step** of a Triple Touch outbound sequence, or a **full plan** for one contact: call opener, discovery questions, voicemails, emails, LinkedIn copy and objection responses. It follows 30 Minutes to President's Club (30MPC) and Ian Koniak's *Untap Your Sales Potential* (UYSP). On Triple Touch steps the email follows what happened on the call (voicemail left, power-dialer call with no voicemail, or no call), and a voicemail script is ready in case you leave one. When no approved proof fits, Claude looks up a real, public customer story that matches the prospect and links the source. It runs through your normal Claude login in a browser tab (no API key), or through an Anthropic API key if you prefer.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this `email-writer-extension/` folder.
3. Click the extension icon to open the side panel, then open **Settings**:
   - pick the **engine** (see below). The default needs no API key.
   - paste your **playbook** (persona tracks, pains, proof, rules). It goes to the model as system context on every email and overrides the built-in defaults.
   - add one entry per sequence you run: persona track, Pain A, Pain B, what you do about it, approved proof points, and an optional mid-sequence asset

## Engines: with or without an API key

**Claude tab (default, no API key).** Clicking **Write email in Claude** builds the full prompt (rules, playbook, step, prospect), opens Claude in a new tab and pastes the prompt into the message box. It does not send it.
1. Press **Enter** in the Claude tab.
2. When Claude finishes, click **Get reply from Claude tab** in the side panel. The draft loads with the playbook checks and Insert, just like the API path.
3. If Claude replied in the wrong format or you tweaked the reply, copy it and use **Load pasted reply** instead.

If the automatic paste fails (for example, you're on a login page), the prompt is already on your clipboard: paste it with Ctrl/Cmd+V and send.

**Tip: use a Claude Project.** Create a Project, put your playbook in its instructions, set **Claude URL** in Settings to the Project's link, and untick **Include my playbook in each prompt**. The prompts get much shorter.

**Anthropic API key.** Runs inside the panel with no extra tab. You pay per use on your API account.

Your API key and playbook are stored only in this browser (`chrome.storage.local`). They are never committed to this repo.

## Email steps (`methodology.js`)

| Day | Step | Thread | Angle |
|---|---|---|---|
| 1 | Triple Touch #1 email (+ voicemail script) | new | Problem proposition, Pain A |
| 3 | Email #2 | reply | New angle: Pain B or a customer story |
| 7 | Triple Touch #2 email (+ voicemail script) | new | Trigger / insight, one optional asset |
| 10 | Email #4 | new | Peer proof as a short story |
| 14 | Triple Touch #3 email (+ voicemail script) | new | "Wrong person?" referral ask |
| 21 | Breakup | reply (Day 14 thread) | Permission to close the loop |
| any | Exec reverse-selling email | new | Bottom-up insight from colleague intel, ≤50 words |

**Call outcome** (Triple Touch steps): *Called, no voicemail* (default, for power dialers) opens with "Tried you by phone just now." and never mentions a voicemail. *Called and left a voicemail* opens with "Just left you a voicemail." and the voicemail names the subject. *No call* writes a plain cold email. The playbook check flags an email that mentions a voicemail you didn't leave.

**Real customer proof.** With **Find a real customer story** on (Settings), Claude uses an approved proof point when one fits; otherwise it looks up a public customer story that matches the prospect's industry or persona, uses only facts from that source, and returns the URL (shown under the draft as **Proof source**). With no verified match, it leaves `{customer proof}` and flags it. In a Claude tab this needs **web search turned on in Claude**; with the API engine it uses Claude's web search tool.

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

### Your task list: write everyone due at once

On your Outreach home or task list, click **Write for this Outreach task** (or **Import from Outreach task**). It finds every prospect row on the page (name, title, account, "Step #N of <sequence>") and lists them under **Prospects on this Outreach page**:
- **Use this prospect** loads one person into the form, clearing the previous prospect.
- **Write all** has one Claude chat write the email for everyone, with a different pain and customer story per person at the same account. The drafts appear under **Drafts for this account**.

Then open each person's task and click **Write for this Outreach task**: it drops in the draft already written for that person, without opening Claude again.

**Step map (Settings → Sequences).** Outreach numbers every step (calls, LinkedIn, emails), so tell the extension which Outreach step is which email, e.g. `1:tt1, 3:e2, 6:tt2, 8:e4, 10:tt3, 12:breakup`. Step 1 defaults to the Day 1 email. Set **Outreach sequence name** (e.g. "30MPC Sequence") so the right sequence is picked automatically.

### One click: Write for this Outreach task

Open the prospect's email task in Outreach and click **Write for this Outreach task** at the top of the panel:

1. **Import.** It reads the task and fills in the prospect's name, title, company and email, the step, and the email already in the task. It uses labels, `mailto:` links, "Name <email>" lines and "Day N" text. The raw page text goes to Claude too, so it can fill gaps and see earlier emails sent.
2. **Write.** It opens Claude, pastes the prompt and sends it. The prompt asks Claude to rewrite the task's existing email to the playbook. Turn off **Send the prompt automatically** in Settings if you'd rather press Enter yourself. With the API engine, this step runs inside the panel instead.
3. **Paste back.** When Claude finishes, it switches back to the Outreach tab and puts the subject and body into the task. Reply steps keep the existing subject. **It never clicks Send in Outreach.** Review, then send yourself.

**Import from Outreach task** (in the Prospect section) does only step 1, so you can check or edit the fields before writing. Everything it finds is shown under **From Outreach**.

Outreach's page layout isn't documented and can change. The import reads the links Outreach puts on every task row (prospect, account, sequence step) and falls back to labels and text. Check the **Detected** line, especially the step.

### Manual insert

1. Open the email step (sequence step template or one-off email) in Outreach and **click into the email body**.
2. Click **Insert into page** in the side panel. It writes the subject into the Subject field (not for reply steps, which keep the existing thread) and replaces the body in the editor you clicked. The editor can be inside an iframe. The insert tries a paste first, which editors handle natively, then falls back to direct insertion.
3. Review it in Outreach before saving or sending.

If you're writing a reusable sequence template, enter an Outreach variable such as `{{first_name}}` as the prospect's first name. Variables in double braces are left untouched. Check the exact variable names in your Outreach instance.

**Grab selection / page text** works on an Outreach prospect page too. Select the part you want (their title, notes, recent activity) before clicking.
