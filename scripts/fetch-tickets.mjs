#!/usr/bin/env node
/**
 * fetch-tickets.mjs
 *
 * Reads data/matches.json (curated Northeast World Cup 2026 fixtures), looks up
 * the current cheapest price for each match from a ticketing API, and writes
 * tickets.json at the repo root for the static page to render.
 *
 * Providers (use whichever key is present, in this order):
 *   - SeatGeek Platform API   -> env SEATGEEK_CLIENT_ID   (best price data)
 *   - Ticketmaster Discovery  -> env TICKETMASTER_API_KEY (FIFA-managed, limited)
 *
 * With NO key set, it still writes a valid tickets.json (prices = null,
 * source = "seed") so the page works as a deep-link launcher immediately.
 *
 * No external dependencies — uses Node 18+ global fetch.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MATCHES_PATH = join(ROOT, "data", "matches.json");
const OUT_PATH = join(ROOT, "tickets.json");

const SEATGEEK_ID = process.env.SEATGEEK_CLIENT_ID || "";
const TM_KEY = process.env.TICKETMASTER_API_KEY || "";

const provider = SEATGEEK_ID ? "seatgeek" : TM_KEY ? "ticketmaster" : "seed";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "lifelogger-wc-tracker" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/** SeatGeek: GET /2/events/{id} -> stats.lowest_price / average_price / listing_count */
async function priceFromSeatGeek(id) {
  const url = `https://api.seatgeek.com/2/events/${id}?client_id=${encodeURIComponent(SEATGEEK_ID)}`;
  const data = await fetchJson(url);
  const stats = data.stats || {};
  const lowest = stats.lowest_price ?? null;
  if (lowest == null && stats.listing_count == null) return null;
  return {
    provider: "seatgeek",
    lowest,
    average: stats.average_price ?? null,
    highest: stats.highest_price ?? null,
    listingCount: stats.listing_count ?? null,
    url: data.url ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

/** Ticketmaster Discovery: GET /events/{id} -> priceRanges[].min/max */
async function priceFromTicketmaster(id) {
  const url = `https://app.ticketmaster.com/discovery/v2/events/${id}.json?apikey=${encodeURIComponent(TM_KEY)}`;
  const data = await fetchJson(url);
  const range = Array.isArray(data.priceRanges) ? data.priceRanges[0] : null;
  if (!range) return null;
  return {
    provider: "ticketmaster",
    lowest: range.min ?? null,
    average: null,
    highest: range.max ?? null,
    listingCount: null,
    url: data.url ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

async function priceForMatch(match) {
  const ids = match.providerIds || {};
  try {
    if (provider === "seatgeek" && ids.seatgeek) return await priceFromSeatGeek(ids.seatgeek);
    if (provider === "ticketmaster" && ids.ticketmaster) return await priceFromTicketmaster(ids.ticketmaster);
  } catch (err) {
    console.warn(`  ! ${match.id}: ${err.message}`);
  }
  return null;
}

async function main() {
  const cfg = JSON.parse(await readFile(MATCHES_PATH, "utf8"));
  console.log(`Provider: ${provider} (${cfg.matches.length} matches)`);

  const matches = [];
  for (const m of cfg.matches) {
    const price = provider === "seed" ? null : await priceForMatch(m);
    if (price) console.log(`  ✓ ${m.id} ${m.teams}: $${price.lowest ?? "?"} (${price.listingCount ?? "?"} listings)`);
    matches.push({
      id: m.id,
      venue: m.venue,
      venueName: cfg.venues[m.venue]?.name ?? m.venue,
      venueBrand: cfg.venues[m.venue]?.brand ?? "",
      city: cfg.venues[m.venue]?.city ?? "",
      kickoff: m.kickoff,
      stage: m.stage,
      teams: m.teams,
      links: m.links || {},
      price,
    });
  }

  const withPrices = matches.filter((m) => m.price && m.price.lowest != null).length;
  const out = {
    generatedAt: new Date().toISOString(),
    source: provider,
    currency: "USD",
    matchesWithLivePrice: withPrices,
    disclaimer:
      provider === "seed"
        ? "Live prices are off (no API key configured). Use the platform links for current prices, or add a SEATGEEK_CLIENT_ID / TICKETMASTER_API_KEY secret to activate. See README."
        : `Live ${provider} marketplace prices. Other resellers (StubHub, Vivid, TickPick, FIFA) may differ — use the links to compare. Prices are dynamic.`,
    venues: cfg.venues,
    matches,
  };

  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT_PATH} — ${withPrices}/${matches.length} matches with a live price.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
