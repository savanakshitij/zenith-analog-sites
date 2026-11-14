/*
 * Mission-coverage engine: Zenith.assess(plan, data) -> report. This is the engine the app runs on.
 *
 * It stands in for the team's own engine, which is NOT wired in: that one reports a different data
 * shape, so it cannot just be dropped in. To switch to it, adapt its output to the report below in
 * runEngine() in js/app.js.
 *
 *   plan   = { target: "jezero", subsystems: ["rover", "drill", ...] }
 *   data   = window.ZENITH_DATA  (built by tools/build_data.py)
 *   report = {
 *     target,
 *     ranked: [{ site, overall, subsystems: {id: 0..1}, stability, tag }],
 *     cannotTest: [{ what, target, earth }]
 *   }
 */
(function () {
  // Which environment dimensions each subsystem needs to be rehearsed (weights sum to 1).
  const SUBSYSTEMS = {
    rover:    { label: "Rover & mobility",     dims: { terrain: 0.6, surface: 0.2, aridity: 0.2 } },
    drill:    { label: "Drill & ice mining",   dims: { ice: 0.4, geology: 0.3, thermal: 0.3 } },
    habitat:  { label: "Habitat & shelter",    dims: { thermal: 0.6, aridity: 0.2, terrain: 0.2 } },
    eva:      { label: "Crew & spacewalks",    dims: { thermal: 0.4, terrain: 0.4, illumination: 0.2 } },
    power:    { label: "Solar power",          dims: { illumination: 0.6, surface: 0.2, aridity: 0.2 } },
    science:  { label: "Sampling & science",   dims: { geology: 0.5, aridity: 0.25, surface: 0.25 } },
    landing:  { label: "Landing & ascent",     dims: { terrain: 0.8, surface: 0.2 } },
  };

  function subsystemScore(dims, need) {
    let s = 0, w = 0;
    for (const [d, wt] of Object.entries(need)) {
      const v = dims[d];
      if (v == null) continue;                    // missing data is skipped, not filled
      s += v * wt; w += wt;
    }
    return w ? s / w : null;
  }

  function cannotTest(t) {
    const out = [];
    const K = k => `${Math.round(k)} K (${Math.round(k - 273.15)} °C)`;
    for (const r of t.not_matchable) {
      const label = { gravity: "Gravity", air_pressure: "Air pressure", surface_radiation: "Surface radiation", day_length: "Day length" }[r.parameter] || r.parameter;
      const earth = { gravity: "9.81 m/s²", air_pressure: "1013 mbar", surface_radiation: "~0.1 µSv/h", day_length: "24 h" }[r.parameter] || "";
      out.push({ what: label, target: r.value, earth });
    }
    const oor = t.out_of_earth_range || {};
    if (oor.temp_min_K) {
      const o = oor.temp_min_K;
      out.push({ what: "Coldest temperature", target: K(o.target), earth: `coldest bare ground: ${K(o.earth_edge)}` });
    }
    if (oor.temp_daynight_range_K) {
      const o = oor.temp_daynight_range_K;
      out.push({ what: "Day–night swing", target: `${Math.round(o.target)} K`, earth: `largest on Earth: ${Math.round(o.earth_edge)} K` });
    }
    for (const [f, label] of [["slope_deg", "Slopes"], ["roughness_tri_m", "Roughness"]]) {
      const o = oor[f];
      if (o) out.push({ what: label, target: `${Math.round(o.target)}${f === "slope_deg" ? "°" : " m"}`, earth: `Earth max ${Math.round(o.earth_edge)}${f === "slope_deg" ? "°" : " m"}` });
    }
    return out;
  }

  function assess(plan, data) {
    const t = data.targets[plan.target];
    if (!t) throw new Error("unknown target " + plan.target);
    const subs = (plan.subsystems && plan.subsystems.length ? plan.subsystems : ["rover", "habitat"]).filter(s => SUBSYSTEMS[s]);
    const ranked = t.candidates.filter(c => c.eligible).map(c => {
      const per = {};
      for (const s of subs) per[s] = subsystemScore(c.dims, SUBSYSTEMS[s].dims);
      const vals = Object.values(per).filter(v => v != null);
      const overall = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { site: c, overall, subsystems: per, stability: c.stability, tag: c.kind === "known" || c.kind === "known-area" ? "known" : c.kind === "gem" ? "gem" : "unlisted" };
    }).sort((a, b) => b.overall - a.overall);
    return { target: t, ranked, cannotTest: cannotTest(t) };
  }

  window.Zenith = { assess, SUBSYSTEMS };
})();
