// Computes "best match" and "best new candidate" for the seven targets exactly as the Zenith web app does.
// Run from the repo root:  node scoring/new_candidates.mjs
// Loads the app's own files (engine-data.js, extras.js, zenith-engine.js, coverage.js, bridge.js, mission.js) into a
// browser-like window and calls the app's own functions (assess, top, inspect). Nothing is rescored here.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "zenith-app");
const win = { addEventListener() {}, matchMedia: () => ({ matches: false }) };
win.window = win; win.self = win; win.atob = s => Buffer.from(s, "base64").toString("binary");
vm.createContext(win);
// Same order as index.html (mission.js needs ZenithApp from bridge.js only when region() is called).
for (const f of ["js/vendor/d3.min.js", "js/vendor/topojson-client.min.js", "js/vendor/countries-110m.js", "data/engine-data.js", "data/extras.js",
  "js/zenith-engine.js", "js/coverage.js", "js/bridge.js", "js/mission.js"]) vm.runInContext(fs.readFileSync(path.join(app, f), "utf8"), win, { filename: f });

const A = win.ZenithApp, M = win.ZenithMission, d3 = win.d3, topojson = win.topojson;
const countries = topojson.feature(win.WORLD_TOPO, win.WORLD_TOPO.objects.countries).features;
// Same as ZenithGlobe.countryOf in js/globe.js (that file needs a canvas, so it is repeated here).
const countryOf = (lat, lon) => { const f = countries.find(c => d3.geoContains(c, [lon, lat])); return f ? f.properties.name : null; };
// Same as nameOf in js/app.js.
const nameOf = s => {
  if (s.tags.impact_crater) return `${s.tags.impact_crater} crater`;
  if (s.nearest_known.km < 40) return s.nearest_known.name;
  return M.region(s.lat, s.lon) || (s.nearest_known.km < 150 ? `Near ${s.nearest_known.name.split(",")[0]}` : countryOf(s.lat, s.lon)) || "Unnamed ground";
};
const DIM_LABEL = { thermal: "Cold", aridity: "Dryness", terrain: "Terrain", surface: "Surface", ice: "Ice", illumination: "Sunlight", geology: "Rock type" };
const NEW_KM = A.NEW_KM, N_KNOWN = A.known.length;
const LABEL = "Not field-checked yet. Access and permits not assessed.";
const r2 = v => Math.round(v * 100) / 100;
const coordText = (la, lo) => `${Math.abs(la).toFixed(1)}${la >= 0 ? "N" : "S"}, ${Math.abs(lo).toFixed(1)}${lo >= 0 ? "E" : "W"}`;

// Specific place names for the README, keyed by exact cell centre "lat,lon". Missing cells fall back to the app name plus coordinates.
const README = JSON.parse(fs.readFileSync(path.join(root, "scoring/new_candidates_readme_names.json"), "utf8"));
const readmeName = s => README[`${s.lat},${s.lon}`] || `${nameOf(s)} (${coordText(s.lat, s.lon)})`;

function why(s, tname) {
  const d = A.DIMS.map(k => ({ k, v: s.dims[k] })).sort((a, b) => b.v - a.v || A.DIMS.indexOf(a.k) - A.DIMS.indexOf(b.k));
  const lab = k => DIM_LABEL[k].toLowerCase(), lo = d[d.length - 1];
  let t = `Strongest on ${lab(d[0].k)} (${d[0].v.toFixed(2)}) and ${lab(d[1].k)} (${d[1].v.toFixed(2)}); weakest on ${lab(lo.k)} (${lo.v.toFixed(2)})`;
  if (lo.k === "thermal") t += `, and no place on Earth is that cold`;
  return t + ".";
}
function dimsOf(s) {
  const d = A.DIMS.map(k => ({ dim: k, label: DIM_LABEL[k], score: r2(s.dims[k]) })).sort((a, b) => b.score - a.score || A.DIMS.indexOf(a.dim) - A.DIMS.indexOf(b.dim));
  return { best: d.slice(0, 3), worst: d.slice(-2).reverse() };
}
function describe(s, T) {
  const { best, worst } = dimsOf(s);
  return { id: s.id, name: nameOf(s), readme_name: readmeName(s), lat: s.lat, lon: s.lon, score: r2(s.score), rank: s.rank, percentile: r2(s.percentile),
    nearest_known_km: s.nearest_known.km, nearest_known_name: s.nearest_known.name, best_dimensions: best, worst_dimensions: worst, why: why(s, T.name), label: LABEL };
}

const targets = [], pool = [];
for (const id of Object.keys(A.X.targets).filter(k => k !== "custom")) {
  const plan = { target: id, subsystems: [] }; // no mission picked: balanced weights, every dimension weight 1
  const R = A.assess(plan), tt = R.target, b = R.ranked[0].site, f = R.ranked[R.fresh].site;
  const bm = { name: nameOf(b), lat: b.lat, lon: b.lon, score: r2(b.score), nearest_known_km: b.nearest_known.km, nearest_known_name: b.nearest_known.name, kind: b.kind };
  targets.push({ target_id: id, target_name: tt.name, body: tt.body, best_match: bm, best_new: describe(f, tt), same_place: R.fresh === 0 });
  // Candidates: the app's 100 km-spaced ranking (top()), keeping cells at least NEW_KM from every known site, plus the app's own best new cell.
  const seen = new Set();
  for (const s of [f, ...A.top(plan, 400).map(([i, la, lo]) => A.inspect(la, lo, plan).site)])
    if (s.nearest_known.km >= NEW_KM && !seen.has(s.id)) { seen.add(s.id); pool.push({ s, T: tt }); }
}
pool.sort((a, b) => b.s.score - a.s.score || a.s.i - b.s.i);
const kept = [];
for (const c of pool) {
  const near = kept.find(k => A.km(k.s.lat, k.s.lon, c.s.lat, c.s.lon) < 300);
  if (near) { if (c.T.id !== near.T.id && !near.also.some(a => a.target_id === c.T.id)) near.also.push({ target_id: c.T.id, target_name: c.T.name, score: r2(c.s.score), rank: c.s.rank }); continue; }
  kept.push({ s: c.s, T: c.T, also: [] });
}
const overall = kept.slice(0, 10).map(k => Object.assign({ target_id: k.T.id, target_name: k.T.name }, describe(k.s, k.T), { also_matches: k.also }));

// Counts: land cells in the engine; cells the balanced pass scores for a target without ice (bare ground with complete data).
const eng = A.eng;
const noIce = eng.targets.find(t => !t.ice_cells_allowed);
const counts = { land_cells: eng.n, bare_ground_scored: A.pass(A.target(noIce.id), A.weightsFor({ target: noIce.id, subsystems: [] })).n };

const rule = { new_km: NEW_KM, known_sites: N_KNOWN, weights: "balanced", text: `A new candidate is the best cell at least ${NEW_KM} km from all ${N_KNOWN} known analog sites.` };
const out = { rule, counts, targets, overall_top_10: overall };
const json = JSON.stringify(out, null, 2) + "\n";
fs.mkdirSync(path.join(root, "results"), { recursive: true });
fs.writeFileSync(path.join(root, "results/new_candidates.json"), json);
fs.writeFileSync(path.join(app, "data/new-candidates.js"), `window.ZENITH_NEW_CANDIDATES = ${JSON.stringify(out)};\n`);

const n = v => v.toLocaleString("en");
const md = ["# New candidates", "", rule.text, "",
  `Balanced weights, as the app uses with no mission picked. Same rule and code as the app (NEW_KM = ${NEW_KM} in zenith-app/js/bridge.js). Regenerate with \`node scoring/new_candidates.mjs\`.`, "",
  `Land cells: ${n(counts.land_cells)}. Bare-ground cells scored: ${n(counts.bare_ground_scored)}.`, "",
  "## Best match and best new candidate per target", "",
  "| Target | Best match overall | Score | Best new candidate | Score | Km to nearest known site |", "|---|---|---|---|---|---|"];
for (const t of targets) md.push(`| ${t.target_name} | ${t.best_match.name} | ${t.best_match.score.toFixed(2)} | ${t.same_place ? "same place" : t.best_new.readme_name} | ${t.best_new.score.toFixed(2)} | ${n(t.best_new.nearest_known_km)} (${t.best_new.nearest_known_name}) |`);
md.push("", "## Why each new candidate", "");
for (const t of targets) md.push(`- ${t.target_name}: ${t.best_new.why}`);
md.push("", "## Top 10 new candidates across all targets", "", "One entry per place. Sites within 300 km of a higher-scoring one are merged and listed under other targets.", "",
  "| # | Place | Target | Score | Rank | Km to nearest known site | Also matches |", "|---|---|---|---|---|---|---|");
overall.forEach((o, i) => md.push(`| ${i + 1} | ${o.readme_name} | ${o.target_name} | ${o.score.toFixed(2)} | ${n(o.rank)} | ${n(o.nearest_known_km)} | ${o.also_matches.map(a => `${a.target_name} ${a.score.toFixed(2)}`).join(", ") || "none"} |`));
md.push("", LABEL, "");
fs.writeFileSync(path.join(root, "results/new_candidates.md"), md.join("\n"));
console.log(md.join("\n"));
