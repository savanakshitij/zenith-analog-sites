/*
 * Zenith mission-plan layer.
 * Turns a mission plan into a coverage report: which Earth site can test
 * which part of the plan, and which parts can only be tested in space.
 *
 * Works in the browser (window.Zenith) and in Node (module.exports).
 * Written with AI assistance (Claude), reviewed by Team Zenith.
 */
(function (root) {
  'use strict';

  /*
   * Subsystems of a mission plan.
   *  dims:    which of the pipeline's five dimension scores feed this subsystem
   *  ceiling: the most an Earth field test can validate for this subsystem (0..1).
   *           These are TEAM ASSUMPTIONS, shown openly in the UI.
   *  kind:    'scored'       = computed from data
   *           'not_assessed' = no data layer yet, counts as 0 and is flagged
   *           'space_only'   = cannot be tested on Earth, always 0
   */
  var SUBSYSTEMS = [
    { id: 'mobility', label: 'Mobility and landing', dims: ['terrain'], ceiling: 0.8, kind: 'scored',
      why: 'Slopes and rough ground are real on Earth, but gravity changes traction and dust behaviour.' },
    { id: 'thermal', label: 'Thermal', dims: ['thermal'], ceiling: 0.9, kind: 'scored',
      why: 'Cold-soak and day/night cycling can be field tested where temperatures are close.' },
    { id: 'resources', label: 'Ice and resources', dims: ['ice'], ceiling: 0.7, kind: 'scored',
      why: 'Drilling into frozen ground and ice handling can be rehearsed, but Earth ice is a different form than lunar or Martian ice.' },
    { id: 'surface', label: 'Surface, dust and rock', dims: ['aridity', 'surface', 'geology'], ceiling: 0.6, kind: 'scored',
      why: 'Dry, bare ground of the right rock type behaves similarly, but regolith chemistry and grain shape differ.' },
    { id: 'illumination', label: 'Illumination and power', dims: ['illumination'], ceiling: 0.5, kind: 'scored',
      why: 'Sun angle and shadow length can be matched by latitude. Sunlight strength and day length cannot (Mars gets 43% of Earth\'s sunlight, a lunar day lasts 29.5 Earth days).' },
    { id: 'gravity', label: 'Gravity', dims: [], ceiling: 0, kind: 'space_only',
      why: 'Earth gravity cannot be changed in the field.' },
    { id: 'pressure', label: 'Vacuum / atmosphere', dims: [], ceiling: 0, kind: 'space_only',
      why: 'No place on Earth has lunar vacuum or Mars-level pressure.' },
    { id: 'radiation', label: 'Radiation', dims: [], ceiling: 0, kind: 'space_only',
      why: 'Earth\'s atmosphere and magnetic field block the radiation found on the Moon and Mars.' }
  ];

  /*
   * Mission presets. Weights say how much of the plan's risk sits in each
   * subsystem (they are normalised, so only the proportions matter).
   * They were set from what each mission needs, before looking at rankings.
   * Illustrative values, not NASA figures.
   */
  var PRESETS = [
    { id: 'lunar_rover', name: 'Lunar south pole rover', target: 'Shackleton crater rim',
      summary: 'Drive a rover along a crater rim near the lunar south pole.',
      weights: { mobility: 30, thermal: 20, surface: 10, resources: 5, illumination: 10, gravity: 10, pressure: 10, radiation: 5 } },
    { id: 'mars_ice', name: 'Mars ice drilling', target: 'Arcadia Planitia',
      summary: 'Drill for shallow ground ice on the northern plains of Mars.',
      weights: { resources: 30, thermal: 20, mobility: 10, surface: 10, illumination: 5, gravity: 10, pressure: 10, radiation: 5 } },
    { id: 'lava_tube', name: 'Lava tube habitat', target: 'Marius Hills lava-tube pit',
      summary: 'Reach and set up a shelter at a lava-tube skylight on the Moon.',
      weights: { mobility: 20, surface: 15, thermal: 15, resources: 0, illumination: 10, gravity: 10, pressure: 15, radiation: 15 } },
    { id: 'mars_rover', name: 'Mars rover science ops', target: 'Jezero crater',
      summary: 'Run rover traverses and sampling in an ancient crater lake bed.',
      weights: { surface: 25, mobility: 25, thermal: 15, resources: 0, illumination: 10, gravity: 10, pressure: 10, radiation: 5 } }
  ];

  function subsystem(id) {
    for (var i = 0; i < SUBSYSTEMS.length; i++) if (SUBSYSTEMS[i].id === id) return SUBSYSTEMS[i];
    return null;
  }

  function normaliseWeights(weights) {
    var total = 0, out = {};
    SUBSYSTEMS.forEach(function (s) { var w = Math.max(0, Number(weights[s.id]) || 0); out[s.id] = w; total += w; });
    if (total === 0) throw new Error('A plan needs at least one subsystem weight above zero.');
    SUBSYSTEMS.forEach(function (s) { out[s.id] = out[s.id] / total; });
    return out;
  }

  /* Mean of the dimension scores a subsystem uses. null if a score is missing. */
  function matchFor(sub, dims) {
    if (sub.kind !== 'scored') return null;
    var sum = 0;
    for (var i = 0; i < sub.dims.length; i++) {
      var v = dims[sub.dims[i]];
      if (typeof v !== 'number' || isNaN(v)) return null;
      sum += v;
    }
    return sum / sub.dims.length;
  }

  /*
   * Coverage of one Earth cell for one plan.
   *   coverage(subsystem) = match x ceiling
   *   plan coverage       = sum(weight x coverage)   (weights sum to 1)
   */
  function assessCell(cell, weights) {
    var w = normaliseWeights(weights), total = 0, rows = [];
    SUBSYSTEMS.forEach(function (s) {
      var match = matchFor(s, cell.dims);
      var cov = match === null ? 0 : match * s.ceiling;
      total += w[s.id] * cov;
      rows.push({ id: s.id, label: s.label, kind: s.kind, weight: w[s.id], match: match,
                  ceiling: s.ceiling, coverage: cov, why: s.why });
    });
    var scored = rows.filter(function (r) { return r.kind === 'scored' && r.weight > 0; });
    scored.sort(function (a, b) { return b.coverage - a.coverage; });
    return {
      cell: cell,
      planCoverage: total,
      subsystems: rows,
      strongest: scored.length ? scored[0] : null,
      weakest: scored.length ? scored[scored.length - 1] : null
    };
  }

  /* The best any Earth site could reach for this plan, given the ceilings. */
  function ceilingCoverage(weights) {
    var w = normaliseWeights(weights), total = 0;
    SUBSYSTEMS.forEach(function (s) { if (s.kind === 'scored') total += w[s.id] * s.ceiling; });
    return total;
  }

  /* Share of the plan's risk that no Earth site can test. */
  function spaceOnlyShare(weights) {
    var w = normaliseWeights(weights), total = 0;
    SUBSYSTEMS.forEach(function (s) { if (s.kind === 'space_only') total += w[s.id]; });
    return total;
  }

  function km(a, b) {
    var r = Math.PI / 180, p1 = a.lat * r, p2 = b.lat * r;
    var h = Math.pow(Math.sin((p2 - p1) / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin((b.lon - a.lon) * r / 2), 2);
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  }

  /* Keep the best cell of each neighbourhood, so the list is not thirty adjacent cells. */
  function thin(sorted, minKm) {
    var kept = [];
    sorted.forEach(function (r) {
      for (var i = 0; i < kept.length; i++) if (km(kept[i].cell, r.cell) < minKm) return;
      kept.push(r);
    });
    return kept;
  }

  function pct(x) { return Math.round(x * 100) + '%'; }

  function verdict(result, weights) {
    var w = normaliseWeights(weights);
    var spaceOnly = SUBSYSTEMS.filter(function (s) { return s.kind === 'space_only' && w[s.id] > 0; })
      .map(function (s) { return s.label.toLowerCase(); });
    var text = 'This site can validate about ' + pct(result.planCoverage) + ' of the plan\'s risk.';
    if (result.strongest) text += ' Strongest: ' + result.strongest.label.toLowerCase() + ' (' + pct(result.strongest.coverage) + ').';
    if (result.weakest && result.weakest !== result.strongest) text += ' Weakest: ' + result.weakest.label.toLowerCase() + ' (' + pct(result.weakest.coverage) + ').';
    if (spaceOnly.length) text += ' Not testable on Earth: ' + spaceOnly.join(', ') + '.';
    return text;
  }

  /*
   * Main entry point.
   *   plan = { target: 'Jezero crater', weights: {...}, includeIneligible: false }
   *   data = contents of data.json
   * Returns ranked Earth sites for the plan plus everything the UI needs.
   */
  function assess(plan, data) {
    var target = data.targets[plan.target];
    if (!target) throw new Error('Unknown target: ' + plan.target);
    var all = target.cells.map(function (c) { return assessCell(c, plan.weights); });
    all.forEach(function (r) { r.verdict = verdict(r, plan.weights); });
    all.sort(function (a, b) { return b.planCoverage - a.planCoverage; });
    var spacing = plan.minSpacingKm === undefined ? 150 : plan.minSpacingKm;
    if (spacing > 0) all = thin(all, spacing);
    var eligible = all.filter(function (r) { return r.cell.eligible === true; });
    var excluded = all.filter(function (r) { return r.cell.eligible !== true; });
    var known = target.known_sites.map(function (k) {
      var r = assessCell({ dims: k.dims }, plan.weights);
      return { site: k.site, percentile: k.percentile, planCoverage: r.planCoverage, subsystems: r.subsystems };
    }).sort(function (a, b) { return b.planCoverage - a.planCoverage; });
    return {
      target: plan.target,
      body: target.body,
      weights: normaliseWeights(plan.weights),
      ceilingCoverage: ceilingCoverage(plan.weights),
      spaceOnlyShare: spaceOnlyShare(plan.weights),
      sites: plan.includeIneligible ? all : eligible,
      excluded: excluded,
      knownSites: known,
      targetValues: target.values,
      notMatchable: target.not_matchable
    };
  }

  var api = { SUBSYSTEMS: SUBSYSTEMS, PRESETS: PRESETS, subsystem: subsystem, normaliseWeights: normaliseWeights,
              assessCell: assessCell, ceilingCoverage: ceilingCoverage, spaceOnlyShare: spaceOnlyShare,
              verdict: verdict, assess: assess };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Zenith = api;
})(typeof window !== 'undefined' ? window : this);
