---
name: workpaper-protocol
description: The file-first state contract for the STR deal pipeline. Read on every agent startup. Defines where workpapers live, their required structure, the standard return receipt, and how to resume after interruption or context compaction. Use whenever an agent needs to write output or the orchestrator needs to read it.
---

# Workpaper Protocol

## Core principle

**If you cannot afford to lose it, write it to a file before you return.** Context
compaction can drop any subagent's return message at any time. The workpaper on disk
is the single source of truth. Return strings are disposable receipts.

This is the STR-project adaptation of a checkpoint protocol: instead of a machine JSON
checkpoint tree, each agent owns exactly one human-readable **workpaper** markdown file
and writes it atomically before returning.

## Canonical paths

| Path | Owner | Purpose |
|------|-------|---------|
| `./config/deal.json` | human | Deal inputs (source of truth) |
| `./analysis/<deal-id>/<agent>-workpaper.md` | that agent | The agent's full analysis |
| `./analysis/<deal-id>/decision.md` | orchestrator | Final go/no-go |
| `./analysis/<deal-id>/_pipeline.md` | orchestrator | Live run state (which agents done) |

`<deal-id>` = `deal.dealId` from `config/deal.json`. `<agent>` = the agent's `name`
(e.g. `market-intel-workpaper.md`).

## Every agent, on startup

1. Read `.claude/skills/workpaper-protocol/SKILL.md` (this file).
2. Read `./config/deal.json` → extract `dealId` and the fields you need.
3. Check whether your workpaper already exists:
   - **Exists and its front-matter `status: COMPLETE`** → your work is already done.
     Return the receipt pointing at it. Do not redo the work.
   - **Exists and `status: PARTIAL`** → resume: read what you already wrote, keep the
     completed sections, continue from the first unfinished step.
   - **Does not exist** → fresh start.

## Workpaper structure (every specialist)

Each workpaper is a markdown file that begins with a YAML front-matter block, then the
19-section analysis body (see each agent's own definition), then a machine-readable
JSON block the orchestrator can parse.

```markdown
---
agent: market-intel
deal_id: STR-2026-001
status: COMPLETE            # COMPLETE | PARTIAL | FAILED
confidence: HIGH            # HIGH | MEDIUM | LOW
risk_category_score: 34     # this agent's 0-100 score for its risk-scoring category
dealbreakers: 0
updated: 2026-07-14T18:30:00Z
sources_count: 6
---

# <Agent> Workpaper — <deal-id>

## Summary
<3-5 sentence headline a human can act on>

## Findings
<the agent's analysis, following its 19-section anatomy>

...

## Machine Summary
```json
{ "agent": "...", "dealId": "...", "status": "...", "confidence": "...",
  "dealbreakers": [], "keyMetrics": { }, "uncertaintyFlags": [],
  "dataForDownstream": { } }
```
```

The `dataForDownstream` object is this agent's **Downstream Data Contract** (section 17
of its anatomy) — the exact keys other agents read. Changing those keys is a breaking
change.

## Writing order (do NOT skip)

1. Do the analysis.
2. Run the 6-point **self-review-protocol** checklist.
3. Write the complete workpaper file with `status: COMPLETE` (or `PARTIAL`/`FAILED`).
4. **Only then** return the receipt.

If you return before writing the file, you have failed the contract and the
orchestrator will treat the run as failed.

## Standard return receipt

```
STATUS: COMPLETE | PARTIAL | FAILED
WORKPAPER: ./analysis/<deal-id>/<agent>-workpaper.md
CONFIDENCE: HIGH | MEDIUM | LOW
DEALBREAKERS: <count> (<one-line list or "none">)
HEADLINE: <one sentence>
```

## Partial / failure handling

- **PARTIAL**: you completed some steps but hit a blocking data gap. Write everything
  you have, mark unfinished sections with `> TODO: <what's missing>`, set
  `status: PARTIAL`, log the gap in `uncertaintyFlags`, and return `STATUS: PARTIAL`.
- **FAILED**: you could not produce usable output. Still write a workpaper with
  `status: FAILED` and a `## Why this failed` section so the orchestrator (and a human)
  can see what happened. Never return FAILED with no file.

## Orchestrator read pattern

- Read each `./analysis/<deal-id>/<agent>-workpaper.md`, parse its front-matter and the
  `## Machine Summary` JSON block.
- **Trust the file, not the receipt.** If the receipt says COMPLETE but the file is
  missing/empty/`FAILED`, the agent failed — re-launch it.
- Never reconstruct a specialist's findings from its return string.
