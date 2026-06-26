---
name: savings-rewards-optimizer
description: Pick the card or account that maximizes rewards, cashback, and savings on a purchase. Use when the user asks "which card should I use for X", wants to maximize points/miles/cashback, is planning a large or recurring purchase (travel, tickets, groceries, dining), is comparing card reward rates, wants to know what a redemption is worth, or asks how to optimize a wallet of cards and loyalty programs.
---

# Savings & Rewards Optimizer

Given a purchase (or set of purchases) and the user's wallet of cards and loyalty
programs, recommend the card that returns the most real value — accounting for
category multipliers, point valuations, spend caps, rotating categories, foreign
transaction fees, and annual-fee drag. The goal is **after-everything dollars
back**, not the biggest advertised multiplier.

## Core principle

Always compare cards in **effective dollars returned per dollar spent**, never in
raw points. A "3x" card and a "5x" card are only comparable once you multiply by
what each point is actually worth on redemption:

```
value_per_dollar = earn_rate (units per $) × point_value ($ per unit)
```

A 5x card earning a point worth $0.01 (5%) loses to a 3x card earning a point
worth $0.02 (6%). Surfacing this is the single most valuable thing this skill does.

## Workflow

Make a short todo list, then work through these steps.

### 1. Load or build the wallet

The wallet is a JSON file describing the user's cards and what their points are
worth. The schema and a worked example live in `assets/wallet.example.json`.

- If the user has a wallet file, read it.
- If not, ask for their cards (or infer from what they mention) and build one
  from the example. Keep `assets/wallet.example.json` as the template — copy it,
  don't edit the template in place.
- If the user names a card you don't have rates for, use the public defaults in
  `reference/redemption-values.md` and tell them you used a default so they can
  correct it.

### 2. Describe the purchase

Capture: **amount**, **category** (see the category list in the optimizer), and
optionally **merchant**, **date** (for rotating quarterly categories), and whether
it's **foreign / non-USD** (triggers FX fees). For recurring spend, capture the
period (monthly/annual) so caps and annual fees amortize correctly.

### 3. Run the optimizer

Do not do this math by hand — it's error-prone with caps and FX fees. Run:

```bash
node scripts/optimize.mjs <wallet.json> --amount 1200 --category travel [--date 2026-06-26] [--foreign] [--merchant "FIFA"]
```

It prints every card ranked by effective value returned, the winner, the runner-up,
and the dollar gap between them. Pass `--json` for machine-readable output. Run
`node scripts/optimize.mjs --help` for all flags.

For a basket of different-category purchases, pass `--basket basket.json` (array of
`{amount, category, ...}`); the optimizer assigns the best card to each line and
reports the total.

### 4. Explain the recommendation

Report, concisely:

- **Use card X** — effective rate and total dollars back.
- **Why** — the category multiplier and point valuation that won it.
- **The gap** — how many dollars better than the runner-up (if it's pennies, say so;
  don't make the user juggle cards for $0.30).
- **Caveats the optimizer flagged** — cap nearly hit, FX fee, rotating category not
  active this quarter, or an annual fee that this spend doesn't justify.

### 5. Look past the single purchase (when relevant)

- **Sign-up bonuses** dwarf category multipliers. If a card in the wallet has an
  open bonus with an unmet minimum-spend, steering spend there is usually correct
  even at a worse multiplier — flag it.
- **Savings, not just rewards.** If the user is sitting on cash or asks about
  parking money, point them at the high-yield baseline in
  `reference/redemption-values.md` rather than only talking cards.
- **Annual fee math.** A premium card only wins net if its extra rewards plus used
  credits exceed its fee. Don't recommend chasing a multiplier on a fee card the
  user wouldn't otherwise keep.

## Guardrails

- This is reward-optimization guidance, not financial, tax, or credit advice. Don't
  advise carrying a balance — interest swamps every reward rate. If a user implies
  they revolve debt, say the payoff beats any rewards play.
- Point valuations are estimates that move; state the assumption you used and that
  results shift with it.
- Never invent reward rates. Use the wallet, then `reference/redemption-values.md`,
  then ask — in that order.
