#!/usr/bin/env node
/*
 * Earth Jukebox tests. Plain Node, no browser, no packages:  node tools/test_sonify.mjs
 * Checks the mapping in js/sonify-core.js (determinism, one key for both voices, detune vs match, ranges,
 * missing data) and, if audio/ has been rendered, the WAV files (length, peak, loudness, and that missions sound different).
 */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const C = createRequire(import.meta.url)(path.join(APP, "js/sonify-core.js"));
const box = {}; box.window = box; vm.createContext(box);
for (const f of ["data/zenith-data.js", "js/coverage-stub.js", "js/mission.js"]) vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), box, { filename: f });
const D = box.ZENITH_DATA, best = (target, subs) => { const r = box.Zenith.assess({ target, subsystems: subs }, D); return { site: r.ranked[0].site, target: r.target, match: r.ranked[0].overall }; };
const missions = box.ZenithMission.LIBRARY.map(m => ({ m, ...best(m.target, m.subsystems) }));
const prof = x => C.profile(x.site, x.target, x.match, null);
const clone = o => JSON.parse(JSON.stringify(o));
const finite = (v, p = "") => { if (typeof v === "number") assert.ok(isFinite(v), `non-finite number at ${p}`); else if (v && typeof v === "object") for (const k in v) finite(v[k], `${p}.${k}`); else assert.ok(v !== undefined, `undefined at ${p}`); };

let pass = 0, fail = 0;
const test = (name, fn) => { try { const note = fn(); pass++; console.log(`  ok   ${name}${note ? "  (" + note + ")" : ""}`); } catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e.message).split("\n")[0]}`); } };

console.log("Mapping (js/sonify-core.js)");
test("deterministic: same input, same profile and text", () => {
  for (const x of missions) { assert.deepEqual(prof(x), prof(x)); assert.equal(C.describe(prof(x), { name: "A" }), C.describe(prof(x), { name: "A" })); }
  return `${missions.length} missions`;
});
test("one key: both voices, chord, melody and bells share the root and scale", () => {
  for (const x of missions) {
    const p = prof(x), inKey = m => p.key.intervals.includes((((m - p.key.root) % 12) + 12) % 12);
    assert.ok(p.chord.every(c => inKey(c.midi)), "chord tone out of key");
    for (const v of p.voices) assert.ok([...v.melody, ...v.bells].every(n => inKey(n.midi)), `${v.role} note out of key`);
    assert.equal(p.key.root, prof({ ...x, site: { ...x.site, id: "other", dims: {} } }).key.root, "root must come from the target only");
  }
  return [...new Set(missions.map(x => `${prof(x).key.name} ${prof(x).key.scale}`))].join(", ");
});
test("the base is always in tune; the Earth voice is detuned by at most 35 cents", () => {
  for (const x of missions) { const [b, e] = prof(x).voices; assert.ok(b.cents.every(c => c === 0) && b.melCents === 0 && b.bellCents === 0); assert.ok(e.cents.every(c => Math.abs(c) <= 35.001)); }
});
test("total detune falls as every dimension improves; a perfect match is pure", () => {
  const x = missions[4], tot = d => { const s = clone(x.site); for (const k in s.dims) s.dims[k] = d; return C.profile(s, x.target, d).totalDetune; };
  const t = [0, 0.25, 0.5, 0.75, 1].map(tot);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] < t[i - 1], `not falling: ${t}`);
  assert.equal(t[4], 0); return t.map(v => v.toFixed(0)).join(" > ");
});
test("one dimension at a time: improving it lowers the total detune", () => {
  const x = missions[4]; for (const d of C.DIMS) { const lo = clone(x.site), hi = clone(x.site); lo.dims[d] = 0.1; hi.dims[d] = 0.9; assert.ok(C.profile(hi, x.target, 0.5).totalDetune < C.profile(lo, x.target, 0.5).totalDetune, d); }
});
test("ranges are sane (60-110 bpm, finite numbers, notes 30-88, mix within bounds)", () => {
  const pool = [...missions.map(prof)]; let n = 0;
  for (const t of Object.values(D.targets)) for (const c of t.candidates.slice(0, 40)) { pool.push(C.profile(c, t, c.dims.thermal)); n++; }
  for (const p of pool) {
    finite(p); assert.ok(p.tempo >= 60 && p.tempo <= 110 && p.match >= 0 && p.match <= 1);
    assert.ok(p.mix.wet > 0.1 && p.mix.wet < 0.45 && p.mix.reverbSec >= 1.5 && p.mix.reverbSec <= 4 && p.mix.drone > 0.2 && p.mix.drone <= 1);
    for (const v of p.voices) { assert.ok(v.cutoff >= 300 && v.cutoff <= 5200 && v.level >= 0.7 && v.level <= 1.3 && v.span >= 0 && v.span <= 30); assert.ok([...v.melody, ...v.bells].every(q => q.midi >= 30 && q.midi <= 88 && q.step >= 0 && q.step < p.steps)); assert.ok(v.melody.length >= 8); }
  }
  return `${pool.length} profiles`;
});
test("the mapping moves the right way (slope, roughness, albedo, low sun, ice, cloud, flat vs steep)", () => {
  const x = missions[4], mk = (over, frame) => { const s = clone(x.site); Object.assign(s.earth, over); return C.profile(s, x.target, 0.6, frame); };
  assert.ok(mk({ slope_deg: 8 }).tempo >= mk({ slope_deg: 0.1 }).tempo, "slope -> tempo");
  assert.ok(mk({ roughness_tri_m: 900 }).voices[1].density > mk({ roughness_tri_m: 5 }).voices[1].density, "roughness -> density");
  assert.ok(mk({ albedo_wsa_unitless: 0.7 }).voices[1].cutoff > mk({ albedo_wsa_unitless: 0.1 }).voices[1].cutoff, "albedo -> brightness");
  assert.ok(mk({ sun_noon_elev_mean_deg: 2 }).voices[1].cutoff < mk({ sun_noon_elev_mean_deg: 60 }).voices[1].cutoff, "low sun -> darker");
  assert.ok(mk({ ground_ice_frac: 1 }).voices[1].bell > mk({ ground_ice_frac: 0 }).voices[1].bell, "ice -> bell");
  assert.ok(mk({}, { cloud: 0.9 }).voices[1].shimmer > mk({}, { cloud: 0 }).voices[1].shimmer, "cloud -> shimmer");
  const flat = mk({ slope_deg: 0.05, roughness_tri_m: 3, relief_m: 5 }).voices[1], steep = mk({ slope_deg: 14, roughness_tri_m: 1200 }).voices[1];
  assert.ok(flat.span <= 2 && steep.span >= 8, `flat span ${flat.span}, steep span ${steep.span}`);
  return `flat span ${flat.span}, steep span ${steep.span}`;
});
test("missing or odd fields never throw", () => {
  const junk = [undefined, null, {}, [], "x", 5, { earth: null, dims: null, features: null }, { dims: { thermal: NaN, ice: Infinity, aridity: "no" }, earth: { slope_deg: -3, roughness_tri_m: "a", albedo_wsa_unitless: NaN } }, { id: 7, name: {} }];
  for (const s of junk) for (const t of junk) for (const m of [undefined, NaN, -2, 5, "0.5"]) { const p = C.profile(s, t, m, s === 5 ? "bad" : { hue: NaN }); finite(p); assert.equal(typeof C.describe(p, t), "string"); }
  assert.equal(typeof C.describe(null), "string"); assert.equal(typeof C.describe({}, 3), "string");
  assert.deepEqual(C.frameFromPixels(undefined, undefined).cloud >= 0, true);
});
test("missions sound different from each other", () => {
  const ps = missions.map(prof), sig = p => JSON.stringify([p.key, p.tempo, p.voices.map(v => v.melody.map(n => n.midi))]);
  assert.equal(new Set(ps.map(sig)).size, ps.length); assert.ok(new Set(ps.map(p => p.key.name + p.key.scale)).size >= 4);
});
test("a new target gets sound with no extra work (only data is added)", () => {
  const t = clone(D.targets.jezero); t.id = "new-test-base"; t.name = "Test crater"; t.features.slope_deg = 9; D.targets[t.id] = t;
  const r = box.Zenith.assess({ target: t.id, subsystems: ["rover"] }, D).ranked[0], p = C.profile(r.site, t, r.overall), q = prof(missions[4]);
  delete D.targets[t.id]; finite(p);
  assert.ok(p.names.target === "Test crater" && p.voices[0].melody.length > 8 && /Test crater \(Mars\)/.test(C.describe(p, { name: "X" })));
  assert.notEqual(JSON.stringify(p.voices[0].melody), JSON.stringify(q.voices[0].melody));
});
test("frame statistics from pixels (any image source)", () => {
  const px = (r, g, b, n = 20) => Uint8ClampedArray.from({ length: n * 4 }, (_, i) => [r, g, b, 255][i % 4]);
  const red = C.frameFromPixels(px(200, 30, 30), px(0, 0, 0)), blue = C.frameFromPixels(px(20, 60, 200), px(255, 255, 255)), white = C.frameFromPixels(px(250, 250, 250), px(255, 255, 255));
  assert.ok(red.hue < 10 || red.hue > 350); assert.ok(Math.abs(blue.hue - 224) < 6 && blue.cloud === 1 && red.cloud === 0); assert.ok(white.sat < 0.01 && white.light > 0.95);
});
test("the description is short plain English with the numbers in it", () => {
  const x = missions[4], t = C.describe(prof(x), { name: "Chile" });
  assert.ok(/^Chile \(Earth\) beside Jezero crater \(Mars\)\. Match 86%/.test(t) && !/undefined|NaN|<|>/.test(t) && t.length < 650, t);
  return `${t.length} characters`;
});

/* ---------- the rendered WAV files (only if tools/sonify_render.mjs has been run) ---------- */
const AUD = path.join(APP, "audio"), plf = path.join(AUD, "playlist.json");
if (fs.existsSync(plf)) {
  console.log("\nRendered audio (audio/)");
  const pl = JSON.parse(fs.readFileSync(plf, "utf8")).tracks, rows = [];
  const fft = (re, im) => { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(a * k), wi = Math.sin(a * k), u = i + k, v = u + len / 2, xr = re[v] * wr - im[v] * wi, xi = re[v] * wi + im[v] * wr; re[v] = re[u] - xr; im[v] = im[u] - xi; re[u] += xr; im[u] += xi; } } };
  for (const t of pl) {
    const b = fs.readFileSync(path.join(AUD, t.file)), sr = b.readUInt32LE(24), n = (b.length - 44) / 2, x = new Float32Array(n);
    assert.equal(b.toString("ascii", 0, 4), "RIFF"); assert.equal(b.readUInt16LE(22), 1); assert.equal(b.readUInt16LE(34), 16);
    let pk = 0, ss = 0; for (let i = 0; i < n; i++) { x[i] = b.readInt16LE(44 + 2 * i) / 32768; pk = Math.max(pk, Math.abs(x[i])); ss += x[i] * x[i]; }
    const N = 4096, spec = new Float64Array(N / 2); let cnt = 0;
    for (let s = sr; s + N < n - sr; s += N) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im); for (let k = 0; k < N / 2; k++) spec[k] += Math.hypot(re[k], im[k]); cnt++; }
    let num = 0, den = 0, chroma = new Float64Array(12); for (let k = 2; k < N / 2; k++) { const f = k * sr / N; num += f * spec[k]; den += spec[k]; if (f > 60 && f < 2000) chroma[(Math.round(12 * Math.log2(f / 440) + 69) % 12 + 12) % 12] += spec[k] * spec[k]; }
    const top = chroma.indexOf(Math.max(...chroma));
    rows.push({ id: t.id, sr, sec: n / sr, peak: pk, rmsdB: 20 * Math.log10(Math.sqrt(ss / n)), centroid: num / den, note: C.NOTE[top], key: t.key });
    test(`${t.file}: ${(n / sr).toFixed(1)} s mono 16-bit ${sr} Hz, peak ${pk.toFixed(2)}, RMS ${rows.at(-1).rmsdB.toFixed(1)} dBFS`, () => {
      assert.ok(Math.abs(n / sr - t.seconds) < 0.05 && sr === 22050 && pk <= 1 && pk > 0.05 && ss > 0 && x.every(isFinite));
      assert.ok(rows.at(-1).rmsdB > -30 && rows.at(-1).rmsdB < -10, "loudness out of range");
    });
  }
  test("missions differ in the audio: spectral centroids and strongest notes", () => {
    const c = rows.map(r => r.centroid), spread = Math.max(...c) / Math.min(...c);
    assert.ok(spread > 1.15, `centroid spread only ${spread.toFixed(2)}x`); assert.ok(new Set(rows.map(r => r.note)).size >= 3);
    return rows.map(r => `${r.id.split("-")[0]} ${r.centroid.toFixed(0)} Hz ${r.note}`).join(", ");
  });
  test(`the whole audio folder is under 8 MB`, () => { const sz = fs.readdirSync(AUD).reduce((a, f) => a + fs.statSync(path.join(AUD, f)).size, 0); assert.ok(sz < 8e6); return (sz / 1e6).toFixed(1) + " MB"; });
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
