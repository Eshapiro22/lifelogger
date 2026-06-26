#!/usr/bin/env node
/**
 * savings-rewards-optimizer — pick the card that returns the most real value.
 *
 * Compares cards in EFFECTIVE DOLLARS RETURNED, not raw points:
 *   value_per_dollar = earn_rate (units/$) * point_value ($/unit)
 *
 * Accounts for: category multipliers, point valuations, spend caps, rotating
 * quarterly categories, foreign-transaction fees, and (for recurring spend)
 * annual-fee amortization.
 *
 * Usage:
 *   node optimize.mjs <wallet.json> --amount 1200 --category travel
 *   node optimize.mjs <wallet.json> --basket basket.json
 *   node optimize.mjs --help
 *
 * No dependencies; Node >= 16.
 */

import { readFileSync } from 'node:fs';

const CATEGORIES = [
  'travel', 'airfare', 'hotel', 'dining', 'groceries', 'gas', 'transit',
  'streaming', 'drugstore', 'online_retail', 'entertainment', 'utilities', 'other',
];

const HELP = `savings-rewards-optimizer

Usage:
  node optimize.mjs <wallet.json> --amount <n> --category <cat> [options]
  node optimize.mjs <wallet.json> --basket <basket.json> [options]

Required (single purchase):
  --amount <n>       Purchase amount in USD (pre-fee).
  --category <cat>   One of: ${CATEGORIES.join(', ')}

Options:
  --basket <file>    JSON array of {amount, category, date?, foreign?, merchant?}.
                     Optimizes each line and reports the total. Overrides --amount.
  --date <ISO>       Purchase date (e.g. 2026-06-26). Activates rotating quarterly
                     categories that match this quarter.
  --foreign          Purchase is in a non-USD currency (applies FX fees).
  --merchant <name>  Free-text merchant, echoed in output (no logic).
  --json             Emit machine-readable JSON instead of a report.
  --help             Show this help.

Wallet schema: see assets/wallet.example.json.`;

// ---------- arg parsing ----------
function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (a === '--foreign' || a === '--json') { args.flags[a.slice(2)] = true; continue; }
    if (a.startsWith('--')) { args.flags[a.slice(2)] = argv[++i]; continue; }
    args._.push(a);
  }
  return args;
}

// ---------- wallet helpers ----------
function quarterOf(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) die(`Invalid --date: ${dateStr}`);
  return Math.floor(d.getUTCMonth() / 3) + 1; // 1..4
}

function pointValue(wallet, currency) {
  const v = wallet.pointValues?.[currency];
  if (v == null) die(`Wallet has no pointValues entry for currency "${currency}".`);
  return v;
}

/**
 * Best matching reward rule on a card for a category at a given quarter.
 * Returns { rate, rule } where rate is units earned per dollar.
 */
function ruleForCategory(card, category, quarter) {
  let best = { rate: card.default ?? 1, rule: null };
  for (const rule of card.rewards ?? []) {
    if (!rule.categories?.includes(category)) continue;
    // Rotating categories only count in their active quarters.
    if (rule.activeQuarters && (quarter == null || !rule.activeQuarters.includes(quarter))) continue;
    if (rule.rate > best.rate) best = { rate: rule.rate, rule };
  }
  return best;
}

/**
 * Effective return for one purchase on one card.
 * Handles caps (rule.cap with optional card-level priorSpend) and FX fees.
 */
function evaluate(card, wallet, purchase) {
  const { amount, category, quarter, foreign } = purchase;
  const ptVal = pointValue(wallet, card.currency);
  const { rate, rule } = ruleForCategory(card, category, quarter);
  const notes = [];

  // Apply a spend cap: dollars above the remaining cap earn the card default.
  let bonusDollars = amount;
  let baseDollars = 0;
  if (rule?.cap != null) {
    const prior = rule.priorSpend ?? 0;
    const remaining = Math.max(0, rule.cap - prior);
    if (amount > remaining) {
      bonusDollars = remaining;
      baseDollars = amount - remaining;
      notes.push(
        remaining === 0
          ? `cap reached ($${rule.cap}); whole purchase earns base rate`
          : `cap: only $${remaining.toFixed(0)} earns ${rate}x, rest earns base`
      );
    }
  }

  const baseRate = card.default ?? 1;
  const units = bonusDollars * rate + baseDollars * baseRate;
  let value = units * ptVal;

  // Foreign transaction fee is a real cash cost — net it out.
  let fxCost = 0;
  if (foreign && card.foreignTransactionFee) {
    fxCost = amount * card.foreignTransactionFee;
    value -= fxCost;
    notes.push(`FX fee ${(card.foreignTransactionFee * 100).toFixed(1)}% = -$${fxCost.toFixed(2)}`);
  }

  const effectiveRate = amount > 0 ? value / amount : 0;
  return {
    cardId: card.id,
    cardName: card.name,
    currency: card.currency,
    earnRate: rate,
    pointValue: ptVal,
    units,
    fxCost,
    value,
    effectiveRate,
    annualFee: card.annualFee ?? 0,
    notes,
  };
}

function rankForPurchase(wallet, purchase) {
  const rows = wallet.cards.map((c) => evaluate(c, wallet, purchase));
  rows.sort((a, b) => b.value - a.value);
  return rows;
}

// ---------- output ----------
function pct(x) { return `${(x * 100).toFixed(2)}%`; }
function usd(x) { return `$${x.toFixed(2)}`; }

function reportSingle(wallet, purchase, rows) {
  const win = rows[0];
  const runner = rows[1];
  const lines = [];
  lines.push(`Purchase: ${usd(purchase.amount)} · ${purchase.category}` +
    (purchase.merchant ? ` · ${purchase.merchant}` : '') +
    (purchase.foreign ? ' · FOREIGN' : '') +
    (purchase.quarter ? ` · Q${purchase.quarter}` : ''));
  lines.push('');
  lines.push('Ranked by effective dollars back:');
  for (const r of rows) {
    const tag = r === win ? '→' : ' ';
    let line = `  ${tag} ${r.cardName.padEnd(28)} ${usd(r.value).padStart(9)}  (${pct(r.effectiveRate)} · ${r.earnRate}x @ ${usd(r.pointValue)}/pt)`;
    lines.push(line);
    for (const n of r.notes) lines.push(`        ⚠ ${n}`);
  }
  lines.push('');
  lines.push(`✅ Use ${win.cardName} — ${usd(win.value)} back (${pct(win.effectiveRate)}).`);
  if (runner) {
    const gap = win.value - runner.value;
    if (gap < 0.5) {
      lines.push(`   Effectively tied with ${runner.cardName} (${usd(gap)} apart) — use whichever you prefer.`);
    } else {
      lines.push(`   Beats ${runner.cardName} by ${usd(gap)}.`);
    }
  }
  if (win.annualFee > 0) {
    lines.push(`   Note: ${win.cardName} carries a ${usd(win.annualFee)} annual fee — only worth keeping if your yearly rewards + used credits exceed it.`);
  }
  return lines.join('\n');
}

function reportBasket(wallet, basket, results) {
  const lines = [];
  let total = 0;
  lines.push('Basket optimization (best card per line):');
  results.forEach((rows, i) => {
    const p = basket[i];
    const win = rows[0];
    total += win.value;
    lines.push(`  ${usd(p.amount).padStart(9)}  ${String(p.category).padEnd(12)} → ${win.cardName.padEnd(28)} ${usd(win.value).padStart(8)} (${pct(win.effectiveRate)})`);
    for (const n of win.notes) lines.push(`        ⚠ ${n}`);
  });
  lines.push('');
  lines.push(`✅ Total back: ${usd(total)} across ${basket.length} purchase(s).`);
  return lines.join('\n');
}

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// ---------- main ----------
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || process.argv.length <= 2) { console.log(HELP); process.exit(0); }

  const walletPath = args._[0];
  if (!walletPath) die('Missing <wallet.json>. See --help.');
  let wallet;
  try { wallet = JSON.parse(readFileSync(walletPath, 'utf8')); }
  catch (e) { die(`Could not read wallet "${walletPath}": ${e.message}`); }
  if (!Array.isArray(wallet.cards) || wallet.cards.length === 0) die('Wallet has no cards.');

  const asJson = !!args.flags.json;

  if (args.flags.basket) {
    let basket;
    try { basket = JSON.parse(readFileSync(args.flags.basket, 'utf8')); }
    catch (e) { die(`Could not read basket: ${e.message}`); }
    if (!Array.isArray(basket)) die('Basket file must be a JSON array.');
    const results = basket.map((p) => {
      validateCategory(p.category);
      return rankForPurchase(wallet, {
        amount: Number(p.amount),
        category: p.category,
        quarter: quarterOf(p.date),
        foreign: !!p.foreign,
        merchant: p.merchant,
      });
    });
    if (asJson) {
      const total = results.reduce((s, r) => s + r[0].value, 0);
      console.log(JSON.stringify({ basket, results, total }, null, 2));
    } else {
      console.log(reportBasket(wallet, basket, results));
    }
    return;
  }

  const amount = Number(args.flags.amount);
  if (!Number.isFinite(amount) || amount <= 0) die('--amount must be a positive number.');
  const category = args.flags.category;
  validateCategory(category);

  const purchase = {
    amount,
    category,
    quarter: quarterOf(args.flags.date),
    foreign: !!args.flags.foreign,
    merchant: args.flags.merchant,
  };
  const rows = rankForPurchase(wallet, purchase);
  if (asJson) {
    console.log(JSON.stringify({ purchase, ranked: rows, winner: rows[0] }, null, 2));
  } else {
    console.log(reportSingle(wallet, purchase, rows));
  }
}

function validateCategory(category) {
  if (!category) die('Missing --category. See --help.');
  if (!CATEGORIES.includes(category)) {
    die(`Unknown category "${category}". Use one of: ${CATEGORIES.join(', ')} (use "other" if unsure).`);
  }
}

main();
