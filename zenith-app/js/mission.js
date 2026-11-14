/* Plain-words mission text -> mission plan. Keyword rules only (no API, works offline). */
(function () {
  // Example missions. Also used by the "Also a fit for" collaboration feature.
  const LIBRARY = [
    { id: "polar-base", title: "Crewed base at the lunar south pole that mines ice", target: "shackleton", subsystems: ["habitat", "drill", "eva", "power"] },
    { id: "malapert-lander", title: "Solar-powered lander on the Malapert ridge", target: "malapert", subsystems: ["landing", "power", "rover"] },
    { id: "lava-tube", title: "Shelter a crew inside a lunar lava tube", target: "marius", subsystems: ["habitat", "eva", "rover"] },
    { id: "arcadia-ice", title: "Drill buried ice for a Mars base in Arcadia", target: "arcadia", subsystems: ["drill", "habitat", "power"] },
    { id: "jezero-life", title: "Rover searching for ancient life in Jezero's river delta", target: "jezero", subsystems: ["rover", "science"] },
    { id: "gale-climb", title: "Climb Mount Sharp in Gale crater with a rover", target: "gale", subsystems: ["rover", "science", "landing"] },
    { id: "meridiani-trek", title: "Long-range rover across Meridiani's hematite plains", target: "meridiani", subsystems: ["rover", "science", "power"] },
  ];

  const TARGET_WORDS = {
    shackleton: ["south pole", "shackleton", "polar", "permanently shadowed", "psr", "artemis"],
    malapert: ["malapert", "massif", "ridge", "peak of light", "mountain"],
    marius: ["lava tube", "lava-tube", "cave", "pit", "skylight", "marius", "underground"],
    arcadia: ["arcadia", "buried ice", "ground ice", "glacier", "ice sheet", "mid-latitude"],
    jezero: ["jezero", "delta", "river", "lake", "ancient life", "biosignature", "perseverance"],
    gale: ["gale", "mount sharp", "curiosity", "layers", "climb", "sediment"],
    meridiani: ["meridiani", "hematite", "opportunity", "blueberries", "plains", "salt"],
  };
  const MOON = ["moon", "lunar", "artemis"], MARS = ["mars", "martian", "red planet"];
  const DEFAULT = { Moon: "shackleton", Mars: "jezero" };

  const SUB_WORDS = {
    rover: ["rover", "drive", "driving", "vehicle", "traverse", "explore", "mobility", "long-range"],
    drill: ["drill", "mine", "mining", "ice", "isru", "extract", "water", "dig", "excavat"],
    habitat: ["habitat", "base", "shelter", "outpost", "live", "camp", "station", "crewed"],
    eva: ["crew", "astronaut", "spacesuit", "eva", "walk", "human", "people"],
    power: ["solar", "power", "energy", "sunlight", "battery"],
    science: ["sample", "science", "geology", "life", "search", "study", "rock", "fossil"],
    landing: ["land", "lander", "landing", "ascent", "touchdown"],
  };

  function parse(text, data) {
    const s = " " + String(text || "").toLowerCase() + " ";
    const has = w => s.includes(w);
    let body = MOON.some(has) ? "Moon" : MARS.some(has) ? "Mars" : null;
    let best = null, bestHits = 0;
    for (const [tid, words] of Object.entries(TARGET_WORDS)) {
      if (body && data.targets[tid].body !== body) continue;
      const hits = words.filter(has).length;
      if (hits > bestHits) { best = tid; bestHits = hits; }
    }
    const target = best || DEFAULT[body || "Moon"];
    let subsystems = Object.entries(SUB_WORDS).filter(([, ws]) => ws.some(has)).map(([k]) => k);
    if (!subsystems.length) subsystems = (LIBRARY.find(m => m.target === target) || LIBRARY[0]).subsystems.slice();
    return { target, subsystems };
  }

  window.ZenithMission = { LIBRARY, parse };
})();
