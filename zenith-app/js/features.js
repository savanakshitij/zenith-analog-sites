/* The five extra features. Every number comes from the site's data record. */
(function () {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Sun's declination at mid-month (degrees), simple formula.
  const declination = m => 23.44 * Math.sin((2 * Math.PI * (m * 30.4 + 15 - 81)) / 365);
  function polarNight(lat, m) {
    const d = declination(m);
    return (lat > 0 && lat > 90 + d) || (lat < 0 && lat < -90 + d);
  }

  /* 1. Best time of year: the coldest, driest months with the Sun above the horizon. */
  function bestMonths(site) {
    const mo = site.monthly || {};
    if (!mo.tmin_C || !mo.precip_mm_day) return null;
    const tmin = mo.tmin_C, pr = mo.precip_mm_day;
    const tLo = Math.min(...tmin), tHi = Math.max(...tmin), pHi = Math.max(...pr, 0.01);
    const months = MONTHS.map((name, i) => {
      const cold = tHi > tLo ? (tHi - tmin[i]) / (tHi - tLo) : 1;      // 1 = coldest month
      const dry = 1 - pr[i] / pHi;                                     // 1 = driest month
      const dark = polarNight(site.lat, i);
      return { name, i, tmin: tmin[i], tmax: mo.tmax_C ? mo.tmax_C[i] : null, precip: pr[i], dark, score: dark ? -1 : 0.6 * cold + 0.4 * dry };
    });
    const best = months.filter(m => !m.dark).sort((a, b) => b.score - a.score).slice(0, 3).map(m => m.i).sort((a, b) => a - b);
    months.forEach(m => (m.best = best.includes(m.i)));
    return { months, best, label: rangeLabel(best) };
  }
  function rangeLabel(idx) {
    if (!idx.length) return "none";
    const runs = [];
    let start = idx[0], prev = idx[0];
    for (const i of idx.slice(1).concat([null])) {
      if (i === prev + 1) { prev = i; continue; }
      runs.push(start === prev ? MONTHS[start] : `${MONTHS[start]}–${MONTHS[prev]}`);
      start = prev = i;
    }
    return runs.join(", ");
  }

  /* 4. Hazards and prep: rules on the site's measured values. */
  function hazards(site) {
    const e = site.earth || {}, h = site.hazard || {}, out = [];
    const C = k => Math.round(k - 273.15);
    if (e.temp_min_K != null && e.temp_min_K < 250)
      out.push({ level: e.temp_min_K < 220 ? "high" : "med", risk: `Extreme cold, down to ${C(e.temp_min_K)} °C at the surface`,
        prep: "Battery heaters and insulated packs, cold-rated lubricants and seals, warm-up time before each drive." });
    if (e.temp_daynight_range_K != null && e.temp_daynight_range_K > 20)
      out.push({ level: "med", risk: `Big day–night swing (${Math.round(e.temp_daynight_range_K)} K)`,
        prep: "Thermal-cycling fatigue on joints and solder: check fasteners daily, leave slack in cables." });
    if (h.wind_m_s != null && h.wind_m_s >= 6)
      out.push({ level: h.wind_m_s >= 8 ? "high" : "med", risk: `Strong wind, ${h.wind_m_s.toFixed(1)} m/s on average`,
        prep: "Anchor tents and habitats, stow solar panels and masts in gusts, protect optics from blown grit." });
    if (h.dust_aod != null && h.dust_aod >= 0.2)
      out.push({ level: h.dust_aod >= 0.4 ? "high" : "med", risk: `Dusty air (aerosol optical depth ${h.dust_aod.toFixed(2)})`,
        prep: "Seal joints and connectors, filter air intakes, plan solar-panel cleaning." });
    if (e.slope_deg != null && e.slope_deg >= 6)
      out.push({ level: e.slope_deg >= 10 ? "high" : "med", risk: `Steep ground, ${e.slope_deg.toFixed(1)}° mean slope`,
        prep: "Rollover risk: set tilt limits on rovers, drive slopes head-on, use tethers for crew on foot." });
    if (e.roughness_tri_m != null && e.roughness_tri_m >= 300)
      out.push({ level: "med", risk: `Rugged terrain (ruggedness ${Math.round(e.roughness_tri_m)} m)`,
        prep: "Check wheel and suspension clearance, scout routes from imagery first." });
    if (e.ground_ice_frac != null && e.ground_ice_frac >= 0.5)
      out.push({ level: "med", risk: "Frozen ground or ice",
        prep: "Heated structures can thaw and sink: raise habitats on pads. Good place to test ice drills." });
    if (e.precip_mm_per_yr != null && e.precip_mm_per_yr >= 150)
      out.push({ level: "med", risk: `Rain or snow, ${Math.round(e.precip_mm_per_yr)} mm a year`,
        prep: "Waterproof electronics (IP67), cover hatches, dry gear after each sortie." });
    if (e.albedo_wsa_unitless != null && e.albedo_wsa_unitless >= 0.45)
      out.push({ level: "med", risk: `Bright ground (albedo ${e.albedo_wsa_unitless.toFixed(2)})`,
        prep: "Snow glare can blind cameras and crew: polarising filters, auto-exposure tests, eye protection." });
    if (Math.abs(site.lat) >= 66)
      out.push({ level: "med", risk: "Polar night part of the year and remote logistics",
        prep: "Plan around the dark months shown above; budget for aircraft or ship access and rescue cover." });
    if (!out.length) out.push({ level: "low", risk: "No major hazard flags in the data", prep: "Standard field kit, sun and heat protection." });
    return out;
  }

  function km(a, b, c, d) {
    const r = Math.PI / 180, x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(x));
  }

  window.ZenithFeatures = { bestMonths, hazards, km, MONTHS };
})();
