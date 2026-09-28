---
name: str-underwriting
description: The buy box — this investor's concrete STR acquisition criteria and pass/fail thresholds, ported from the cre-ref underwriting-calc + risk-scoring structure but encoding real targets (10% Year-1 cash-on-cash floor, 1.10x DSCR floor, reject any FEMA SFHA flood zone, pre-tax underwriting with cost-seg/bonus-depreciation as after-tax upside). Read by the underwriting agent and the orchestrator to score a deal against the buy box. Machine-readable mirror lives in config/thresholds.json.
---

# STR Underwriting — Buy Box

This skill encodes **the investor's acquisition criteria**. It keeps the structure of a
CRE underwriting reference — formula definitions, worked examples, weighted risk
categories, dealbreaker thresholds — but the numbers are this buyer's, not generic.

- Full formula library (RevPAR, GOP/NOI, amortization, etc.): see **str-underwriting-calc**.
- Full 9-category risk factor tables: see **str-risk-scoring**.
- This file is the **decision layer**: the thresholds a deal must clear, and the
  weights and dealbreakers used to reach GO / CONDITIONAL / NO-GO.
- The machine-readable mirror is **`config/thresholds.json`** — keep the two in sync.

---

## 1. Buy box quick reference

| Criterion | Threshold | Below/violation → |
|-----------|-----------|-------------------|
| Year-1 cash-on-cash | **≥ 10.0%** | FAIL (buy-box miss) |
| Stabilized cash-on-cash | ≥ 12.0% (target, not gating) | watch |
| DSCR (NOI / annual debt service) | **≥ 1.10x** | FAIL; **< 0.90x → hard dealbreaker** |
| FEMA flood zone | **Zone X only (incl. shaded X)** | any SFHA (A/AE/AH/AO/AR/A99/V/VE) → **hard dealbreaker** |
| Break-even occupancy | ≤ (underwriting occupancy − 10 pts) | CONDITIONAL if cushion < 10 pts; FAIL if ≥ market occ |
| OpEx ratio | 35–55% of gross revenue | <25% → reject pro forma (missing costs) |
| STR legality | permitted + permit obtainable | prohibited / no path → **hard dealbreaker** |
| STR insurance | obtainable | none available → **hard dealbreaker** |
| Furnishing CapEx | funded in cash basis | unfunded → CONDITIONAL |
| Tax underwriting basis | **pre-tax** for go/no-go | — |

Default strategy: **cash-flow-str** (the 10% cash-on-cash floor is a cash-flow mandate).

---

## 2. Formula definitions (the buy-box-gating metrics)

Formulas are from **str-underwriting-calc**; repeated here because the buy box gates on
them directly.

### Cash-on-Cash (Year 1) — primary return gate
```
Annual Pre-Tax Cash Flow (Yr1) = NOI(Yr1) − Annual Debt Service
Total Cash Invested = Down Payment + Closing Costs + Furnishing/Setup CapEx + Initial Reserve
Cash-on-Cash (Yr1) = Annual Pre-Tax Cash Flow (Yr1) / Total Cash Invested
BUY-BOX FLOOR: 10.0%.  Furnishing CapEx MUST be in the cash basis (STR-specific).
```
Year-1 NOI uses the **new-listing ramp** revenue (str-revenue-benchmarks), not
stabilized — the floor must be cleared on ramped, not idealized, income.

### DSCR — debt-safety gate
```
DSCR = NOI / Annual Debt Service
BUY-BOX FLOOR: 1.10x.  DSCR < 0.90x is a HARD DEALBREAKER (no restructure clears it).
```

### Break-even occupancy — cushion gate
```
Break-Even Occupancy = (Total OpEx + Annual Debt Service) / (ADR × Available Nights)
REQUIRE: Break-Even ≤ (Underwriting Occupancy − 10 percentage points).
  cushion 0–10 pts → CONDITIONAL;  break-even ≥ market occupancy → FAIL.
```

### Flood-zone gate (hard)
```
ACCEPT: FEMA Zone X (unshaded) and shaded Zone X (0.2% annual / 500-yr).
REJECT (HARD DEALBREAKER): any Special Flood Hazard Area — A, AE, AH, AO, AR, A99, V, VE.
Source: public-record agent's FEMA screen (record.floodZone).
```

---

## 3. Occupancy & ADR underwriting policy

Revenue is **comp-derived** (str-revenue agent, str-revenue-benchmarks method). The buy
box underwrites conservatively off those comps:

```
Underwriting Occupancy (base) = Comp Stabilized Occupancy × 0.90     # 10% haircut
ADR (base)                    = Comp seasonal median                 # no unearned premium
Year-1 Revenue                = new-listing ramp haircut (str-revenue-benchmarks)
Downside case                 = 0.80 × comp occupancy, ADR − 10%
Upside case                   = comp occupancy, ADR (no haircut)
```
The go/no-go verdict is taken on the **base case**. Downside must not produce
DSCR < 0.90x (else flag execution risk even if base passes).

---

## 4. After-tax treatment (cost seg + bonus depreciation) — UPSIDE ONLY

**The go/no-go verdict is computed pre-tax.** Depreciation benefits are modeled and
reported as a *separate after-tax upside line*, and may **never** be used to lift a deal
over the pre-tax cash-on-cash or DSCR floors.

```
Depreciable (building) basis = Purchase Price − Land Value (+ Furnishing CapEx as personal property)
Cost Segregation reclass     = ~20–30% of building basis into 5/7/15-year property
First-Year Bonus Depreciation = Reclassified basis × BonusDepreciationPct
  ⚠ BonusDepreciationPct is legislation-dependent — confirm the current-year percentage
    (config/thresholds.json → tax.bonusDepreciationPct) before quoting a number.
After-Tax Upside = (Depreciation deduction × Investor Marginal Rate) shown as a
                   supplemental IRR/CoC uplift, labeled "after-tax, not go/no-go".
```
Note STR-specific angle: a self-managed STR with material personal involvement can make
losses **non-passive** ("short-term rental loophole" — average guest stay ≤ 7 days). Flag
this qualitatively; it is the investor's/CPA's determination, not an underwriting input.

---

## 5. Weighted risk categories (this buyer — cash-flow-str weights)

Full factor tables live in **str-risk-scoring**. The buy box uses the cash-flow-str
weighting and adds a hard flood gate:

| # | Category | Weight | Owner agent |
|---|----------|:--:|---|
| 1 | Regulatory & Permitting | 25% | legal-risk |
| 2 | Revenue & Demand | 20% | str-revenue |
| 3 | Financial | 18% | underwriting |
| 4 | Physical & Readiness | 8% | physical-condition |
| 5 | Market & Location | 12% | market-intel |
| 6 | Title & Ownership | 5% | public-record |
| 7 | Insurance & Liability | 5% | legal-risk |
| 8 | Operational & Mgmt | 5% | underwriting |
| 9 | Environmental (incl. flood) | 2% | public-record |

```
Overall Score = Σ(Category Score × Weight) / Σ(Weights)
```
Category 9 carries the flood gate: an SFHA is a **hard dealbreaker regardless of the 2%
weight** — never let a low category weight bury an absolute reject.

### Overall-score thresholds (cash-flow-str)
| Overall | Recommendation |
|:--:|---|
| < 25 | PROCEED |
| 25–40 | PROCEED_WITH_MITIGATIONS |
| 40–55 | PROCEED_WITH_CAUTION |
| > 55, or any hard dealbreaker, or a buy-box FAIL | NO-GO |

---

## 6. Dealbreaker thresholds

### Hard dealbreakers (automatic NO-GO, regardless of score)
1. STR prohibited by ordinance at the address.
2. STR banned by HOA / condo CC&Rs.
3. Primary-residence-only requirement with no investment-operation path.
4. Permit unobtainable (moratorium / non-transferable / waitlist with no path).
5. **Property in a FEMA Special Flood Hazard Area (A/AE/AH/AO/AR/A99/V/VE).**
6. **DSCR < 0.90x** with no viable restructure.
7. No STR insurance obtainable at any reasonable cost.
8. Unresolvable title dispute or property in tax foreclosure.

### Buy-box FAIL (deal misses criteria → NO-GO unless a stated mitigation applies)
- Year-1 cash-on-cash **< 10.0%**.
- DSCR **< 1.10x** (but ≥ 0.90x).
- Break-even occupancy ≥ comp market occupancy (no cushion).

### Soft dealbreakers (require a written mitigation to reach CONDITIONAL)
- Break-even cushion < 10 points.
- Furnishing + deferred-maintenance CapEx not funded.
- < 3 usable revenue comps (thin data → FURTHER_DILIGENCE).
- Single-driver demand or pending STR-restriction legislation within the hold.

---

## 7. Worked example (apply the full buy box)

3BR cabin, comp-derived ADR $285, comp stabilized occupancy 62%, price $525,000, 75% LTV
DSCR loan at 7.25%/30yr, furnishing CapEx $32,000, FEMA Zone X.

```
Underwriting occupancy (base) = 62% × 0.90 = 55.8%
Available nights = 350 (15 owner/maint nights)
RevPAR = 285 × 0.558 = $159.03
Gross revenue = 159.03 × 350 = $55,661
OpEx @ 45% = $25,047 ; furnishing reserve $3,000
NOI = 55,661 − 25,047 − 3,000 = $27,614

Annual Debt Service ($393,750, 7.25%, 30yr) ≈ $32,220
DSCR = 27,614 / 32,220 = 0.857x

Cash invested = 131,250 + 15,750 + 32,000 + 6,000 = $185,000
Cash flow = 27,614 − 32,220 = −$4,606
Cash-on-Cash (Yr1) = −2.5%
Break-even occupancy = (25,047 + 3,000 + 32,220)/(285×350) = 60,267/99,750 = 60.4%
```

**Buy-box verdict:**
| Gate | Result | Pass? |
|------|--------|:--:|
| Flood zone | Zone X | ✅ |
| DSCR ≥ 1.10x | 0.857x — also **< 0.90 hard dealbreaker** | ❌ HARD |
| Cash-on-cash ≥ 10% | −2.5% | ❌ |
| Break-even ≤ occ − 10pts | 60.4% vs 45.8% target | ❌ |

→ **NO-GO** (hard dealbreaker: DSCR < 0.90x; plus two buy-box FAILs). At this price and
rate the deal is not close; it would need ~25–30% lower leverage or a materially higher
comp ADR/occupancy to clear the 10% / 1.10x floors.

---

## 8. How agents use this skill
- **underwriting**: read this + `config/thresholds.json`; compute the gating metrics,
  mark each PASS / CONDITIONAL / FAIL, apply the flood and DSCR hard gates, and report
  the after-tax depreciation upside as a separate, non-gating line.
- **orchestrator**: aggregate category scores with the weights here, run the dealbreaker
  checklist, and map to GO / CONDITIONAL / NO-GO using the thresholds above. Any hard
  dealbreaker or buy-box FAIL → NO-GO regardless of the numeric score.
- Keep this file and `config/thresholds.json` in sync — the JSON is the machine mirror.
