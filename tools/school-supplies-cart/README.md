# school-supplies-cart

Add every **Amazon + Walmart** item from a [DansDeals](https://www.dansdeals.com)
roundup to your cart, driving a real Chrome that's logged into **your** accounts.

> **This only runs on your own machine.** Claude Code on the web can't do it: that
> sandbox's network policy blocks `amazon.com` / `walmart.com` / `dansdeals.com`
> at the proxy, and it has none of your login cookies. Adding to *your* cart needs
> *your* browser session — so you run this locally.
>
> It **adds to cart only**. It never selects a payment method and never places an
> order. You review the carts and check out yourself.

## What it does

1. **Scrape** — opens the roundup, harvests every outbound product link, follows
   DansDeals/affiliate redirects, classifies each as Amazon/Walmart/Target, and
   writes `items.json`.
2. **Cart** — opens each Amazon/Walmart product and clicks **Add to Cart**,
   pausing for you whenever it hits a login, captcha, or variant picker.

## Setup (one time)

Requires [Node.js 18+](https://nodejs.org). Then:

```bash
cd tools/school-supplies-cart
npm install          # installs Playwright + a Chromium build
```

You don't strictly need Chrome installed — the script uses your system Chrome if
present, otherwise falls back to the Chromium that `npm install` fetched.

## Run it

```bash
# 1. Build the shopping list first and eyeball it:
node scrape-and-add.mjs --scrape-only
#    → review items.json (edit/delete lines you don't want)

# 2. Add everything to your carts:
node scrape-and-add.mjs
```

A browser window opens. The **first time**, it'll pause and ask you to log into
Amazon (your Business account) and Walmart in that window — do it once; the login
is saved in `./.browser-profile` and reused on later runs. Then it walks the list,
adding each item and printing a running log, ending with a summary of what it
added and what needs your hand.

## Handy flags

| Flag | Effect |
|------|--------|
| `--url <link>` | Scrape a different roundup URL |
| `--scrape-only` | Phase 1 only — just write `items.json` |
| `--items <path>` | Use a hand-made list instead of scraping |
| `--stores amazon` | Only one store (`amazon` or `walmart`) |
| `--dry-run` | Open each product but don't click Add to Cart |
| `--limit 5` | Only the first 5 items (good for a test run) |
| `--headless` | No visible window (you can't solve captchas — avoid) |
| `--profile <dir>` | Use a different saved-login profile folder |

## Reality check

Amazon and Walmart change their page markup constantly and run bot detection, so
this is **best-effort**:

- Items needing a **variant** (size/color/pack) or that are **out of stock** are
  skipped and listed in the summary.
- On a **captcha / "press & hold"**, the script pauses so you can clear it, then
  continues.
- Anything it can't add gets a **screenshot** in `screenshots/` so you can finish
  it manually in a few clicks.

Nothing here logs, stores, or transmits your credentials — the login lives only in
the local `.browser-profile` folder, which is git-ignored.
