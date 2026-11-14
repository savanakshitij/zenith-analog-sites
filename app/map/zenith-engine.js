/*
 * Zenith browser engine (data v1.6).
 * Scores any 0.25° land cell on Earth against the seven Moon and Mars targets, in the browser,
 * with the same formula as scoring/score_v16.py. No server needed.
 *
 *   const zen = await ZenithEngine.load('.');            // folder holding earth_cells.bin and engine_params.json
 *   const r = zen.scoreAt(-24.1, -70.0);                   // any latitude and longitude
 *   r.targets[0]   // best-matching target: { id, name, body, score, earthTestableScore, percentile, eligible, dims, ... }
 *
 * Written with AI assistance (Claude), reviewed by Team Zenith.
 */
(function (root) {
  'use strict';

  var ROWS = 720, COLS = 1440, STEP = 0.25;
  var DIM_LABELS = { thermal: 'Temperature', aridity: 'Dryness', terrain: 'Terrain', surface: 'Surface brightness',
                     ice: 'Ice', illumination: 'Sunlight', geology: 'Rock type' };
  var ROCK_NAMES = { su: 'loose sediment', vb: 'basalt', ss: 'sandstone and mudstone', pb: 'gabbro and anorthosite',
                     sm: 'mixed sediment', sc: 'carbonate rock', va: 'acid volcanic rock', mt: 'metamorphic rock', pa: 'granite',
                     vi: 'intermediate volcanic rock', wb: 'water', py: 'pyroclastics', pi: 'intermediate plutonic rock',
                     ev: 'evaporites (salts)', nd: 'unknown', ig: 'ice' };

  function sunNoonMean(lat, tilt) {
    var s = 0, t = tilt * Math.PI / 180;
    for (var k = 0; k < 360; k++) {
      var decl = Math.asin(Math.sin(t) * Math.sin(2 * Math.PI * k / 360)) * 180 / Math.PI;
      s += Math.max(0, 90 - Math.abs(lat - decl));
    }
    return Math.round(s / 360 * 100) / 100;
  }

  function Engine(params, buf) {
    var n = params.n_cells, off = 0, self = this;
    function u16() { var a = new Uint16Array(buf, off, n); off += 2 * n; return a; }
    this.params = params;
    this.n = n;
    this.row = u16();
    this.col = u16();
    this.q = {};
    params.quant.forEach(function (m) { self.q[m.name] = { data: u16(), meta: m }; });
    this.rock = new Uint8Array(buf, off, n); off += n;
    this.flags = new Uint8Array(buf, off, n); off += n;
    if (off !== buf.byteLength) throw new Error('earth_cells.bin has an unexpected size');
    this.index = new Int32Array(ROWS * COLS).fill(-1);
    for (var i = 0; i < n; i++) this.index[this.row[i] * COLS + this.col[i]] = i;
    this.sunByRow = new Float64Array(ROWS);
    for (var r = 0; r < ROWS; r++) this.sunByRow[r] = sunNoonMean(89.875 - r * STEP, params.earth_tilt);
    this.targets = params.targets;
  }

  Engine.prototype.value = function (name, i) {
    var c = this.q[name], v = c.data[i];
    return v === c.meta.missing ? null : v / c.meta.scale + c.meta.offset;
  };

  /* All feature values of one cell, as the scoring uses them. */
  Engine.prototype.features = function (i) {
    var f = {}, self = this;
    this.params.quant.forEach(function (m) { f[m.name] = self.value(m.name, i); });
    f.sun_noon_elev_mean_deg = this.sunByRow[this.row[i]];
    var fl = this.flags[i];
    f.bare = !!(fl & 1); f.icy = !!(fl & 2); f.impact_crater = !!(fl & 4); f.ice_flag = !!(fl & 8);
    f.rock_abbr = this.params.rocks[this.rock[i]];
    f.rock = ROCK_NAMES[f.rock_abbr] || 'unknown';
    return f;
  };

  Engine.prototype.cellIndex = function (lat, lon) {
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    var r = Math.min(ROWS - 1, Math.max(0, Math.floor((90 - lat) / STEP)));
    var c = Math.min(COLS - 1, Math.max(0, Math.floor((lon + 180) / STEP)));
    return this.index[r * COLS + c];
  };

  function tf(name, x, log1p) { return log1p.indexOf(name) >= 0 ? Math.log1p(Math.max(0, x)) : x; }

  function pctFromCdf(cdf, s) {
    if (s <= cdf[0]) return 0;
    if (s >= cdf[cdf.length - 1]) return 100;
    var lo = 0, hi = cdf.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cdf[mid] <= s) lo = mid; else hi = mid; }
    var frac = cdf[hi] === cdf[lo] ? 0 : (s - cdf[lo]) / (cdf[hi] - cdf[lo]);
    return Math.round((lo + frac) / (cdf.length - 1) * 10000) / 100;
  }

  /* Score one cell against one target. weights: optional {thermal: 1, ...}; default equal (the balanced preset). */
  Engine.prototype.scoreCell = function (i, T, f, weights) {
    var P = this.params, dims = {}, missing = [];
    f = f || this.features(i);
    var geology = (T.rock_match.indexOf(f.rock_abbr) >= 0 || (f.impact_crater && T.impact_relevant)) ? 1 : 0;
    P.dims.forEach(function (d) {
      var sims = [];
      P.dimensions[d].forEach(function (name) {
        var def = T.features[name];
        if (!def) return;
        var v = name === 'geology_match' ? geology : f[name];
        if (v === null || v === undefined) { missing.push(name); return; }
        sims.push(Math.exp(-Math.abs(tf(name, v, P.log1p) - def.clamped_target) / def.scale));
      });
      dims[d] = sims.length ? sims.reduce(function (a, b) { return a + b; }, 0) / sims.length : null;
    });
    var complete = missing.length === 0;
    function geo(keep) {
      var sw = 0, sl = 0;
      P.dims.forEach(function (d) {
        if (keep && keep.indexOf(d) < 0) return;
        var w = weights ? (weights[d] || 0) : 1;
        if (!w || dims[d] === null) return;
        sw += w; sl += w * Math.log(Math.max(dims[d], P.floor));
      });
      return sw ? Math.exp(sl / sw) : null;
    }
    var score = complete ? geo(null) : null, et = complete ? geo(T.earth_testable_dims) : null;
    var eligible = complete && (f.bare || (f.icy && T.ice_cells_allowed));
    var reason = '';
    if (!complete) reason = 'missing data: ' + missing.join(', ');
    else if (!eligible) {
      if (f.icy) reason = 'ice sheet or glacier (counts only for targets with ice)';
      else if (f.ndvi_max_unitless !== null && f.ndvi_max_unitless > 0.3) reason = 'vegetated (max NDVI ' + f.ndvi_max_unitless.toFixed(2) + ')';
      else reason = 'only ' + Math.round(f.barren_pct) + '% bare ground';
    }
    return {
      id: T.id, name: T.name, body: T.body, score: score, earthTestableScore: et,
      percentile: eligible && !weights ? pctFromCdf(T.cdf_full, score) : null,
      earthTestablePercentile: eligible && !weights ? pctFromCdf(T.cdf_earth_testable, et) : null,
      eligible: eligible, ineligibleReason: reason, dims: dims, geologyMatch: geology === 1,
      notTestableOnEarth: T.not_testable_on_earth, outOfEarthRange: T.out_of_earth_range, nEligible: T.n_eligible
    };
  };

  /* Score the cell under a latitude/longitude against every target. Sorted best first (eligible before excluded). */
  Engine.prototype.scoreAt = function (lat, lon, weights) {
    var i = this.cellIndex(lat, lon);
    if (i < 0) return { lat: lat, lon: lon, land: false, message: 'No land data here (ocean, or outside the grid).' };
    var f = this.features(i), self = this;
    var res = this.targets.map(function (T) { return self.scoreCell(i, T, f, weights); });
    res.sort(function (a, b) {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return (b.score || 0) - (a.score || 0);
    });
    return { lat: lat, lon: lon, land: true, cellLat: 89.875 - this.row[i] * STEP, cellLon: -179.875 + this.col[i] * STEP,
             features: f, targets: res };
  };

  /* Decoded feature columns, built once, for fast whole-map scoring. */
  Engine.prototype.columns = function () {
    if (this._cols) return this._cols;
    var cols = {}, self = this, n = this.n;
    this.params.quant.forEach(function (m) {
      var src = self.q[m.name].data, a = new Float32Array(n);
      for (var i = 0; i < n; i++) a[i] = src[i] === m.missing ? NaN : src[i] / m.scale + m.offset;
      cols[m.name] = a;
    });
    var sun = new Float32Array(n);
    for (var i = 0; i < n; i++) sun[i] = this.sunByRow[this.row[i]];
    cols.sun_noon_elev_mean_deg = sun;
    this._cols = cols;
    return cols;
  };

  /* Score every land cell for one target, or 'best' for the best eligible target per cell.
     Returns Float32Array aligned with the cell list (NaN = not scored or not eligible). Same formula as scoreCell. */
  Engine.prototype.scoreAll = function (targetId, opts) {
    opts = opts || {};
    var P = this.params, cols = this.columns(), n = this.n, out = new Float32Array(n).fill(NaN), self = this;
    var Ts = targetId === 'best' ? this.targets : this.targets.filter(function (t) { return t.id === targetId; });
    Ts.forEach(function (T) {
      var keep = opts.earthTestable ? T.earth_testable_dims : null;
      var useDims = P.dims.filter(function (d) { return (!keep || keep.indexOf(d) >= 0) && (!opts.weights || opts.weights[d]); });
      var wsum = 0, wts = useDims.map(function (d) { var w = opts.weights ? opts.weights[d] : 1; wsum += w; return w; });
      var rockOk = new Uint8Array(P.rocks.length);
      P.rocks.forEach(function (r, k) { rockOk[k] = T.rock_match.indexOf(r) >= 0 ? 1 : 0; });
      var plan = useDims.map(function (d) {
        return P.dimensions[d].filter(function (name) { return T.features[name]; }).map(function (name) {
          var def = T.features[name];
          return { name: name, col: cols[name], log: P.log1p.indexOf(name) >= 0, t: def.clamped_target, s: def.scale };
        });
      });
      for (var i = 0; i < n; i++) {
        var fl = self.flags[i];
        if (!((fl & 1) || ((fl & 2) && T.ice_cells_allowed))) continue;
        var sl = 0, ok = true;
        for (var k = 0; k < plan.length && ok; k++) {
          var fs = plan[k], sum = 0;
          for (var j = 0; j < fs.length; j++) {
            var v;
            if (fs[j].name === 'geology_match') v = (rockOk[self.rock[i]] || ((fl & 4) && T.impact_relevant)) ? 1 : 0;
            else { v = fs[j].col[i]; if (v !== v) { ok = false; break; } if (fs[j].log) v = Math.log1p(v > 0 ? v : 0); }
            sum += Math.exp(-Math.abs(v - fs[j].t) / fs[j].s);
          }
          var dv = sum / fs.length;
          sl += wts[k] * Math.log(dv > P.floor ? dv : P.floor);
        }
        if (!ok) continue;
        var sc = Math.exp(sl / wsum);
        if (!(sc <= out[i])) out[i] = sc;
      }
    });
    return out;
  };

  /* Latitude and longitude of cell i. */
  Engine.prototype.cellLatLon = function (i) { return [89.875 - this.row[i] * STEP, -179.875 + this.col[i] * STEP]; };

  Engine.prototype.dimLabel = function (d) { return DIM_LABELS[d] || d; };

  function load(base) {
    if (root.ZENITH_EMBED) {  // single-file build: data embedded as base64, works without a server
      var bin = atob(root.ZENITH_EMBED.bin), bytes = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      return Promise.resolve(new Engine(root.ZENITH_EMBED.params, bytes.buffer));
    }
    base = (base || '.').replace(/\/$/, '');
    return Promise.all([
      fetch(base + '/engine_params.json').then(function (r) { if (!r.ok) throw new Error('engine_params.json: ' + r.status); return r.json(); }),
      fetch(base + '/earth_cells.bin').then(function (r) { if (!r.ok) throw new Error('earth_cells.bin: ' + r.status); return r.arrayBuffer(); })
    ]).then(function (x) { return new Engine(x[0], x[1]); });
  }

  var api = { load: load, Engine: Engine, ROWS: ROWS, COLS: COLS, STEP: STEP, ROCK_NAMES: ROCK_NAMES, DIM_LABELS: DIM_LABELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZenithEngine = api;
})(typeof window !== 'undefined' ? window : this);
