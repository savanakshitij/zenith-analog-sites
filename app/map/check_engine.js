// node check_engine.js <out folder> <scores_balanced.json>: compares the browser engine with score_v16 output
const fs = require('fs'), path = require('path');
const Z = require(path.resolve(process.argv[2], 'zenith-engine.js'));
const params = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'engine_params.json')));
const b = fs.readFileSync(path.join(process.argv[2], 'earth_cells.bin'));
const eng = new Z.Engine(params, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const S = JSON.parse(fs.readFileSync(process.argv[3])).targets;
let worst = 0, worstP = 0, n = 0;
for (const [tid, t] of Object.entries(S)) {
  const T = eng.targets.find(x => x.id === tid);
  const cells = t.top.concat(t.lesser_known);
  for (const c of cells) {
    const i = eng.cellIndex(c.lat, c.lon), r = eng.scoreCell(i, T);
    worst = Math.max(worst, Math.abs(r.score - c.score), Math.abs(r.earthTestableScore - c.earth_testable_score));
    worstP = Math.max(worstP, Math.abs(r.percentile - c.percentile)); n++;
    if (!r.eligible) throw new Error('scored cell not eligible in JS: ' + tid + ' ' + c.lat + ',' + c.lon);
  }
}
console.log('compared', n, 'cells | max score diff', worst.toFixed(4), '| max percentile diff', worstP.toFixed(2));
for (const [n2, la, lo] of [['Yungay', -24.1, -69.98], ['NW Saudi lava field', 27.375, 37.375], ['Heilbronn', 49.14, 9.22], ['Pacific', 0, -150], ['McMurdo Dry Valleys', -77.5, 162.0], ['Antarctic plateau', -80, 40]]) {
  const r = eng.scoreAt(la, lo);
  if (!r.land) { console.log(n2, '->', r.message); continue; }
  console.log(n2, r.cellLat, r.cellLon, '| rock', r.features.rock, '| top:', r.targets.slice(0, 3).map(t => `${t.name} ${t.score && t.score.toFixed(2)} ${t.eligible ? 'p' + t.percentile : '(' + t.ineligibleReason + ')'}`).join(' ; '));
}
let t0 = Date.now(); const a0 = eng.scoreAll('best'); console.log('scoreAll best:', Date.now() - t0, 'ms, scored cells', a0.filter(x => !isNaN(x)).length);
// fast path must agree with scoreCell
for (const T of eng.targets) {
  const a = eng.scoreAll(T.id); let d = 0, cnt = 0;
  for (let i = 0; i < eng.n; i += 97) { const r = eng.scoreCell(i, T); const s = r.eligible ? r.score : NaN;
    if (isNaN(a[i]) !== isNaN(s)) throw new Error('eligibility mismatch ' + T.id + ' ' + i); if (!isNaN(s)) { d = Math.max(d, Math.abs(a[i] - s)); cnt++; } }
  console.log('fast path', T.id.padEnd(10), 'checked', cnt, 'max diff', d.toExponential(1));
}
t0 = Date.now(); eng.scoreAll('best'); console.log('scoreAll best (fast):', Date.now() - t0, 'ms');
