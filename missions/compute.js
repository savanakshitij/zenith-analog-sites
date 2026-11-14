// node compute.js <engine folder> : best Earth test sites per future mission, using the v1.6 engine with mission weights
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const Z = require(path.resolve(dir, 'zenith-engine.js'));
const params = JSON.parse(fs.readFileSync(path.join(dir, 'engine_params.json')));
const b = fs.readFileSync(path.join(dir, 'earth_cells.bin'));
const eng = new Z.Engine(params, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const M = JSON.parse(fs.readFileSync(path.join(__dirname, 'missions_input.json')));
const KNOWN = [['Yungay, Atacama', -24.1, -70.0], ['McMurdo Dry Valleys', -77.5, 162.0], ['Haughton Crater', 75.38, -89.68], ['Qaidam Basin', 38.33, 91.67],
  ['Wadi Rum', 29.57, 35.42], ['Mars Desert Research Station', 38.41, -110.79], ['Lanzarote', 29.0, -13.79], ['HI-SEAS, Mauna Loa', 19.6, -155.49], ['Devon Island', 75.4, -89.7]];
const hav = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(Math.min(1, x))); };
const out = [];
for (const m of M) {
  const T = eng.targets.find(t => t.id === m.target_id);
  const s = eng.scoreAll(T.id, { weights: m.weights });
  const idx = []; for (let i = 0; i < eng.n; i++) if (!isNaN(s[i])) idx.push(i);
  idx.sort((a, c) => s[c] - s[a]);
  const aw = i => Math.cos(eng.cellLatLon(i)[0] * Math.PI / 180);
  const tot = idx.reduce((t, i) => t + aw(i), 0);
  let cum = 0; const pct = new Map(); for (let k = idx.length - 1; k >= 0; k--) { pct.set(idx[k], 100 * cum / tot); cum += aw(idx[k]); }
  const picks = [];
  for (const i of idx) { const [la, lo] = eng.cellLatLon(i); if (picks.every(p => hav(p.lat, p.lon, la, lo) >= 500)) picks.push({ i, lat: la, lon: lo }); if (picks.length === 4) break; }
  const sites = picks.map(p => {
    const r = eng.scoreCell(p.i, T, null, m.weights), f = eng.features(p.i);
    const near = KNOWN.map(k => [k[0], hav(p.lat, p.lon, k[1], k[2])]).sort((a, c) => a[1] - c[1])[0];
    return { lat: p.lat, lon: p.lon, score: +r.score.toFixed(3), percentile: +pct.get(p.i).toFixed(2), dims: Object.fromEntries(Object.entries(r.dims).map(([k, v]) => [k, +v.toFixed(2)])),
             rock: f.rock, temp_min_K: +f.temp_min_K.toFixed(0), slope_deg: +f.slope_deg.toFixed(2), precip_mm: Math.round(f.precip_mm_per_yr), ice: f.ground_ice_frac,
             nearest_known: near[0], km_to_known: Math.round(near[1]) };
  });
  // best known analog under the same mission weights (site box: best cell within 0.375 deg)
  const kb = KNOWN.map(([name, la, lo]) => { let best = null;
    for (let dl = -1; dl <= 1; dl++) for (let dn = -1; dn <= 1; dn++) { const i = eng.cellIndex(la + dl * 0.25, lo + dn * 0.25); if (i < 0) continue;
      const r = eng.scoreCell(i, T, null, m.weights); if (r.score !== null && (!best || r.score > best.score)) best = { name, score: +r.score.toFixed(3), eligible: r.eligible }; }
    return best; }).filter(Boolean).sort((a, c) => c.score - a.score)[0];
  out.push({ ...m, target_name: T.name, best_sites: sites, best_known_analog: kb });
  console.log(`\n== ${m.mission} -> ${T.name} | known: ${kb.name} ${kb.score}`);
  sites.forEach(x => console.log(`  ${x.lat},${x.lon} score ${x.score} pct ${x.percentile} rock ${x.rock} Tmin ${x.temp_min_K} slope ${x.slope_deg} rain ${x.precip_mm} ice ${x.ice} | ${x.nearest_known} ${x.km_to_known} km | dims ${JSON.stringify(x.dims)}`));
}
fs.writeFileSync(path.join(__dirname, 'missions_scored.json'), JSON.stringify(out, null, 1));
