# CLAUDE.md — STR Deal Analyzer

This file is loaded every session. It defines the **orchestration contract** for a
short-term-rental (STR) acquisition analyzer built entirely from native Claude Code
primitives: subagents (`.claude/agents/*.md`), skills (`.claude/skills/*/SKILL.md`),
and this file. There is **no application code** — the pipeline runs by launching
subagents with the Task tool and passing state through files on disk.

## Non-negotiable orchestration rule

**When given a property address, you MUST invoke the `orchestrator` subagent via the
Task tool.** You never perform deal analysis yourself in the main context. You never
call specialist subagents (`market-intel`, `public-record`, `underwriting`,
`physical-condition`, `legal-risk`, `str-revenue`) directly from the main session.

If you are about to research a property in the main context — a web search, a comp
lookup, a permit check, anything — **stop and launch the `orchestrator` instead.**

The `orchestrator` is a real subagent (invoked via Task), not a main-session persona.
It in turn launches the 6 specialists in parallel via the Task tool (nested subagents
are supported), waits for all workpaper files to appear on disk, then runs
`underwriting` on the collected data and writes `decision.md`. The main session's only
job for a deal is: read/confirm `config/deal.json`, launch the orchestrator, and relay
its final verdict.

## What this analyzes

Single-family and small-multi (1–4 unit) properties acquired to operate as
**short-term rentals** (Airbnb/VRBO-style). This is NOT a multifamily underwriter:
revenue is modeled as ADR × occupancy × seasonality (RevPAR), not a rent roll;
the #1 risk is **STR regulation/permitting**, not agency-debt sizing.

## The orchestration contract (read this before doing anything)

### 1. State lives in files, never in return strings

Context compaction can drop any subagent's return message. Therefore:

- **Every specialist writes its full analysis to
  `./analysis/<deal-id>/<agent>-workpaper.md` BEFORE it returns.**
- A specialist's return string is only a 3–5 line status receipt (see below). It is
  **not** the deliverable and must never be the sole copy of any finding.
- **The orchestrator reads the workpaper files, not the return strings.** If a
  workpaper file is missing or empty, the agent failed — re-launch it; do not try to
  reconstruct findings from the return message.

### 2. Standard specialist return receipt (all specialists)

```
STATUS: COMPLETE | PARTIAL | FAILED
WORKPAPER: ./analysis/<deal-id>/<agent>-workpaper.md
CONFIDENCE: HIGH | MEDIUM | LOW
DEALBREAKERS: <count> (<one-line list or "none">)
HEADLINE: <one sentence>
```

### 3. Deal identity

- The deal config is `./config/deal.json` (copy `./config/deal.example.json` to start).
- `<deal-id>` is `deal.dealId`. All outputs for a deal live under
  `./analysis/<deal-id>/`. The orchestrator creates this directory before launching
  any specialist.

## Pipeline (orchestrator runs this)

The orchestrator is a **subagent invoked via the Task tool** (see
`.claude/agents/orchestrator.md` for its full playbook). It launches the 6 specialists
via the Task tool — nested subagents are supported (depth stays well under the 5-level
limit: main → orchestrator → specialists). Specialists **do not launch other
specialists** — only the orchestrator fans out.

Dependency order (STR-specific — regulation gates everything, revenue drives underwriting):

```
Wave 1 (parallel, no dependencies):
  legal-risk        -> can KILL the deal (STR banned / no permit path)
  public-record     -> title, ownership, taxes, permit history
  market-intel      -> demand drivers, seasonality, tourism, saturation
  physical-condition -> condition, furnishing CapEx, readiness-to-list

Wave 2 (needs Wave 1 outputs):
  str-revenue       -> AirDNA-style comp set; needs market-intel + legal-risk
                       (a permit cap or night limit changes the revenue ceiling)

Wave 3 (needs revenue + costs):
  underwriting      -> pro forma, DSCR, cash-on-cash; needs str-revenue,
                       physical-condition, public-record (taxes)

Final:
  orchestrator      -> reads all 6 workpapers, applies go/no-go, writes
                       ./analysis/<deal-id>/decision.md
```

**Early kill:** if `legal-risk` reports a hard dealbreaker (STR prohibited, or
primary-residence-only with no investment path), the orchestrator may stop the
pipeline and write `decision.md` with a NO-GO verdict — but it still records which
downstream agents were skipped.

## Roles

| Agent | Role | Tools |
|-------|------|-------|
| `orchestrator` | Fan-out, read workpapers, synthesize go/no-go | Task, Read, Write, TodoWrite, Bash |
| `market-intel` | Demand drivers, tourism, seasonality, saturation | Read, Write, WebSearch, WebFetch |
| `public-record` | Title, ownership, tax basis, permit history | Read, Write, WebSearch, WebFetch |
| `str-revenue` | AirDNA-style comp set → ADR/occupancy/RevPAR | Read, Write, WebSearch, WebFetch |
| `physical-condition` | Condition, deferred maintenance, furnishing CapEx | Read, Write, WebSearch, WebFetch |
| `legal-risk` | STR ordinance/permit, zoning, HOA, insurance, PSA | Read, Write, WebSearch, WebFetch |
| `underwriting` | Pro forma, DSCR, cash-on-cash, scenarios, verdict inputs | Read, Write, Bash |

## Shared skills (`.claude/skills/`)

- **str-underwriting-calc** — every STR formula (RevPAR, ADR, occupancy, GOP, NOI,
  cap rate, DSCR, cash-on-cash, break-even, furnishing CapEx). Mandatory for
  `underwriting`; reference for `str-revenue`.
- **str-risk-scoring** — 9 STR risk categories (Regulatory is #1), scoring rubric,
  dealbreaker checklist, strategy thresholds. Every specialist scores its own
  category; orchestrator aggregates.
- **str-revenue-benchmarks** — AirDNA-style comp methodology, occupancy/ADR tiers,
  seasonality indices, market-saturation signals. Mandatory for `str-revenue`.
- **workpaper-protocol** — the file-first contract: paths, workpaper structure,
  resume rules, return receipt. Every agent reads this on startup.
- **self-review-protocol** — the 6-point checklist every specialist runs before it
  writes its final workpaper and returns.

## Conventions

- **Write the workpaper before returning. Always.** A specialist that returns without
  having written `./analysis/<deal-id>/<agent>-workpaper.md` has failed its contract.
- **Never hand-edit another agent's workpaper.** Each agent owns exactly one file.
- **Cite sources.** STR regulation and comp data are time-sensitive — every external
  claim in a workpaper carries a source and an access date.
- **Flag, don't guess.** Missing data becomes an `uncertainty_flag` with reduced
  confidence, per `workpaper-protocol`. An invented number is worse than a gap.
- **Money is USD.** Dates are ISO-8601.
