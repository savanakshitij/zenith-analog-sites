/* Plain-words mission text -> mission plan. Keyword rules only (no API, works offline).
   Also: the mission library for the search bar, and place names for cells. */
(function () {
  // Example missions of our own.
  const EXAMPLES = [
    { id: "polar-base", title: "Crewed base at the lunar south pole that mines ice", target: "shackleton", subsystems: ["habitat", "drill", "eva", "power"] },
    { id: "malapert-lander", title: "Solar-powered lander on the Malapert ridge", target: "malapert", subsystems: ["landing", "power", "rover"] },
    { id: "lava-tube", title: "Shelter a crew inside a lunar lava tube", target: "marius", subsystems: ["habitat", "rover", "science"] },
    { id: "arcadia-ice", title: "Drill buried ice for a Mars base in Arcadia", target: "arcadia", subsystems: ["drill", "habitat", "power"] },
    { id: "jezero-life", title: "Rover searching for ancient life in Jezero's river delta", target: "jezero", subsystems: ["rover", "science"] },
    { id: "gale-climb", title: "Climb Mount Sharp in Gale crater with a rover", target: "gale", subsystems: ["rover", "science", "landing"] },
    { id: "meridiani-trek", title: "Long-range rover across Meridiani's hematite plains", target: "meridiani", subsystems: ["rover", "science", "power"] },
  ];
  // Real upcoming missions (missions/missions.json, statuses checked on the date in the file).
  const M = window.ZENITH_MISSIONS || { missions: [] };
  const REAL = M.missions.map(m => ({ id: m.id, title: m.suggestion, target: m.target_id, weights: m.weights, real: m, tag: m.agency.split(" ")[0].toUpperCase() }));
  const LIBRARY = REAL.concat(EXAMPLES);
  const REAL_WORDS = { "artemis-iv": ["artemis"], ltv: ["terrain vehicle", "ltv", "moon buggy"], viper: ["viper"], "change-7": ["chang'e-7", "chang'e 7", "change 7", "change-7"], "change-8": ["chang'e-8", "chang'e 8", "change 8"],
    lupex: ["lupex", "chandrayaan"], "rosalind-franklin": ["rosalind", "exomars"], "tianwen-3": ["tianwen"], "mars-greenhouse": ["greenhouse", "farm", "crop", "grow food", "agricult", "plants"] };

  const TARGET_WORDS = {
    shackleton: ["south pole", "shackleton", "polar", "permanently shadowed", "shadowed", "psr", "lunar ice", "water ice", "crater rim"],
    malapert: ["malapert", "massif", "ridge", "peak of light", "sunlit", "solar"],
    marius: ["lava tube", "lava-tube", "lava", "cave", "pit", "skylight", "marius", "underground", "volcan"],
    arcadia: ["arcadia", "buried ice", "ground ice", "subsurface ice", "glacier", "mid-latitude", "settlement", "colony", "propellant", "fuel", "plains"],
    jezero: ["jezero", "delta", "river", "lake", "life", "biosignature", "fossil", "microb", "perseverance", "ancient", "clay"],
    gale: ["gale", "mount sharp", "curiosity", "layers", "layered", "climb", "mountain", "strata"],
    meridiani: ["meridiani", "hematite", "opportunity", "blueberr", "salt", "long-range", "long range", "dune"],
  };
  const MOON = ["moon", "lunar", "artemis", "regolith"], MARS = ["mars", "martian", "red planet"];
  const DEFAULT = { Moon: "shackleton", Mars: "jezero" };
  const SUB_WORDS = {
    rover: ["rover", "driving", "vehicle", "traverse", "mobility", "long-range", "climb"],
    drill: ["drill", "mine", "mining", "ice", "isru", "extract", "water", "dig", "excavat"],
    habitat: ["habitat", " base", "shelter", "outpost", "station", "crewed", "settle", "colony"],
    eva: ["crew", "astronaut", "spacesuit", " eva ", "moonwalk", "spacewalk"],
    power: ["solar", "power", "energy", "sunlight", "battery"],
    science: ["sample", "science", "geology", "life", "rock", "fossil"],
    landing: ["land ", "lander", "landing", "ascent", "touchdown", "hop"],
  };

  function parse(text) {
    const s = " " + String(text || "").toLowerCase() + " ", has = w => s.includes(w), T = window.ZenithApp.target;
    for (const id in REAL_WORDS) if (REAL_WORDS[id].some(has)) { const m = REAL.find(x => x.id === id); if (m) return { target: m.target, weights: m.weights, real: m.real, why: "a real mission" }; }
    const body = MOON.some(has) ? "Moon" : MARS.some(has) ? "Mars" : null;
    let best = null, bestHits = 0;
    for (const [tid, words] of Object.entries(TARGET_WORDS)) {
      if (body && T(tid).body !== body) continue;
      const hits = words.filter(has).length;
      if (hits > bestHits) { best = tid; bestHits = hits; }
    }
    const target = best || DEFAULT[body || "Mars"];
    let subsystems = Object.entries(SUB_WORDS).filter(([, ws]) => ws.some(has)).map(([k]) => k);
    // Nothing we can read: no site, no Moon or Mars, no mission part. Say so instead of guessing a site.
    if (!best && !body && !subsystems.length) return { unknown: true, text: String(text || "").trim() };
    const noPlace = !best && !body;
    if (!subsystems.length) subsystems = (EXAMPLES.find(m => m.target === target) || EXAMPLES[0]).subsystems.slice();
    return { target, subsystems, guessed: !best, noPlace, why: best ? `matched “${TARGET_WORDS[best].find(has)}”` : body ? `no site named, so the usual ${body} site` : "no site named, so our default Mars site" };
  }

  /* Place names for cells: centre lat, lon, radius km. The closest centre within its radius wins. */
  const REGIONS = [
    ["Pampa del Tamarugal, Atacama, Chile", -20.6, -69.7, 120], ["Atacama Desert, Chile", -23.5, -69.8, 450], ["Southern Peru coast", -16.5, -73.5, 350],
    ["Puna de Atacama, Argentina", -25.8, -67.6, 200], ["High Andes, Chile and Argentina", -30, -69.8, 500], ["Altiplano, Bolivia", -20, -67.5, 250], ["Patagonia, Argentina", -46, -69, 600],
    ["Sahara, Algeria", 25, 3, 900], ["Sahara, Libya", 26, 18, 600], ["Tibesti, northern Chad", 21, 18, 400], ["Eastern Desert, Egypt", 25.5, 33.5, 300], ["Western Desert, Egypt", 26, 28, 400],
    ["Sahara, Mauritania and Mali", 21, -8, 800], ["Sahara, Niger", 19, 10, 500], ["Sahara, Sudan", 20, 30, 450], ["Sinai, Egypt", 29.5, 33.8, 160],
    ["Afar, Ethiopia and Djibouti", 12.5, 41.5, 300], ["Namib Desert, Namibia", -24, 15.2, 450], ["Kalahari, Botswana", -23, 22, 500],
    ["Rub' al Khali, Arabia", 20.5, 50.5, 600], ["Harrat lava fields, NW Saudi Arabia", 27, 37.5, 300], ["Wadi Rum, Jordan", 29.6, 35.4, 120], ["Hadhramaut, Yemen", 15, 47.5, 350],
    ["Dasht-e Lut, Iran", 30.5, 58.5, 250], ["Eastern Iran", 33.5, 58.5, 300], ["Baluchistan, Iran–Pakistan border", 28.6, 61, 250], ["Registan, Afghanistan", 31, 64, 300],
    ["Taklamakan Desert, Xinjiang, China", 38.8, 82.5, 550], ["Southern Taklamakan, Xinjiang, China", 37.6, 84, 200], ["Qaidam Basin, China", 37.5, 94, 350],
    ["Kunlun Mountains, China", 36, 85, 400], ["Karakoram", 36, 76, 200], ["Eastern Pamir, China", 37.8, 75.5, 180], ["Tian Shan", 42, 79, 450], ["Aksai Chin", 35, 79.2, 150],
    ["Tibetan Plateau", 33, 88, 600], ["Gobi Desert, Mongolia and China", 43, 104, 700], ["Ladakh, India", 34, 77.6, 180], ["Thar Desert, India and Pakistan", 27, 71, 400],
    ["Great Basin, USA", 40, -116.5, 500], ["Mojave and Death Valley, USA", 35.8, -116.5, 250], ["Colorado Plateau, USA", 38.4, -110.8, 300], ["Sonoran Desert, Mexico", 30, -113, 350],
    ["Hawaii volcanoes", 19.6, -155.5, 150], ["Iceland highlands", 64.8, -17, 250], ["Lanzarote, Canary Islands", 29, -13.7, 100],
    ["Devon Island, Canada", 75.3, -89.5, 250], ["Ellesmere Island, Canada", 80.5, -79, 450], ["Northern Greenland", 81.5, -45, 700], ["Svalbard", 78.5, 17, 250],
    ["Central Australia", -24, 133, 900], ["Western Australia deserts", -25, 122, 600], ["Lake Eyre basin, Australia", -28.5, 137.5, 350],
    ["McMurdo Dry Valleys, Antarctica", -77.5, 162, 80], ["Transantarctic Mountains, Antarctica", -84, 170, 700], ["Prince Charles Mountains, Antarctica", -72, 67, 400],
    ["Ellsworth Mountains, Antarctica", -79, -85, 350], ["Antarctic Peninsula", -67, -64, 450], ["Dronning Maud Land, Antarctica", -72, 10, 800], ["Victoria Land, Antarctica", -74, 163, 400],
  ];
  function region(lat, lon) {
    let best = null, bd = 1e9;
    for (const R of REGIONS) { const d = window.ZenithApp.km(lat, lon, R[1], R[2]); if (d <= R[3] && d / R[3] < bd) { bd = d / R[3]; best = R[0]; } }
    return best;
  }

  window.ZenithMission = { LIBRARY, EXAMPLES, REAL, parse, region };
})();
