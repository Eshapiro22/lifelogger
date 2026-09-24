---
name: str-underwriting-calc
description: Every formula used to underwrite a short-term-rental (STR) acquisition — RevPAR, ADR, occupancy, gross booking revenue, STR operating expenses, GOP/NOI, cap rate vs comp valuation, DSCR, cash-on-cash, break-even occupancy, furnishing CapEx, and seasonality. Mandatory read for the underwriting agent; reference for str-revenue. This is STR economics, NOT multifamily rent-roll math.
---

# STR Underwriting Calculations

All financial analysis for a short-term rental must use these formulas exactly. STR
economics differ fundamentally from long-term multifamily: revenue is a function of
nightly rate and occupancy (not a rent roll), operating expenses run far higher
(cleaning, dynamic pricing, platform fees, host-paid utilities, lodging taxes), and
small single-family assets are usually valued off sales comps, not a cap rate.

---

## 1. Revenue metrics (the core of STR)

### Average Daily Rate (ADR)
```
ADR = Total Booking Room Revenue / Number of Booked Nights
```
Room revenue only — exclude cleaning fees and taxes (they are pass-throughs).

### Occupancy
```
Occupancy = Booked Nights / Available Nights
```
Available nights = 365 − owner-use nights − blocked/maintenance nights. Do NOT use 365
if the owner reserves personal-use nights or the permit caps rentable nights.

### RevPAR (Revenue Per Available Rental night) — the single most important STR metric
```
RevPAR = ADR × Occupancy
       = Annual Room Revenue / Available Nights
```
RevPAR normalizes rate and occupancy into one comparable number. It is to STR what
NOI-per-unit is to multifamily.

### Annual Gross Booking Revenue
```
Annual Room Revenue = RevPAR × Available Nights × Number of Listings/Units
Gross Booking Revenue = Annual Room Revenue + Cleaning Fee Income + Other Guest Fees
```
For a single SFR listing, Number of Listings = 1. For a small-multi operated as
separate STR units, sum per-unit RevPAR.

### Seasonality
STR revenue is highly seasonal. Never annualize a peak month.
```
Seasonality Index (month) = Month RevPAR / Average Monthly RevPAR
Annual Revenue = Σ (Monthly RevPAR × Days in Month) across all 12 months
```
Model month-by-month. A beach market may earn 45% of annual revenue in 3 summer months.

---

## 2. Operating expenses (STR runs 35–55% of gross revenue)

```
Total OpEx = Platform/Channel Fees + Property Management + Cleaning & Turnover
           + Supplies & Consumables + Utilities (host-paid: power, water, gas, internet, streaming)
           + Repairs & Maintenance + Lodging/Occupancy Tax remittance handling
           + STR Insurance + Dynamic-Pricing/Software tools + Licensing/Permit fees
           + HOA dues (if any) + Landscaping/Pool/Hot-tub service
           + Furnishing Replacement Reserve
```

### Key STR expense benchmarks
| Line | Typical range | Notes |
|------|--------------|-------|
| Property management (full-service STR) | 18–30% of room revenue | vs 8–10% long-term; self-manage ≈ 0 cash but real time cost |
| Cleaning & turnover | Often pass-through to guest; net cost 0–5% | Model any gap between cleaning fee charged and cost paid |
| Platform/channel fees | 3% (Airbnb host) to 15% (some channels) | |
| Supplies & consumables | 3–6% | Linens, toiletries, coffee, restock |
| Utilities (host-paid) | 6–12% | Higher than long-term: guests don't conserve; hot tubs/AC |
| STR insurance | 1.5–3× a standard landlord policy | Must be STR-specific (e.g. Proper, Steadily) |
| Dynamic pricing tools | 1% | PriceLabs/Wheelhouse |
| Lodging/occupancy taxes | Pass-through, but you remit | Track separately; not an expense to owner if collected |

### OpEx Ratio
```
OpEx Ratio = Total OpEx / Gross Booking Revenue
```
STR OpEx ratio of 35–55% is normal. A pro forma showing <25% is almost certainly
missing cleaning, management, or host-paid utilities — reject it.

---

## 3. Income

### Gross Operating Profit (GOP) / NOI
```
GOP = Gross Booking Revenue − Total OpEx (excluding debt service and reserves-for-CapEx)
NOI = GOP − Furnishing/Capital Replacement Reserve
```
For STR, treat GOP and NOI carefully: furnishing wears out fast (2–4 yr cycle on soft
goods), so a replacement reserve is not optional.

---

## 4. Valuation (single-family/small-multi is usually COMP-based, not cap-rate)

### Sales-comparison value (primary for 1–4 unit)
```
Estimated Value = weighted average of adjusted sale prices of comparable homes
```
An SFR STR does not trade on a cap rate — it trades as a house. Model the exit as a
residential comp sale, not an NOI/cap-rate reversion.

### Cap Rate (secondary / cross-check only)
```
Cap Rate = NOI / Purchase Price
```
Useful as a yield sanity-check, not as the valuation basis for a house.

### Gross Rent (Revenue) Multiplier
```
GRM = Purchase Price / Annual Gross Booking Revenue
```
STR GRMs are typically lower (higher yield) than long-term, reflecting higher revenue
and higher opex/effort.

---

## 5. Debt (STR commonly uses DSCR loans, not agency debt)

```
Monthly Payment = Loan × [r(1+r)^n] / [(1+r)^n − 1],  r = APR/12, n = amort months
Annual Debt Service = Monthly Payment × 12
LTV = Loan / Purchase Price
```

### DSCR (the metric DSCR-loan lenders size on)
```
DSCR = NOI / Annual Debt Service
```
STR DSCR lenders often accept **projected** STR income but may haircut it or require a
long-term-rent fallback. Minimums: DSCR loans typically 1.0–1.25×; below 1.0 the
property does not cover debt on its own.

### Debt Yield
```
Debt Yield = NOI / Loan Amount
```

---

## 6. Return metrics

### Cash-on-Cash
```
Annual Pre-Tax Cash Flow = NOI − Annual Debt Service
Total Cash Invested = Down Payment + Closing Costs + Furnishing/Setup CapEx + Initial Reserve
Cash-on-Cash = Annual Pre-Tax Cash Flow / Total Cash Invested
```
**Furnishing CapEx is part of the cash basis** — this is unique to STR and materially
lowers first-year CoC versus a long-term rental.

### Furnishing / Setup CapEx (upfront)
```
Furnishing CapEx = Furniture + Appliances + Linens + Kitchenware + Electronics/Smart-locks
                 + Outdoor/Hot-tub + Décor + Photography + Listing setup + Initial supplies
```
Typical: **$15,000–$45,000** for a 1–4 bedroom house depending on finish level; luxury
markets higher. Amortize soft goods over 2–4 years for reserves.

### Break-Even Occupancy
```
Break-Even Occupancy = (Total OpEx + Annual Debt Service) / (ADR × Available Nights)
```
The occupancy the property must hit just to cover costs. Compare to the comp-derived
market occupancy from str-revenue — if break-even ≥ market occupancy, the deal has no
cushion.

### Net Yield
```
Gross Yield = Gross Booking Revenue / Purchase Price
Net Yield   = NOI / (Purchase Price + Furnishing CapEx)
```

---

## 7. Worked example (illustrative — a 3BR STR)

| Input | Value |
|-------|-------|
| Purchase price | $525,000 |
| Comp-derived ADR | $285 |
| Comp-derived occupancy | 62% |
| Available nights | 350 (15 owner/maintenance nights) |
| Furnishing CapEx | $32,000 |
| Loan | $393,750 (75% LTV), 7.25% APR, 30-yr DSCR loan |

```
RevPAR = 285 × 0.62 = $176.70
Annual Room Revenue = 176.70 × 350 = $61,845
+ Cleaning fee net + other fees (assume net $0 pass-through)
Gross Booking Revenue ≈ $61,845

Total OpEx @ 45% = $27,830
  (management 22%, utilities 9%, supplies 5%, insurance 3%, tools 1%, R&M 5%)
Furnishing reserve @ $3,000/yr
NOI = 61,845 − 27,830 − 3,000 = $31,015

Annual Debt Service (7.25%, 30yr, $393,750) ≈ $32,220
DSCR = 31,015 / 32,220 = 0.96x  -> below 1.0, FAILS DSCR-loan sizing
Cash flow = 31,015 − 32,220 = −$1,205

Total Cash Invested = 131,250 (down) + 15,750 (closing) + 32,000 (furnishing) + 6,000 (reserve)
                    = $185,000
Cash-on-Cash = −1,205 / 185,000 = −0.65%

Break-Even Occupancy = (27,830 + 3,000 + 32,220) / (285 × 350) = 63,050 / 99,750 = 63.2%
```
**Read:** market occupancy is 62% but break-even is 63.2% — no cushion, negative Year-1
cash flow, sub-1.0 DSCR. This deal only works with a lower price, more equity, or a
demonstrably higher ADR/occupancy than comps support. Flag as CONDITIONAL/FAIL.

---

## 8. Edge cases

- **Permit caps rentable nights** (e.g. 90-night annual cap): Available Nights is the
  cap, not 365. Recompute RevPAR base and revenue against the cap. This can halve a
  pro forma — always confirm the cap with legal-risk before finalizing.
- **Owner-occupied / house-hack**: if the permit requires primary residence, only
  spare rooms or part-year are rentable. Model actual rentable inventory, not the whole
  house.
- **Seasonal-only markets**: do not annualize peak ADR. Use the month-by-month build.
- **New listing ramp**: a brand-new listing underperforms comps for 6–12 months (no
  reviews, no ranking). Haircut Year-1 occupancy 15–30% vs stabilized.
- **Cleaning fee arbitrage**: if the cleaning fee charged to guests exceeds cleaning
  cost, the surplus is revenue; if it's under, the gap is an expense. Model the net.

## How agents use this skill

- **underwriting** (mandatory, in full): the primary reference for the pro forma,
  DSCR, cash-on-cash, break-even, and scenario math.
- **str-revenue** (sections 1 & 7): to turn a comp set into ADR/occupancy/RevPAR and a
  revenue projection the underwriter consumes.
- Cross-reference revenue against str-revenue's workpaper and expenses against
  physical-condition (furnishing CapEx) and public-record (reassessed taxes).
