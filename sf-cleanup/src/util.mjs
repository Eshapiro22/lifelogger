// Small shared helpers: CSV parsing/writing, name + domain normalization, a
// concurrency pool, and JSON file IO. No dependencies.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

/** RFC 4180-ish CSV parser (handles quoted fields, embedded commas/newlines, CRLF, BOM). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function toCsv(headers, records) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of records) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n") + "\n";
}

const LEGAL_SUFFIXES = [
  "inc", "incorporated", "llc", "l l c", "ltd", "limited", "plc", "corp", "corporation", "co",
  "company", "gmbh", "ag", "sa", "s a", "sas", "sarl", "srl", "bv", "b v", "nv", "n v", "oy", "ab",
  "as", "a s", "pty", "pte", "kk", "k k", "llp", "lp", "holdings", "holding", "group", "the",
];
const LEGAL_RE = new RegExp(`\\b(${LEGAL_SUFFIXES.map((s) => s.replace(/ /g, "\\s?")).join("|")})\\b`, "g");

/** Normalize a company name for duplicate detection. "The Acme Corp., Inc." -> "acme" */
export function normalizeName(name) {
  if (!name) return "";
  let n = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  n = n.replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ");
  n = n.replace(LEGAL_RE, " ");
  return n.replace(/\s+/g, " ").trim();
}

/** Very small "registrable domain" extraction. Not a full public-suffix list. */
export function registrableDomain(urlOrHost) {
  if (!urlOrHost) return "";
  let host = String(urlOrHost).trim().toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(host)) host = "http://" + host;
  try { host = new URL(host).hostname; } catch { return ""; }
  host = host.replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  const twoLevel = new Set(["co", "com", "org", "net", "gov", "ac", "edu", "ne", "or", "go"]);
  const last = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  if (last.length === 2 && twoLevel.has(second) && parts.length >= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

export function looksLikeUrl(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(s);
}

/** Run `fn` over `items` with at most `n` in flight. Preserves order. */
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  return out;
}

export async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
