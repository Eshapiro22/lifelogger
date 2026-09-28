# STR Deal Analyzer

A short-term-rental (STR) acquisition analyzer for single-family and small-multi (1–4
unit) properties, built entirely from **native Claude Code primitives** — subagents,
skills, and `CLAUDE.md`. There is no application code and no external API keys: every
data point is gathered from public web sources at analysis time.

It adapts the *architecture* of a multi-agent CRE due-diligence system (19-section
agent anatomy, phase orchestration, checkpointing) but re-scopes the *domain* from
multifamily to STR: revenue is modeled as ADR × occupancy × seasonality (RevPAR), not a
rent roll, and the #1 risk is **STR regulation/permitting**, not agency-debt sizing.

## How it works

```
CLAUDE.md ............. the orchestration contract, loaded every session
.claude/agents/*.md ... 7 subagents (orchestrator + 6 specialists), each with the
                        full 19-section anatomy incl. Dealbreaker Detection,
                        Confidence Scoring, and Self-Review
.claude/skills/*/ ..... shared domain knowledge (STR underwriting math, risk scoring,
                        AirDNA-style comp method, the file-first workpaper protocol,
                        and the self-review checklist)
config/deal.json ...... deal inputs (copy from deal.example.json)
analysis/<deal-id>/ ... generated: one workpaper per specialist + decision.md
```

### The file-first rule (why nothing is lost to compaction)

Every specialist writes its complete analysis to
`./analysis/<deal-id>/<agent>-workpaper.md` **before it returns**. Its return string is
a 3–5 line receipt, never the deliverable. The **orchestrator reads the workpaper
files, not the return strings** — so if context is compacted mid-run, the analysis
still exists on disk and the pipeline can resume.

### Pipeline (orchestrator fans out; specialists never call specialists)

```
Wave 1 (parallel): legal-risk · public-record · market-intel · physical-condition
Wave 2:            str-revenue      (needs market-intel + legal-risk)
Wave 3:            underwriting     (needs str-revenue + physical-condition + public-record)
Final:             orchestrator     -> ./analysis/<deal-id>/decision.md
```

`legal-risk` can early-kill the deal (STR prohibited / HOA ban / primary-residence-only
/ no permit path).

## Run it

1. `cp config/deal.example.json config/deal.json` and edit the property details.
2. Open this folder in Claude Code and ask: **"Analyze the STR deal in config/deal.json."**
3. The orchestrator creates `analysis/<deal-id>/`, fans out the specialists, and writes
   `decision.md` with a GO / CONDITIONAL / NO-GO verdict, a 9-category risk scorecard,
   the key STR metrics (ADR, occupancy, RevPAR, DSCR, cash-on-cash, break-even), and any
   dealbreakers.

## Agents

| Agent | Owns risk category | Writes |
|-------|--------------------|--------|
| orchestrator | (aggregates all 9) | `decision.md`, `_pipeline.md` |
| legal-risk | Regulatory & Permitting (1), Insurance (7) | `legal-risk-workpaper.md` |
| str-revenue | Revenue & Demand (2) | `str-revenue-workpaper.md` |
| underwriting | Financial (3), Operational (8) | `underwriting-workpaper.md` |
| physical-condition | Physical & Readiness (4) | `physical-condition-workpaper.md` |
| market-intel | Market & Location (5) | `market-intel-workpaper.md` |
| public-record | Title & Ownership (6), Environmental (9) | `public-record-workpaper.md` |

## Skills

- **str-underwriting-calc** — every STR formula (RevPAR, GOP/NOI, DSCR, cash-on-cash,
  break-even, furnishing CapEx).
- **str-risk-scoring** — 9 STR categories (Regulatory is #1), rubric, dealbreakers,
  strategy thresholds.
- **str-revenue-benchmarks** — AirDNA-style comp methodology and reference tiers.
- **workpaper-protocol** — the file-first state contract.
- **self-review-protocol** — the 6-point pre-write checklist.
