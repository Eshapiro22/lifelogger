---
name: self-review-protocol
description: The 6-point self-review checklist every STR specialist runs BEFORE writing its final workpaper and returning. Use to catch schema gaps, impossible numbers, cross-reference mismatches, and unflagged assumptions before they propagate downstream.
---

# Self-Review Protocol

Run all 6 checks before writing your final workpaper (`status: COMPLETE`). If any
MUST-FIX check fails, fix it and re-run (max 2 passes). Record the result as a
`## Self-Review` block in your workpaper.

## The 6 checks

### 1. Schema Compliance (MUST-FIX)
Every field your **Output Format** (anatomy §6) and **Downstream Data Contract**
(anatomy §17) promise is present, non-null, and correctly typed in your
`## Machine Summary` JSON. No downstream agent should read an `undefined`.

### 2. Numeric Sanity (MUST-FIX)
Every number is within a plausible bound:
- Occupancy 0–100%. ADR > $0 and < ~$3,000/night for a normal SFR/small-multi.
- RevPAR = ADR × Occupancy (recompute and confirm).
- OpEx ratio for STR typically 35–55% of gross revenue; flag if <25% or >70%.
- DSCR ≥ 0 (negative is impossible; a value <1.0 is a finding, not an error).
- No percentage > 100% unless explicitly a growth/premium figure.

### 3. Cross-Reference Validation (MUST-FIX)
Property address, `dealId`, unit/bedroom count, and purchase price in your workpaper
match `config/deal.json`. If you consumed another agent's `dataForDownstream`, the
values you used match that agent's workpaper.

### 4. Threshold Comparison
Compare your category metrics against the thresholds in the **str-risk-scoring** skill
and any limits in `config/deal.json` (e.g. `strategy.minDSCR`). State PASS / CONDITIONAL
/ FAIL for each, and set your `risk_category_score`.

### 5. Completeness Assessment
Every step in your **Strategy** (anatomy §5) either produced output or logged a data
gap. No step was silently skipped. If a step was skipped, it is an `uncertainty_flag`.

### 6. Confidence Scoring
Set `confidence` (HIGH / MEDIUM / LOW) per your **Confidence Scoring** rubric
(anatomy §16) and populate `uncertaintyFlags` for every estimated, assumed, stale, or
interpolated value. Missing data must lower confidence — never assign HIGH with open
critical gaps.

## Recording the result

Append to the workpaper:

```markdown
## Self-Review
- [x] 1 Schema compliance
- [x] 2 Numeric sanity
- [x] 3 Cross-reference validation
- [x] 4 Threshold comparison — DSCR PASS, occupancy CONDITIONAL
- [x] 5 Completeness — all steps produced output
- [x] 6 Confidence — MEDIUM (2 estimated inputs flagged)
Retries: 0
```

## Common mistakes this catches

- Assigning a category a LOW risk score when the data was actually **missing** (should
  be UNSCORED / flagged, not LOW — a false sense of safety).
- RevPAR that doesn't equal ADR × occupancy (a copy-paste or units error).
- Using in-place long-term rent instead of STR revenue (wrong model entirely).
- Reporting a confident number that traces back to a single unverified source.
