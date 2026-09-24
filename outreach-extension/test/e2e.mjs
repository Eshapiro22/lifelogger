// End-to-end test: loads the unpacked extension in Chromium and runs it against
// test/mock-outreach.html, served in place of https://app.outreach.io via request
// interception. Nothing touches the real Outreach.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')); }
const { chromium } = playwright;

const here = dirname(fileURLToPath(import.meta.url));
const extDir = join(here, '..');
const mockHtml = readFileSync(join(here, 'mock-outreach.html'), 'utf8');

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});

const events = [];
let breakProspectsPage = false;
await context.route('https://app.outreach.io/**', async route => {
  const req = route.request();
  if (breakProspectsPage && new URL(req.url()).pathname === '/prospects') return route.abort('namenotresolved');
  if (req.url().endsWith('/__event')) {
    events.push(JSON.parse(req.postData()));
    return route.fulfill({ status: 204 });
  }
  return route.fulfill({ status: 200, contentType: 'text/html', body: mockHtml });
});

let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;

// The extension works in the user's existing Outreach tab.
const outreachTab = await context.newPage();
await outreachTab.goto('https://app.outreach.io/');

async function run({ mode, name, dryRun }) {
  const page = await context.newPage();
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => console.error('page error:', e));
  await page.goto(`chrome-extension://${extId}/app.html`);
  await page.setInputFiles('#csvFile', join(here, 'sample-leads.csv'));
  await page.check(`input[name=mode][value=${mode}]`);
  await page.fill(mode === 'sequence' ? '#sequenceName' : '#templateName', name);
  await page.fill('#delayMin', '0');
  await page.fill('#delayMax', '0');
  if (!dryRun) await page.uncheck('#dryRun');
  await page.check('#includeDone');
  await page.click('#startBtn');
  await page.waitForFunction(() => /Run finished|Stopped\./.test(document.querySelector('#log').textContent), null, { timeout: 120000 });
  const logText = await page.textContent('#log');
  const statuses = await page.$$eval('#leadTable tbody tr', trs => trs.map(tr => [tr.children[1].textContent, tr.children[4].textContent, tr.children[5].textContent]));
  await page.close();
  statuses.log = logText;
  return statuses;
}

try {
  // Dry run: nothing should be sent.
  let s = await run({ mode: 'sequence', name: 'Q4 Outbound', dryRun: true });
  console.table(s);
  assert.equal(events.length, 0, 'dry run must not click the final button');
  assert.deepEqual(s.map(r => r[1]), ['dry-run', 'dry-run', 'review', 'review', 'skipped']);
  // One search tab per lead: closed when it went fine, left open for review otherwise.
  const openSearches = () => context.pages().map(p => p.url()).filter(u => u.includes('/prospects?search=')).map(u => new URL(u).searchParams.get('search')).sort();
  assert.deepEqual(openSearches(), ['Chris Lee', 'Pat Nobody']);
  for (const p of context.pages()) if (p.url().includes('/prospects?search=')) await p.close();

  // Live sequence run.
  s = await run({ mode: 'sequence', name: 'Q4 Outbound', dryRun: false });
  console.table(s);
  assert.deepEqual(s.map(r => r[1]), ['done', 'done', 'review', 'review', 'skipped']);
  assert.match(s[2][2], /Ambiguous/);
  assert.match(s[3][2], /No matching prospect/);
  assert.deepEqual(events, [
    { type: 'sequence', prospect: 'Jane Doe', company: 'Acme Corp', sequence: 'Q4 Outbound' },
    { type: 'sequence', prospect: 'John Smith', company: 'Globex', sequence: 'Q4 Outbound' },
  ]);

  // Live one-off email run.
  events.length = 0;
  s = await run({ mode: 'email', name: 'LinkedIn intro v2', dryRun: false });
  console.table(s);
  assert.deepEqual(events, [
    { type: 'email', prospect: 'Jane Doe', company: 'Acme Corp', template: 'LinkedIn intro v2' },
    { type: 'email', prospect: 'John Smith', company: 'Globex', template: 'LinkedIn intro v2' },
  ]);

  // A page that fails to load stops the whole run instead of failing every lead.
  events.length = 0;
  breakProspectsPage = true;
  s = await run({ mode: 'email', name: 'LinkedIn intro v2', dryRun: true });
  breakProspectsPage = false;
  assert.match(s.log, /Run stopped: Page failed to load: https:\/\/app\.outreach\.io\/prospects/);
  assert.equal(s[0][1], 'pending', 'the lead in progress goes back to pending');
  assert.ok(!s.some(r => ['failed', 'review'].includes(r[1])), 'no lead is blamed for a page that failed to load');
  assert.equal((s.log.match(/✗/g) || []).length, 0);
  assert.equal(events.length, 0);

  console.log('e2e tests passed');
} finally {
  await context.close();
}
