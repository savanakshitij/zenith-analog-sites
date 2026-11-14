// Run with: node test.js
const assert = require('assert');
const Z = require('./coverage.js');
const data = require('./data.json');

// 1. Hand-checked arithmetic on a made-up cell.
const cell = { dims: { thermal: 0.5, aridity: 1, terrain: 1, surface: 0, ice: 0 }, eligible: true };
const w = { mobility: 50, thermal: 50 };
const r = Z.assessCell(cell, w);
// mobility: 1 x 0.8 = 0.8, thermal: 0.5 x 0.9 = 0.45, plan = 0.5*0.8 + 0.5*0.45 = 0.625
assert.ok(Math.abs(r.planCoverage - 0.625) < 1e-9, 'plan coverage arithmetic');
assert.strictEqual(r.strongest.id, 'mobility');
assert.strictEqual(r.weakest.id, 'thermal');

// 2. Space-only subsystems never add coverage, but they do dilute it.
const r2 = Z.assessCell(cell, { mobility: 50, thermal: 50, gravity: 100 });
assert.ok(Math.abs(r2.planCoverage - 0.3125) < 1e-9, 'gravity dilutes coverage');
assert.ok(Math.abs(Z.spaceOnlyShare({ mobility: 50, thermal: 50, gravity: 100 }) - 0.5) < 1e-9);

// 3. Coverage can never exceed the ceiling coverage.
for (const p of Z.PRESETS) {
  const out = Z.assess({ target: p.target, weights: p.weights, includeIneligible: true }, data);
  for (const s of out.sites) assert.ok(s.planCoverage <= out.ceilingCoverage + 1e-9, 'coverage <= ceiling');
  for (let i = 1; i < out.sites.length; i++) assert.ok(out.sites[i - 1].planCoverage >= out.sites[i].planCoverage, 'sorted');
  const elig = Z.assess({ target: p.target, weights: p.weights }, data);
  assert.ok(elig.sites.every(s => s.cell.eligible === true), 'only eligible cells by default');
  const top = elig.sites[0];
  console.log(`${p.name.padEnd(24)} target=${p.target.padEnd(27)} eligible=${String(elig.sites.length).padStart(2)}/${out.sites.length}` +
    `  best=${top ? (top.planCoverage * 100).toFixed(0) + '% at ' + top.cell.lat + ',' + top.cell.lon : 'none'}` +
    `  ceiling=${(out.ceilingCoverage * 100).toFixed(0)}%  space-only=${(out.spaceOnlyShare * 100).toFixed(0)}%`);
}

// 4. Bad input is rejected.
assert.throws(() => Z.assess({ target: 'Nowhere', weights: { mobility: 1 } }, data));
assert.throws(() => Z.normaliseWeights({}));
console.log('all tests passed');
