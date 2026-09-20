// Submit approved findings through the Jira Service Management customer portal
// form ("Sales Technologies" -> Salesforce -> Data quality issue) with Playwright.
//
// Uses a persistent browser profile so your SSO login survives between runs:
//   sf-cleanup login            # opens the portal, you sign in once
//   sf-cleanup submit           # dry run: fills the form, screenshots, does NOT press Send
//   sf-cleanup submit --live    # actually presses Send and records the ticket key
//
// The portal's dropdowns are React-Select style widgets. `selectOption` clicks the
// control by its label, types the option text, then clicks the matching option.
// If UiPath's portal markup differs, tune the helpers below (they are the only
// DOM-specific code).

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function openPortal(config, { headless = false } = {}) {
  const userDataDir = config.portal.userDataDir || ".pw-profile";
  await mkdir(userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1280, height: 1400 },
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

/** Interactive login: open the create-request URL and wait until the form's Action field is visible. */
export async function login(config, log = console.log) {
  const { context, page } = await openPortal(config, { headless: false });
  await page.goto(config.portal.createUrl, { waitUntil: "domcontentloaded" });
  log("Complete SSO in the browser window. Waiting for the request form to appear (up to 10 minutes)...");
  await fieldControl(page, "Action").waitFor({ state: "visible", timeout: 600_000 });
  log("Logged in. Browser profile saved; you can close the window.");
  await context.close();
}

/** Locate the form control (input/combobox) that belongs to a visible field label. */
export function fieldControl(page, label) {
  // JSM renders <label>Label<span>*</span></label> followed by the control. getByLabel
  // handles both native inputs and aria-labelledby comboboxes.
  return page.getByLabel(new RegExp(`^\\s*${escapeRe(label)}\\s*\\*?\\s*$`, "i")).first();
}

async function selectOption(page, label, optionText) {
  const control = fieldControl(page, label);
  await control.waitFor({ state: "visible", timeout: 30_000 });
  await control.click();
  await page.keyboard.type(optionText, { delay: 20 });
  const option = page.getByRole("option", { name: optionText, exact: true }).first();
  try {
    await option.waitFor({ state: "visible", timeout: 5_000 });
    await option.click();
  } catch {
    // Fallback: first option that starts with the text, then Enter.
    const loose = page.getByRole("option", { name: new RegExp(`^${escapeRe(optionText)}`, "i") }).first();
    if (await loose.isVisible().catch(() => false)) await loose.click();
    else await page.keyboard.press("Enter");
  }
  // Give the cascading fields time to render.
  await page.waitForTimeout(600);
}

async function fillText(page, label, value) {
  const control = fieldControl(page, label);
  await control.waitFor({ state: "visible", timeout: 30_000 });
  await control.fill(String(value ?? ""));
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/**
 * Fill the form for one finding. Returns { ticketKey, ticketUrl, screenshot }.
 * With live=false the Send button is never clicked.
 */
export async function submitFinding(page, config, finding, { live = false, screenshotDir = "work/screenshots", log = console.log } = {}) {
  const p = finding.proposal;
  if (!p) throw new Error(`${finding.id} has no proposal`);
  const rtConfig = config.form?.requestTypes?.[p.requestType] || {};
  const labelFor = (k) => rtConfig.fields?.[k] || k;

  await page.goto(config.portal.createUrl, { waitUntil: "domcontentloaded" });
  await selectOption(page, "Action", p.action);
  await selectOption(page, "Object", p.object);
  await selectOption(page, `Request Type (${p.object})`, rtConfig.label || p.requestType);

  for (const [key, value] of Object.entries(p.fields)) {
    if (value == null || value === "") continue;
    await fillText(page, labelFor(key), value);
  }

  await mkdir(screenshotDir, { recursive: true });
  const screenshot = join(screenshotDir, `${finding.id}${live ? "" : "-dryrun"}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });

  if (!live) {
    log(`  [dry-run] ${finding.id} ${p.requestType} for "${finding.accountName}" filled; screenshot ${screenshot}`);
    return { ticketKey: null, ticketUrl: null, screenshot };
  }

  await page.getByRole("button", { name: /^send$/i }).click();
  // After submit the portal navigates to /portal/<n>/<KEY-123>. Wait for that or for an error banner.
  await page.waitForURL(/\/portal\/\d+\/[A-Z][A-Z0-9]+-\d+/, { timeout: 60_000 });
  const ticketUrl = page.url();
  const ticketKey = ticketUrl.match(/\/portal\/\d+\/([A-Z][A-Z0-9]+-\d+)/)?.[1] || null;
  log(`  submitted ${finding.id} -> ${ticketKey} ${ticketUrl}`);
  return { ticketKey, ticketUrl, screenshot };
}

/**
 * Diagnostic: walk the cascading dropdowns for each configured request type and print the
 * field labels the portal actually shows, so config.form.requestTypes can be corrected.
 */
export async function formCheck(config, log = console.log) {
  const { context, page } = await openPortal(config, { headless: false });
  await page.goto(config.portal.createUrl, { waitUntil: "domcontentloaded" });
  await selectOption(page, "Action", "Single Update Request");
  await selectOption(page, "Object", "Account");
  const rts = Object.entries(config.form?.requestTypes || {});
  for (const [key, rt] of rts) {
    try {
      await selectOption(page, "Request Type (Account)", rt.label || key);
      const labels = await page.locator("form label").allInnerTexts();
      log(`\n${rt.label || key}:`);
      for (const l of labels) log(`  - ${l.replace(/\s+/g, " ").trim()}`);
    } catch (e) {
      log(`\n${rt.label || key}: could not select (${e.message.split("\n")[0]})`);
    }
  }
  await context.close();
}
