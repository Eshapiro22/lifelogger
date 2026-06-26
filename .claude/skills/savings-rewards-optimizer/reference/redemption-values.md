# Redemption values & default reward rates

Use these only as fallbacks when the user's wallet doesn't specify a rate or a
point value. **Always state which default you used so the user can correct it.**
Valuations move over time and depend heavily on how points are redeemed — these
are conservative, broadly-cited baselines, not guarantees.

## Point / mile valuations (dollars per unit)

| Currency        | Conservative value | Notes                                              |
|-----------------|--------------------|----------------------------------------------------|
| `cash`          | $0.01 per unit     | 1 unit = 1 cent. A 2% card = rate 2.               |
| `chase_ur`      | ~$0.0205           | Higher via transfer partners; ~$0.01 cash-out.     |
| `amex_mr`       | ~$0.02             | Transfer-partner dependent; cash-out is worse.     |
| `capone_miles`  | ~$0.018            | Transfer or eraser; ~$0.005–0.01 floor.            |
| airline miles   | ~$0.012–0.015      | Highly route-dependent; avoid over-valuing.        |
| hotel points    | ~$0.005–0.012      | Program-dependent; Hyatt high, others lower.       |

**Cash-out floor:** most bank points redeem for ~$0.01 as statement credit. Only
use the higher transfer values if the user actually transfers to partners; if
unsure, value at the cash floor and say so.

## Typical category multipliers (points per dollar)

Common defaults if a specific card's rates are unknown. Prefer real card terms.

| Category        | Typical strong rate | Example card type                 |
|-----------------|---------------------|-----------------------------------|
| dining          | 3x–4x               | Amex Gold, CSR                    |
| groceries       | 4x–6x (often capped)| Amex Gold, Blue Cash Preferred   |
| gas             | 3x–5x               | rotating / co-brand              |
| travel/airfare  | 3x–5x               | CSR, Venture X                   |
| streaming       | 3x                  | Blue Cash Preferred              |
| everything else | 1x–2x               | Double Cash (2%), Venture (2x)   |

A flat **2% cashback** card (`currency: cash`, `default: 2`) is the floor every
purchase should beat. If no card beats 2% for a category, recommend the 2% card.

## Savings baseline (not rewards)

When the user asks about parking cash rather than spending:

- **High-yield savings (HYSA)** typically pays meaningfully more than a big-bank
  checking/savings account. Moving idle cash there is usually the highest-ROI,
  zero-risk move — often worth more than any card-rewards tweak.
- For known short-horizon spend, short-term Treasuries / money-market funds are
  the conventional comparison. State current-rate assumptions; do not quote a
  specific APY as fact without checking — rates move.

This is reward/savings optimization, **not** financial advice. Never recommend
carrying a card balance: interest charges dwarf every reward rate here.
