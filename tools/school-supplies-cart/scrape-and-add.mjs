#!/usr/bin/env node
/**
 * scrape-and-add.mjs
 *
 * Add every Amazon + Walmart item from a DansDeals roundup to your cart,
 * driving a real Chrome that is logged into YOUR accounts.
 *
 * WHY THIS RUNS LOCALLY (not in Claude Code on the web):
 *   - The web sandbox's network policy blocks amazon.com / walmart.com /
 *     dansdeals.com at the proxy (403 on CONNECT), so it physically can't
 *     reach any of them.
 *   - Adding to *your* cart needs *your* logged-in session. This script uses
 *     a persistent browser profile you log into once; the login sticks for
 *     future runs.
 *
 * TWO PHASES
 *   1. SCRAPE  – open the roundup URL, harvest every outbound product link,
 *                resolve DansDeals/affiliate redirects, classify by store,
 *                and write items.json.
 *   2. CART    – open each Amazon/Walmart product and click "Add to Cart".
 *                Pauses for you on captchas / logins / variant pickers.
 *
 * USAGE
 *   npm install                 # one-time (installs Playwright + Chromium)
 *   node scrape-and-add.mjs --scrape-only          # just build items.json
 *   node scrape-and-add.mjs                         # scrape (if needed) + add to cart
 *   node scrape-and-add.mjs --items ./items.json    # skip scrape, use a file
 *   node scrape-and-add.mjs --stores amazon         # only one store
 *
 * FLAGS
 *   --url <link>        Roundup URL to scrape (defaults to the school-supplies one)
 *   --scrape-only       Phase 1 only; write items.json and exit
 *   --items <path>      Load items from JSON instead of scraping
 *   --stores <list>     Comma list of amazon,walmart (default: both)
 *   --profile <dir>     Browser profile dir (default: ./.browser-profile)
 *   --headless          Run headless (NOT recommended – you can't solve captchas)
 *   --dry-run           Open each product page but do NOT click Add to Cart
 *   --limit <n>         Only process the first n items (handy for testing)
 *
 * NOTE: Amazon/Walmart change their markup and run bot detection. This is
 * best-effort: it handles the common cases, screenshots anything it can't do,
 * and prints a summary so you can finish the stragglers by hand. It never
 * places an order — it only adds to the cart.
 */

import { chromium } from "playwright";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve as pathResolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_URL =
  "https://www.dansdeals.com/shopping-deals/amazon/huge-school-supplies-roundup-crayons-from-0-25-notebooks-from-0-35-and-much-more-from-amazon-walmart-and-target/";

// ---------- tiny arg parser ----------
function parseArgs(argv) {
  const a = {
    url: DEFAULT_URL,
    scrapeOnly: false,
    items: null,
    stores: ["amazon", "walmart"],
    profile: join(__dirname, ".browser-profile"),
    headless: false,
    dryRun: false,
    limit: Infinity,
  };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--scrape-only") a.scrapeOnly = true;
    else if (t === "--headless") a.headless = true;
    else if (t === "--dry-run") a.dryRun = true;
    else if (t === "--url") a.url = argv[++i];
    else if (t === "--items") a.items = argv[++i];
    else if (t === "--profile") a.profile = pathResolve(argv[++i]);
    else if (t === "--limit") a.limit = parseInt(argv[++i], 10) || Infinity;
    else if (t === "--stores")
      a.stores = argv[++i].split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return a;
}

const args = parseArgs(process.argv);
const ITEMS_PATH = join(__dirname, "items.json");
const SHOTS_DIR = join(__dirname, "screenshots");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const rl = createInterface({ input, output });
const pause = (msg) => rl.question(`\n⏸  ${msg}\n   Press Enter to continue… `);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A link points at a store if its final URL lands on that domain.
function classify(url) {
  const u = url.toLowerCase();
  if (/(^|\.)amazon\.|amzn\.to|a\.co\//.test(u)) return "amazon";
  if (/(^|\.)walmart\.com/.test(u)) return "walmart";
  if (/(^|\.)target\.com/.test(u)) return "target";
  return null;
}

// Links worth resolving: direct store links, Amazon short links, DansDeals
// redirect hops, and the affiliate shorteners the roundups use.
function looksLikeProductLink(href) {
  return /amazon\.|amzn\.to|a\.co\/|walmart\.com|target\.com|geni\.us|dansdeals\.com\/(go|track|out)\/|shareasale|avantlink|rstyle|prf\.hn/i.test(
    href
  );
}

// ---------- Phase 1: scrape ----------
async function scrape(context, url) {
  console.log(`\n🔎 Scraping roundup:\n   ${url}\n`);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2500);

  // Grab candidate links from the article body (fall back to whole page).
  const raw = await page.evaluate(() => {
    const scope =
      document.querySelector(
        ".entry-content, article .content, article, .post-content, main"
      ) || document.body;
    const seen = [];
    scope.querySelectorAll("a[href]").forEach((el) => {
      const href = el.href;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (href) seen.push({ href, text });
    });
    return seen;
  });

  const candidates = raw.filter((r) => looksLikeProductLink(r.href));
  console.log(`   Found ${candidates.length} candidate links. Resolving redirects…`);

  const resolved = [];
  const seenFinal = new Set();
  for (const c of candidates) {
    let finalUrl = c.href;
    try {
      // Follow redirects without rendering: cheaper and dodges some walls.
      const res = await context.request.get(c.href, {
        maxRedirects: 8,
        timeout: 30_000,
        headers: { "User-Agent": UA },
      });
      finalUrl = res.url() || c.href;
    } catch {
      // If resolution fails, keep the original href; classify may still work.
    }
    const store = classify(finalUrl);
    if (!store) continue;
    const key = finalUrl.split(/[?#]/)[0];
    if (seenFinal.has(key)) continue;
    seenFinal.add(key);
    resolved.push({ store, url: finalUrl, name: c.text || "(unnamed)", source: c.href });
    process.stdout.write(`   • ${store.padEnd(7)} ${(c.text || "").slice(0, 60)}\n`);
  }

  await page.close();
  const items = resolved.sort((a, b) => a.store.localeCompare(b.store));
  await writeFile(ITEMS_PATH, JSON.stringify(items, null, 2));
  console.log(`\n💾 Wrote ${items.length} items → ${ITEMS_PATH}`);
  return items;
}

// ---------- login gate ----------
async function ensureLoggedIn(context, store) {
  const page = await context.newPage();
  try {
    if (store === "amazon") {
      await page.goto("https://www.amazon.com/gp/css/homepage.html", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const greeting = await page
        .locator("#nav-link-accountList")
        .innerText()
        .catch(() => "");
      if (/sign in|hello, sign/i.test(greeting) || /ap\/signin/.test(page.url())) {
        await pause(
          "Log into AMAZON (Business account) in the open window, then come back."
        );
      } else {
        console.log("   ✓ Amazon appears logged in.");
      }
    } else if (store === "walmart") {
      await page.goto("https://www.walmart.com/account", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      if (/\/account\/login|sign in/i.test(page.url() + (await page.title()))) {
        await pause("Log into WALMART in the open window, then come back.");
      } else {
        console.log("   ✓ Walmart appears logged in.");
      }
    }
  } finally {
    await page.close();
  }
}

// ---------- add to cart: Amazon ----------
async function addAmazon(page, item) {
  await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);

  if (await page.locator("form[action*='validateCaptcha'], #captchacharacters").count()) {
    await pause(`Amazon captcha on "${item.name}". Solve it, then continue.`);
  }

  const atc = page.locator("#add-to-cart-button, input#add-to-cart-button");
  if (!(await atc.count())) {
    // Variation products need a selection first.
    return { ok: false, reason: "no add-to-cart button (variant/unavailable?)" };
  }
  await atc.first().click({ timeout: 15_000 });
  await page.waitForTimeout(1500);

  // Optional protection-plan / warranty interstitial.
  const skip = page.locator(
    "#attachSiNoCoverage input, input[aria-labelledby*='NoCoverage'], #siNoCoverage"
  );
  if (await skip.count()) await skip.first().click().catch(() => {});

  const added =
    (await page.locator("#huc-v2-order-row-confirm-text, #sw-atc-details-single-container, #NATC_SMART_WAGON_CONF_MSG_SUCCESS").count()) > 0 ||
    /cart/i.test(page.url());
  return added ? { ok: true } : { ok: false, reason: "clicked but no confirmation" };
}

// ---------- add to cart: Walmart ----------
async function addWalmart(page, item) {
  await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2000);

  if (await page.locator("text=/press & hold|verify you are a human|robot/i").count()) {
    await pause(`Walmart bot-check on "${item.name}". Clear it, then continue.`);
  }

  const atc = page.locator(
    "[data-automation-id='atc'], [data-testid='add-to-cart-section'] button, button:has-text('Add to cart')"
  );
  if (!(await atc.count())) {
    return { ok: false, reason: "no add-to-cart button (variant/out of stock?)" };
  }
  await atc.first().click({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  const confirmed =
    (await page.locator("text=/added to cart|in your cart|view cart/i").count()) > 0;
  return confirmed ? { ok: true } : { ok: false, reason: "clicked but no confirmation" };
}

// ---------- Phase 2: cart ----------
async function addAll(context, items) {
  await mkdir(SHOTS_DIR, { recursive: true });
  const wanted = items.filter((it) => args.stores.includes(it.store)).slice(0, args.limit);
  console.log(`\n🛒 Adding ${wanted.length} item(s) across: ${args.stores.join(", ")}`);

  const stores = [...new Set(wanted.map((w) => w.store))];
  for (const s of stores) await ensureLoggedIn(context, s);

  const page = await context.newPage();
  const results = [];
  let i = 0;
  for (const item of wanted) {
    i++;
    const label = `[${i}/${wanted.length}] ${item.store}: ${item.name.slice(0, 55)}`;
    process.stdout.write(`\n${label}\n   ${item.url}\n`);
    if (args.dryRun) {
      await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      results.push({ ...item, ok: null, reason: "dry-run" });
      continue;
    }
    try {
      const r =
        item.store === "amazon"
          ? await addAmazon(page, item)
          : await addWalmart(page, item);
      if (r.ok) console.log("   ✅ added");
      else {
        console.log(`   ⚠️  ${r.reason}`);
        const shot = join(SHOTS_DIR, `item-${i}-${item.store}.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      }
      results.push({ ...item, ...r });
    } catch (e) {
      console.log(`   ❌ error: ${e.message}`);
      results.push({ ...item, ok: false, reason: e.message });
    }
    await sleep(1200 + Math.floor(Math.random() * 1500)); // be gentle
  }
  await page.close();
  return results;
}

// ---------- main ----------
async function main() {
  const context = await chromium.launchPersistentContext(args.profile, {
    headless: args.headless,
    channel: "chrome", // use real Chrome if installed
    viewport: { width: 1280, height: 900 },
    userAgent: UA,
    args: ["--disable-blink-features=AutomationControlled"],
  }).catch(async () => {
    // Fall back to Playwright's bundled Chromium if system Chrome is absent.
    console.log("   (system Chrome not found — using bundled Chromium)");
    return chromium.launchPersistentContext(args.profile, {
      headless: args.headless,
      viewport: { width: 1280, height: 900 },
      userAgent: UA,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  });

  try {
    // Load or build the item list.
    let items;
    if (args.items) {
      items = JSON.parse(await readFile(pathResolve(args.items), "utf8"));
    } else if (await access(ITEMS_PATH).then(() => true).catch(() => false) && args.scrapeOnly === false) {
      // Reuse an existing items.json unless we're explicitly re-scraping.
      items = JSON.parse(await readFile(ITEMS_PATH, "utf8"));
      console.log(`ℹ️  Reusing ${items.length} items from ${ITEMS_PATH} (delete it to re-scrape).`);
    } else {
      items = await scrape(context, args.url);
    }

    if (args.scrapeOnly) {
      console.log("\nDone (scrape-only). Review items.json, then run without --scrape-only.");
      return;
    }

    const results = await addAll(context, items);

    // Summary.
    const ok = results.filter((r) => r.ok === true).length;
    const skipped = results.filter((r) => r.ok === null).length;
    const failed = results.filter((r) => r.ok === false);
    console.log("\n────────── SUMMARY ──────────");
    console.log(`  ✅ added:   ${ok}`);
    if (skipped) console.log(`  ⏭  dry-run: ${skipped}`);
    console.log(`  ⚠️  needs you: ${failed.length}`);
    for (const f of failed) console.log(`     - ${f.store}: ${f.name.slice(0, 50)} (${f.reason})`);
    console.log("\nCarts are populated but NO order was placed — review & check out yourself.");
    if (failed.length) console.log(`Screenshots of the stragglers are in ${SHOTS_DIR}`);
  } finally {
    await pause("All done — press Enter to close the browser.");
    await context.close();
    rl.close();
  }
}

main().catch((e) => {
  console.error("\nFatal:", e);
  rl.close();
  process.exit(1);
});
