# 30MPC Email Writer (Chrome extension)

A side-panel Chrome extension that writes the **subject line and body for each email step** of an outbound sequence, following 30 Minutes to President's Club (30MPC) cold-email principles. It calls Claude using your own Anthropic API key.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this `email-writer-extension/` folder.
3. Click the extension icon to open the side panel, then open **Settings**:
   - paste your Anthropic API key (stored only in this browser via `chrome.storage.local`)
   - add one entry per sequence you run: persona, problem #1, problem #2, how you solve it, proof points, CTA style
   - check or replace the **Triple T** definition (see note below)

## Using it

1. Pick the **sequence** and **step** (Email 1–7).
2. Fill in the prospect and a **research trigger**. **Grab selection / page text** pulls text from the current tab (e.g. a LinkedIn profile or a CRM record).
3. Check **Triple T** if the email goes out right after a call and voicemail.
4. Click **Write email**. The draft shows a **30MPC check** (length, lowercase subject, reply-vs-new-thread, banned phrases).
5. **Copy** the subject and body, or use **Insert into page**. Insert is best-effort: it looks for a visible "subject" input and the focused rich-text editor, so it may not work in every tool. Always review before sending.

After each email the step moves forward and the draft is added to **Earlier emails**, so bumps don't repeat earlier wording.

## Sequence map (`methodology.js`)

| Step | Phase | Subject | What it does |
|---|---|---|---|
| 1 | Opening touches | new | Trigger → problem #1 → notice line → interest CTA → optional P.S., under 100 words |
| 2 | Opening touches | reply | 1–2 sentence bump |
| 3 | Opening touches | reply | 1–2 sentence bump, new angle |
| 4 | Switch the problem | new | Same structure, problem #2 |
| 5 | Switch the problem | reply | Bump on the problem #2 thread |
| 6 | Breakup | new | "Are you the right person?" |
| 7 | Breakup | new | Professional break-up (not cheeky) |

Calls and LinkedIn touches between these emails aren't generated. This tool writes emails only.

## Notes and limits

- **Triple T:** I couldn't verify 30MPC's exact definition. The default treats it as the "triple" touch: call, then voicemail, then email within about 90 seconds. Edit it in Settings to match your course material.
- The methodology is summarized from public 30MPC posts and newsletter excerpts, not from the paid course.
- The model is told to use only the facts you provide. Still check every draft for accuracy before sending.
