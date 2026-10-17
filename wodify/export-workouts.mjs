#!/usr/bin/env node
// Export every posted workout from Wodify.
//
// How it works (no guessing at Wodify's private API):
//   1. Opens a real browser window. You log in and open the Workout tab yourself.
//   2. The script watches network traffic until it sees a response containing the
//      text you passed with --match (e.g. a movement from the workout on screen).
//      That request is "the workout request" for the date in --date.
//   3. It replays that same request in your logged-in session for every date in
//      the range, swapping in each date, and saves each raw response.
//   4. It flattens the responses into workouts.json / workouts.csv / workouts.md.
//
// Usage:
//   node export-workouts.mjs run --match "Squat clean" --date 2026-10-17 [--from 2012-01-01] [--to 2026-10-17]
//   node export-workouts.mjs extract          # rebuild outputs from saved raw responses
//
// Re-running `run` skips dates already saved, so it is safe to stop and resume.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'output');
const RAW = path.join(OUT, 'raw');
const PROFILE = path.join(HERE, '.browser-profile');
const TEMPLATE_FILE = path.join(OUT, 'request-template.json');

// Headers the browser sets itself; fetch() refuses or ignores them.
const SKIP_HEADERS = new Set([
  'host', 'cookie', 'content-length', 'connection', 'origin', 'referer',
  'accept-encoding', 'user-agent', 'sec-fetch-site', 'sec-fetch-mode',
  'sec-fetch-dest', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
]);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parseIso = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Expected YYYY-MM-DD, got "${s}"`);
  return new Date(`${s}T00:00:00Z`);
};

// Every textual form a date might take inside a request URL or body.
function dateForms(d) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  return {
    iso: `${y}-${pad(m)}-${pad(day)}`,
    us: `${pad(m)}/${pad(day)}/${y}`,
    usShort: `${m}/${day}/${y}`,
    usEnc: encodeURIComponent(`${pad(m)}/${pad(day)}/${y}`),
    compact: `${y}${pad(m)}${pad(day)}`,
  };
}

function findDateFormat(text, d) {
  const forms = dateForms(d);
  // Longest/most specific forms first so "iso" wins over overlapping matches.
  for (const key of ['iso', 'us', 'usEnc', 'usShort', 'compact']) {
    if (text.includes(forms[key])) return key;
  }
  return null;
}

const fillDate = (text, fromDate, toDate, fmt) =>
  text.split(dateForms(fromDate)[fmt]).join(dateForms(toDate)[fmt]);

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function captureTemplate(page, match, anchorDate) {
  const needle = match.toLowerCase();
  console.log(`\nWaiting for a network response that contains "${match}"...`);
  console.log('  1. Log in to Wodify in the browser window.');
  console.log('  2. Open the Workout tab.');
  console.log(`  3. Pick ${isoDate(anchorDate)} in the date selector (the day whose workout contains "${match}").`);
  console.log('  If it is already showing, switch to another day and back to trigger a fresh load.\n');

  return new Promise((resolve) => {
    const onResponse = async (response) => {
      try {
        const req = response.request();
        if (!['xhr', 'fetch'].includes(req.resourceType())) return;
        const body = await response.text().catch(() => '');
        if (!body.toLowerCase().includes(needle)) return;

        const url = req.url();
        const postData = req.postData() || '';
        const fmt = findDateFormat(url + '\n' + postData, anchorDate);
        console.log(`Found "${match}" in a response from ${url.split('?')[0]}`);
        if (!fmt) {
          console.log(`  ...but ${isoDate(anchorDate)} does not appear in that request, so it can't be replayed for other dates.`);
          console.log('  Check that --date matches the day shown on screen. Still watching...\n');
          return;
        }
        const headers = {};
        for (const [k, v] of Object.entries(await req.allHeaders())) {
          if (!SKIP_HEADERS.has(k.toLowerCase()) && !k.startsWith(':')) headers[k] = v;
        }
        page.off('response', onResponse);
        resolve({ url, method: req.method(), headers, postData, dateFormat: fmt, anchorDate: isoDate(anchorDate) });
      } catch { /* responses can vanish on navigation; ignore */ }
    };
    page.on('response', onResponse);
  });
}

async function replay(page, tpl, date) {
  const anchor = parseIso(tpl.anchorDate);
  const url = fillDate(tpl.url, anchor, date, tpl.dateFormat);
  const body = tpl.postData ? fillDate(tpl.postData, anchor, date, tpl.dateFormat) : undefined;
  // Run inside the page so the session cookies and same-origin rules apply.
  return page.evaluate(async ({ url, method, headers, body }) => {
    const res = await fetch(url, { method, headers, body, credentials: 'include' });
    return { status: res.status, text: await res.text() };
  }, { url, method: tpl.method, headers: tpl.headers, body });
}

// ---------- extraction ----------

const stripHtml = (s) => s
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// Strings that are clearly IDs, flags, timestamps or URLs rather than workout text.
const NOISE = [
  /^-?\d+(\.\d+)?$/, /^(true|false|null)$/i, /^[0-9a-f-]{20,}$/i,
  /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/, /^https?:\/\//i, /^[A-Za-z0-9+/=]{40,}$/,
];

function collectStrings(node, out) {
  if (typeof node === 'string') {
    const s = stripHtml(node);
    if (s.length > 1 && !NOISE.some((re) => re.test(s))) out.push(s);
  } else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => collectStrings(n, out));
  return out;
}

function extractText(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return stripHtml(raw); }
  return [...new Set(collectStrings(parsed, []))].join('\n');
}

function buildOutputs() {
  if (!fs.existsSync(RAW)) { console.log('No raw responses yet. Run the `run` command first.'); return; }
  const files = fs.readdirSync(RAW).filter((f) => /^\d{4}-\d{2}-\d{2}\.txt$/.test(f)).sort();
  const texts = files.map((f) => ({ date: f.slice(0, 10), text: extractText(fs.readFileSync(path.join(RAW, f), 'utf8')) }));

  // Text that shows up on nearly every day, workout or not (program name, UI labels), is boilerplate.
  const lineCounts = new Map();
  for (const { text } of texts) for (const line of new Set(text.split('\n'))) lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
  const common = new Set([...lineCounts].filter(([, n]) => texts.length >= 20 && n / texts.length > 0.9).map(([l]) => l));

  const workouts = texts
    .map(({ date, text }) => ({ date, workout: text.split('\n').filter((l) => !common.has(l)).join('\n').trim() }))
    .filter((w) => w.workout.length > 0);

  fs.writeFileSync(path.join(OUT, 'workouts.json'), JSON.stringify(workouts, null, 2));
  const csvCell = (s) => `"${s.replace(/"/g, '""')}"`;
  fs.writeFileSync(path.join(OUT, 'workouts.csv'),
    'date,workout\n' + workouts.map((w) => `${w.date},${csvCell(w.workout)}`).join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'workouts.md'),
    workouts.slice().reverse().map((w) => `## ${w.date}\n\n${w.workout}\n`).join('\n'));
  console.log(`Wrote ${workouts.length} days with workouts (of ${files.length} days fetched) to ${OUT}`);
}

// ---------- main ----------

async function run(args) {
  if (!args.match) throw new Error('Pass --match "<text from the workout on screen>", e.g. --match "Squat clean"');
  const today = isoDate(new Date());
  const anchor = parseIso(args.date || today);
  const from = parseIso(args.from || '2012-01-01');
  const to = parseIso(args.to || today);
  const delayMs = Number(args.delay ?? 400);
  fs.mkdirSync(RAW, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE, { headless: Boolean(args.headless), viewport: { width: 430, height: 900 } });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(args.url || 'https://app.wodify.com');

  const tpl = await captureTemplate(page, args.match, anchor);
  fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(tpl, null, 2));
  console.log(`Captured the workout request (date format: ${tpl.dateFormat}). Template saved to ${TEMPLATE_FILE}`);

  // Sanity check: replaying the anchor date must return the same workout.
  const check = await replay(page, tpl, anchor);
  if (check.status !== 200 || !check.text.toLowerCase().includes(String(args.match).toLowerCase())) {
    console.log(`Replay check failed (HTTP ${check.status}). First 500 chars of the response:\n${check.text.slice(0, 500)}`);
    await context.close();
    process.exit(1);
  }
  console.log('Replay check passed. Fetching every date, newest first...\n');

  let fetched = 0, skipped = 0, failures = 0;
  for (let d = new Date(to); d >= from; d.setUTCDate(d.getUTCDate() - 1)) {
    const day = isoDate(d);
    const file = path.join(RAW, `${day}.txt`);
    if (fs.existsSync(file)) { skipped++; continue; }
    try {
      const res = await replay(page, tpl, d);
      if (res.status === 401 || res.status === 403) {
        console.log(`\nHTTP ${res.status} on ${day}: the session probably expired. Re-run the command to log in again; finished dates are kept.`);
        break;
      }
      if (res.status !== 200) { failures++; console.log(`${day}: HTTP ${res.status}`); continue; }
      fs.writeFileSync(file, res.text);
      fetched++;
      if (fetched % 50 === 0) console.log(`...${fetched} days fetched (at ${day})`);
    } catch (e) {
      failures++;
      console.log(`${day}: ${e.message}`);
      if (failures > 25) { console.log('Too many failures, stopping. Re-run to resume.'); break; }
    }
    await page.waitForTimeout(delayMs);
  }
  console.log(`\nDone. fetched=${fetched} already-had=${skipped} failed=${failures}`);
  await context.close();
  buildOutputs();
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (cmd === 'run') await run(args);
else if (cmd === 'extract') buildOutputs();
else {
  console.log('Usage:\n  node export-workouts.mjs run --match "Squat clean" --date 2026-10-17 [--from 2012-01-01] [--to YYYY-MM-DD] [--url https://app.wodify.com]\n  node export-workouts.mjs extract');
  if (cmd) process.exit(1);
}
