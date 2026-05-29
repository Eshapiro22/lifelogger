#!/usr/bin/env node
/**
 * Dunkapedia driver — in-process static server + Playwright.
 * Usage: node .claude/skills/run-dunkapedia/driver.mjs [screenshot-dir]
 *
 * Screenshots land at <screenshot-dir>/dunkapedia-*.png (default: /tmp)
 *
 * NOTE: External resources (YouTube thumbnails, Google Fonts) fail with
 * ERR_CERT_AUTHORITY_INVALID in sandboxed containers — expected, doesn't
 * affect catalog functionality or JS execution.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../../..');
const PORT = 8765;
const OUT  = process.argv[2] ?? '/tmp';
const BASE = `http://localhost:${PORT}`;

const MIME = {
  '.html':'text/html','.css':'text/css','.js':'application/javascript',
  '.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon',
};

// ── In-process static server ─────────────────────────────────────────────────
const srv = createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const filePath = join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const data = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(ok => srv.listen(PORT, '127.0.0.1', ok));
console.log('Server ready on', BASE);

// ── Launch Playwright ────────────────────────────────────────────────────────
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));

// ── 1. Homepage ───────────────────────────────────────────────────────────────
// app.js runs synchronously at DOMContentLoaded; catalog & stats are populated immediately.
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

const dunks   = await page.$eval('#stat-dunks',   el => el.textContent.trim());
const players = await page.$eval('#stat-players', el => el.textContent.trim());
const eras    = await page.$eval('#stat-years',   el => el.textContent.trim());
console.log(`Catalog: ${dunks} dunks · ${players} players · ${eras} eras`);
await page.screenshot({ path: `${OUT}/dunkapedia-home.png` });

// ── 2. Scroll to catalog + player filter ─────────────────────────────────────
// Use scrollIntoView rather than .click() on hash link to avoid re-navigation
await page.evaluate(() => document.getElementById('catalog').scrollIntoView());
await page.waitForTimeout(200);
await page.selectOption('#player-filter', { index: 1 });
await page.waitForTimeout(300);
const playerResult = await page.$eval('#results-count', el => el.textContent.trim());
console.log('Player filter:', playerResult);
await page.screenshot({ path: `${OUT}/dunkapedia-filtered.png` });

// ── 3. Type filter ────────────────────────────────────────────────────────────
await page.selectOption('#player-filter', '');
await page.selectOption('#type-filter', { index: 1 });
await page.waitForTimeout(300);
const typeResult = await page.$eval('#results-count', el => el.textContent.trim());
console.log('Type filter:', typeResult);

// ── 4. Text search ─────────────────────────────────────────────────────────────
await page.selectOption('#type-filter', '');
await page.fill('#catalog-search', 'Jordan');
await page.waitForTimeout(300);
const searchResult = await page.$eval('#results-count', el => el.textContent.trim());
console.log('Catalog search "Jordan":', searchResult);
await page.fill('#catalog-search', '');

// ── 5. Surprise Me → modal ────────────────────────────────────────────────────
await page.click('#random-dunk');
await page.waitForSelector('#video-modal[open]', { timeout: 5000 });
const modalTitle = await page.$eval('#modal-title', el => el.textContent.trim());
console.log('Random dunk modal:', modalTitle);
await page.screenshot({ path: `${OUT}/dunkapedia-modal.png` });
await page.evaluate(() => document.querySelector('#video-modal').close());

// ── 6. Clip Finder ────────────────────────────────────────────────────────────
await page.fill('#youtube-query', 'LeBron poster');
await page.click('#youtube-search-button');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/dunkapedia-search.png` });

// ── Wrap-up ───────────────────────────────────────────────────────────────────
if (jsErrors.length) console.warn('JS errors:', jsErrors);
else console.log('No JS runtime errors');
console.log(`Screenshots → ${OUT}/dunkapedia-*.png`);

await browser.close();
srv.close();
