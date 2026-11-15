/* "Turn Earth into Mars": a live, step-by-step simulation for the audience.
   Start with every patch of bare ground on Earth. Add the target's conditions one at a time. A place stays in only while
   it matches every condition switched on so far (closeness 0.5 or more on each dimension, same formula as the scores),
   so the count only goes down. Cold goes last by default: it is the one Earth can never match.
   Written with AI assistance (Claude), reviewed by Team Zenith. */
(function () {
  const A = window.ZenithApp, X = A.X, e = A.eng, G = window.ZenithGlobe, M = window.ZenithMission;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const THR = 0.5;
  const ORDER = ["aridity", "terrain", "surface", "ice", "illumination", "geology", "thermal"];
  const NAME = { aridity: "Dryness", terrain: "Terrain", surface: "Ground colour", ice: "Ice", illumination: "Sunlight", geology: "Rock type", thermal: "Cold" };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function says(id, d) {
    const t = X.targets[id], f = t.features, T = A.target(id);
    const rocks = T.rock_match.map(r => ZenithEngine.ROCK_NAMES[r] || r).join(" or ");
    return {
      aridity: `${Math.round(f.precip_mm_per_yr || 0)} mm of rain or snow a year`,
      terrain: `${f.slope_deg.toFixed(1)}° slopes, ${Math.round(f.roughness_tri_m)} m ruggedness`,
      surface: `ground as dark or bright as albedo ${f.albedo_wsa_unitless.toFixed(2)}`,
      ice: (f.ground_ice_frac || 0) >= 0.5 ? "Ice in the ground" : "No ice in the ground",
      illumination: `the Sun ${Math.round(f.sun_noon_elev_mean_deg)}° up at noon`,
      geology: rocks,
      thermal: `nights down to ${Math.round(f.temp_min_K - 273.15)} °C, a ${Math.round(f.temp_daynight_range_K)} K day–night swing`,
    }[d];
  }

  let id = null, on = [], dimS = {}, elig = null, nAll = 0, shown = 0, timer = 0, busy = false;
  const ones = () => { const w = {}; A.DIMS.forEach(d => (w[d] = 0)); return w; };

  function prepare(tid) {
    id = tid; on = []; dimS = {};
    elig = e.scoreAll(id, {});
    nAll = 0; for (let i = 0; i < e.n; i++) if (elig[i] === elig[i]) nAll++;
  }
  function dim(d) { if (!dimS[d]) { const w = ones(); w[d] = 1; dimS[d] = e.scoreAll(id, { weights: w }); } return dimS[d]; }

  // survivors, the combined score over the conditions switched on, the best survivor and the best cell overall
  function state() {
    // a condition past anything on Earth (not in the target's Earth-testable dimensions) lets no place through
    const beyond = on.filter(d => !A.target(id).earth_testable_dims.includes(d));
    const ss = on.map(dim), w = ones(); on.forEach(d => (w[d] = 1));
    const C = on.length ? e.scoreAll(id, { weights: w }) : elig;
    const alive = new Uint8Array(e.n); let n = 0, bi = -1, bs = -1, oi = -1, os = -1;
    for (let i = 0; i < e.n; i++) {
      if (elig[i] !== elig[i]) continue;
      if (C[i] > os) { os = C[i]; oi = i; }
      let ok = beyond.length ? 0 : 1; if (ok) for (const s of ss) if (!(s[i] >= THR)) { ok = 0; break; }
      if (ok) { alive[i] = 1; n++; if (C[i] > bs) { bs = C[i]; bi = i; } }
    }
    return { alive, n, C, best: bi, bestScore: bs, overall: oi, overallScore: os };
  }

  const RAMP = [[30, 128, 146], [120, 200, 112], [250, 212, 72], [255, 122, 40]];
  function col(v) { const x = Math.max(0, Math.min(1, v)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i; return RAMP[i].map((c, k) => Math.round(c + (RAMP[i + 1][k] - c) * f)); }
  function paint(st) {
    if (!G.hasGL()) return;
    const buf = new Uint8Array(1440 * 720 * 4);
    for (let i = 0; i < e.n; i++) {
      if (elig[i] !== elig[i]) continue;
      const o = (e.row[i] * 1440 + e.col[i]) * 4;
      if (st.alive[i]) { const c = on.length ? col((st.C[i] - THR) / (1 - THR)) : [120, 200, 112]; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 240; }
      else { buf[o] = buf[o + 1] = buf[o + 2] = 90; buf[o + 3] = 70; }
    }
    G.setHeat(buf); G.heat(true);
  }

  function count(to) {
    const el = $("#simN"), from = shown, t0 = performance.now(), ms = reduce ? 0 : 900;
    shown = to;
    const tick = t => { const k = ms ? Math.min(1, (t - t0) / ms) : 1, v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); el.textContent = v.toLocaleString("en"); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  function place(i) { const [la, lo] = e.cellLatLon(i); return { lat: la, lon: lo, name: M.region(la, lo) || G.countryOf(la, lo) || "Unnamed ground" }; }

  function render(last) {
    const st = state(), T = A.target(id), done = on.length === ORDER.length;
    paint(st); count(st.n);
    const pct = st.n / nAll * 100;
    $("#simPct").textContent = on.length ? `${pct < 0.1 && st.n ? "<0.1" : pct.toFixed(pct < 10 ? 1 : 0)}% of Earth's bare ground` : "every patch of bare ground we score";
    let line;
    if (!on.length) line = `Press <b>Add a condition</b>, or let the room pick one below.`;
    else if (last && st.n === 0) line = `<b>${esc(NAME[last])}</b> · ${esc(says(id, last))}. <b>No place on Earth survives.</b>${!T.earth_testable_dims.includes(last) ? ` Earth is never ${last === "thermal" ? "this cold" : "like this"}, so this gets tested in a chamber.` : ""}`;
    else if (last) line = `<b>${esc(NAME[last])}</b> · ${esc(says(id, last))}.`;
    else line = st.n === 0 ? `Nothing on Earth passes ${on.map(d => NAME[d].toLowerCase()).join(" and ")}. Click a condition again to take it out.` : `Took that condition out.`;
    const bi = st.n ? st.best : st.overall, p = bi >= 0 ? place(bi) : null;
    $("#simLine").innerHTML = line;
    $("#simBest").innerHTML = p && on.length ? `${st.n ? "Best place still in" : "Closest anyway"}: <b>${esc(p.name)}</b> <span>${(st.n ? st.bestScore : st.overallScore).toFixed(2)}</span>` : "";
    document.querySelectorAll("#simChips [data-d]").forEach(b => b.setAttribute("aria-pressed", on.includes(b.dataset.d)));
    $("#simNext").disabled = done; $("#simPlay").disabled = done;
    $("#simEnd").hidden = !done;
    if (done) $("#simEnd").textContent = st.n ? `Open the full result: ${st.n} place${st.n === 1 ? "" : "s"} pass everything` : "Open the full result for the closest places";
    if (p && on.length) G.flyTo(p.lat, p.lon, { cinematic: false });
    $("#simTarget").textContent = `${T.name}, ${T.body}`;
  }

  function add(d) {
    if (busy) return;
    if (on.includes(d)) on = on.filter(x => x !== d); else on.push(d);
    busy = true; $("#sim").classList.add("busy");
    setTimeout(() => { try { render(on.includes(d) ? d : null); } finally { busy = false; $("#sim").classList.remove("busy"); } }, 30);
  }
  const next = () => { const d = ORDER.find(x => !on.includes(x)); if (d) add(d); };
  function play() {
    clearInterval(timer);
    if ($("#simPlay").getAttribute("aria-pressed") === "true") { $("#simPlay").setAttribute("aria-pressed", "false"); $("#simPlay").textContent = "Play ▶"; return; }
    $("#simPlay").setAttribute("aria-pressed", "true"); $("#simPlay").textContent = "Pause ❚❚";
    next();
    timer = setInterval(() => { if (on.length === ORDER.length) { clearInterval(timer); $("#simPlay").setAttribute("aria-pressed", "false"); $("#simPlay").textContent = "Play ▶"; return; } next(); }, 3200);
  }

  function start(tid) {
    window.ZenithUI.closeSheet && window.ZenithUI.closeSheet();
    prepare(tid); shown = 0;
    document.body.classList.add("is-sim");
    $("#sim").hidden = false;
    $("#simChips").innerHTML = ORDER.map(d => `<button class="chip" data-d="${d}" aria-pressed="false">${NAME[d]}</button>`).join("");
    $("#simPlay").setAttribute("aria-pressed", "false"); $("#simPlay").textContent = "Play ▶";
    G.setMarkers([]); G.spin(false); G.zoom(1);
    G.setLayout({ cx: 0.5, cy: innerWidth <= 900 ? 0.36 : 0.42, r: innerWidth <= 900 ? 0.4 : 0.34, maxX: 1 });
    render(null);
  }
  function stop(open) {
    clearInterval(timer);
    document.body.classList.remove("is-sim"); $("#sim").hidden = true;
    const UI = window.ZenithUI;
    if (open) {
      const ex = M.EXAMPLES.find(m => m.target === id), w = {}; A.DIMS.forEach(d => (w[d] = 1));
      UI.go(`Earth as ${A.target(id).name}`, { target: id, weights: w, subsystems: ex ? ex.subsystems.slice() : null, why: "the simulation" });
    } else UI.restore();
  }

  function sheet() {
    return `<h2>Turn Earth into Mars</h2>
      <p class="lede">A live simulation for the room. We start with every patch of bare ground on Earth, then add one place's conditions one at a time. A place stays in only while it matches every condition so far. Watch the planet go dark.</p>
      <div class="sim-pick">${e.targets.map(t => `<button class="answer" data-sim="${t.id}"><span class="kicker">${t.body}</span><b>${esc(t.name)}</b></button>`).join("")}</div>
      <p class="note">"Matches" means a closeness of ${THR} or more on that condition, from the same formula as the scores. Cold goes last unless the room picks it earlier: nothing on Earth is as cold as the Moon or Mars.</p>`;
  }

  document.body.insertAdjacentHTML("beforeend", `<section id="sim" class="sim" hidden aria-live="polite">
    <button class="x" id="simX" aria-label="Stop the simulation">×</button>
    <p class="kicker">Turning Earth into <span id="simTarget"></span></p>
    <div class="sim-count"><b id="simN">0</b><span>places still match<small id="simPct"></small></span></div>
    <p class="sim-line" id="simLine"></p>
    <p class="sim-best" id="simBest"></p>
    <div class="plan-row" id="simChips"></div>
    <div class="sim-btns"><button class="cta" id="simNext">Add a condition ›</button><button class="chip" id="simPlay">Play ▶</button></div>
    <button class="cta" id="simEnd" hidden></button>
  </section>`);
  $("#simChips").addEventListener("click", ev => { const b = ev.target.closest("[data-d]"); if (b) add(b.dataset.d); });
  $("#simNext").onclick = next; $("#simPlay").onclick = play; $("#simX").onclick = () => stop(false); $("#simEnd").onclick = () => stop(true);
  addEventListener("keydown", ev => { if (!$("#sim").hidden && (ev.key === " " || ev.key === "ArrowRight") && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(document.activeElement.tagName)) { ev.preventDefault(); next(); } if (!$("#sim").hidden && ev.key === "Escape") stop(false); });

  window.ZenithSim = { sheet, start, stop, bind: () => document.querySelectorAll("[data-sim]").forEach(b => (b.onclick = () => start(b.dataset.sim))) };
})();
