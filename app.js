const curatedDunks = [
    {
        id: "vince-2000-olympics",
        title: "Vince Carter Clears Frederic Weis",
        player: "Vince Carter",
        team: "Team USA",
        year: 2000,
        type: "Poster",
        youtubeId: "k_uZeCymShQ",
        description: "A full-stride, two-handed jam over a 7'2\" defender that stopped the 2000 Sydney Olympics cold and became the single most replayed image in basketball history.",
        tags: ["Olympics", "In-Game", "Legendary"]
    },
    {
        id: "mj-free-throw-line",
        title: "Michael Jordan Free Throw Line Slam",
        player: "Michael Jordan",
        team: "Chicago Bulls",
        year: 1988,
        type: "Dunk Contest",
        youtubeId: "DXFfmWA3xx8",
        description: "Jordan takes off from the free throw line at Chicago Stadium, glides 15 feet through the air, and delivers a perfect 50 to beat Dominique Wilkins for the title.",
        tags: ["Free Throw Line", "Legendary"]
    },
    {
        id: "dominique-1985",
        title: "Dominique Wilkins 1985 Dunk Contest",
        player: "Dominique Wilkins",
        team: "Atlanta Hawks",
        year: 1985,
        type: "Dunk Contest",
        youtubeId: "UPcgR9tsGfs",
        description: "The Human Highlight Film introduces himself to the contest with a windmill that sets the template for the next 40 years of dunk competition.",
        tags: ["Windmill", "Legendary"]
    },
    {
        id: "spud-webb-1986",
        title: "Spud Webb Wins the 1986 Dunk Contest",
        player: "Spud Webb",
        team: "Atlanta Hawks",
        year: 1986,
        type: "Dunk Contest",
        youtubeId: "r1YRJvFvlgg",
        description: "Standing 5'7\", Webb beats his own teammate Dominique Wilkins to take the title — the greatest upset in dunk contest history.",
        tags: ["Legendary", "Upset"]
    },
    {
        id: "dr-j-rock-the-baby",
        title: "Dr. J Rock-the-Baby Cradle Dunk",
        player: "Julius Erving",
        team: "Philadelphia 76ers",
        year: 1983,
        type: "Cradle",
        youtubeId: "7YwY_tFSrWw",
        description: "Over Michael Cooper on January 5, 1983: Dr. J cradles the ball, rocks it once, and finishes with a signature move that still looks impossible four decades later.",
        tags: ["In-Game", "Legendary"]
    },
    {
        id: "shaq-breakaway",
        title: "Shaq Tears Down the Backboard",
        player: "Shaquille O'Neal",
        team: "Orlando Magic",
        year: 1993,
        type: "Power",
        youtubeId: "mvMGuaQBGnc",
        description: "Less a dunk than an industrial stress test. Shaq's slam against the Nets on April 23, 1993 brings down the entire backboard support and stops the game cold.",
        tags: ["Rim Wrecker", "Legendary"]
    },
    {
        id: "kemp-carr-1996",
        title: "Shawn Kemp Destroys Antoine Carr",
        player: "Shawn Kemp",
        team: "Seattle SuperSonics",
        year: 1996,
        type: "Poster",
        youtubeId: "a4VynGnht00",
        description: "The Reign Man catches the ball in transition, aims at Carr's chest, and throws down one of the most violent posters of the decade in Game 2 of the 1996 Western Conference Finals.",
        tags: ["Power", "In-Game", "Playoffs"]
    },
    {
        id: "dwight-superman-2008",
        title: "Dwight Howard Superman Dunk",
        player: "Dwight Howard",
        team: "Orlando Magic",
        year: 2008,
        type: "Dunk Contest",
        youtubeId: "SQsdNHUILgY",
        description: "Dwight shows up in a Superman cape, catches a lob from center court, and delivers a perfect 50 that made an entire arena lose its collective mind.",
        tags: ["Alley-Oop", "Legendary"]
    },
    {
        id: "kobe-hornets-reverse",
        title: "Kobe Bryant Baseline Reverse",
        player: "Kobe Bryant",
        team: "Los Angeles Lakers",
        year: 2001,
        type: "Reverse",
        youtubeId: "j3L5e47lAzk",
        description: "Young Kobe snakes the baseline and finishes with a one-handed reverse that feels violent and elegant at the same time.",
        tags: ["Baseline", "In-Game"]
    },
    {
        id: "lavine-2015",
        title: "Zach LaVine 2015 Dunk Contest",
        player: "Zach LaVine",
        team: "Minnesota Timberwolves",
        year: 2015,
        type: "Dunk Contest",
        youtubeId: "Glcnv0MphkI",
        description: "LaVine arrives as a 20-year-old unknown and scores back-to-back 50s, including a between-the-legs windmill that rewrote what athletic looks like in a dunk contest.",
        tags: ["Between Legs", "Windmill", "Legendary"]
    },
    {
        id: "blake-mozgov",
        title: "Blake Griffin Posters Timofey Mozgov",
        player: "Blake Griffin",
        team: "Los Angeles Clippers",
        year: 2010,
        type: "Poster",
        youtubeId: "9eRKXGiAAnw",
        description: "Pure rookie force over a seven-footer. Elevation, contact, and no apology whatsoever.",
        tags: ["Power", "In-Game"]
    },
    {
        id: "dwade-varajao",
        title: "Dwyane Wade Over Anderson Varejao",
        player: "Dwyane Wade",
        team: "Miami Heat",
        year: 2009,
        type: "Poster",
        youtubeId: "5uRN7iJ5CqQ",
        description: "A slash into traffic that ends with Wade detonating over a crowded paint on November 12, 2009 — widely considered the best dunk of his career.",
        tags: ["Drive", "In-Game"]
    },
    {
        id: "deandre-brandon-knight",
        title: "DeAndre Jordan Over Brandon Knight",
        player: "DeAndre Jordan",
        team: "Los Angeles Clippers",
        year: 2013,
        type: "Alley-Oop",
        youtubeId: "WFhFI2OYExk",
        description: "The dictionary-definition poster. Chris Paul lobs it up, Jordan catches it over Knight, and the internet spends three days processing what just happened.",
        tags: ["Poster", "In-Game", "Legendary"]
    },
    {
        id: "aaron-lavine-duel",
        title: "Aaron Gordon vs. Zach LaVine Dunk Duel",
        player: "Aaron Gordon",
        team: "Orlando Magic",
        year: 2016,
        type: "Dunk Contest",
        youtubeId: "u7VgkfcSYz0",
        description: "The contest stretch where both competitors kept scoring 50s until nobody could explain why either one lost. Gordon's under-the-legs windmill alone belongs in a museum.",
        tags: ["Under Legs", "Legendary"]
    },
    {
        id: "lebron-jason-terry",
        title: "LeBron Over Jason Terry",
        player: "LeBron James",
        team: "Miami Heat",
        year: 2013,
        type: "Poster",
        youtubeId: "FkxcY45bP2U",
        description: "A full-speed transition poster on March 18, 2013 that triggered one of the loudest collective reactions in the arena and sent the internet into immediate chaos.",
        tags: ["Fast Break", "In-Game"]
    },
    {
        id: "westbrook-putback",
        title: "Russell Westbrook Putback Hammer",
        player: "Russell Westbrook",
        team: "Oklahoma City Thunder",
        year: 2015,
        type: "Putback",
        youtubeId: "3e6Z3DKcDcw",
        description: "Westbrook arrives from nowhere, turns a missed shot into a warning, and leaves the rim vibrating. The kind of putback that forces a timeout just to let everyone calm down.",
        tags: ["Explosive", "In-Game"]
    },
    {
        id: "ja-poeltl",
        title: "Ja Morant Posterizes Jakob Poeltl",
        player: "Ja Morant",
        team: "Memphis Grizzlies",
        year: 2022,
        type: "Poster",
        youtubeId: "IujgoXEWEXQ",
        description: "Ja goes straight at the seven-footer and detonates over him on March 1, 2022 — capping a career-high 52-point night with the most emphatic punctuation mark of the season.",
        tags: ["Explosive", "In-Game"]
    },
    {
        id: "giannis-vucevic-2024",
        title: "Giannis Posterizes Nikola Vucevic",
        player: "Giannis Antetokounmpo",
        team: "Milwaukee Bucks",
        year: 2024,
        type: "Poster",
        youtubeId: "7pax4RPQXbY",
        description: "The Greek Freak attacks the rim at full speed, absorbs contact from Vucevic at the rim, and finishes with a dunk so decisive it triggered a post-game incident.",
        tags: ["Power", "In-Game"]
    },
    {
        id: "mj-ewing-1991",
        title: "Michael Jordan Soars Over Patrick Ewing",
        player: "Michael Jordan",
        team: "Chicago Bulls",
        year: 1991,
        type: "Poster",
        youtubeId: "flIh7WHGndM",
        description: "April 30, 1991 in the playoffs at MSG: Jordan rises from the baseline and hammers a one-handed slam over Ewing — for many the most ferocious in-game dunk of his career.",
        tags: ["In-Game", "Playoffs", "Legendary"]
    },
    {
        id: "starks-the-dunk-1993",
        title: "John Starks \"The Dunk\"",
        player: "John Starks",
        team: "New York Knicks",
        year: 1993,
        type: "Poster",
        youtubeId: "KhkIMpBaCEs",
        description: "Game 2 of the 1993 Eastern Conference Finals: the lefty Starks drives the baseline and throws down over Horace Grant and Michael Jordan — the defining image in Knicks history.",
        tags: ["In-Game", "Playoffs", "Legendary"]
    },
    {
        id: "pippen-ewing-1994",
        title: "Scottie Pippen Posters Patrick Ewing",
        player: "Scottie Pippen",
        team: "Chicago Bulls",
        year: 1994,
        type: "Poster",
        youtubeId: "xtOUpybXmzo",
        description: "Game 6 of the 1994 East semis: Pippen rises over Ewing, throws it down, then stands over him and stares down Spike Lee. Pure disrespect, perfectly executed.",
        tags: ["In-Game", "Playoffs", "Legendary"]
    },
    {
        id: "tmac-self-oop-2002",
        title: "Tracy McGrady Self Alley-Oop",
        player: "Tracy McGrady",
        team: "Orlando Magic",
        year: 2002,
        type: "Alley-Oop",
        youtubeId: "QZFBROm2DEU",
        description: "At the 2002 All-Star Game, T-Mac bounces the ball off the backboard to himself and throws it down — inventing a move that players still try to copy.",
        tags: ["All-Star", "Self Oop"]
    },
    {
        id: "kobe-yao-2006",
        title: "Kobe Bryant Posterizes Yao Ming",
        player: "Kobe Bryant",
        team: "Los Angeles Lakers",
        year: 2006,
        type: "Poster",
        youtubeId: "y3u83Lk3CYA",
        description: "Kobe attacks the lane and rises straight over the 7'6\" Yao Ming for an emphatic finish — proof that size meant nothing to him.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "vince-mourning-2005",
        title: "Vince Carter Over Alonzo Mourning",
        player: "Vince Carter",
        team: "New Jersey Nets",
        year: 2005,
        type: "Poster",
        youtubeId: "yu206ZrVcSs",
        description: "November 7, 2005: Carter elevates over the rim-protecting Mourning for a poster so brutal it reportedly ended their friendship.",
        tags: ["In-Game", "Legendary"]
    },
    {
        id: "drose-dragic-2011",
        title: "Derrick Rose Hammers Over Goran Dragic",
        player: "Derrick Rose",
        team: "Chicago Bulls",
        year: 2011,
        type: "Poster",
        youtubeId: "t71IqHJOqgE",
        description: "MVP-season Rose splits the lane and detonates a two-handed slam over Dragic — \"Derrick Rose can go upstairs!\" became the call of the night.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "zion-kessler-2022",
        title: "Zion Williamson Posters Walker Kessler",
        player: "Zion Williamson",
        team: "New Orleans Pelicans",
        year: 2022,
        type: "Poster",
        youtubeId: "Ieh6_A9m8Lo",
        description: "285 pounds of explosion: Zion rises over the seven-foot Kessler and finishes with a dunk that left the announcers speechless.",
        tags: ["In-Game", "Power"]
    },
    {
        id: "ant-collins-2024",
        title: "Anthony Edwards Over John Collins",
        player: "Anthony Edwards",
        team: "Minnesota Timberwolves",
        year: 2024,
        type: "Poster",
        youtubeId: "zNhFv6fOdRA",
        description: "Edwards rises from a standstill and absolutely erases John Collins at the rim. He called it the best dunk of his career, and few argued.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "vince-360-windmill-2000",
        title: "Vince Carter 360 Windmill",
        player: "Vince Carter",
        team: "Toronto Raptors",
        year: 2000,
        type: "Dunk Contest",
        youtubeId: "7QtljAdtwgQ",
        description: "The dunk that reinvented the contest: a full 360 spin into a windmill finish, the first of a string of perfect-50 slams in 2000.",
        tags: ["Windmill", "360", "Legendary"]
    },
    {
        id: "jrich-btl-2003",
        title: "Jason Richardson Between-the-Legs Reverse",
        player: "Jason Richardson",
        team: "Golden State Warriors",
        year: 2003,
        type: "Dunk Contest",
        youtubeId: "_n-eVS258-A",
        description: "The clinching dunk of the 2003 contest: a baseline lob brought between the legs and finished reverse. Back-to-back championship sealed.",
        tags: ["Between Legs", "Reverse", "Legendary"]
    },
    {
        id: "dee-brown-1991",
        title: "Dee Brown No-Look Dunk",
        player: "Dee Brown",
        team: "Boston Celtics",
        year: 1991,
        type: "Dunk Contest",
        youtubeId: "6uD8ZqkoM5E",
        description: "Brown pumps up his Reeboks, throws an arm across his eyes, and throws it down blind — the most stylish closing dunk in contest history.",
        tags: ["No-Look", "Legendary"]
    },
    {
        id: "gerald-green-cake-2008",
        title: "Gerald Green Birthday Cake Dunk",
        player: "Gerald Green",
        team: "Minnesota Timberwolves",
        year: 2008,
        type: "Dunk Contest",
        youtubeId: "Ed_NEFjYUYc",
        description: "A cupcake with a lit candle sits on the back of the rim — Green takes off, blows out the candle mid-air, and throws it down in one motion.",
        tags: ["Creative", "Legendary"]
    },
    {
        id: "larry-nance-1984",
        title: "Larry Nance Wins the First Dunk Contest",
        player: "Larry Nance",
        team: "Phoenix Suns",
        year: 1984,
        type: "Dunk Contest",
        youtubeId: "Y141jxJUFP8",
        description: "The inaugural 1984 NBA contest in Denver: Nance edges out Dr. J himself with a cradle windmill to become the event's first champion.",
        tags: ["Windmill", "Legendary"]
    }
];

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
    typeFilter: document.getElementById("type-filter"),
    clearFilters: document.getElementById("clear-filters"),
    resultsCount: document.getElementById("results-count"),
    catalogGrid: document.getElementById("catalog-grid"),
    emptyState: document.getElementById("empty-state"),
    youtubeQuery: document.getElementById("youtube-query"),
    youtubeSearchButton: document.getElementById("youtube-search-button"),
    youtubeStatus: document.getElementById("youtube-status"),
    youtubeResults: document.getElementById("youtube-results"),
    searchLaunch: document.getElementById("search-launch"),
    videoModal: document.getElementById("video-modal"),
    videoFrame: document.getElementById("video-frame"),
    modalClose: document.getElementById("modal-close"),
    modalKicker: document.getElementById("modal-kicker"),
    modalTitle: document.getElementById("modal-title"),
    modalDescription: document.getElementById("modal-description"),
    modalTags: document.getElementById("modal-tags"),
    modalYoutubeLink: document.getElementById("modal-youtube-link"),
    randomDunk: document.getElementById("random-dunk")
};

const filters = {
    query: "",
    player: "",
    team: "",
    year: "",
    type: ""
};

function uniqueValues(key) {
    return [...new Set(curatedDunks.map((dunk) => dunk[key]))].sort();
}

function uniqueTypes() {
    return [...new Set(curatedDunks.map((dunk) => dunk.type))].sort();
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
    elements.playerFilter.append(createOption("", "All Players"), ...uniqueValues("player").map((v) => createOption(v, v)));
    elements.teamFilter.append(createOption("", "All Teams"), ...uniqueValues("team").map((v) => createOption(v, v)));
    elements.yearFilter.append(createOption("", "All Years"), ...uniqueValues("year").map((v) => createOption(String(v), String(v))));
    elements.typeFilter.append(createOption("", "All Types"), ...uniqueTypes().map((v) => createOption(v, v)));
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
        dunk.type,
        ...dunk.tags
    ].join(" ").toLowerCase();

    return (!filters.query || haystack.includes(filters.query))
        && (!filters.player || dunk.player === filters.player)
        && (!filters.team || dunk.team === filters.team)
        && (!filters.year || String(dunk.year) === filters.year)
        && (!filters.type || dunk.type === filters.type);
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
    elements.modalDescription.textContent = item.description || "Watch the clip on YouTube.";
    renderTags(elements.modalTags, [item.type, ...item.tags]);
    elements.videoFrame.src = `https://www.youtube.com/embed/${item.youtubeId}?autoplay=1`;
    elements.modalYoutubeLink.href = `https://www.youtube.com/watch?v=${item.youtubeId}`;
    elements.videoModal.showModal();
}

function closeModal() {
    elements.videoFrame.src = "";
    elements.videoModal.close();
}

function buildCard(dunk) {
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
    renderTags(article.querySelector(".tag-row"), [dunk.type, ...dunk.tags]);
    article.addEventListener("click", () => openModal(dunk));
    return article;
}

function renderCatalog() {
    const results = curatedDunks.filter(matchesFilter);
    elements.catalogGrid.innerHTML = "";
    elements.resultsCount.textContent = `Showing ${results.length} dunk${results.length === 1 ? "" : "s"}`;
    elements.emptyState.classList.toggle("hidden", results.length > 0);
    results.forEach((dunk) => elements.catalogGrid.appendChild(buildCard(dunk)));
}

function renderYouTubeResults(items) {
    elements.youtubeResults.innerHTML = "";
    items.forEach((dunk) => elements.youtubeResults.appendChild(buildCard(dunk)));
}

function searchYouTube() {
    const query = elements.youtubeQuery.value.trim();

    if (!query) {
        elements.youtubeStatus.textContent = "Enter a search term first.";
        return;
    }

    const lower = query.toLowerCase();
    const matches = curatedDunks.filter((dunk) => {
        const haystack = [dunk.title, dunk.player, dunk.team, dunk.description, dunk.type, ...dunk.tags]
            .join(" ").toLowerCase();
        return haystack.includes(lower);
    });

    renderYouTubeResults(matches);

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " NBA dunk")}`;
    elements.searchLaunch.innerHTML = `<a class="secondary-button" href="${searchUrl}" target="_blank" rel="noopener noreferrer">Search YouTube for "${query}"</a>`;
    elements.searchLaunch.classList.remove("hidden");

    elements.youtubeStatus.textContent = matches.length
        ? `Found ${matches.length} archive match${matches.length === 1 ? "" : "es"} for "${query}".`
        : `No archive matches for "${query}". Try the YouTube link above.`;
}

function syncFiltersFromInputs() {
    filters.query = elements.catalogSearch.value.trim().toLowerCase();
    filters.player = elements.playerFilter.value;
    filters.team = elements.teamFilter.value;
    filters.year = elements.yearFilter.value;
    filters.type = elements.typeFilter.value;
    renderCatalog();
}

function clearFilters() {
    elements.catalogSearch.value = "";
    elements.playerFilter.value = "";
    elements.teamFilter.value = "";
    elements.yearFilter.value = "";
    elements.typeFilter.value = "";
    syncFiltersFromInputs();
}

function wireEvents() {
    [
        elements.catalogSearch,
        elements.playerFilter,
        elements.teamFilter,
        elements.yearFilter,
        elements.typeFilter
    ].forEach((el) => el.addEventListener("input", syncFiltersFromInputs));

    elements.clearFilters.addEventListener("click", clearFilters);
    elements.modalClose.addEventListener("click", closeModal);
    elements.videoModal.addEventListener("click", (event) => {
        if (event.target === elements.videoModal) closeModal();
    });

    elements.youtubeSearchButton.addEventListener("click", searchYouTube);
    elements.youtubeQuery.addEventListener("keydown", (event) => {
        if (event.key === "Enter") searchYouTube();
    });

    document.querySelectorAll(".search-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            elements.youtubeQuery.value = chip.dataset.query;
            searchYouTube();
            elements.youtubeQuery.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
    });

    elements.randomDunk.addEventListener("click", () => {
        const dunk = curatedDunks[Math.floor(Math.random() * curatedDunks.length)];
        openModal(dunk);
    });
}

hydrateFilters();
updateStats();
updateFeatured();
renderCatalog();
wireEvents();
