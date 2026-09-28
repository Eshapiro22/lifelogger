---
name: str-risk-scoring
description: The risk-scoring framework for short-term-rental acquisitions — 9 STR-specific categories (Regulatory/Permitting is #1 and the top dealbreaker), 0-100 scoring rubric, hard/soft dealbreaker checklist, and strategy-specific go/no-go thresholds. Every specialist scores its own category; the orchestrator aggregates. This replaces multifamily rent-control/tenant-concentration scoring with STR regulation, demand, and operational risk.
---

# STR Risk Scoring

Each specialist scores **its own category** 0–100 and records it as
`risk_category_score` in its workpaper. The orchestrator aggregates into an overall
weighted score and applies the dealbreaker checklist.

## Scoring bands

| Level | Score | Meaning |
|-------|-------|---------|
| LOW | 0–25 | Minimal risk |
| MEDIUM | 26–50 | Monitor / document |
| HIGH | 51–75 | Requires mitigation plan |
| CRITICAL | 76–100 | Potential dealbreaker |

```
Category Score  = Σ(Factor Score × Factor Weight) / Σ(Factor Weights)
Overall Score   = Σ(Category Score × Category Weight) / Σ(Category Weights)
```
If a category cannot be scored for lack of data, mark it **UNSCORED** (score `null`),
exclude it from the weighted average, and — if more than 2 categories are UNSCORED —
the overall recommendation is `FURTHER_DILIGENCE`.

---

## The 9 categories (owner agent in parentheses)

### 1. Regulatory & Permitting  — *the STR category that kills deals*  (legal-risk)
The single most important STR risk. Covers whether STR is legal at this address at all.

| Factor | LOW | MEDIUM | HIGH | CRITICAL |
|--------|-----|--------|------|----------|
| STR legality | By-right, permits issued routinely | Allowed with conditions | Allowed but permit cap / waitlist | Prohibited outright |
| Primary-residence requirement | None | Owner-occupancy not required but favored | Hosted-only / part-year | Primary-residence-only (no investment path) |
| Night cap | None / 300+ nights | 180–300 nights | 90–180 nights | < 90 nights |
| Permit transferability | Transfers with sale | New permit, routine | New permit, discretionary | Non-transferable / moratorium |
| HOA / condo rules | STR allowed | Minimum-stay limits | Board approval required | STR banned by HOA/CC&Rs |
| Enforcement climate | Light | Complaint-based | Active enforcement + fines | Aggressive, revocations happening |
| Pending legislation | None | Proposed, uncertain | Advancing restriction | Ban on ballot / effective soon |

**Automatic escalations:** STR prohibited by ordinance OR HOA → CRITICAL (95).
Primary-residence-only with no investment path → CRITICAL (90). Active moratorium on
new permits → HIGH (75).

### 2. Revenue & Demand  (str-revenue)
| Factor | LOW | MEDIUM | HIGH | CRITICAL |
|--------|-----|--------|------|----------|
| Comp occupancy | >65% | 55–65% | 45–55% | <45% |
| ADR stability | Steady, low seasonality | Moderate seasonality | Highly seasonal | Single-season dependent |
| Market saturation | Undersupplied | Balanced | Rising supply | Oversupplied / listing glut |
| Comp set quality | 8+ close comps | 5–7 comps | 3–4 comps | <3 comps (thin) |
| Event/single-driver dependency | Diversified demand | Some concentration | Event-dependent | One employer/event = most demand |

**Escalations:** comp occupancy <40% → HIGH (65). Fewer than 3 usable comps →
category MEDIUM minimum + flag confidence.

### 3. Financial  (underwriting)
| Factor | LOW | MEDIUM | HIGH | CRITICAL |
|--------|-----|--------|------|----------|
| DSCR | >1.25× | 1.10–1.25× | 1.00–1.10× | <1.00× |
| Cash-on-Cash (Yr 1) | >8% | 4–8% | 0–4% | <0% |
| Break-even vs market occupancy | >15 pts cushion | 5–15 pts | 0–5 pts | break-even ≥ market |
| Furnishing CapEx vs budget | Funded | Tight | Underfunded | Not budgeted |

**Escalations:** DSCR <1.0 → CRITICAL (85). Break-even occupancy ≥ market occupancy →
HIGH (70).

### 4. Physical Condition & Readiness  (physical-condition)
Roof/HVAC/systems age, deferred maintenance, plus **STR readiness** (furnishability,
photogenic appeal, amenities guests expect: parking, wifi, AC, hot tub if market
expects one). Escalations: active structural issues → CRITICAL (80); not-listable
without major work → HIGH (65).

### 5. Market & Location  (market-intel)
Tourism/demand drivers, seasonality depth, distance to attractions, walkability,
economic diversification, natural-disaster/insurance exposure. Escalations: demand
tied to a single declining driver → HIGH (65); severe wildfire/flood exposure → HIGH.

### 6. Title & Ownership  (public-record)
Ownership chain, liens, transfer pattern (flip flags), tax delinquency, easements.
Escalations: unresolved title dispute → CRITICAL (80); tax foreclosure → CRITICAL (90).

### 7. Insurance & Liability  (legal-risk, cross-checked by underwriting)
STR-specific coverage availability and cost, liability exposure (pool/hot tub/stairs),
prior claims. Escalations: no STR insurer will write the property → HIGH (70).

### 8. Operational & Management  (underwriting + physical-condition)
Self-manage vs full-service PM availability and cost, turnover/cleaning labor supply,
remote-management feasibility, guest-service load. Escalations: no cleaner/PM available
in market → HIGH (60).

### 9. Environmental  (public-record)
Phase-I-style screening scaled to a house: flood zone, wildfire, prior use,
UST/asbestos for older stock. Escalations: FEMA high-risk flood without insurability →
HIGH (65).

---

## Category weights by strategy

| Category | Cash-Flow STR | Appreciation/House-Hack | Luxury/Trophy |
|----------|:---:|:---:|:---:|
| 1 Regulatory & Permitting | 25% | 20% | 22% |
| 2 Revenue & Demand | 20% | 14% | 18% |
| 3 Financial | 18% | 14% | 12% |
| 4 Physical & Readiness | 8% | 12% | 14% |
| 5 Market & Location | 12% | 16% | 14% |
| 6 Title & Ownership | 5% | 6% | 6% |
| 7 Insurance & Liability | 5% | 6% | 6% |
| 8 Operational & Mgmt | 5% | 8% | 6% |
| 9 Environmental | 2% | 4% | 2% |

Default to **Cash-Flow STR** weights if `config/deal.json → strategy` is unset.

---

## Dealbreaker checklist

### Hard dealbreakers (automatic NO-GO regardless of score)
1. STR prohibited by ordinance at this address.
2. STR banned by HOA / condo CC&Rs.
3. Primary-residence-only requirement with no investment-operation path.
4. Active moratorium making a permit unobtainable for this property.
5. Unresolvable title dispute (cannot get clean title).
6. DSCR < 0.85 with no viable restructure and no appreciation thesis.
7. No STR insurance obtainable at any reasonable cost.

### Soft dealbreakers (require a mitigation plan to proceed)
1. Night cap that cuts revenue below break-even → need lower price or higher ADR.
2. Break-even occupancy ≥ comp market occupancy → need price/equity/ADR fix.
3. Furnishing + deferred-maintenance CapEx not funded → budget it into cash basis.
4. Fewer than 3 usable revenue comps → widen comp radius / discount confidence.
5. Pending legislation likely to restrict within the hold period → scenario it.
6. Single-driver demand (one event/employer) → stress a downside occupancy case.

---

## Recommendation values

| Value | When |
|-------|------|
| `PROCEED` | Overall <30, no dealbreakers |
| `PROCEED_WITH_MITIGATIONS` | Overall <55, no hard dealbreakers, soft ones have viable fixes |
| `PROCEED_WITH_CAUTION` | Overall 55–70, significant but manageable |
| `FURTHER_DILIGENCE` | >2 categories UNSCORED or thin comp data |
| `NO-GO` | Any hard dealbreaker, OR overall >70, OR soft dealbreaker with no viable fix |

### Strategy thresholds (overall score)
| Strategy | PROCEED | PROCEED_W_MIT | CAUTION | NO-GO |
|----------|:--:|:--:|:--:|:--:|
| Cash-Flow STR | <25 | 25–40 | 40–55 | >55 or any hard dealbreaker |
| Appreciation/House-Hack | <35 | 35–50 | 50–65 | >65 or any hard dealbreaker |
| Luxury/Trophy | <40 | 40–55 | 55–70 | >70 or any hard dealbreaker |

## How agents use this skill
- **Each specialist**: score only your category using the factor tables; apply
  automatic escalations; record `risk_category_score` and any dealbreakers you detect.
- **orchestrator**: aggregate with the strategy weight table, run the dealbreaker
  checklist across all workpapers, map to a recommendation. A single hard dealbreaker
  = NO-GO regardless of the numeric score.
