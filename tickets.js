"use strict";

// Platform hubs — always-available fallbacks when a match has no direct deep link.
const HUBS = {
  fifa: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/tickets",
  ticketmaster: "https://www.ticketmaster.com/2026-world-cup-tickets/artist/4067734",
  stubhub: "https://www.stubhub.com/world-cup-tickets/grouping/45410",
  seatgeek: "https://seatgeek.com/fifa-world-cup-tickets",
  vivid: "https://www.vividseats.com/world-cup-soccer-tickets--sports-soccer/performer/944",
  gametime: "https://gametime.co/2026-fifa-world-cup-tickets/performers/soccerworldcup",
  tickpick: "https://lp.tickpick.com/worldcup",
};
const PLATFORM_LABELS = {
  fifa: "FIFA Resale",
  ticketmaster: "Ticketmaster",
  stubhub: "StubHub",
  seatgeek: "SeatGeek",
  vivid: "Vivid Seats",
  gametime: "Gametime",
  tickpick: "TickPick",
};
// Order links are shown in.
const PLATFORM_ORDER = ["fifa", "stubhub", "seatgeek", "vivid", "tickpick", "gametime", "ticketmaster"];

const state = { data: null, venue: "all", hidePlayed: true, onlyPriced: false };

const fmtMoney = (n) =>
  n == null ? null : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

function fmtKickoff(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  }) + " ET";
}

function fmtAgo(iso) {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

function statusOf(match) {
  return new Date(match.kickoff).getTime() < Date.now() ? "played" : "upcoming";
}

function renderBanner() {
  const el = document.getElementById("status-banner");
  const d = state.data;
  if (d.source === "seed") {
    el.className = "status-banner seed";
    el.innerHTML = "⚙️ <strong>Live prices off.</strong> Showing all matches with one-click links to every platform. Add a SeatGeek or Ticketmaster API key (see README) to light up live prices here.";
  } else {
    const upcoming = d.matches.filter((m) => statusOf(m) === "upcoming");
    const priced = upcoming.map((m) => m.price && m.price.lowest).filter((v) => v != null);
    const cheapest = priced.length ? Math.min(...priced) : null;
    el.className = "status-banner live";
    el.innerHTML = `🟢 <strong>Live ${d.source} prices.</strong> ${d.matchesWithLivePrice} matches priced` +
      (cheapest != null ? ` · cheapest upcoming get-in <strong>${fmtMoney(cheapest)}</strong>` : "") +
      ` · updated ${fmtAgo(d.generatedAt)}.`;
  }
}

function renderVenueFilters() {
  const venues = state.data.venues || {};
  const row = document.getElementById("venue-filters");
  const opts = [["all", "All venues"], ...Object.entries(venues).map(([k, v]) => [k, v.name])];
  row.innerHTML = "";
  for (const [key, label] of opts) {
    const b = document.createElement("button");
    b.className = "chip" + (state.venue === key ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => { state.venue = key; render(); });
    row.appendChild(b);
  }
}

function linkFor(match, platform) {
  return (match.links && match.links[platform]) || HUBS[platform];
}

function matchCard(match) {
  const status = statusOf(match);
  const isFinal = match.stage === "FINAL";
  const card = document.createElement("article");
  card.className = "match-card" + (status === "played" ? " played" : "");

  const badge = isFinal
    ? '<span class="badge final">Final</span>'
    : status === "played"
      ? '<span class="badge played">Played</span>'
      : '<span class="badge upcoming">Upcoming</span>';

  const price = match.price && match.price.lowest != null;
  const priceHtml = price
    ? `<div class="price-amount">${fmtMoney(match.price.lowest)}</div>
       <div class="price-sub">${match.price.listingCount != null ? match.price.listingCount + " listings · " : ""}via ${match.price.provider}</div>`
    : `<div class="price-amount none">See links →</div>
       <div class="price-sub">no live price</div>`;

  const links = PLATFORM_ORDER.map((p) => {
    const direct = match.links && match.links[p];
    return `<a class="link-btn${direct ? " primary" : ""}" href="${linkFor(match, p)}" target="_blank" rel="noopener noreferrer">${PLATFORM_LABELS[p]}${direct ? "" : " ↗"}</a>`;
  }).join("");

  card.innerHTML = `
    <div class="match-main">
      <p class="match-teams">${match.teams}${badge}</p>
      <p class="match-meta">${match.stage} · ${match.venueName}, ${match.city} · ${fmtKickoff(match.kickoff)}</p>
    </div>
    <div class="price-box">${priceHtml}</div>
    <div class="links-row">${links}</div>`;
  return card;
}

function render() {
  renderVenueFilters();
  const list = document.getElementById("match-list");
  const empty = document.getElementById("empty-state");
  list.innerHTML = "";

  let matches = [...state.data.matches].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  if (state.venue !== "all") matches = matches.filter((m) => m.venue === state.venue);
  if (state.hidePlayed) matches = matches.filter((m) => statusOf(m) === "upcoming");
  if (state.onlyPriced) matches = matches.filter((m) => m.price && m.price.lowest != null);

  document.getElementById("results-count").textContent =
    `Showing ${matches.length} match${matches.length === 1 ? "" : "es"}`;

  empty.classList.toggle("hidden", matches.length > 0);
  for (const m of matches) list.appendChild(matchCard(m));

  renderBanner();
  document.getElementById("disclaimer").textContent = state.data.disclaimer || "";
  document.getElementById("source-label").textContent = state.data.source;
  document.getElementById("generated-at").textContent = fmtAgo(state.data.generatedAt);
}

async function init() {
  document.getElementById("hide-played").addEventListener("change", (e) => {
    state.hidePlayed = e.target.checked; render();
  });
  document.getElementById("only-priced").addEventListener("change", (e) => {
    state.onlyPriced = e.target.checked; render();
  });
  try {
    const res = await fetch("tickets.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
    render();
  } catch (err) {
    document.getElementById("status-banner").textContent =
      "Could not load tickets.json — run scripts/fetch-tickets.mjs to generate it.";
    console.error(err);
  }
}

init();
