/*
 * Connects the page to the team's v1.6 engine (zenith-engine.js) and mission-plan layer (coverage.js).
 * Every score on screen is computed here, live, from the same formula as scoring/score_v16.py.
 * Written with AI assistance (Claude), reviewed by Team Zenith.
 */
(function () {
  const X = window.ZENITH_EXTRAS, E = window.ZENITH_EMBED;
  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const eng = new ZenithEngine.Engine(E.params, bytes(E.bin).buffer);
  const DIMS = eng.params.dims;
  const keep = new Uint32Array(bytes(X.keep).buffer), pos = new Int32Array(eng.n).fill(-1);
  keep.forEach((i, j) => (pos[i] = j));
  const TMIN = new Int8Array(bytes(X.tmin).buffer), PREC = bytes(X.precip), WIND = bytes(X.wind), DUST = bytes(X.dust);
  const STAB = {}; for (const t in X.stability) STAB[t] = bytes(X.stability[t]);
  const CEIL = {}; (window.Zenith.SUBSYSTEMS || []).forEach(s => (CEIL[s.id] = s));

  /* Mission parts (the chips). boost = extra weight on the dimensions that part depends on.
     Every dimension always keeps weight 1, so no part of the environment is ever ignored.
     tests = the coverage.js subsystems used for the "testable here" bars (with the team's ceilings). */
  const PARTS = {
    rover:   { label: "Rover and mobility",  boost: { terrain: 2 },                tests: ["mobility"] },
    landing: { label: "Landing and ascent",  boost: { terrain: 1, surface: 1 },    tests: ["mobility"] },
    drill:   { label: "Drilling and ice",    boost: { ice: 2, geology: 1 },        tests: ["resources"] },
    habitat: { label: "Habitat and shelter", boost: { thermal: 2 },                tests: ["thermal"] },
    eva:     { label: "Crew on foot",        boost: { thermal: 1, illumination: 1 }, tests: ["thermal", "mobility"] },
    power:   { label: "Solar power",         boost: { illumination: 2 },           tests: ["illumination"] },
    science: { label: "Sampling and science", boost: { aridity: 2, geology: 2 },   tests: ["surface"] },
  };
  function weightsFor(plan) {
    let w;
    if (plan.weights) w = Object.assign({}, plan.weights);
    else {
      w = {}; DIMS.forEach(d => (w[d] = 1));
      (plan.subsystems || []).forEach(p => { const b = (PARTS[p] || {}).boost || {}; for (const d in b) w[d] = Math.min(5, w[d] + b[d]); });
    }
    // your own conditions: a dimension whose conditions are all switched off gets no weight
    const T = plan.target === "custom" ? CUSTOM : null;
    if (T) DIMS.forEach(d => { if (!eng.params.dimensions[d].some(n => T.features[n])) w[d] = 0; });
    return w;
  }
  function partsFromWeights(w) {
    const out = Object.keys(PARTS).filter(p => Object.keys(PARTS[p].boost).every(d => (w[d] || 0) >= 2) && Object.keys(PARTS[p].boost).some(d => (w[d] || 0) >= 3));
    return out.length ? out : ["rover", "science"];
  }

  const km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(Math.min(1, x))); };
  let CUSTOM = null; // the "your own conditions" target, rebuilt on every slider change
  const target = id => (id === "custom" ? CUSTOM : eng.targets.find(t => t.id === id));

  /* Known analog sites. The extras list misses three well-studied ones, so they are added here. */
  [{ id: "lajoya", name: "La Joya desert, Arequipa", country: "Peru", lat: -16.5, lon: -71.9, cave: false },
   { id: "dallol", name: "Dallol, Danakil Depression", country: "Ethiopia", lat: 14.24, lon: 40.3, cave: false },
   { id: "shackletonglacier", name: "Shackleton Glacier soils", country: "Antarctica", lat: -85.0, lon: -176.0, cave: false }]
    .forEach(k => { if (!X.known.some(x => x.id === k.id)) X.known.push(k); });
  /* A "new candidate" is at least this far from every known analog site. Closer than this is a known analog region. */
  const NEW_KM = 500;
  let far = null; // per cell: 1 when the cell is NEW_KM or more from every known site
  function farMask() {
    if (far) return far;
    far = new Uint8Array(eng.n);
    const r = Math.PI / 180, K = X.known.map(k => [Math.sin(k.lat * r), Math.cos(k.lat * r), k.lon * r]), cmin = Math.cos(NEW_KM / 6371);
    for (let i = 0; i < eng.n; i++) {
      const [la, lo] = eng.cellLatLon(i), sa = Math.sin(la * r), ca = Math.cos(la * r), l = lo * r;
      let ok = 1;
      for (const k of K) if (sa * k[0] + ca * k[1] * Math.cos(l - k[2]) > cmin) { ok = 0; break; }
      far[i] = ok;
    }
    return far;
  }

  /* One scoring pass over every cell, cached per target + weights. */
  const cache = new Map();
  function pass(T, weights) {
    const key = T.id + JSON.stringify(weights) + (T._wi || "");
    if (cache.has(key)) return cache.get(key);
    if (T.id === "custom") for (const k of [...cache.keys()]) if (k.startsWith("custom")) cache.delete(k); // one custom pass at a time
    let s;
    if (T._wi) { eng.targets.push(T); try { s = eng.scoreAll(T.id, { weights }); } finally { eng.targets.pop(); } }
    else s = eng.scoreAll(T.id, { weights });
    const idx = []; for (let i = 0; i < eng.n; i++) if (s[i] === s[i]) idx.push(i);
    idx.sort((a, b) => s[b] - s[a]);
    const cum = new Float64Array(idx.length); let tot = 0;      // area-weighted share of land that scores higher
    idx.forEach((i, k) => { cum[k] = tot; tot += Math.cos(eng.cellLatLon(i)[0] * Math.PI / 180); });
    const sorted = Float32Array.from(idx, i => s[i]);
    const pctOf = v => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] > v) lo = m + 1; else hi = m; } return 100 * (1 - (lo < cum.length ? cum[lo] : tot) / tot); };
    const rankOf = v => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] > v) lo = m + 1; else hi = m; } return lo + 1; };
    const out = { s, idx, n: idx.length, pctOf, rankOf, best: sorted[0], p60: sorted[Math.floor(sorted.length * 0.6)] };
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return out;
  }

  function nearestKnown(lat, lon) {
    let best = null, bd = 1e9;
    for (const k of X.known) { const d = km(lat, lon, k.lat, k.lon); if (d < bd) { bd = d; best = k; } }
    return { name: best.name, id: best.id, km: Math.round(bd) };
  }
  function monthly(i) {
    const j = pos[i]; if (j < 0 || TMIN[j * 12] === -128 || PREC[j * 12] === 255) return null;
    return { tmin_C: Array.from(TMIN.subarray(j * 12, j * 12 + 12)), precip_mm_day: Array.from(PREC.subarray(j * 12, j * 12 + 12), v => v / 20) };
  }

  /* Everything the page shows about one cell, for one target and weighting. */
  function site(i, T, weights, P) {
    const f = eng.features(i), r = eng.scoreCell(i, T, f, weights), bal = eng.scoreCell(i, T, f, null);
    const [lat, lon] = eng.cellLatLon(i), j = pos[i], tg = X.tags[i] || {}, nk = nearestKnown(lat, lon);
    const parts = {};
    return {
      id: "c" + i, i, lat, lon, earth: f, dims: r.dims, eligible: r.eligible, why_not: r.ineligibleReason,
      score: r.score, percentile: r.eligible && P ? P.pctOf(r.score) : null, rank: r.eligible && P ? P.rankOf(r.score) : null,
      balanced: bal.score, balancedPct: bal.percentile, earthTestable: r.earthTestableScore,
      stability: j >= 0 && STAB[T.id] && r.eligible ? STAB[T.id][j] / 200 : null,
      tags: { rock: f.rock, rock_abbr: f.rock_abbr, impact_crater: tg.impact_crater || null, lava_tube: tg.lava_tube || null, geology: r.geologyMatch },
      hazard: { wind_m_s: j >= 0 && WIND[j] !== 255 ? WIND[j] / 10 : null, dust_aod: j >= 0 && DUST[j] !== 255 ? DUST[j] / 100 : null },
      monthly: monthly(i), nearest_known: nk, kind: nk.km < 150 ? "known-area" : nk.km < NEW_KM ? "known-region" : "candidate",
      studied: X.studies.map(s => ({ name: s.name, url: s.url, for: s.for, km: Math.round(km(lat, lon, s.lat, s.lon)) })).filter(s => s.km <= 150).sort((a, b) => a.km - b.km).slice(0, 6),
    };
  }

  /* How much of each mission part a field test here can cover: dimension match x the team's ceiling (coverage.js). */
  function coverage(s, partIds) {
    const out = {};
    for (const p of partIds) {
      if (!PARTS[p]) continue;
      let sum = 0, cap = 0, n = 0;
      for (const id of PARTS[p].tests) {
        const sub = CEIL[id]; if (!sub) continue;
        const used = sub.dims.filter(d => s.dims[d] != null); if (!used.length) continue; // switched-off conditions don't count
        const m = used.reduce((a, d) => a + s.dims[d], 0) / used.length;
        sum += m * sub.ceiling; cap += sub.ceiling; n++;
      }
      out[p] = n ? { value: sum / n, ceiling: cap / n } : null;
    }
    return out;
  }

  function cannotTest(T) {
    const t = X.targets[T.id], out = [], K = k => `${Math.round(k)} K (${Math.round(k - 273.15)} °C)`;
    for (const r of t.not_matchable) {
      const label = { gravity: "Gravity", air_pressure: "Air pressure", surface_radiation: "Surface radiation", day_length: "Day length" }[r.parameter] || r.parameter;
      const earth = { gravity: "9.81 m/s²", air_pressure: "1013 mbar", surface_radiation: "~0.1 µSv/h", day_length: "24 h" }[r.parameter] || "";
      out.push({ what: label, target: r.value, earth });
    }
    const o = t.out_of_earth_range;
    if (T.id === "custom") { // every slider that goes past Earth
      const L = { temp_min_K: ["Coldest temperature", K, K], temp_daynight_range_K: ["Day–night swing", v => `${Math.round(v)} K`, v => `${Math.round(v)} K`],
        slope_deg: ["Slope", v => `${v.toFixed(1)}°`, v => `${v.toFixed(1)}°`], roughness_tri_m: ["Ruggedness", v => `${Math.round(v)} m`, v => `${Math.round(v)} m`],
        albedo_wsa_unitless: ["Brightness", v => v.toFixed(2), v => v.toFixed(2)], precip_mm_per_yr: ["Rain and snow", v => `${Math.round(v)} mm/yr`, v => `${Math.round(v)} mm/yr`],
        sun_noon_elev_mean_deg: ["Noon Sun height", v => `${Math.round(v)}°`, v => `${Math.round(v)}°`] };
      for (const f in o) if (L[f]) out.push({ what: L[f][0], target: L[f][1](o[f].target), earth: `Earth's limit ${L[f][2](o[f].earth_edge)}` });
      return out;
    }
    if (o.temp_min_K) out.push({ what: "Coldest temperature", target: K(o.temp_min_K.target), earth: `coldest scored ground ${K(o.temp_min_K.earth_edge)}` });
    if (o.temp_daynight_range_K) out.push({ what: "Day–night swing", target: `${Math.round(o.temp_daynight_range_K.target)} K`, earth: `largest ${Math.round(o.temp_daynight_range_K.earth_edge)} K` });
    return out;
  }

  const quality = v => (v >= 0.7 ? "strong" : v >= 0.5 ? "moderate" : "weak");
  const QUALITY_NOTE = {
    strong: "Earth has good test sites for this mission.",
    moderate: "Earth matches parts of this well. Nothing on Earth matches the cold.",
    weak: "No robust Earth analog. These are the closest partial matches, so test each subsystem separately.",
  };

  function assess(plan) {
    const T = target(plan.target); if (!T) throw new Error("unknown target " + plan.target);
    const weights = weightsFor(plan), P = pass(T, weights), picked = [];
    for (const i of P.idx) {
      const [la, lo] = eng.cellLatLon(i);
      if (picked.every(p => km(p[1], p[2], la, lo) >= 100)) picked.push([i, la, lo]);
      if (picked.length === 20) break;
    }
    const parts = plan.subsystems && plan.subsystems.length ? plan.subsystems : partsFromWeights(weights);
    const ranked = picked.map(([i]) => { const s = site(i, T, weights, P); return { site: s, overall: s.score, subsystems: coverage(s, parts), stability: s.stability, tag: s.kind }; });
    // Two answers: the best match overall, and the best match at least NEW_KM from every known analog site.
    let fresh = -1;
    const F = farMask(), fi = P.idx.find(i => F[i]);
    if (fi != null) {
      fresh = ranked.findIndex(r => r.site.i === fi);
      if (fresh < 0) { const s = site(fi, T, weights, P); ranked.push({ site: s, overall: s.score, subsystems: coverage(s, parts), stability: s.stability, tag: s.kind, extra: true }); fresh = ranked.length - 1; }
    }
    const q = quality(P.best);
    let note = QUALITY_NOTE[q];
    if (T.id === "custom") {
      const off = Object.keys(T.out_of_earth_range).map(f => CUSTOM_LABEL[f]).filter(Boolean);
      note = P.best >= 0.7 ? "Earth has close matches for these conditions." : P.best >= 0.5 ? "Earth matches parts of these conditions, not all of them." : P.best >= 0.3 ? "No close Earth match. These are the nearest partial matches, so test each part separately." : "Nothing on Earth is close to these conditions. These are the least-bad places, not analogs.";
      if (off.length) note += ` Beyond anything on Earth: ${off.join(", ")}.`;
    }
    return { target: Object.assign({}, X.targets[T.id], { engine: T }), weights, parts, ranked, fresh, pass: P, cannotTest: cannotTest(T), quality: q, qualityNote: note };
  }

  /* Just the top places for a plan (cells 100 km apart), without building full records. */
  function top(plan, n) {
    const T = target(plan.target), P = pass(T, weightsFor(plan)), out = [];
    for (const i of P.idx) { const [la, lo] = eng.cellLatLon(i); if (out.every(p => km(p[1], p[2], la, lo) >= 100)) out.push([i, la, lo]); if (out.length === n) break; }
    return out;
  }

  /* Any point on the globe, for the current plan. */
  function inspect(lat, lon, plan) {
    const i = eng.cellIndex(lat, lon); if (i < 0) return { land: false };
    const T = target(plan.target), weights = weightsFor(plan), P = pass(T, weights), s = site(i, T, weights, P);
    const parts = plan.subsystems && plan.subsystems.length ? plan.subsystems : partsFromWeights(weights);
    return { land: true, site: s, overall: s.score, subsystems: coverage(s, parts), stability: s.stability, tag: s.kind };
  }
  /* The same cell against all seven targets (balanced weights). */
  function allTargets(lat, lon) { const r = eng.scoreAt(lat, lon); return r.land ? r.targets : []; }

  /* ---------- your own conditions ----------
     A custom target built from sliders, scored with exactly the same rules as the seven sites (scoring/DECISIONS_v1_6.md):
     scale = area-weighted IQR of bare cells; a value past Earth's range is clamped to Earth's edge and scored with the
     wider p5-p95 scale (R2); a dimension leaves the Earth-testable score only if the gap to Earth is bigger than its scale (R3).
     The numbers below reproduce the engine's own scales and edges (checked against engine_params.json). */
  const SCALE = { temp_min_K: 11.89, temp_daynight_range_K: 3.1, precip_mm_per_yr: 100.9, slope_deg: 0.816, roughness_tri_m: 1.7343875736003724, albedo_wsa_unitless: 0.1448, sun_noon_elev_mean_deg: 11.07, ground_ice_frac: 1, geology_match: 1 };
  const WIDE = { temp_min_K: 40.51954119977171, temp_daynight_range_K: 9.3, precip_mm_per_yr: 264.4, slope_deg: 4.501, roughness_tri_m: 4.3279, albedo_wsa_unitless: 0.2857, sun_noon_elev_mean_deg: 25.06 };
  // Earth's range over the cells that can be scored: bare ground, or bare ground plus ice when the target has ice.
  const EDGE = {
    bare: { temp_min_K: [233.62, 302.44], temp_daynight_range_K: [0.38, 29.66], precip_mm_per_yr: [0, 3106.8], slope_deg: [0, 17.461], roughness_tri_m: [0, 7.45], albedo_wsa_unitless: [0.054, 0.625], sun_noon_elev_mean_deg: [11.01, 75.14] },
    icy: { temp_min_K: [193.71, 302.44], temp_daynight_range_K: [-1.61, 29.66], precip_mm_per_yr: [0, 4516], slope_deg: [0, 18.588], roughness_tri_m: [0, 7.45], albedo_wsa_unitless: [0.054, 0.927], sun_noon_elev_mean_deg: [7.45, 75.14] },
  };
  const CUSTOM_LABEL = { temp_min_K: "coldest temperature", temp_daynight_range_K: "day–night swing", precip_mm_per_yr: "rain and snow", slope_deg: "slope", roughness_tri_m: "ruggedness", albedo_wsa_unitless: "brightness", sun_noon_elev_mean_deg: "noon Sun height" };
  const TILT = { Moon: 1.54, Mars: 25.19 }, LIKE = { Moon: "shackleton", Mars: "jezero" };
  function sunNoonMean(lat, tilt) { // same as the engine: mean noon Sun height over a year
    let s = 0; const t = tilt * Math.PI / 180;
    for (let k = 0; k < 360; k++) { const d = Math.asin(Math.sin(t) * Math.sin(2 * Math.PI * k / 360)) * 180 / Math.PI; s += Math.max(0, 90 - Math.abs(lat - d)); }
    return Math.round(s / 360 * 100) / 100;
  }
  /* Slider values of one of the seven sites, to start from. */
  function conditionsOf(id) {
    const t = X.targets[id], T = target(id), f = t.features;
    return { body: t.body, lat: Math.round(t.lat * 2) / 2, tmin_C: Math.round(f.temp_min_K - 273.15), swing_K: Math.round(f.temp_daynight_range_K), precip: Math.round(f.precip_mm_per_yr || 0),
      slope: +f.slope_deg.toFixed(1), rough_m: Math.round(f.roughness_tri_m), albedo: +f.albedo_wsa_unitless.toFixed(2), ice: (f.ground_ice_frac || 0) >= 0.5,
      rocks: T.rock_match.slice(), impact: !!T.impact_relevant, from: id };
  }
  /* Where one slider value sits against Earth: null when inside, else Earth's edge in slider units. */
  function earthEdge(name, v, ice) {
    const lg = eng.params.log1p.includes(name), x = lg ? Math.log1p(Math.max(0, v)) : v, [lo, hi] = EDGE[ice ? "icy" : "bare"][name];
    if (x >= lo && x <= hi) return null;
    const e = x < lo ? lo : hi;
    return lg ? Math.expm1(e) : e;
  }
  let ver = 0;
  function setCustom(c) {
    const off = new Set(c.off || []), ice = !!c.ice && !off.has("ground_ice_frac"), E = EDGE[ice ? "icy" : "bare"], like = LIKE[c.body] || "jezero";
    const raw = { temp_min_K: c.tmin_C + 273.15, temp_daynight_range_K: c.swing_K, precip_mm_per_yr: c.precip, slope_deg: c.slope, roughness_tri_m: c.rough_m,
      albedo_wsa_unitless: c.albedo, ground_ice_frac: ice ? 1 : 0, sun_noon_elev_mean_deg: sunNoonMean(c.lat, TILT[c.body] || 0), geology_match: 1 };
    const features = {}, outE = {}, outX = {}, gap = {};
    for (const name in raw) {
      if (off.has(name)) continue; // switched off: not part of the match at all
      const lg = eng.params.log1p.includes(name), x = lg ? Math.log1p(Math.max(0, raw[name])) : raw[name];
      if (!E[name]) { features[name] = { target: raw[name], clamped_target: x, scale: SCALE[name], clamped: false }; continue; }
      const ct = Math.min(E[name][1], Math.max(E[name][0], x)), clamped = ct !== x, scale = clamped ? WIDE[name] : SCALE[name];
      features[name] = { target: raw[name], clamped_target: ct, scale, clamped };
      gap[name] = Math.abs(x - ct) / scale;
      if (clamped) { outE[name] = { target: raw[name], earth_edge: lg ? Math.expm1(ct) : ct }; outX[name] = outE[name]; }
    }
    const allRocks = eng.params.rocks.filter(r => r !== "nd" && r !== "wb" && r !== "ig");
    const rocks = c.rocks && c.rocks.length ? c.rocks.slice() : allRocks;
    if (!Object.keys(features).length) return null;
    CUSTOM = { id: "custom", name: c.name || "Your conditions", body: c.body, features, rock_match: rocks, impact_relevant: !!c.impact, ice_cells_allowed: ice,
      earth_testable_dims: DIMS.filter(d => eng.params.dimensions[d].every(n => !(gap[n] > 1))), not_testable_on_earth: [], out_of_earth_range: outE,
      n_eligible: 0, cdf_full: [0, 1], cdf_earth_testable: [0, 1], _wi: "v" + (++ver) };
    X.targets.custom = { id: "custom", name: CUSTOM.name, body: c.body, lat: c.lat, lon: 0, features: raw, meta: {}, rock_classes: c.rocks && c.rocks.length ? rocks : ["any"],
      out_of_earth_range: outX, not_matchable: X.targets[like].not_matchable, n_eligible: 0, conditions: Object.assign({}, c) };
    return CUSTOM;
  }

  window.ZenithApp = { eng, X, PARTS, DIMS, km, target, weightsFor, partsFromWeights, assess, inspect, top, allTargets, pass, NEW_KM, setCustom, conditionsOf, earthEdge, sunNoonMean, TILT, EDGE, quality, QUALITY_NOTE,
    known: X.known, rediscovery: X.rediscovery, knownScores: X.knownScores };
})();
