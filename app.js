const curatedDunksRaw = [
    {
        id: "vince-dunk-of-death",
        title: "Vince Carter's Dunk of Death — 2000 Olympics",
        player: "Vince Carter",
        team: "Toronto Raptors",
        year: 2000,
        youtubeId: "XMrPjl-927Q",
        description: "The Olympic vault-over that turned a live defender into a permanent piece of dunk history.",
        tags: ["Olympics", "Over A Player", "Iconic"]
    },
    {
        id: "mj-free-throw-line",
        title: "Michael Jordan — Free Throw Line Dunk",
        player: "Michael Jordan",
        team: "Chicago Bulls",
        year: 1988,
        youtubeId: "CVsoFMQvwto",
        description: "MJ launched from the free throw line in the 1988 Slam Dunk Contest and made the silhouette immortal.",
        tags: ["Dunk Contest", "Free Throw Line", "Iconic"]
    },
    {
        id: "lebron-celtics-tomahawk",
        title: "LeBron James — Tomahawk vs. Celtics",
        player: "LeBron James",
        team: "Cleveland Cavaliers",
        year: 2008,
        youtubeId: "VkvTLOhm-TQ",
        description: "LeBron threw down a thunderous tomahawk against Boston in a playoff moment that felt built for posters.",
        tags: ["Playoffs", "Tomahawk", "Powerful"]
    },
    {
        id: "dominique-windmill",
        title: "Dominique Wilkins — Windmill Dunk",
        player: "Dominique Wilkins",
        team: "Atlanta Hawks",
        year: 1985,
        youtubeId: "sw8rPum4jcU",
        description: "The Human Highlight Film uncorks one of the cleanest contest windmills ever recorded.",
        tags: ["Dunk Contest", "Windmill", "Iconic"]
    },
    {
        id: "shaq-backboard-break",
        title: "Shaquille O'Neal — Backboard Breaking Dunk",
        player: "Shaquille O'Neal",
        team: "Orlando Magic",
        year: 1993,
        youtubeId: "lxElMqPhsfE",
        description: "Shaq turned a dunk into structural engineering footage and forced everyone to rethink rim durability.",
        tags: ["Powerful", "Backboard", "Iconic"]
    },
    {
        id: "blake-mozgov",
        title: "Blake Griffin — Over Timofey Mozgov",
        player: "Blake Griffin",
        team: "Los Angeles Clippers",
        year: 2010,
        youtubeId: "d8FYUdPPUy4",
        description: "A violent rookie-era poster that became one of the defining clips of the Lob City prequel.",
        tags: ["Posterizer", "Over A Player", "Rookie"]
    },
    {
        id: "kobe-reverse-nuggets",
        title: "Kobe Bryant — Reverse Dunk vs. Nuggets",
        player: "Kobe Bryant",
        team: "Los Angeles Lakers",
        year: 2001,
        youtubeId: "dic-CL5mLcU",
        description: "Kobe twists through traffic and finishes with the kind of reverse that only looks reasonable after replay five.",
        tags: ["Reverse", "In Traffic", "Acrobatic"]
    },
    {
        id: "zach-space-jam",
        title: "Zach LaVine — Space Jam Dunk",
        player: "Zach LaVine",
        team: "Minnesota Timberwolves",
        year: 2016,
        youtubeId: "QjG32huIjFw",
        description: "Between the legs from the free throw line, somehow with enough smoothness to make it look routine.",
        tags: ["Dunk Contest", "Between The Legs", "Free Throw Line"]
    },
    {
        id: "jrich-backboard-legs",
        title: "Jason Richardson — Between the Legs Off the Backboard",
        player: "Jason Richardson",
        team: "Golden State Warriors",
        year: 2003,
        youtubeId: "R6twnJjqoUY",
        description: "A dunk contest sequence that still looks like someone accidentally left the difficulty slider on impossible.",
        tags: ["Dunk Contest", "Off The Backboard", "Between The Legs"]
    },
    {
        id: "dwight-superman",
        title: "Dwight Howard — Superman Dunk",
        player: "Dwight Howard",
        team: "Orlando Magic",
        year: 2008,
        youtubeId: "d1ila4MBLIg",
        description: "Cape, theater, and a launch point that pushed the contest fully into comic-book territory.",
        tags: ["Dunk Contest", "Superman", "Iconic"]
    },
    {
        id: "pippen-ewing",
        title: "Scottie Pippen — Over Patrick Ewing",
        player: "Scottie Pippen",
        team: "Chicago Bulls",
        year: 1994,
        youtubeId: "srl2BU9jLFo",
        description: "Baseline drive, violent finish, then the stare-down. The whole sequence belongs in a museum.",
        tags: ["Posterizer", "Over A Player", "Iconic"]
    },
    {
        id: "lebron-wade-celtics",
        title: "LeBron James — Alley-Oop with D-Wade vs. Celtics",
        player: "LeBron James",
        team: "Miami Heat",
        year: 2011,
        youtubeId: "PxkOG6VaMxQ",
        description: "Peak Heatles spectacle: Wade sees it early, LeBron finishes with enough force to tilt the whole arena.",
        tags: ["Alley-Oop", "Playoffs", "Duo"]
    },
    {
        id: "ja-duren",
        title: "Ja Morant — Poster Over Jalen Duren",
        player: "Ja Morant",
        team: "Memphis Grizzlies",
        year: 2023,
        youtubeId: "hxQ0qf2Ysc8",
        description: "Ja launches so abruptly that the clip feels like it skips a frame before the finish lands.",
        tags: ["Posterizer", "In-Game", "Viral"]
    },
    {
        id: "giannis-hardaway",
        title: "Giannis Antetokounmpo — Over Tim Hardaway Jr.",
        player: "Giannis Antetokounmpo",
        team: "Milwaukee Bucks",
        year: 2019,
        youtubeId: "V4-0MMs8x6o",
        description: "The Greek Freak covers too much ground, too fast, and the result is pure helplessness at the rim.",
        tags: ["Posterizer", "Powerful", "In-Game"]
    },
    {
        id: "aaron-gordon-mascot",
        title: "Aaron Gordon — Under Both Legs Over Mascot",
        player: "Aaron Gordon",
        team: "Orlando Magic",
        year: 2016,
        youtubeId: "gSaBsGKzw7c",
        description: "One of the most creative contest dunks ever and still the center of an eternal robbery debate.",
        tags: ["Dunk Contest", "Over Mascot", "Between The Legs"]
    },
    {
        id: "deandre-brandon-knight",
        title: "DeAndre Jordan — Poster Over Brandon Knight",
        player: "DeAndre Jordan",
        team: "Los Angeles Clippers",
        year: 2013,
        youtubeId: "NTkN2q6sUUk",
        description: "This is the dictionary-definition poster: lob, collision, aftermath, disbelief.",
        tags: ["Posterizer", "Over A Player", "Iconic"]
    },
    {
        id: "dr-j-rock-cradle",
        title: "Julius Erving — Rock the Cradle Dunk",
        player: "Julius Erving",
        team: "Philadelphia 76ers",
        year: 1983,
        youtubeId: "1vz3eKkP_d4",
        description: "Dr. J turns a baseline attack into a piece of basketball choreography that still feels impossibly stylish.",
        tags: ["Reverse", "Acrobatic", "Classic"]
    },
    {
        id: "spud-webb-1986",
        title: "Spud Webb — 1986 Slam Dunk Contest",
        player: "Spud Webb",
        team: "Atlanta Hawks",
        year: 1986,
        youtubeId: "H5wBI98NFGE",
        description: "The underdog contest win that permanently broke assumptions about what kind of body can own the air.",
        tags: ["Dunk Contest", "Underdog", "Iconic"]
    },
    {
        id: "kd-haywood",
        title: "Kevin Durant — Poster Over Brendan Haywood",
        player: "Kevin Durant",
        team: "Oklahoma City Thunder",
        year: 2011,
        youtubeId: "vT6EzxYgBjQ",
        description: "KD catches a defender expecting finesse and answers with straight-line violence instead.",
        tags: ["Posterizer", "In-Game", "Powerful"]
    },
    {
        id: "westbrook-tomahawk",
        title: "Russell Westbrook — Tomahawk vs. Warriors",
        player: "Russell Westbrook",
        team: "Oklahoma City Thunder",
        year: 2016,
        youtubeId: "7xPls15yzRo",
        description: "Pure fury in dunk form, with the kind of landing that tells you the rim barely survived.",
        tags: ["Tomahawk", "Powerful", "In-Game"]
    },
    {
        id: "tmac-self-oop",
        title: "Tracy McGrady — Alley-Oop Off the Backboard to Himself",
        player: "Tracy McGrady",
        team: "Orlando Magic",
        year: 2002,
        youtubeId: "us3Fz5JkfZ8",
        description: "The self-oop that felt too playful for an NBA game until T-Mac made it look obvious.",
        tags: ["Self Alley-Oop", "Acrobatic", "Iconic"]
    },
    {
        id: "ant-watanabe",
        title: "Anthony Edwards — Poster Over Watanabe",
        player: "Anthony Edwards",
        team: "Minnesota Timberwolves",
        year: 2022,
        youtubeId: "axKUIshBRaw",
        description: "A modern baptism clip: terrifying takeoff, total contact, instant replay immortality.",
        tags: ["Posterizer", "Viral", "Powerful"]
    },
    {
        id: "clyde-glide",
        title: "Clyde Drexler — Glide Dunk",
        player: "Clyde Drexler",
        team: "Portland Trail Blazers",
        year: 1989,
        youtubeId: "Bx-_KL8-SNE",
        description: "The nickname becomes a literal scouting report as Clyde floats into an effortless baseline slam.",
        tags: ["Baseline", "Glide", "Classic"]
    },
    {
        id: "drose-dragic",
        title: "Derrick Rose — Over Goran Dragic",
        player: "Derrick Rose",
        team: "Chicago Bulls",
        year: 2010,
        youtubeId: "uRAp00SxP30",
        description: "MVP-season Rose attacks with no deceleration and turns a crowded lane into a warning label.",
        tags: ["Posterizer", "In-Game", "MVP Season"]
    },
    {
        id: "nate-over-dwight",
        title: "Nate Robinson — Over Dwight Howard",
        player: "Nate Robinson",
        team: "New York Knicks",
        year: 2009,
        youtubeId: "3fQmifTeDlc",
        description: "A contest dunk built entirely on audacity, timing, and a complete refusal to care about size.",
        tags: ["Dunk Contest", "Over A Player", "Underdog"]
    },
    {
        id: "kawhi-pacers",
        title: "Kawhi Leonard — Playoff Poster vs. Pacers",
        player: "Kawhi Leonard",
        team: "Toronto Raptors",
        year: 2019,
        youtubeId: "8Dv2M67ZXGA",
        description: "Kawhi usually looks economical; this one looked like he temporarily borrowed someone else's rage.",
        tags: ["Playoffs", "Powerful", "Two-Handed"]
    },
    {
        id: "iverson-mourning",
        title: "Allen Iverson — Dunk on Alonzo Mourning",
        player: "Allen Iverson",
        team: "Philadelphia 76ers",
        year: 2001,
        youtubeId: "y3X274lz3wY",
        description: "The size mismatch makes the finish feel even louder. AI had zero interest in respecting reputations.",
        tags: ["Posterizer", "In-Game", "Fearless"]
    },
    {
        id: "wade-varajao",
        title: "Dwyane Wade — Poster on Anderson Varejao",
        player: "Dwyane Wade",
        team: "Miami Heat",
        year: 2009,
        youtubeId: "5uRN7iJ5CqQ",
        description: "D-Wade detonates through the paint and leaves Varejao in the exact clip everyone remembers.",
        tags: ["Posterizer", "In-Game", "Powerful"]
    },
    {
        id: "dawkins-shatter",
        title: "Darryl Dawkins — Backboard Shattering Dunk",
        player: "Darryl Dawkins",
        team: "Philadelphia 76ers",
        year: 1979,
        youtubeId: "GFMnTM7cXdQ",
        description: "Chocolate Thunder helped force the league toward breakaway rims by dunking like the glass offended him.",
        tags: ["Backboard", "Powerful", "Historic"]
    },
    {
        id: "zion-360-windmill",
        title: "Zion Williamson — 360 Windmill at Duke",
        player: "Zion Williamson",
        team: "Duke Blue Devils",
        year: 2019,
        youtubeId: "UdSV_5AJjAo",
        description: "College basketball briefly turned into a dunk lab experiment and Zion passed the test instantly.",
        tags: ["College", "360", "Windmill"]
    },
    {
        id: "james-white-ft-line",
        title: "James White — Between the Legs Free Throw Line",
        player: "James White",
        team: "Cincinnati Bearcats",
        year: 2006,
        youtubeId: "LVpLRnCJAS0",
        description: "Flight White earned the nickname with a dunk that still sounds exaggerated even when described accurately.",
        tags: ["Dunk Contest", "Between The Legs", "Free Throw Line"]
    },
    {
        id: "pg-360-windmill",
        title: "Paul George — 360 Windmill vs. Bobcats",
        player: "Paul George",
        team: "Indiana Pacers",
        year: 2014,
        youtubeId: "V7_vpXoUxv8",
        description: "An in-game 360 windmill has no business looking this casual, which is exactly what makes it absurd.",
        tags: ["360", "Windmill", "In-Game"]
    },
    {
        id: "lebron-jason-terry",
        title: "LeBron James — Over Jason Terry",
        player: "LeBron James",
        team: "Miami Heat",
        year: 2013,
        youtubeId: "V-QTiByTKaI",
        description: "LeBron drives baseline and detonates over Jason Terry for one of the defining posters of the decade.",
        tags: ["Posterizer", "Tomahawk", "Iconic"]
    },
    {
        id: "wemby-block-to-oop",
        title: "Victor Wembanyama — Alley-Oop Block to Dunk",
        player: "Victor Wembanyama",
        team: "San Antonio Spurs",
        year: 2024,
        youtubeId: "CKqXFNIvClg",
        description: "Block on one end, full-court glide on the other, then the alley-oop finish that sells the unicorn myth.",
        tags: ["Alley-Oop", "Block", "Rookie"]
    },
    {
        id: "mitchell-rockets",
        title: "Donovan Mitchell — Playoff Poster vs. Rockets",
        player: "Donovan Mitchell",
        team: "Utah Jazz",
        year: 2019,
        youtubeId: "8GZz1F7T2mE",
        description: "Spida elevates into traffic and turns a playoff possession into a personal brand statement.",
        tags: ["Playoffs", "Posterizer", "Powerful"]
    },
    {
        id: "shawn-kemp-lob",
        title: "Shawn Kemp — Lob City Before Lob City",
        player: "Shawn Kemp",
        team: "Seattle SuperSonics",
        year: 1992,
        youtubeId: "l2GaAWdHwsw",
        description: "The Reign Man catches a lob, unloads on the rim, and adds enough attitude to make the replay mandatory.",
        tags: ["Alley-Oop", "Posterizer", "Iconic"]
    },
    {
        id: "pippen-allstar-oop",
        title: "Kenny Smith to Scottie Pippen — 1994 All-Star Alley-Oop",
        player: "Scottie Pippen",
        team: "Chicago Bulls",
        year: 1994,
        youtubeId: "JO0IMXFN4bA",
        description: "An All-Star lob that still feels crisp decades later, partly because Scottie finishes it with contempt.",
        tags: ["All-Star", "Alley-Oop", "Classic"]
    },
    {
        id: "vince-2000-contest",
        title: "Vince Carter — 2000 Slam Dunk Contest",
        player: "Vince Carter",
        team: "Toronto Raptors",
        year: 2000,
        youtubeId: "igKn4wEfyKA",
        description: "The gold-standard dunk contest performance: 360 windmill, between-the-legs, elbow hang, no wasted motion.",
        tags: ["Dunk Contest", "Iconic", "GOAT Performance"]
    },
    {
        id: "jimmy-giannis",
        title: "Jimmy Butler — Poster on Giannis",
        player: "Jimmy Butler",
        team: "Miami Heat",
        year: 2020,
        youtubeId: "GRTtqYXscEw",
        description: "Jimmy rises through Giannis with exactly the kind of fearless aggression his playoff reputation promises.",
        tags: ["Posterizer", "Playoffs", "Fearless"]
    },
    {
        id: "terrence-ross-2013",
        title: "Terrence Ross — 2013 Slam Dunk Contest",
        player: "Terrence Ross",
        team: "Toronto Raptors",
        year: 2013,
        youtubeId: "y1aMoXIizTk",
        description: "Ross channels Toronto dunk lineage and wins the contest with a performance built on control and lift.",
        tags: ["Dunk Contest", "Vince Carter Tribute"]
    },
    {
        id: "steph-rare-poster",
        title: "Stephen Curry — Rare Poster Dunk",
        player: "Stephen Curry",
        team: "Golden State Warriors",
        year: 2019,
        youtubeId: "HGBBR9UNs1k",
        description: "Nobody expects it, which is the whole fun of it: a Curry dunk that lands like a glitch in the matrix.",
        tags: ["Unexpected", "Posterizer", "Rare"]
    },
    {
        id: "cp3-blake-lakers",
        title: "Chris Paul — Alley-Oop to Blake Griffin vs. Lakers",
        player: "Blake Griffin",
        team: "Los Angeles Clippers",
        year: 2012,
        youtubeId: "FCXo40DVXJQ",
        description: "Peak Lob City. CP3 drops the pass in exactly the right window and Blake handles the rest with cruelty.",
        tags: ["Alley-Oop", "Lob City", "Rivalry"]
    },
    {
        id: "john-wall-2014",
        title: "John Wall — 2014 Slam Dunk Contest",
        player: "John Wall",
        team: "Washington Wizards",
        year: 2014,
        youtubeId: "RqWcY-RAXLQ",
        description: "Wall finishes a creative contest setup with the kind of reverse snap that makes the whole sequence click.",
        tags: ["Dunk Contest", "Reverse", "Creative"]
    },
    {
        id: "amare-poster",
        title: "Amar'e Stoudemire — Poster Over Everyone",
        player: "Amar'e Stoudemire",
        team: "Phoenix Suns",
        year: 2005,
        youtubeId: "ZCb_8k7KBhI",
        description: "STAT spent entire seasons turning Nash-era space into runway, then punishing whichever defender was late.",
        tags: ["Posterizer", "Powerful", "Run And Gun"]
    },
    {
        id: "darius-qrich-backboard",
        title: "Darius Miles & Quentin Richardson — Off-the-Backboard Alley-Oop",
        player: "Darius Miles",
        team: "Los Angeles Clippers",
        year: 2001,
        youtubeId: "aBtNTXG_0c0",
        description: "One of the most joyful duo highlights of that era: flashy, reckless, and absolutely worth it.",
        tags: ["Alley-Oop", "Off The Backboard", "Duo"]
    },
    {
        id: "mac-mcclung-2023",
        title: "Mac McClung — 2023 Slam Dunk Contest",
        player: "Mac McClung",
        team: "Philadelphia 76ers",
        year: 2023,
        youtubeId: "A7Dwb2cUJpc",
        description: "Mac revived the event with a two-way-player legend run that instantly became weekend-saving folklore.",
        tags: ["Dunk Contest", "Underdog", "Viral"]
    },
    {
        id: "dirk-rare-poster",
        title: "Dirk Nowitzki — Rare Poster Slam",
        player: "Dirk Nowitzki",
        team: "Dallas Mavericks",
        year: 2007,
        youtubeId: "RMCODhFwVWA",
        description: "The shock value does a lot of the work, but the finish still deserves its place in the archive.",
        tags: ["Unexpected", "Posterizer", "Rare"]
    },
    {
        id: "cwebb-self-oop",
        title: "Chris Webber — Off the Backboard Self Alley-Oop",
        player: "Chris Webber",
        team: "Sacramento Kings",
        year: 2002,
        youtubeId: "LbBMPeMHJ9g",
        description: "C-Webb turns a transition chance into playground theater without losing any of the NBA-level violence.",
        tags: ["Self Alley-Oop", "Creative", "Classic"]
    },
    {
        id: "jaylen-windmill-poster",
        title: "Jaylen Brown — Windmill Poster",
        player: "Jaylen Brown",
        team: "Boston Celtics",
        year: 2021,
        youtubeId: "kqSUul6ts00",
        description: "A windmill in traffic is already rude; doing it in rhythm makes it feel even meaner.",
        tags: ["Windmill", "In-Game", "Powerful"]
    },
    {
        id: "larry-nance-1984",
        title: "Larry Nance — First NBA Slam Dunk Contest Winner",
        player: "Larry Nance",
        team: "Phoenix Suns",
        year: 1984,
        youtubeId: "7xPls15yzRo",
        description: "The first official NBA dunk contest champion, locking in a new part of basketball culture from the jump.",
        tags: ["Dunk Contest", "Historic", "First Ever"]
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
    }
];

const verifiedVideoIds = new Set([
    "XMrPjl-927Q",
    "VkvTLOhm-TQ",
    "NTkN2q6sUUk",
    "uRAp00SxP30",
    "y3X274lz3wY",
    "5uRN7iJ5CqQ",
    "V7_vpXoUxv8",
    "V-QTiByTKaI",
    "l2GaAWdHwsw",
    "iyLHuVwJUkc",
    "d8FYUdPPUy4"
]);

const elements = {
    statDunks: document.getElementById("stat-dunks"),
    statPlayers: document.getElementById("stat-players"),
    statYears: document.getElementById("stat-years"),
    featuredTitle: document.getElementById("featured-title"),
    featuredMeta: document.getElementById("featured-meta"),
    featuredDescription: document.getElementById("featured-description"),
    featuredWatch: document.getElementById("featured-watch"),
    randomDunk: document.getElementById("random-dunk"),
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
    searchLaunch: document.getElementById("search-launch"),
    searchChips: Array.from(document.querySelectorAll(".search-chip")),
    videoModal: document.getElementById("video-modal"),
    videoShell: document.getElementById("video-shell"),
    videoFrame: document.getElementById("video-frame"),
    modalClose: document.getElementById("modal-close"),
    modalKicker: document.getElementById("modal-kicker"),
    modalTitle: document.getElementById("modal-title"),
    modalDescription: document.getElementById("modal-description"),
    modalStatus: document.getElementById("modal-status"),
    modalTags: document.getElementById("modal-tags"),
    modalYoutubeLink: document.getElementById("modal-youtube-link")
};

const filters = {
    query: "",
    player: "",
    team: "",
    year: "",
    tag: ""
};

function buildYouTubeSearchUrl(query) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function thumbnailFor(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function normalizeDunk(dunk) {
    const hasVerifiedVideo = verifiedVideoIds.has(dunk.youtubeId);
    const searchQuery = `${dunk.player} ${dunk.title} dunk`;
    return {
        ...dunk,
        hasVerifiedVideo,
        searchQuery,
        watchUrl: hasVerifiedVideo
            ? `https://www.youtube.com/watch?v=${dunk.youtubeId}`
            : buildYouTubeSearchUrl(searchQuery),
        thumbnail: hasVerifiedVideo ? thumbnailFor(dunk.youtubeId) : "",
        availabilityLabel: hasVerifiedVideo ? "Verified Clip" : "Clip Hunt"
    };
}

const curatedDunks = curatedDunksRaw.map(normalizeDunk);

function uniqueValues(key) {
    return [...new Set(curatedDunks.map((dunk) => dunk[key]))].sort();
}

function uniqueTags() {
    return [...new Set(curatedDunks.flatMap((dunk) => dunk.tags))].sort();
}

function createOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
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
    const featured = curatedDunks.find((dunk) => dunk.hasVerifiedVideo) || curatedDunks[0];
    elements.featuredTitle.textContent = featured.title;
    elements.featuredMeta.textContent = `${featured.player} • ${featured.team} • ${featured.year}`;
    elements.featuredDescription.textContent = featured.description;
    elements.featuredWatch.textContent = featured.hasVerifiedVideo ? "Watch Dunk" : "Find Clip";
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

function fallbackThumbMarkup(dunk) {
    return `
        <div class="card-thumb fallback-thumb">
            <span class="card-badge card-badge-left">${dunk.availabilityLabel}</span>
            <span class="card-badge">${dunk.year}</span>
            <div class="fallback-copy">
                <p>${dunk.player}</p>
                <strong>Find A Fresh Clip</strong>
            </div>
            <button class="card-play card-play-search" type="button" aria-label="Find ${dunk.title} on YouTube">↗</button>
        </div>
    `;
}

function verifiedThumbMarkup(dunk) {
    return `
        <div class="card-thumb">
            <img src="${dunk.thumbnail}" alt="${dunk.title}">
            <span class="card-badge card-badge-left">${dunk.availabilityLabel}</span>
            <span class="card-badge">${dunk.year}</span>
            <button class="card-play" type="button" aria-label="Play ${dunk.title}">▶</button>
        </div>
    `;
}

function createDunkCard(dunk) {
    const article = document.createElement("article");
    article.className = `dunk-card${dunk.hasVerifiedVideo ? "" : " dunk-card-search"}`;
    article.innerHTML = `
        ${dunk.hasVerifiedVideo ? verifiedThumbMarkup(dunk) : fallbackThumbMarkup(dunk)}
        <div class="card-body">
            <h3 class="card-title">${dunk.title}</h3>
            <p class="card-meta">${dunk.player} • ${dunk.team}</p>
            <p class="card-description">${dunk.description}</p>
            <div class="tag-row"></div>
        </div>
    `;

    renderTags(article.querySelector(".tag-row"), dunk.tags);
    article.addEventListener("click", () => openModal(dunk));
    return article;
}

function openModal(item) {
    elements.modalKicker.textContent = `${item.player} • ${item.team} • ${item.year}`;
    elements.modalTitle.textContent = item.title;
    elements.modalDescription.textContent = item.description || "Track down the clip on YouTube.";
    elements.modalYoutubeLink.href = item.watchUrl;
    elements.modalYoutubeLink.textContent = item.hasVerifiedVideo ? "Open on YouTube" : "Find Clip on YouTube";
    renderTags(elements.modalTags, item.tags || ["Archive"]);

    if (item.hasVerifiedVideo) {
        elements.modalStatus.textContent = "Verified embeddable clip.";
        elements.videoShell.classList.remove("hidden");
        elements.videoFrame.src = `https://www.youtube.com/embed/${item.youtubeId}?autoplay=1`;
    } else {
        elements.modalStatus.textContent = "This archive entry uses a safer YouTube search handoff because a stable embeddable clip was not verified.";
        elements.videoShell.classList.add("hidden");
        elements.videoFrame.src = "";
    }

    elements.videoModal.showModal();
}

function closeModal() {
    elements.videoFrame.src = "";
    elements.videoModal.close();
}

function renderCatalog() {
    const results = curatedDunks.filter(matchesFilter);
    const verifiedCount = results.filter((dunk) => dunk.hasVerifiedVideo).length;
    const clipHuntCount = results.length - verifiedCount;
    elements.catalogGrid.innerHTML = "";
    elements.resultsCount.textContent = `Showing ${results.length} dunk${results.length === 1 ? "" : "s"} • ${verifiedCount} verified clip${verifiedCount === 1 ? "" : "s"} • ${clipHuntCount} clip hunt${clipHuntCount === 1 ? "" : "s"}`;
    elements.emptyState.classList.toggle("hidden", results.length > 0);
    results.forEach((dunk) => elements.catalogGrid.appendChild(createDunkCard(dunk)));
}

function scoreMatch(dunk, query) {
    const lower = query.toLowerCase();
    let score = 0;
    if (dunk.title.toLowerCase().includes(lower)) score += 5;
    if (dunk.player.toLowerCase().includes(lower)) score += 4;
    if (dunk.team.toLowerCase().includes(lower)) score += 3;
    if (dunk.tags.some((tag) => tag.toLowerCase().includes(lower))) score += 3;
    if (dunk.description.toLowerCase().includes(lower)) score += 1;
    if (dunk.hasVerifiedVideo) score += 1;
    return score;
}

function archiveMatchesFor(query) {
    return curatedDunks
        .map((dunk) => ({ dunk, score: scoreMatch(dunk, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.dunk.year - a.dunk.year)
        .map((item) => item.dunk);
}

function resetSearchPanel() {
    elements.youtubeStatus.textContent = "No API key needed. Search to get archive matches and a direct YouTube results link.";
    elements.youtubeResults.innerHTML = "";
    elements.searchLaunch.innerHTML = "";
    elements.searchLaunch.classList.add("hidden");
}

function renderSearchResults() {
    const query = elements.youtubeQuery.value.trim();
    if (!query) {
        resetSearchPanel();
        return;
    }

    const matches = archiveMatchesFor(query).slice(0, 6);
    const searchUrl = buildYouTubeSearchUrl(`${query} dunk`);

    elements.searchLaunch.classList.remove("hidden");
    elements.searchLaunch.innerHTML = `
        <p class="section-note">Open a fresh YouTube results page for this query, then use the archive matches below as your fast lane.</p>
        <a class="primary-button" href="${searchUrl}" target="_blank" rel="noopener noreferrer">Search YouTube for "${query}"</a>
    `;

    elements.youtubeResults.innerHTML = "";
    matches.forEach((dunk) => elements.youtubeResults.appendChild(createDunkCard(dunk)));

    elements.youtubeStatus.textContent = matches.length
        ? `Found ${matches.length} archive match${matches.length === 1 ? "" : "es"} for "${query}".`
        : `No archive matches for "${query}" yet, but the YouTube search link above is ready.`;
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

function openRandomDunk() {
    const choice = curatedDunks[Math.floor(Math.random() * curatedDunks.length)];
    openModal(choice);
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
    elements.randomDunk.addEventListener("click", openRandomDunk);
    elements.modalClose.addEventListener("click", closeModal);
    elements.videoModal.addEventListener("click", (event) => {
        if (event.target === elements.videoModal) {
            closeModal();
        }
    });

    elements.youtubeSearchButton.addEventListener("click", renderSearchResults);
    elements.youtubeQuery.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            renderSearchResults();
        }
    });

    elements.searchChips.forEach((button) => {
        button.addEventListener("click", () => {
            elements.youtubeQuery.value = button.dataset.query;
            renderSearchResults();
        });
    });
}

hydrateFilters();
updateStats();
updateFeatured();
renderCatalog();
resetSearchPanel();
wireEvents();
