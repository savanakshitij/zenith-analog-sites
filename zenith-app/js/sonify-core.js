/*
 * Earth Jukebox, part 1 of 2: the mapping. No DOM, no audio; runs in a browser and in Node.
 *
 *   profile(site, target, match, frame) -> a "sound profile" (plain JSON)
 *   describe(profile, info)             -> the same thing in plain English
 *   frameFromPixels(dayRGBA, cloudRGBA) -> {hue, sat, light, cloud} from any image pixels
 *
 * The Moon or Mars base and its Earth analog site get ONE key (the base picks it) and the same six
 * chord tones, one per dimension. The base plays them in tune. The Earth voice plays them detuned
 * by (1 - agreement) x 35 cents, so a perfect match is a pure chord and a poor match beats.
 * Nothing here is random: every seed comes from an id, so the same input gives the same sound.
 * Missing fields fall back to neutral values and never throw. js/sonify.js turns the profile into sound.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ZenithSoundCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const num = (x, d) => (typeof x === "number" && isFinite(x) ? x : d);
  const lin = (x, lo, hi) => clamp((x - lo) / (hi - lo), 0, 1);
  const logn = (x, lo, hi) => clamp(Math.log(Math.max(x, 1e-9) / lo) / Math.log(hi / lo), 0, 1);
  const r3 = x => Math.round(x * 1000) / 1000;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function hash(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const DIMS = ["thermal", "aridity", "terrain", "surface", "ice", "illumination"]; // low tone to high tone
  const WORDS = { thermal: "temperature", aridity: "dryness", terrain: "terrain", surface: "surface brightness", ice: "ground ice", illumination: "sunlight" };
  const SIGN = { thermal: 1, aridity: -1, terrain: 1, surface: -1, ice: 1, illumination: -1 }; // detune up or down, so the chord does not drift sharp
  const MAX_DETUNE = 35, STEPS = 64, PATCH_M = 12000;
  // scale: intervals in semitones; chord: which scale degrees (counted up from the root) carry the six tones
  const SCALES = {
    Moon: { name: "minor pentatonic", iv: [0, 3, 5, 7, 10], chord: [0, 2, 3, 5, 6, 8] },
    Mars: { name: "Dorian", iv: [0, 2, 3, 5, 7, 9, 10], chord: [0, 4, 7, 9, 11, 12] },
  };
  const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const BODY_LOOK = { Moon: { hue: 40, sat: 0.05, light: 0.45, cloud: 0 }, Mars: { hue: 20, sat: 0.45, light: 0.4, cloud: 0.08 } };
  const HINT = "The base sits a little to the left, the Earth site a little to the right. Wobbling or beating between them means a mismatch.";
  const degSemis = (sc, k) => { const L = sc.iv.length; return sc.iv[((k % L) + L) % L] + 12 * Math.floor(k / L); };

  /* ---------- a line through each place's ground, built from its measured numbers ---------- */
  // Same recipe as the 3D blocks in js/ground.js (fractal noise scaled to the measured mean slope, ruggedness sets
  // how much fine detail), but in one dimension, with the same craters and pits. It illustrates statistics; it is not real elevation.
  function transect(s, n) {
    const rnd = rng(hash(s.id)), dx = PATCH_M / (n - 1), tn = Math.tan(clamp(s.slope, 0.01, 60) * Math.PI / 180);
    const ratio = s.rough / Math.max(1, tn * 1000);
    const per = clamp(0.5 + 0.15 * Math.log2(Math.max(ratio, 0.01) / 5), 0.32, 0.66); // how much each finer layer keeps
    const base = new Float64Array(n), feat = new Float64Array(n);
    for (let o = 0, f = 2, amp = 1; o < 5; o++, f *= 2, amp *= per) {
      const lat = Array.from({ length: f + 1 }, () => rnd() * 2 - 1);
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * f, k = Math.min(f - 1, Math.floor(x)); let u = x - k; u = u * u * (3 - 2 * u);
        base[i] += amp * (lat[k] * (1 - u) + lat[k + 1] * u);
      }
    }
    for (const c of s.features) for (let i = 0; i < n; i++) { // a bowl (crater) or a steep-walled pit, in metres
      const r = Math.abs(i * dx - c.x) / c.R;
      if (r < 1) feat[i] += c.pit ? -c.R * 0.18 * (1 - Math.pow(r, 6)) : c.R * 0.4 * (r * r - 1);
    }
    const meanTan = h => { let a = 0; for (let i = 1; i < n; i++) a += Math.abs(h[i] - h[i - 1]); return a / ((n - 1) * dx) || 1e-9; };
    const fk = meanTan(feat) > 0.7 * tn ? 0.7 * tn / meanTan(feat) : 1; // features may not make the ground steeper than measured
    for (let i = 0; i < n; i++) feat[i] *= fk;
    let k = tn / meanTan(base); const h = new Float64Array(n);
    for (let it = 0; it < 4; it++) { for (let i = 0; i < n; i++) h[i] = base[i] * k + feat[i]; k *= tn / meanTan(h); }
    let lo = Infinity, hi = -Infinity, mean = 0;
    for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); mean += v / n; }
    const cut = s.relief > 0 && hi - lo > s.relief ? s.relief / (hi - lo) : 1; // never taller than the measured relief
    return { h: h.map(v => (v - mean) * cut), range: (hi - lo) * cut };
  }
  function placeSpec(id, o, name, tags, isTarget) {
    const rnd = rng(hash(id) ^ 0x51ed), W = PATCH_M, features = [];
    if (/rim/i.test(name)) features.push({ x: W * 1.05, R: W * 0.6 });
    if (tags && tags.impact_crater) features.push({ x: W * 0.5, R: 3200 });
    if ((tags && tags.lava_tube) || /lava|pit/i.test(name)) features.push({ x: W * (0.35 + rnd() * 0.3), R: isTarget ? 650 : 260, pit: true });
    return { id, slope: num(o.slope_deg, 0.3), rough: num(o.roughness_tri_m, 20), relief: num(o.relief_m, 0), features };
  }

  /* ---------- what a satellite frame looks like, as four numbers ---------- */
  function frameFromPixels(day, cloud) {
    let sx = 0, sy = 0, sS = 0, sL = 0, n = 0, cl = 0, cn = 0;
    for (let i = 0; day && i + 2 < day.length; i += 4) {
      const r = day[i] / 255, g = day[i + 1] / 255, b = day[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      const h = d === 0 ? 0 : (mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * Math.PI / 3;
      sx += Math.cos(h) * s; sy += Math.sin(h) * s; sS += s; sL += l; n++;
    }
    for (let i = 0; cloud && i < cloud.length; i += 4) { cl += cloud[i] / 255; cn++; }
    const hue = n && (sx || sy) ? (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360 : 0;
    return { hue: r3(hue), sat: r3(n ? sS / n : 0.3), light: r3(n ? sL / n : 0.45), cloud: r3(cn ? cl / cn : 0.2) };
  }
  function frameOrFallback(f, e) { // no image: a plain stand-in from the site's own numbers
    const dry = num(e.precip_mm_per_yr, 300) < 250;
    const d = { hue: dry ? 40 : 110, sat: 0.3, light: clamp(0.2 + 0.9 * num(e.albedo_wsa_unitless, 0.2), 0.05, 0.95), cloud: clamp(num(e.precip_mm_per_yr, 300) / 1500, 0, 0.6) };
    f = f && typeof f === "object" ? f : {};
    return { hue: r3(((num(f.hue, d.hue) % 360) + 360) % 360), sat: r3(clamp(num(f.sat, d.sat), 0, 1)), light: r3(clamp(num(f.light, d.light), 0, 1)), cloud: r3(clamp(num(f.cloud, d.cloud), 0, 1)) };
  }

  /* ---------- one place's voice ---------- */
  function voice(role, f, look, tr, S, sc, root, cents, dens, jit, rnd) {
    const L = sc.iv.length, bright = lin(f.albedo, 0.05, 0.6), dark = 0.45 + 0.55 * lin(f.sun, 0, 45);
    const warm = 0.5 + 0.5 * Math.cos((look.hue - 35) * Math.PI / 180), g = (0.2 + 0.8 * warm) * (0.35 + 0.65 * look.sat);
    const centre = Math.round(1.4 * L) + Math.round(bright * 0.4 * L); // melody centres about 17 semitones above the root; bright ground sits a little higher
    const ks = [], notes = [];
    for (let i = 0; i < STEPS; i++) { // elevation -> scale degree, on the scale SHARED by both places
      let k = centre + clamp(Math.round(tr.h[i] / S * 2 * L), -L, L);
      if (rnd() < jit) k += rnd() < 0.5 ? -1 : 1; // rougher ground wobbles more
      ks.push(k);
    }
    let prev = null;
    for (let i = 0; i < STEPS; i++) {
      const anchor = i % 8 === 0;
      if (anchor || (ks[i] !== prev && rnd() < dens) || rnd() < dens * dens * 0.3) { notes.push({ step: i, k: ks[i], vel: r3(anchor ? 0.95 : 0.7 + 0.2 * rnd()) }); prev = ks[i]; }
    }
    notes.forEach((n, j) => { n.len = clamp((j + 1 < notes.length ? notes[j + 1].step : STEPS) - n.step, 1, 8); n.midi = Math.min(88, root + degSemis(sc, n.k)); delete n.k; });
    const bells = [], every = f.ice > 0.7 ? 8 : 16, order = [4, 2, 3, 4];
    if (f.ice > 0.12) for (let i = 4, j = 0; i < STEPS; i += every, j++) bells.push({ step: i, midi: root + degSemis(sc, sc.chord[order[j % 4]] + L), vel: r3(0.6 + 0.4 * (j % 2 ? 0.7 : 1)) });
    const lo = Math.min(...ks), hi = Math.max(...ks);
    return {
      role, pan: role === "base" ? -0.3 : 0.3, level: r3(0.75 + 0.5 * look.light),
      cutoff: Math.round(900 * Math.pow(2, 2.5 * bright) * dark), q: r3(0.6 + 1.4 * look.sat),
      harm: [1, 0.38 * g, 0.2 * g, 0.11 * g, 0.06 * g].map(r3),
      cents: DIMS.map(d => r3(cents[d])), melCents: r3(cents.terrain), bellCents: r3(cents.ice),
      shimmer: r3(0.1 * look.cloud), bell: r3(f.ice > 0.12 ? 0.3 + 0.7 * f.ice : 0),
      breath: { hz: r3(0.07 + 0.06 * logn(f.swing, 2, 300)), cents: Math.round(120 + 480 * logn(f.swing, 2, 300)) },
      span: hi - lo, density: r3(dens), melody: notes, bells,
      stat: { slope: r3(f.slope), rough: r3(f.rough), albedo: r3(f.albedo), ice: r3(f.ice), sun: r3(f.sun) },
    };
  }

  /* ---------- the whole profile ---------- */
  function profile(site, target, match, frame) {
    site = site || {}; target = target || {};
    const E = site.earth || {}, F = target.features || {}, D = site.dims || {};
    const body = target.body === "Mars" ? "Mars" : "Moon", sc = SCALES[body];
    const tid = String(target.id || target.name || body), sid = String(site.id || site.name || "site");
    const have = DIMS.filter(d => typeof D[d] === "number" && isFinite(D[d]));
    const m = clamp(num(match, have.length ? have.reduce((a, d) => a + D[d], 0) / have.length : 0.5), 0, 1);
    const dim = {}; DIMS.forEach(d => { dim[d] = clamp(num(D[d], m), 0, 1); });
    const worst = DIMS.reduce((a, d) => (dim[d] < dim[a] ? d : a), DIMS[0]);
    const root = 46 + hash(tid) % 12; // the base picks the key, e.g. 46 = B flat, 57 = A
    const rawF = o => ({ slope: num(o.slope_deg, 0.3), rough: num(o.roughness_tri_m, 20), albedo: num(o.albedo_wsa_unitless, 0.2), ice: clamp(num(o.ground_ice_frac, 0), 0, 1), sun: num(o.sun_noon_elev_mean_deg, 45), swing: num(o.temp_daynight_range_K, 40) });
    const fb = rawF(F), fe = rawF(E);
    const tb = transect(placeSpec(tid, F, String(target.name || ""), null, true), STEPS);
    const te = transect(placeSpec(sid, E, String(site.name || ""), site.tags, false), STEPS);
    const S = Math.max(tb.range, te.range, 300); // one vertical scale for both places; the 300 m floor keeps gentle ground narrow and flat ground a near-drone
    const none = {}, det = {}; DIMS.forEach(d => { none[d] = 0; det[d] = (1 - dim[d]) * MAX_DETUNE * SIGN[d]; });
    const dens = f => 0.25 + 0.7 * logn(f.rough, 3, 1500), jit = f => 0.04 + 0.3 * logn(f.rough, 3, 1500);
    const fr = frameOrFallback(frame, E), look = BODY_LOOK[body];
    const tempo = Math.round(60 + 50 * (logn(fb.slope, 0.1, 15) + logn(fe.slope, 0.1, 15)) / 2); // one shared pulse
    const voices = [
      voice("base", fb, look, tb, S, sc, root, none, dens(fb), jit(fb), rng(hash(tid) ^ 0xb45e)),
      voice("earth", fe, fr, te, S, sc, root, det, dens(fe), jit(fe), rng(hash(sid) ^ 0xea27)),
    ];
    return {
      version: 1, names: { site: String(site.name || ""), target: String(target.name || ""), body }, ids: { site: sid, target: tid },
      match: r3(m), dims: dim, worst, steps: STEPS, tempo: clamp(tempo, 60, 110),
      key: { root, name: NOTE[root % 12], scale: sc.name, intervals: sc.iv },
      chord: DIMS.map((d, i) => ({ dim: d, midi: root + degSemis(sc, sc.chord[i]), freq: r3(mtof(root + degSemis(sc, sc.chord[i]))), agree: r3(dim[d]), detune: r3(det[d]) })),
      totalDetune: r3(DIMS.reduce((a, d) => a + Math.abs(det[d]), 0)),
      mix: { wet: r3(0.14 + 0.26 * m), reverbSec: r3(1.6 + 2.2 * m), dampHz: Math.round(6000 - 4200 * m), drone: r3(0.25 + 0.75 * m) }, // better match: longer, warmer, fuller
      frame: fr, voices,
    };
  }

  /* ---------- the same thing in plain English ---------- */
  function terrainWords(s) {
    const sl = s.slope < 0.5 ? "flat" : s.slope < 2 ? "gentle" : s.slope < 6 ? "sloping" : "steep";
    const ru = s.rough < 30 ? ", smooth" : s.rough < 150 ? " rolling" : s.rough < 500 ? ", rugged" : ", very rugged";
    return `${sl}${ru} ground`;
  }
  const rangeWord = v => (v.span <= 1 ? "near-drone" : v.span <= 3 ? "narrow" : v.span <= 6 ? "medium" : "wide");
  function colourWords(f) {
    const c = f.light > 0.75 && f.sat < 0.25 ? "white" : f.light < 0.16 ? "dark" : f.sat < 0.12 ? "grey" : f.hue < 20 || f.hue >= 340 ? "reddish" : f.hue < 60 ? "sandy" : f.hue < 75 ? "olive" : f.hue < 170 ? "green" : f.hue < 260 ? "blue" : "purple";
    return `${c} and ${f.cloud < 0.15 ? "clear" : f.cloud < 0.4 ? "partly cloudy" : "cloudy"}`;
  }
  function describe(p, info) {
    try {
      info = info || {}; const b = p.voices[0], e = p.voices[1], pct = Math.round(p.match * 100);
      const name = info.name || p.names.site || "This Earth site", tgt = p.names.target || "the base";
      const tune = p.match >= 0.92 ? "almost perfectly in tune" : p.match >= 0.7 ? "mostly in tune" : p.match >= 0.5 ? "partly in tune, with slow beating" : p.match >= 0.3 ? "often out of tune, with clear beating" : "far out of tune, with strong beating";
      const pace = p.tempo <= 72 ? "slow" : p.tempo <= 92 ? "steady" : "lively";
      const r = rangeWord(e), rb = rangeWord(b), mp = w => (w === "near-drone" ? "a near-drone" : `a ${w} melody`);
      const out = [`${name} (Earth) beside ${tgt} (${p.names.body}).`,
        `Match ${pct}%, so the chord is ${tune}${p.match < 0.92 ? `; the least matched tone is ${WORDS[p.worst]}` : ""}.`,
        `${cap(terrainWords(e.stat))} gives ${mp(r)}${r === rb ? ", like the base" : `; the base's ${terrainWords(b.stat)} gives ${mp(rb)}`}, at a ${pace} pace.`];
      const a = e.stat.albedo;
      out.push(a >= 0.4 ? "Bright ground gives a high, airy tone." : a >= 0.25 ? "Light ground gives a clear tone." : a >= 0.14 ? "Mid-tone ground gives a soft, mellow tone." : "Dark ground gives a low, soft tone.");
      if (b.bell && e.bell) out.push("Both places have ground ice, so two glassy bells ring together.");
      else if (b.bell || e.bell) out.push(`Only the ${b.bell ? "base" : "Earth site"} has ground ice, so only one glassy bell rings.`);
      if (b.stat.sun < 10) out.push("Low sun at the base darkens its tone.");
      out.push(`The satellite view around the Earth site is ${colourWords(p.frame)}, which shapes its voice.`);
      return out.join(" ");
    } catch (err) { return "Sound description unavailable."; }
  }

  return { profile, describe, frameFromPixels, mtof, hash, rng, transect, DIMS, WORDS, SCALES, MAX_DETUNE, HINT, NOTE };
});
