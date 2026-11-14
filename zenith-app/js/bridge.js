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
    if (plan.weights) return plan.weights;
    const w = {}; DIMS.forEach(d => (w[d] = 1));
    (plan.subsystems || []).forEach(p => { const b = (PARTS[p] || {}).boost || {}; for (const d in b) w[d] = Math.min(5, w[d] + b[d]); });
    return w;
  }
  function partsFromWeights(w) {
    const out = Object.keys(PARTS).filter(p => Object.keys(PARTS[p].boost).every(d => (w[d] || 0) >= 2) && Object.keys(PARTS[p].boost).some(d => (w[d] || 0) >= 3));
    return out.length ? out : ["rover", "science"];
  }

  const km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(Math.min(1, x))); };
  const target = id => eng.targets.find(t => t.id === id);

  /* One scoring pass over every cell, cached per target + weights. */
  const cache = new Map();
  function pass(T, weights) {
    const key = T.id + JSON.stringify(weights) + (T._wi || "");
    if (cache.has(key)) return cache.get(key);
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
    if (cache.size > 12) cache.delete(cache.keys().next().value);
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
      monthly: monthly(i), nearest_known: nk, kind: nk.km < 150 ? "known-area" : "candidate",
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
        const m = sub.dims.reduce((a, d) => a + (s.dims[d] || 0), 0) / sub.dims.length;
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
    const q = quality(P.best);
    return { target: Object.assign({}, X.targets[T.id], { engine: T }), weights, parts, ranked, pass: P, cannotTest: cannotTest(T), quality: q, qualityNote: QUALITY_NOTE[q] };
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

  /* What if the target were milder or harsher: shift its cold, day-night swing, slope and ruggedness, re-score every cell. */
  function whatIf(s, plan) {
    const T = target(plan.target), weights = weightsFor(plan), tf = (n, v) => (eng.params.log1p.includes(n) ? Math.log1p(Math.max(0, v)) : v);
    return [-0.2, -0.1, 0, 0.1, 0.2].map(p => {
      if (!p) return { p, pct: s.percentile };
      const T2 = JSON.parse(JSON.stringify(T)); T2.id = "__whatif"; T2._wi = String(p);
      for (const [f, sign] of [["temp_min_K", -1], ["temp_daynight_range_K", 1], ["slope_deg", 1], ["roughness_tri_m", 1]]) {
        const d = T2.features[f]; if (!d) continue;
        const v = tf(f, d.target * (1 + sign * p));
        // a target beyond Earth's range stays pinned to Earth's edge unless the shift brings it back inside
        d.clamped_target = d.clamped ? (f === "temp_min_K" ? Math.max(d.clamped_target, v) : Math.min(d.clamped_target, v)) : v;
      }
      const P2 = pass(T2, weights), r = eng.scoreCell(s.i, T2, null, weights);
      return { p, pct: P2.pctOf(r.score) };
    });
  }

  window.ZenithApp = { eng, X, PARTS, DIMS, km, target, weightsFor, partsFromWeights, assess, inspect, top, allTargets, whatIf, pass, quality, QUALITY_NOTE,
    known: X.known, rediscovery: X.rediscovery, knownScores: X.knownScores };
})();
