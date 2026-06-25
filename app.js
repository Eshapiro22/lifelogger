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
    },
    {
        id: "drj-aba-1976",
        title: "Dr. J Wins the First-Ever Slam Dunk Contest",
        player: "Julius Erving",
        team: "New York Nets",
        year: 1976,
        type: "Dunk Contest",
        youtubeId: "vRw-mN-fiAk",
        description: "Denver, 1976 ABA All-Star halftime: the first slam dunk contest ever held. Dr. J wins it with a foul-line dunk that invents the template every contest dunk follows afterward.",
        tags: ["Free Throw Line", "ABA", "Legendary"]
    },
    {
        id: "drexler-1984",
        title: "Clyde Drexler at the Inaugural NBA Dunk Contest",
        player: "Clyde Drexler",
        team: "Portland Trail Blazers",
        year: 1984,
        type: "Dunk Contest",
        youtubeId: "sYwDKvf9Vx8",
        description: "The Glide at the inaugural 1984 NBA contest: silky, airborne, and a preview of the decade of aerial artistry Portland fans were about to enjoy.",
        tags: ["Legendary"]
    },
    {
        id: "griffith-1984",
        title: "Darrell Griffith at the Inaugural NBA Dunk Contest",
        player: "Darrell Griffith",
        team: "Utah Jazz",
        year: 1984,
        type: "Dunk Contest",
        youtubeId: "KGG0FwB5aFg",
        description: "Dr. Dunkenstein was named that for a reason. Griffith's hang time at the first NBA contest looks physically impossible for a 6'4\" guard from 1984.",
        tags: ["Legendary"]
    },
    {
        id: "mj-1985-contest",
        title: "Michael Jordan 1985 Dunk Contest",
        player: "Michael Jordan",
        team: "Chicago Bulls",
        year: 1985,
        type: "Dunk Contest",
        youtubeId: "HlI1-C3_lVg",
        description: "Jordan's rookie-season contest run — runner-up to Wilkins — is so good that losing feels like a miscarriage of justice. The dunks themselves settle the argument.",
        tags: ["Legendary"]
    },
    {
        id: "malone-ewing-1989",
        title: "Karl Malone Dunks Over Patrick Ewing",
        player: "Karl Malone",
        team: "Utah Jazz",
        year: 1989,
        type: "Poster",
        youtubeId: "CsCXIdaVT1U",
        description: "The Mailman at the Garden: Malone drives baseline, rises over Ewing's outstretched arm, and delivers with a force that rattles the basket support.",
        tags: ["In-Game", "Power"]
    },
    {
        id: "nique-robinson-1991",
        title: "Dominique Wilkins Posters David Robinson",
        player: "Dominique Wilkins",
        team: "Atlanta Hawks",
        year: 1991,
        type: "Poster",
        youtubeId: "Z8RPFkuXL30",
        description: "Nique rises over the Admiral with full extension and throws it down — a poster from an era when posterizing a Hall of Famer carried real weight.",
        tags: ["In-Game", "Legendary"]
    },
    {
        id: "harold-miner-1993",
        title: "Harold Miner Wins the 1993 Dunk Contest",
        player: "Harold Miner",
        team: "Miami Heat",
        year: 1993,
        type: "Dunk Contest",
        youtubeId: "xolEl3uhEoQ",
        description: "Baby Jordan wins the 1993 contest with a reverse so clutch the judges need a moment. One of the most underrated contest performances of the decade.",
        tags: ["Reverse", "Legendary"]
    },
    {
        id: "penny-playoffs-1994",
        title: "Penny Hardaway 1994 Playoff Dunk",
        player: "Anfernee Hardaway",
        team: "Orlando Magic",
        year: 1994,
        type: "Poster",
        youtubeId: "Go574BBXbyw",
        description: "The 22-year-old Penny rises in transition during the 1994 playoffs and throws down a two-handed flush that tells the league a new generation has arrived.",
        tags: ["In-Game", "Playoffs", "Explosive"]
    },
    {
        id: "rider-east-bay-1994",
        title: "Isaiah Rider East Bay Funk Dunk",
        player: "Isaiah Rider",
        team: "Minnesota Timberwolves",
        year: 1994,
        type: "Dunk Contest",
        youtubeId: "Y4nai6stST0",
        description: "Rider catches a self-lob, brings it between his legs on the way down, and finishes with a move nobody had seen in competition before. The contest is never the same.",
        tags: ["Between Legs", "Legendary"]
    },
    {
        id: "hill-ewing-1995",
        title: "Grant Hill Dunks Past Patrick Ewing",
        player: "Grant Hill",
        team: "Detroit Pistons",
        year: 1995,
        type: "Poster",
        youtubeId: "cUlOBg19sTA",
        description: "Hill reads the double-team, crosses over, and floats past Ewing for a dunk so complete and inevitable it looks like it was drawn up on a whiteboard.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "josh-smith-2005",
        title: "Josh Smith 2005 Dunk Contest",
        player: "Josh Smith",
        team: "Atlanta Hawks",
        year: 2005,
        type: "Dunk Contest",
        youtubeId: "1EfYwBb2iho",
        description: "Nineteen years old, J-Smoove wins the 2005 contest with a windmill tribute to Dominique Wilkins that makes the arena erupt and makes Nique smile from his seat.",
        tags: ["Windmill", "Legendary"]
    },
    {
        id: "baron-kirilenko-2007",
        title: "Baron Davis Over Andrei Kirilenko",
        player: "Baron Davis",
        team: "Golden State Warriors",
        year: 2007,
        type: "Poster",
        youtubeId: "Ei7u-8IRACw",
        description: "The defining image of the 'We Believe' run: B-Diddy launches from inside the arc and erases the 6'9\" Kirilenko in Game 3 of the West semis with one of the most visceral playoff posters ever.",
        tags: ["In-Game", "Playoffs", "Legendary"]
    },
    {
        id: "nate-robinson-2009",
        title: "Nate Robinson Jumps Over Dwight Howard",
        player: "Nate Robinson",
        team: "New York Knicks",
        year: 2009,
        type: "Dunk Contest",
        youtubeId: "VwXNPbKouzs",
        description: "5'9\" Nate dresses as Kryptonite, positions a costumed Dwight Howard on the court, and clears the 6'11\" Superman to win his second title — the greatest size-differential stunt in contest history.",
        tags: ["Legendary", "Upset"]
    },
    {
        id: "serge-ibaka-2011",
        title: "Serge Ibaka Free Throw Line Dunk",
        player: "Serge Ibaka",
        team: "Oklahoma City Thunder",
        year: 2011,
        type: "Dunk Contest",
        youtubeId: "9FJvGqMhU84",
        description: "Ibaka plants at the free throw line, launches, and clears the stripe by a foot and a half. The most technically sound foul-line dunk since Jordan's silhouette.",
        tags: ["Free Throw Line", "Legendary"]
    },
    {
        id: "lebron-garnett-2012",
        title: "LeBron James Monster Dunk on Kevin Garnett",
        player: "LeBron James",
        team: "Miami Heat",
        year: 2012,
        type: "Poster",
        youtubeId: "c6N4FeyKkhc",
        description: "2012 Eastern Conference Finals, Game 1: LeBron rises over the Big Ticket with a thunderous left-handed slam that takes the air out of TD Garden in a single motion.",
        tags: ["In-Game", "Playoffs", "Legendary"]
    },
    {
        id: "lebron-perkins-2012",
        title: "LeBron James Dunks Over Kendrick Perkins",
        player: "LeBron James",
        team: "Miami Heat",
        year: 2012,
        type: "Poster",
        youtubeId: "blAIcFGyca0",
        description: "Game 1 of the 2012 NBA Finals: LeBron catches in transition, rises over Perkins, and finishes an authoritative one-handed slam that signals the championship is already over.",
        tags: ["In-Game", "Playoffs", "Fast Break"]
    },
    {
        id: "kd-pacers-2012",
        title: "Kevin Durant Poster Dunk vs Indiana",
        player: "Kevin Durant",
        team: "Oklahoma City Thunder",
        year: 2012,
        type: "Poster",
        youtubeId: "ng3gjKf90iQ",
        description: "April 6, 2012: KD attacks the paint and rises over the Pacers defender, finishing two-handed and reminding the league that a seven-footer can also be a freak athlete.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "pg-360-windmill-2014",
        title: "Paul George 360 Windmill Slam",
        player: "Paul George",
        team: "Indiana Pacers",
        year: 2014,
        type: "Windmill",
        youtubeId: "1aMs6khRYPM",
        description: "January 19, 2014 in transition: PG13 completes a full 360 rotation and brings the ball all the way around with a windmill finish that stops Bankers Life Fieldhouse in its tracks.",
        tags: ["In-Game", "360", "Explosive"]
    },
    {
        id: "gordon-tacko-2020",
        title: "Aaron Gordon Dunks Over Tacko Fall",
        player: "Aaron Gordon",
        team: "Orlando Magic",
        year: 2020,
        type: "Dunk Contest",
        youtubeId: "GIzMy2blDGI",
        description: "Gordon elevates over the 7'5\" Tacko Fall — arguably the greatest dunk in contest history. Judges gave it a 47. The crowd gave it a standing ovation. Justice was never served.",
        tags: ["Legendary", "Robbed"]
    },
    {
        id: "kyrie-poster-2021",
        title: "Kyrie Irving Two-Handed Poster Dunk",
        player: "Kyrie Irving",
        team: "Brooklyn Nets",
        year: 2021,
        type: "Poster",
        youtubeId: "_-mrUS6sQSk",
        description: "All angles confirmed: Kyrie absorbs contact at the rim and throws down a two-handed poster that Brooklyn fans still argue should have been the dunk of the year.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "mac-mcclung-2023",
        title: "Mac McClung Wins the 2023 Dunk Contest",
        player: "Mac McClung",
        team: "Philadelphia 76ers",
        year: 2023,
        type: "Dunk Contest",
        youtubeId: "j2pbAp3UtEI",
        description: "The first G-League player ever invited to the contest posts three perfect 50s and wins going away — the biggest underdog championship since Spud Webb in 1986.",
        tags: ["Legendary", "Upset"]
    },
    {
        id: "vince-btl-2000",
        title: "Vince Carter Between-the-Legs Dunk",
        player: "Vince Carter",
        team: "Toronto Raptors",
        year: 2000,
        type: "Dunk Contest",
        youtubeId: "bmnq2ITh914",
        description: "The centerpiece of the greatest contest performance ever: Carter catches a lob, threads the ball between his legs mid-air, and finishes — a move so clean it silenced the arena for a full second.",
        tags: ["Between Legs", "Legendary"]
    },
    {
        id: "kobe-1997-contest",
        title: "Kobe Bryant Wins the 1997 Dunk Contest",
        player: "Kobe Bryant",
        team: "Los Angeles Lakers",
        year: 1997,
        type: "Dunk Contest",
        youtubeId: "pKTLxG0wGfg",
        description: "Eighteen-year-old Kobe wins the contest as a Lakers rookie, flashing the athleticism and competitive ferocity that would define the next two decades.",
        tags: ["Legendary"]
    },
    {
        id: "terrence-ross-2013",
        title: "Terrence Ross Wins the 2013 Dunk Contest",
        player: "Terrence Ross",
        team: "Toronto Raptors",
        year: 2013,
        type: "Dunk Contest",
        youtubeId: "n7DrsR9Xodk",
        description: "Ross beats Ibaka with a throwback Vince Carter tribute dunk — bringing the contest crown back to Toronto and proving the Raptors still own the event.",
        tags: ["Legendary"]
    },
    {
        id: "donovan-mitchell-2018",
        title: "Donovan Mitchell Wins the 2018 Dunk Contest",
        player: "Donovan Mitchell",
        team: "Utah Jazz",
        year: 2018,
        type: "Dunk Contest",
        youtubeId: "hgtR0o6OjjU",
        description: "Mitchell wears a Vince Carter jersey and delivers a between-the-legs windmill as his tribute dunk — a perfect note to win on, and a torch-passing moment for the new generation.",
        tags: ["Between Legs", "Windmill", "Legendary"]
    },
    {
        id: "hamidou-diallo-2019",
        title: "Hamidou Diallo Dunks Over Shaq",
        player: "Hamidou Diallo",
        team: "Oklahoma City Thunder",
        year: 2019,
        type: "Dunk Contest",
        youtubeId: "k3SOL8kA8fg",
        description: "Diallo puts his elbow on the rim after clearing a seated 7'1\" Shaquille O'Neal — the highest-elevation prop dunk in contest history, good enough for a 50.",
        tags: ["Legendary", "Power"]
    },
    {
        id: "anfernee-simons-2021",
        title: "Anfernee Simons Wins the 2021 Dunk Contest",
        player: "Anfernee Simons",
        team: "Portland Trail Blazers",
        year: 2021,
        type: "Dunk Contest",
        youtubeId: "9D5YueDuQoM",
        description: "Simons wins the pandemic-era contest with a between-the-legs reverse that earns back-to-back 50s — the kind of performance that turns a backup guard into a household name overnight.",
        tags: ["Between Legs", "Reverse", "Legendary"]
    },
    {
        id: "obi-toppin-2022",
        title: "Obi Toppin Wins the 2022 Dunk Contest",
        player: "Obi Toppin",
        team: "New York Knicks",
        year: 2022,
        type: "Dunk Contest",
        youtubeId: "9XwUg0Re1eY",
        description: "Toppin's father catches a lob off the backboard, and Obi finishes the relay dunk — the best father-son moment in contest history, capping a back-to-back perfect 50 run.",
        tags: ["Alley-Oop", "Legendary"]
    },
    {
        id: "mac-mcclung-2024",
        title: "Mac McClung Wins the 2024 Dunk Contest",
        player: "Mac McClung",
        team: "Osceola Magic",
        year: 2024,
        type: "Dunk Contest",
        youtubeId: "NKI0SyOc0gs",
        description: "Back-to-back champion: McClung defends his title with another perfect-50 showing including a dunk over the seated Shaq — the first repeat winner since Jason Richardson in 2003.",
        tags: ["Legendary", "Upset"]
    },
    {
        id: "daryl-dawkins-1979",
        title: "Daryl Dawkins Shatters the Backboard",
        player: "Daryl Dawkins",
        team: "Philadelphia 76ers",
        year: 1979,
        type: "Power",
        youtubeId: "O1J86HLTyiM",
        description: "November 13, 1979 against the Kansas City Kings: Chocolate Thunder connects so violently that the entire backboard explodes into pieces — the moment that forced the NBA to install breakaway rims.",
        tags: ["Rim Wrecker", "Legendary", "Historic"]
    },
    {
        id: "nique-over-bird",
        title: "Dominique Wilkins Posterizes Larry Bird",
        player: "Dominique Wilkins",
        team: "Atlanta Hawks",
        year: 1985,
        type: "Poster",
        youtubeId: "BP3VR-vZT18",
        description: "The Human Highlight Film rises over the greatest forward of his era and throws it down — the defining image of what it meant to be posterized in the mid-80s NBA.",
        tags: ["In-Game", "Legendary"]
    },
    {
        id: "kemp-lister-1992",
        title: "Shawn Kemp Dunks on Alton Lister",
        player: "Shawn Kemp",
        team: "Seattle SuperSonics",
        year: 1992,
        type: "Poster",
        youtubeId: "l2GaAWdHwsw",
        description: "The 1992 playoffs: Kemp rises over Lister and points at his face before he even lands — one of the most disrespectful poster dunks in NBA history and the moment the Reign Man became a legend.",
        tags: ["In-Game", "Playoffs", "Legendary"]
    },
    {
        id: "amare-over-lebron",
        title: "Amar'e Stoudemire Dunks Over LeBron James",
        player: "Amar'e Stoudemire",
        team: "New York Knicks",
        year: 2010,
        type: "Poster",
        youtubeId: "uoQtHp5oB-I",
        description: "December 28, 2010: STAT rises over LeBron in transition and throws it down two-handed — posterizing the best player in the world in his prime is a statement nobody forgets.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "wemby-celtics-2024",
        title: "Victor Wembanyama Poster Dunk on Celtics",
        player: "Victor Wembanyama",
        team: "San Antonio Spurs",
        year: 2024,
        type: "Poster",
        youtubeId: "0eIHsiEHrmU",
        description: "January 18, 2024: the 7'4\" alien attacks the rim and throws down a poster dunk that made the Celtics commentators question what they were watching — the first of many Wemby moments that have no historical comparison.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "ja-spurs-2023",
        title: "Ja Morant Poster Dunk on the Spurs",
        player: "Ja Morant",
        team: "Memphis Grizzlies",
        year: 2023,
        type: "Poster",
        youtubeId: "JtDXi2ayDn0",
        description: "January 14, 2023: Ja splits the lane and detonates a thunderous one-handed slam on a Spurs defender — the kind of play that had the basketball world debating dunk of the year before halftime.",
        tags: ["In-Game", "Explosive"]
    },
    {
        id: "giannis-triple-poster-2021",
        title: "Giannis Antetokounmpo Dunks Over Three Spurs",
        player: "Giannis Antetokounmpo",
        team: "Milwaukee Bucks",
        year: 2021,
        type: "Poster",
        youtubeId: "1XOPJDIZ2Y4",
        description: "May 11, 2021: Giannis absorbs contact from multiple Spurs defenders and still finishes — a three-man poster that confirmed the Greek Freak operates by different physical rules than everyone else.",
        tags: ["In-Game", "Power", "Legendary"]
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
