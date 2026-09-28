---
name: str-revenue-benchmarks
description: AirDNA-style comparable-analysis methodology for projecting short-term-rental revenue — how to build a comp set, derive ADR/occupancy/RevPAR, apply seasonality, read market saturation, and haircut for a new-listing ramp. Mandatory read for the str-revenue agent; reference for market-intel and underwriting.
---

# STR Revenue Benchmarks (AirDNA-style comp analysis)

The goal: turn observable comparable listings into a defensible ADR, occupancy, and
RevPAR for the subject property. This mirrors how AirDNA "Rentalizer" / Market Minder
work, using public data instead of a paid API.

## Comp set construction

A usable comp is an **active STR listing** (Airbnb/VRBO or an aggregator) that matches
the subject on the dimensions guests actually book on:

| Dimension | Match tolerance |
|-----------|-----------------|
| Bedrooms | exact, ±1 as fallback |
| Guest capacity | ±2 |
| Location / submarket | same neighborhood or ≤ 3 mi in the same demand zone |
| Property type | house↔house, condo↔condo (don't compare a cabin to a downtown condo) |
| Key amenities | pool/hot tub, waterfront, ski-in — match the ones that drive rate |
| Quality tier | similar finish / review rating band |

**Minimum comp set: 5 active comps.** 8+ is HIGH confidence, 3–4 is LOW confidence and
must be flagged, <3 means the Revenue & Demand category cannot be scored reliably.

## Deriving the metrics

For each comp gather: nightly rate(s) across seasons, and an occupancy signal
(calendar blocked-night ratio over the trailing 12 months, or a review-velocity proxy:
reviews/month × average-stay-length ÷ available nights).

```
Comp ADR       = median of comp nightly rates (by season)
Comp Occupancy = median of comp occupancy signals (trailing 12 mo)
Comp RevPAR    = Comp ADR × Comp Occupancy
Subject projection = comp median, adjusted for subject's amenity/quality deltas
```

Adjust the subject off the comp median for material deltas (a hot tub in a hot-tub
market = +ADR; no parking downtown = −occupancy). Keep adjustments explicit and small;
if you're adjusting more than ±20%, your comp set is wrong.

## Occupancy / ADR reference tiers (sanity bands, not substitutes for comps)

| Market type | Stabilized occupancy | ADR posture | Seasonality |
|-------------|:--:|--|--|
| Urban / business + leisure | 60–72% | mid, steady | low |
| Suburban / drive-to leisure | 50–65% | mid | moderate |
| Beach / lake / seasonal resort | 45–60% blended | high in season | severe (peak = 40–55% of annual) |
| Mountain / ski | 45–60% blended | very high in season | severe, twin peaks |
| Rural / remote / unique-stay | 35–55% | variable | high |

Use these only to catch a comp result that's implausible. The comp set governs.

## Seasonality build (required — never annualize a peak)

```
For each month:  Monthly RevPAR = seasonal ADR(month) × seasonal occupancy(month)
Annual Revenue  = Σ (Monthly RevPAR × days in month)
Seasonality Index(month) = Monthly RevPAR / mean Monthly RevPAR
```
Report the index so the underwriter can see cash-flow timing (debt service is monthly;
revenue is lumpy).

## Market saturation signals

| Signal | Reading |
|--------|---------|
| Active listings trend (12 mo) | Rising fast = downward pressure on occupancy |
| Median occupancy trend | Falling while listings rise = oversupply |
| New-permit issuance | Accelerating = future supply; capped = protected |
| Booking lead time / length of stay | Shortening = softening demand |

## New-listing ramp haircut

A brand-new listing has no reviews and no search ranking. Discount stabilized comp
occupancy for Year 1:

| Months live | Occupancy haircut vs stabilized |
|-------------|:--:|
| 0–3 | −25 to −35% |
| 4–6 | −15 to −25% |
| 7–12 | −5 to −15% |
| 12+ | stabilized |

State the ramp assumption explicitly; the underwriter models Year 1 on the haircut and
Year 2+ on stabilized.

## Output the str-revenue agent must produce

- Comp table (each comp: id/link, beds, distance, ADR, occupancy signal, source, date).
- Subject ADR, occupancy, RevPAR (stabilized) + Year-1 ramped.
- 12-month seasonality curve.
- Saturation read + comp-count confidence.
- `dataForDownstream`: `str.adr`, `str.occupancy`, `str.revpar`,
  `str.annualRevenueStabilized`, `str.annualRevenueYear1`, `str.availableNights`,
  `str.seasonalityIndex[]`, `str.compCount`, `str.confidence`.

## Common mistakes
- Comparing to long-term rent (wrong model entirely).
- Annualizing a single peak-season rate.
- Counting inactive/ghost listings as comps.
- Ignoring the permit night-cap from legal-risk when setting available nights.
- Reporting a point estimate with no confidence band when comp count is thin.
