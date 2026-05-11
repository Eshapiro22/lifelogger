const curatedDunks = [
    {
        id: "vince-2000-olympics",
        title: "Vince Carter Clears Frederic Weis",
        player: "Vince Carter",
        team: "Team USA",
        year: 2000,
        youtubeId: "k_uZeCymShQ",
        description: "The Olympic vault-over that stopped time and turned a live defender into a permanent reference point.",
        tags: ["Olympics", "Poster", "In-Game", "Legendary"]
    },
    {
        id: "mj-free-throw-line",
        title: "Michael Jordan Free Throw Line Slam",
        player: "Michael Jordan",
        team: "Chicago Bulls",
        year: 1988,
        youtubeId: "OO5r5HTR7bA",
        description: "The dunk contest silhouette that became basketball iconography all by itself.",
        tags: ["Dunk Contest", "Free Throw Line", "Legendary"]
    },
    {
        id: "kobe-hornets-reverse",
        title: "Kobe Bryant Baseline Reverse",
        player: "Kobe Bryant",
        team: "Los Angeles Lakers",
        year: 2001,
        youtubeId: "WCRjuwWqU7Q",
        description: "Young Kobe snakes the baseline and finishes with a reverse that feels violent and elegant at the same time.",
        tags: ["Reverse", "Baseline", "In-Game"]
    },
    {
        id: "lebron-jason-terry",
        title: "LeBron Over Jason Terry",
        player: "LeBron James",
        team: "Miami Heat",
        year: 2013,
        youtubeId: "beCxSqSXGDY",
        description: "A full-speed transition poster that triggered one of the loudest collective reactions of the era.",
        tags: ["Poster", "Fast Break", "In-Game", "Playoffs"]
    },
    {
        id: "blake-mozgov",
        title: "Blake Griffin Posters Timofey Mozgov",
        player: "Blake Griffin",
        team: "Los Angeles Clippers",
        year: 2010,
        youtubeId: "d8FYUdPPUy4",
        description: "Pure rookie force. Elevation, contact, and no apology whatsoever.",
        tags: ["Poster", "Power", "In-Game"]
    },
    {
        id: "dwade-varajao",
        title: "Dwyane Wade Over Anderson Varejao",
        player: "Dwyane Wade",
        team: "Miami Heat",
        year: 2009,
        youtubeId: "5uRN7iJ5CqQ",
        description: "A slash into traffic that ends with Wade detonating through a crowded paint.",
        tags: ["Poster", "Drive", "In-Game"]
    },
    {
        id: "shaq-breakaway",
        title: "Shaq Breaks the Backboard Support",
        player: "Shaquille O'Neal",
        team: "Orlando Magic",
        year: 1993,
        youtubeId: "M7LVyv0mL28",
        description: "Less a dunk than an industrial stress test that happened to count for two points.",
        tags: ["Power", "Rim Wrecker", "Legendary"]
    },
    {
        id: "aaron-lavine-duel",
        title: "Aaron Gordon vs. Zach LaVine Dunk Duel",
        player: "Aaron Gordon",
        team: "Orlando Magic",
        year: 2016,
        youtubeId: "0oIitsGzFPU",
        description: "The contest stretch that made everyone forget the score and just stare at the absurdity.",
        tags: ["Dunk Contest", "Under Legs", "Legendary"]
    },
    {
        id: "ja-poeltl",
        title: "Ja Morant Almost Ends Jakob Poeltl",
        player: "Ja Morant",
        team: "Memphis Grizzlies",
        year: 2022,
        youtubeId: "x0T5qM9T2go",
        description: "Even as an almost-poster, it belongs in the archive because the attempt itself broke physics.",
        tags: ["Almost", "Poster Attempt", "Explosive"]
    },
    {
        id: "westbrook-putback",
        title: "Russell Westbrook Putback Hammer",
        player: "Russell Westbrook",
        team: "Oklahoma City Thunder",
        year: 2015,
        youtubeId: "iyLHuVwJUkc",
        description: "Westbrook arrives from nowhere, turns a rebound into a warning, and leaves the rim complaining.",
        tags: ["Putback", "Explosive", "In-Game"]
    },
    {
        id: "dr-j-rock-the-baby",
        title: "Dr. J Rock-the-Baby Windmill",
        player: "Julius Erving",
        team: "Philadelphia 76ers",
        year: 1976,
        youtubeId: "TjU8LQf3P2s",
        description: "One of the template dunks, delivered with the kind of style that still feels modern.",
        tags: ["Windmill", "ABA", "Legendary"]
    },
    {
        id: "deandre-brandon-knight",
        title: "DeAndre Jordan Over Brandon Knight",
        player: "DeAndre Jordan",
        team: "Los Angeles Clippers",
        year: 2013,
        youtubeId: "NTkN2q6sUUk",
        description: "This is the dictionary-definition poster. Lob, collision, aftermath, disbelief.",
        tags: ["Poster", "Lob", "In-Game", "Legendary"]
    }
];

const storageKey = "dunkapedia.youtubeApiKey";

const elements = {
    statDunks: document.getElementById("stat-dunks"),
    statPlayers: document.getElementById("stat-players"),
    statYears: document.getElementById("stat-years"),
    featuredTitle: document.getElementById("featured-title"),
    featuredMeta: document.getElementById("featured-meta"),
    featuredDescription: document.getElementById("featured-description"),
    featuredWatch: document.getElementById("featured-watch"),
    catalogSearch: document.getElementById("catalog-search"),
    playerFilter: document.getElementById("player-filter"),
    teamFilter: document.getElementById("team-filter"),
    yearFilter: document.getElementById("year-filter"),
    tagFilter: document.getElementById("tag-filter"),
    clearFilters: document.getElementById("clear-filters"),
    resultsCount: document.getElementById("results-count"),
    catalogGrid: document.getElementById("catalog-grid"),
    emptyState: document.getElementById("empty-state"),
    youtubeQuery: document.getElementById("youtube-query"),
    youtubeSearchButton: document.getElementById("youtube-search-button"),
    youtubeStatus: document.getElementById("youtube-status"),
    youtubeResults: document.getElementById("youtube-results"),
    videoModal: document.getElementById("video-modal"),
    videoFrame: document.getElementById("video-frame"),
    modalClose: document.getElementById("modal-close"),
    modalKicker: document.getElementById("modal-kicker"),
    modalTitle: document.getElementById("modal-title"),
    modalDescription: document.getElementById("modal-description"),
    modalTags: document.getElementById("modal-tags"),
    apiKeyToggle: document.getElementById("api-key-toggle"),
    apiKeyModal: document.getElementById("api-key-modal"),
    apiKeyInput: document.getElementById("api-key-input"),
    saveApiKey: document.getElementById("save-api-key"),
    clearApiKey: document.getElementById("clear-api-key")
};

const filters = {
    query: "",
    player: "",
    team: "",
    year: "",
    tag: ""
};

function uniqueValues(key) {
    return [...new Set(curatedDunks.map((dunk) => dunk[key]))].sort();
}

function uniqueTags() {
    return [...new Set(curatedDunks.flatMap((dunk) => dunk.tags))].sort();
}

function thumbnailFor(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function createOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
}

function hydrateFilters() {
    elements.playerFilter.append(createOption("", "All Players"), ...uniqueValues("player").map((value) => createOption(value, value)));
    elements.teamFilter.append(createOption("", "All Teams"), ...uniqueValues("team").map((value) => createOption(value, value)));
    elements.yearFilter.append(createOption("", "All Years"), ...uniqueValues("year").map((value) => createOption(String(value), String(value))));
    elements.tagFilter.append(createOption("", "All Tags"), ...uniqueTags().map((value) => createOption(value, value)));
}

function updateStats() {
    elements.statDunks.textContent = String(curatedDunks.length);
    elements.statPlayers.textContent = String(uniqueValues("player").length);
    elements.statYears.textContent = String(uniqueValues("year").length);
}

function updateFeatured() {
    const featured = curatedDunks[0];
    elements.featuredTitle.textContent = featured.title;
    elements.featuredMeta.textContent = `${featured.player} • ${featured.team} • ${featured.year}`;
    elements.featuredDescription.textContent = featured.description;
    elements.featuredWatch.onclick = () => openModal(featured);
}

function matchesFilter(dunk) {
    const haystack = [
        dunk.title,
        dunk.player,
        dunk.team,
        dunk.description,
        ...dunk.tags
    ].join(" ").toLowerCase();

    return (!filters.query || haystack.includes(filters.query))
        && (!filters.player || dunk.player === filters.player)
        && (!filters.team || dunk.team === filters.team)
        && (!filters.year || String(dunk.year) === filters.year)
        && (!filters.tag || dunk.tags.includes(filters.tag));
}

function renderTags(container, tags) {
    container.innerHTML = "";
    tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "tag";
        chip.textContent = tag;
        container.appendChild(chip);
    });
}

function openModal(item) {
    elements.modalKicker.textContent = `${item.player} • ${item.team} • ${item.year}`;
    elements.modalTitle.textContent = item.title;
    elements.modalDescription.textContent = item.description || item.channel || "Watch the clip on YouTube.";
    renderTags(elements.modalTags, item.tags || ["YouTube"]);
    elements.videoFrame.src = `https://www.youtube.com/embed/${item.youtubeId}?autoplay=1`;
    elements.videoModal.showModal();
}

function closeModal() {
    elements.videoFrame.src = "";
    elements.videoModal.close();
}

function renderCatalog() {
    const results = curatedDunks.filter(matchesFilter);
    elements.catalogGrid.innerHTML = "";
    elements.resultsCount.textContent = `Showing ${results.length} dunk${results.length === 1 ? "" : "s"}`;
    elements.emptyState.classList.toggle("hidden", results.length > 0);

    results.forEach((dunk) => {
        const article = document.createElement("article");
        article.className = "dunk-card";
        article.innerHTML = `
            <div class="card-thumb">
                <img src="${thumbnailFor(dunk.youtubeId)}" alt="${dunk.title}">
                <span class="card-badge">${dunk.year}</span>
                <button class="card-play" type="button" aria-label="Play ${dunk.title}">▶</button>
            </div>
            <div class="card-body">
                <h3 class="card-title">${dunk.title}</h3>
                <p class="card-meta">${dunk.player} • ${dunk.team}</p>
                <p class="card-description">${dunk.description}</p>
                <div class="tag-row"></div>
            </div>
        `;

        renderTags(article.querySelector(".tag-row"), dunk.tags);
        article.addEventListener("click", () => openModal(dunk));
        elements.catalogGrid.appendChild(article);
    });
}

function getApiKey() {
    return localStorage.getItem(storageKey) || "";
}

function setApiStatus() {
    elements.youtubeStatus.textContent = getApiKey()
        ? "API key detected. Search YouTube for more dunks."
        : "No results yet. Add an API key to enable live YouTube search, or keep exploring the curated catalog above.";
}

function renderYouTubeResults(items) {
    elements.youtubeResults.innerHTML = "";

    items.forEach((item) => {
        const article = document.createElement("article");
        article.className = "dunk-card";
        article.innerHTML = `
            <div class="card-thumb">
                <img src="${item.thumbnail}" alt="${item.title}">
                <button class="card-play" type="button" aria-label="Play ${item.title}">▶</button>
            </div>
            <div class="card-body">
                <h3 class="card-title">${item.title}</h3>
                <p class="card-meta">${item.channel}</p>
                <p class="card-description">${item.description || "Open the clip in YouTube or play it here."}</p>
                <div class="tag-row"></div>
            </div>
        `;

        renderTags(article.querySelector(".tag-row"), ["YouTube Search"]);
        article.addEventListener("click", () => openModal(item));
        elements.youtubeResults.appendChild(article);
    });
}

async function searchYouTube() {
    const query = elements.youtubeQuery.value.trim();
    const apiKey = getApiKey();

    if (!query) {
        elements.youtubeStatus.textContent = "Enter a search term first.";
        return;
    }

    if (!apiKey) {
        elements.youtubeStatus.textContent = "Add a YouTube Data API key first, then try the search again.";
        return;
    }

    elements.youtubeSearchButton.disabled = true;
    elements.youtubeStatus.textContent = "Searching YouTube...";

    try {
        const params = new URLSearchParams({
            part: "snippet",
            type: "video",
            maxResults: "9",
            q: query,
            key: apiKey
        });
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            const message = data?.error?.message || "Search failed.";
            throw new Error(message);
        }

        const items = (data.items || []).map((item) => ({
            title: item.snippet.title,
            player: "YouTube",
            team: item.snippet.channelTitle,
            year: new Date(item.snippet.publishedAt).getFullYear(),
            youtubeId: item.id.videoId,
            description: item.snippet.description,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            tags: ["YouTube Search"]
        }));

        renderYouTubeResults(items);
        elements.youtubeStatus.textContent = items.length
            ? `Found ${items.length} YouTube result${items.length === 1 ? "" : "s"} for "${query}".`
            : `No YouTube results found for "${query}".`;
    } catch (error) {
        elements.youtubeStatus.textContent = `Search failed: ${error.message}`;
    } finally {
        elements.youtubeSearchButton.disabled = false;
    }
}

function syncFiltersFromInputs() {
    filters.query = elements.catalogSearch.value.trim().toLowerCase();
    filters.player = elements.playerFilter.value;
    filters.team = elements.teamFilter.value;
    filters.year = elements.yearFilter.value;
    filters.tag = elements.tagFilter.value;
    renderCatalog();
}

function clearFilters() {
    elements.catalogSearch.value = "";
    elements.playerFilter.value = "";
    elements.teamFilter.value = "";
    elements.yearFilter.value = "";
    elements.tagFilter.value = "";
    syncFiltersFromInputs();
}

function wireEvents() {
    [
        elements.catalogSearch,
        elements.playerFilter,
        elements.teamFilter,
        elements.yearFilter,
        elements.tagFilter
    ].forEach((element) => element.addEventListener("input", syncFiltersFromInputs));

    elements.clearFilters.addEventListener("click", clearFilters);
    elements.modalClose.addEventListener("click", closeModal);
    elements.videoModal.addEventListener("click", (event) => {
        if (event.target === elements.videoModal) {
            closeModal();
        }
    });

    elements.youtubeSearchButton.addEventListener("click", searchYouTube);
    elements.youtubeQuery.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            searchYouTube();
        }
    });

    elements.apiKeyToggle.addEventListener("click", () => {
        elements.apiKeyInput.value = getApiKey();
        elements.apiKeyModal.showModal();
    });

    elements.saveApiKey.addEventListener("click", () => {
        const value = elements.apiKeyInput.value.trim();
        if (value) {
            localStorage.setItem(storageKey, value);
        }
        setApiStatus();
        elements.apiKeyModal.close();
    });

    elements.clearApiKey.addEventListener("click", () => {
        localStorage.removeItem(storageKey);
        elements.apiKeyInput.value = "";
        setApiStatus();
    });
}

hydrateFilters();
updateStats();
updateFeatured();
renderCatalog();
setApiStatus();
wireEvents();
