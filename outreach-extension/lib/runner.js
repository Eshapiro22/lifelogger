// Runs recipe steps against the Outreach tab. Lives in the dashboard page
// (not the service worker) so a long run isn't cut off when MV3 suspends
// the worker, and so page navigations don't lose runner state.

export function interpolate(value, vars) {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
      for (const name of expr.split('|')) {
        const v = vars[name.trim()];
        if (v != null && String(v).trim() !== '') return String(v);
      }
      return '';
    });
  }
  if (Array.isArray(value)) return value.map(v => interpolate(v, vars));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, vars)]));
  }
  return value;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function waitForTabLoad(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out waiting for page to load'));
    }, timeout);
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function ensureContentScript(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    if (res?.ok) return;
  } catch { /* not injected yet */ }
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

export class FatalError extends Error {}

// Prefers the Outreach tab you're looking at, then any Outreach tab.
export async function getOutreachTab() {
  const tabs = await chrome.tabs.query({ url: 'https://*.outreach.io/*' });
  const usable = tabs.filter(t => t.status === 'complete' || t.url);
  const tab = usable.find(t => t.active) || usable[0];
  if (tab) return tab;
  throw new FatalError('No Outreach tab is open. Open Outreach in a tab, log in, and try again.');
}

async function openTab(url) {
  // Open blank, then navigate, so the load can be awaited the same way as in-tab navigation.
  const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
  await sleep(300);
  const loaded = waitForTabLoad(tab.id);
  await chrome.tabs.update(tab.id, { url });
  await loaded;
  return tab.id;
}

// Runs one step in ctx.tabId. A navigate step with newTab opens its own tab
// and points ctx.tabId at it for the following steps.
// Returns { ok, skipped?, detail? }; throws on failure.
export async function runStep(ctx, rawStep, vars, { dryRun }) {
  if (rawStep.if && !vars[rawStep.if]) return { ok: true, skipped: true, detail: `skipped (no ${rawStep.if})` };
  if (rawStep.unless && vars[rawStep.unless]) return { ok: true, skipped: true, detail: `skipped (has ${rawStep.unless})` };
  if (rawStep.dryRunOnly && !dryRun) return { ok: true, skipped: true };

  const step = interpolate(rawStep, vars);
  let tabId = ctx.tabId;
  try {
    if (step.action === 'navigate') {
      if (step.newTab) {
        tabId = ctx.tabId = await openTab(step.url);
        ctx.openedTabs.push(tabId);
      } else {
        const loaded = waitForTabLoad(tabId);
        await chrome.tabs.update(tabId, { url: step.url });
        await loaded;
      }
      await sleep(step.settle ?? 1000); // single-page apps keep rendering after "complete"
      try {
        await chrome.scripting.executeScript({ target: { tabId }, func: () => true });
      } catch (err) {
        // Chrome shows its own error page (bad address, DNS, redirect loop) — every lead would fail the same way.
        throw new FatalError(`Page failed to load: ${step.url} (${err.message}). Fix the "navigate" URL in the find recipe.`);
      }
      return { ok: true };
    }
    if (step.action === 'pause') {
      await sleep(Number(step.ms) || 0);
      return { ok: true };
    }
    await ensureContentScript(tabId);
    const res = await chrome.tabs.sendMessage(tabId, { type: 'step', step, dryRun });
    if (!res?.ok) throw new Error(res?.error || 'Step failed');
    return res;
  } catch (err) {
    if (err instanceof FatalError) throw err;
    if (step.optional) return { ok: true, skipped: true, detail: `optional step failed: ${err.message}` };
    throw new Error(`${describeStep(step)}: ${err.message}`);
  }
}

export function describeStep(step) {
  const t = step.target || {};
  const what = t.text ? `"${[].concat(t.text).join('" / "')}"` : t.label ? `[${t.label}]` : t.selector || '';
  switch (step.action) {
    case 'navigate': return `go to ${step.url}`;
    case 'type': return `type into ${what}`;
    case 'click': return `click ${what}${step.final ? ' (final)' : ''}`;
    case 'pickResult': return 'pick matching prospect';
    default: return `${step.action} ${what}`.trim();
  }
}

// Runs a list of steps; onFinal (optional) is awaited before any live final
// click and may return false to cancel the lead.
export async function runSteps(ctx, steps, vars, opts) {
  const log = [];
  for (const step of steps) {
    if (opts.shouldStop?.()) throw new Error('Stopped');
    if (step.final && !opts.dryRun && opts.onFinal) {
      const go = await opts.onFinal(interpolate(step, vars));
      if (!go) throw new Error('Cancelled at confirmation');
    }
    const res = await runStep(ctx, step, vars, opts);
    log.push(res.detail || describeStep(interpolate(step, vars)) + (res.skipped ? ' (skipped)' : ''));
  }
  return log;
}
