/* Page logic. Scores come from js/bridge.js (the v1.6 engine). Written with AI assistance (Claude), reviewed by Team Zenith. */
(function () {
  const A = window.ZenithApp, X = A.X;
  const { LIBRARY, EXAMPLES, parse, region } = window.ZenithMission;
  const F = window.ZenithFeatures, G = window.ZenithGlobe;
  const IMG = window.ANALOG_IMAGES || { BASE_IMAGES: {}, SITE_IMAGES: {} };
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const topFmt = p => { const t = Math.max(0.01, 100 - p); return t < 1 ? t.toFixed(2) : t < 10 ? t.toFixed(1) : String(Math.round(t)); };
  const coord = (la, lo) => `${Math.abs(la).toFixed(2)}°${la >= 0 ? "N" : "S"}, ${Math.abs(lo).toFixed(2)}°${lo >= 0 ? "E" : "W"}`;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DIM_LABEL = { thermal: "Cold", aridity: "Dryness", terrain: "Terrain", surface: "Surface", ice: "Ice", illumination: "Sunlight", geology: "Rock type" };

  // Types text into el, one character at a time, with a blinking cursor.
  // Screen readers get the whole text at once from a hidden copy.
  function typeText(el, text, { delay = 0, speed = 28 } = {}) {
    text = String(text == null ? "" : text);
    const run = (el._type = (el._type || 0) + 1);
    if (reduce || !text) { el.textContent = text; return; }
    el.innerHTML = `<span class="sr">${esc(text)}</span><span class="tw" aria-hidden="true"></span>`;
    const tw = el.lastChild, start = performance.now() + delay;
    let shown = -1;
    el.classList.add("typing");
    const tick = now => {
      if (el._type !== run) return; // newer text took over
      const n = Math.max(0, Math.min(text.length, Math.floor((now - start) / speed)));
      if (n !== shown) { shown = n; tw.textContent = text.slice(0, n); }
      if (n < text.length) requestAnimationFrame(tick);
      else setTimeout(() => { if (el._type === run) el.classList.remove("typing"); }, 700);
    };
    requestAnimationFrame(tick);
  }

  let S = { text: "", plan: null, report: null, idx: 0, tab: "overview", pick: null, heat: false, flags: false };

  /* ---------- names ---------- */
  const cc = new Map();
  const country = s => { const k = s.lat + "," + s.lon; if (!cc.has(k)) cc.set(k, G.countryOf(s.lat, s.lon)); return cc.get(k); };
  function nameOf(s) {
    if (s.tags.impact_crater) return `${s.tags.impact_crater} crater`;
    if (s.nearest_known.km < 40) return s.nearest_known.name;
    return region(s.lat, s.lon) || (s.nearest_known.km < 150 ? `Near ${s.nearest_known.name.split(",")[0]}` : country(s)) || "Unnamed ground";
  }
  const placeOf = s => [country(s), coord(s.lat, s.lon)].filter(Boolean).join(", ");

  /* ---------- search ---------- */
  const q = $("#q"), sug = $("#suggest");
  let active = -1;
  function suggestions() {
    const v = q.value.trim().toLowerCase();
    const hit = m => !v || m.title.toLowerCase().includes(v) || A.target(m.target).name.toLowerCase().includes(v) || A.target(m.target).body.toLowerCase().includes(v) || (m.real && (m.real.mission + m.real.agency).toLowerCase().includes(v));
    const items = LIBRARY.filter(hit);
    if (v && !items.length) return parse(v).unknown ? [{ none: true, title: q.value.trim() }, { conditions: true, title: "Set your own conditions with sliders instead" }] : [{ free: true, title: q.value.trim() }];
    return (v ? [] : [{ conditions: true, title: "Set your own conditions with sliders" }]).concat(items);
  }
  function showSuggest() {
    const items = suggestions(); active = -1;
    let html = "", group = null;
    items.forEach((m, i) => {
      const g = m.free || m.none || m.conditions ? null : m.real ? "Upcoming missions" : "Example missions";
      if (g && g !== group) { html += `<li class="grp">${g}</li>`; group = g; }
      html += `<li><button type="button" data-i="${i}" role="option"><span class="body">${m.none ? "?" : m.conditions ? "DIY" : m.free ? "GO" : esc(m.real ? m.tag : A.target(m.target).body.toUpperCase())}</span><span>${m.none ? `No Moon or Mars place in “${esc(m.title)}”<small>Try a site, like Jezero, the south pole or a lava tube</small>` : esc(m.title)}${m.real ? `<small>${esc(m.real.status)}</small>` : ""}</span></button></li>`;
    });
    sug.innerHTML = html; sug.hidden = false; sug._items = items;
    document.body.classList.add("searching"); // the ground window and tools step aside while the list is open
  }
  const hideSuggest = () => { sug.hidden = true; document.body.classList.remove("searching"); };
  q.addEventListener("focus", showSuggest);
  q.addEventListener("input", showSuggest);
  q.addEventListener("keydown", e => {
    const n = (sug._items || []).length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (sug.hidden) showSuggest();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      sug.querySelectorAll("button").forEach((b, i) => { b.setAttribute("aria-selected", i === active); if (i === active) b.scrollIntoView({ block: "nearest" }); });
    } else if (e.key === "Escape") hideSuggest();
  });
  sug.addEventListener("mousedown", e => e.preventDefault());
  sug.addEventListener("click", e => { const b = e.target.closest("button"); if (b) pick(sug._items[+b.dataset.i]); });
  q.addEventListener("blur", () => setTimeout(hideSuggest, 100));
  $("#search").addEventListener("submit", e => {
    e.preventDefault();
    if (active >= 0 && sug._items) return pick(sug._items[active]);
    const text = q.value.trim();
    if (!text) { q.focus(); return showSuggest(); }
    const lib = LIBRARY.find(m => m.title.toLowerCase() === text.toLowerCase());
    lib ? pick(lib) : run(text);
  });
  // Free text: if nothing in it names a Moon or Mars place or mission part, say so instead of flying somewhere.
  function run(text) {
    const plan = parse(text);
    if (plan.unknown) { showSuggest(); return toast(`We can't read a Moon or Mars place in “${text}”. Name a site (Jezero, Gale, the lunar south pole, a lava tube), pick a mission from the list, or set your own conditions.`, 7000); }
    go(text, plan);
    if (plan.noPlace) toast(`No Moon or Mars place named, so this is our default Mars site, ${A.target(plan.target).name}. Change it under Mission plan.`, 6000);
  }
  function pick(m) {
    if (!m) return;
    if (m.none) return run(m.title);
    if (m.conditions) { hideSuggest(); return openConditions(); }
    if (m.free) return run(m.title);
    q.value = m.title;
    go(m.title, m.real ? { target: m.target, weights: m.weights, real: m.real } : { target: m.target, subsystems: m.subsystems.slice() });
  }

  // Home screen: the empty search box types example missions, then erases them, to show what to ask.
  (function attract() {
    if (reduce) return;
    const base = q.placeholder;
    let mi = 0, ci = 0, dir = 1;
    const step = () => {
      if (document.activeElement === q || q.value || !document.body.classList.contains("is-home")) {
        q.placeholder = base; ci = 0; dir = 1;
        return setTimeout(step, 800);
      }
      const t = "Try: " + LIBRARY[mi].title;
      if (dir > 0) {
        ci++; q.placeholder = t.slice(0, ci) + "▌";
        if (ci >= t.length) { dir = -1; return setTimeout(step, 2400); }
        return setTimeout(step, 42 + Math.random() * 40); // uneven, like a person typing
      }
      ci = Math.max(0, ci - 3); q.placeholder = t.slice(0, ci) + "▌";
      if (!ci) { dir = 1; mi = (mi + 1) % LIBRARY.length; return setTimeout(step, 450); }
      setTimeout(step, 16);
    };
    setTimeout(step, 1800);
  })();

  /* ---------- run ---------- */
  const replay = el => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; };
  let flight = 0;
  function go(text, plan) {
    hideSuggest(); q.blur(); closeSheet();
    S.text = text; S.idx = 0; S.tab = "overview"; S.pick = null;
    S.plan = { target: plan.target, subsystems: plan.subsystems || A.partsFromWeights(plan.weights), weights: plan.weights || null, real: plan.real || null, why: plan.why, guessed: plan.guessed };
    S.report = A.assess(S.plan);
    // a new search is a camera flight, a short title card, then the panel
    const id = ++flight, cine = !reduce, res = $("#result"), body = document.body;
    clearTimeout(flightEnd);
    body.classList.remove("is-home", "card-in");
    body.classList.add("is-result");
    body.classList.toggle("is-flying", cine);
    res.hidden = false; $("#tools").hidden = false;
    res.classList.toggle("await", cine);
    if (!cine) replay(res);
    layout();
    markers(); if (S.heat) paintHeat();
    const ms = show(0, { cine }) || 0;
    if (cine && S.report.ranked[0]) {
      const r = S.report.ranked[0], t = S.report.target, card = ms * 0.5;
      // the title card types itself out at the bottom left; it is gone again when the panel is up
      typeText($("#cEyebrow"), `Earth test site for ${t.name}, ${t.body}`, { delay: card, speed: 12 });
      typeText($("#cName"), nameOf(r.site), { delay: card + 350, speed: 40 });
      typeText($("#cCoord"), placeOf(r.site), { delay: card + 350 + 40 * nameOf(r.site).length + 100, speed: 12 });
      const later = (f, at) => setTimeout(() => { if (id === flight) f(); }, at);
      later(() => body.classList.add("card-in"), card);
      later(() => { res.classList.remove("await"); replay(res); }, ms * 0.8);
      later(() => body.classList.remove("card-in"), ms * 0.8 + 400);
      // hard stop: whatever happens, the flight state is cleared (a newer go() clears and re-sets it itself)
      flightEnd = setTimeout(() => { if (id === flight) endFlight(); }, ms * 0.8 + 900);
    } else endFlight();
  }
  let flightEnd = 0;
  function endFlight() { document.body.classList.remove("is-flying", "card-in"); $("#result").classList.remove("await"); }
  function rerun() { S.report = A.assess(S.plan); S.idx = 0; S.pick = null; markers(); if (S.heat) paintHeat(); show(0); }
  function markers() {
    const m = S.report.ranked.map((r, i) => ({ id: r.site.id, lat: r.site.lat, lon: r.site.lon, rank: i + 1, label: nameOf(r.site) }));
    if (S.pick) m.push({ id: S.pick.site.id, lat: S.pick.site.lat, lon: S.pick.site.lon, rank: 0, pick: true, label: "Your pick" });
    G.setMarkers(m);
  }
  const current = () => S.pick || S.report.ranked[S.idx];

  function countUp(el, to, delay = 0) {
    if (reduce) { el.textContent = to.toFixed(2); return; }
    const run = (el._run = (el._run || 0) + 1);
    if (delay) el.textContent = "0.00";
    const from = parseFloat(el.textContent) || 0, t0 = performance.now() + delay, ms = 800;
    const tick = t => {
      if (el._run !== run) return; // a newer count took over
      const k = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (from + (to - from) * e).toFixed(2);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Shows ranked site i (or the clicked place when i is null) and flies the globe to it; returns the flight time in ms.
  function show(i, opts = {}) {
    if (opts === false) opts = { fly: false };
    const R = S.report;
    if (i != null) { S.pick = null; S.idx = Math.max(0, Math.min(R.ranked.length - 1, i)); markers(); }
    const r = current(); if (!r) return 0;
    const s = r.site, t = R.target;
    $("#rSub").innerHTML = s.eligible ? `top <b>${topFmt(s.percentile)}%</b> of ${R.pass.n.toLocaleString("en")} scored cells` : `not ranked: ${esc(s.why_not)}`;
    const isFresh = !S.pick && S.idx === R.fresh;
    $("#rRank").textContent = S.pick ? (s.eligible ? `Your pick, #${s.rank.toLocaleString("en")} of ${R.pass.n.toLocaleString("en")}` : "Your pick")
      : isFresh && r.extra ? `Best new candidate, #${s.rank.toLocaleString("en")}` : `${S.idx + 1} of ${R.ranked.length}`;
    $("#prev").disabled = !S.pick && S.idx === 0; $("#next").disabled = !S.pick && S.idx === R.ranked.length - 1;
    const b = [];
    const nk = s.nearest_known;
    if (nk.km < 150) b.push(`<span class="tag" title="${nk.km} km from ${esc(nk.name)}">Known analog site</span>`);
    else if (nk.km < A.NEW_KM) b.push(`<span class="tag" title="${nk.km} km from ${esc(nk.name)}, a known analog site">Known analog region</span>`);
    else if (s.eligible) b.push(`<span class="tag gem" title="Nearest known analog site: ${esc(nk.name)}">New candidate</span>`);
    if (!S.pick && R.fresh > 0) b.push(isFresh ? `<button class="tag jump" data-jump="0">‹ Best match</button>` : `<button class="tag jump" data-jump="${R.fresh}">New candidate ›</button>`);
    if (r.stability != null) b.push(`<span class="tag ${r.stability >= 0.5 ? "" : "warn"}" title="In the top 1% in ${Math.round(r.stability * 100)}% of 200 random weightings">${r.stability >= 0.5 ? "Stable" : "Weight-sensitive"}</span>`);
    $("#rBadges").innerHTML = b.join("");
    G.select(s.id);
    const ms = opts.fly === false ? 0 : G.flyTo(s.lat, s.lon, { cinematic: !!opts.cine });
    // a cinematic search holds the panel back until 80% of the flight; text types in as it appears
    const at = opts.cine ? ms * 0.8 : 0;
    countUp($("#rPct"), r.overall || 0, at);
    typeText($("#rTarget"), `${t.name}, ${t.body}`, { delay: at, speed: 18 });
    typeText($("#rName"), nameOf(s), { delay: at + 200, speed: 45 });
    typeText($("#rWhere"), placeOf(s), { delay: at + 500, speed: 16 });
    renderSlides(at);
    // the 3D terrain is built after the camera flight, in idle time, so it never lands on a flight frame
    try { if (window.ZenithGround) window.ZenithGround.show(s, t, { name: nameOf(s), place: placeOf(s) }, { delay: opts.cine ? ms : 0 }); } catch (e) { console.warn("ground view", e); }
    try { if (window.ZenithSound) window.ZenithSound.update(s, t, { name: nameOf(s), place: placeOf(s), match: r.overall }); } catch (e) { console.warn("sound", e); }
    return ms;
  }
  $("#rBadges").addEventListener("click", e => { const b = e.target.closest("[data-jump]"); if (b) show(+b.dataset.jump); });
  $("#prev").onclick = () => (S.pick ? show(S.idx) : show(S.idx - 1));
  $("#next").onclick = () => (S.pick ? show(S.idx) : show(S.idx + 1));

  /* ---------- tabs ---------- */
  const TABS = [["overview", "Overview"], ["similar", "Matches"], ["different", "Gaps"], ["season", "Season"], ["hazards", "Hazards"], ["research", "Studies"], ["fits", "Also fits"]];
  const FEAT = [
    ["temp_min_K", "Coldest night", v => `${Math.round(v - 273.15)} °C`],
    ["temp_daynight_range_K", "Day–night swing", v => `${Math.round(v)} K`],
    ["slope_deg", "Slope", v => `${v.toFixed(1)}°`],
    ["roughness_tri_m", "Ruggedness", v => `${Math.round(v)} m`],
    ["albedo_wsa_unitless", "Brightness (albedo)", v => v.toFixed(2)],
    ["precip_mm_per_yr", "Rain and snow", v => `${Math.round(v)} mm/yr`],
    ["ground_ice_frac", "Ground ice", v => (v >= 0.5 ? "Yes" : "No")],
    ["sun_noon_elev_mean_deg", "Noon Sun height", v => `${Math.round(v)}°`],
  ];
  const sim = (f, v, T) => { const d = T.engine.features[f]; if (!d || v == null) return null; const x = A.eng.params.log1p.includes(f) ? Math.log1p(Math.max(0, v)) : v; return Math.exp(-Math.abs(x - d.clamped_target) / d.scale); };
  function split(s, t) {
    const off = t.out_of_earth_range || {};
    const rows = FEAT.map(([f, label, fmt]) => ({ f, label, fmt, e: s.earth[f], tv: t.features[f], d: sim(f, s.earth[f], t), meta: t.meta && t.meta[f] })).filter(x => x.e != null && x.tv != null && x.d != null);
    if (t.engine.features.geology_match) rows.push({ f: "geology", label: "Rock type", e: s.tags.rock, tv: t.rock_classes.map(c => ZenithEngine.ROCK_NAMES[c] || c).join(" or "), d: s.dims.geology, txt: true });
    return { sim: rows.filter(x => x.d >= 0.6 && !off[x.f]), diff: rows.filter(x => x.d < 0.6 && !off[x.f]) };
  }
  /* ---------- fact cards: a stack you swipe through, one card per topic ---------- */
  const panel = $("#panel"), sbar = $("#slideBar"), N = TABS.length;
  let cardIdx = 0, counts = {}, cards = [], busy = false, lazyArgs = null, built = new Set();
  const LAZY = new Set(["fits"]);
  function ensureCard(k) {
    const id = TABS[k][0];
    if (!LAZY.has(id) || built.has(id) || !lazyArgs) return;
    built.add(id);
    cards[k].firstElementChild.innerHTML = PANELS[id](lazyArgs.r, lazyArgs.t, lazyArgs.sp);
    if (BIND[id]) BIND[id](lazyArgs.r);
  }
  function renderSlides(typeAt = 0) {
    const r = current(), t = S.report.target, sp = split(r.site, t);
    counts = { similar: sp.sim.length, different: sp.diff.length + S.report.cannotTest.length };
    // "Also fits" scores every library mission, so that card is built the first time it reaches the top.
    lazyArgs = { r, t, sp }; built = new Set();
    panel.innerHTML = TABS.map(([id, label], k) =>
      `<section class="card" data-card="${id}" role="group" aria-roledescription="card" aria-label="${label}, ${k + 1} of ${N}"><div class="card-body">${LAZY.has(id) ? "" : PANELS[id](r, t, sp)}</div></section>`).join("");
    cards = [...panel.children];
    sbar.innerHTML = `
      <button type="button" class="step sl-step" data-step="-1" aria-label="Bring back the previous card">‹</button>
      <div class="sl-mid">
        <div class="sl-head"><b id="slTitle"></b><span id="slCount"></span></div>
        <div class="sl-dots" role="group" aria-label="Cards">${TABS.map(([id, label], k) =>
          `<button type="button" data-k="${k}" aria-label="${label}${counts[id] != null ? ` (${counts[id]})` : ""}"><i></i></button>`).join("")}</div>
      </div>
      <button type="button" class="step sl-step" data-step="1" aria-label="Next card">›</button>`;
    for (const id in BIND) if (!LAZY.has(id)) BIND[id](r);
    cardIdx = Math.max(0, TABS.findIndex(([id]) => id === S.tab));
    busy = false; place(); announce(typeAt);
    requestAnimationFrame(() => panel.querySelectorAll(".bar .fill").forEach(el => (el.style.transform = `scaleX(${el.dataset.v})`)));
    // on a new search the top card gives a small wiggle, to show it can be swiped
    if (typeAt && !reduce) {
      const el = cards[cardIdx];
      setTimeout(() => { if (el.isConnected && el === cards[cardIdx] && !busy && !sw) { el.classList.add("hint"); el.addEventListener("animationend", () => el.classList.remove("hint"), { once: true }); } }, typeAt + 1500);
    }
  }
  // stacks the cards: the current one on top, the next two peeking out behind it
  function place() {
    cards.forEach((c, k) => {
      const off = (k - cardIdx + N) % N;
      c.className = "card " + (off === 0 ? "is-top" : off === 1 ? "is-next" : off === 2 ? "is-third" : "is-hidden");
      c.inert = off !== 0;
      c.style.transform = c.style.opacity = c.style.transition = "";
      c.firstElementChild.style.opacity = "";
    });
  }
  // title, count and dots for the top card; its headings type in
  function announce(typeAt = 0) {
    const [id, label] = TABS[cardIdx];
    S.tab = id;
    if (LAZY.has(id) && !built.has(id)) ensureCard(cardIdx);
    typeText($("#slTitle"), counts[id] != null ? `${label} (${counts[id]})` : label, { delay: typeAt, speed: 26 });
    $("#slCount").textContent = `${cardIdx + 1} / ${N}`;
    sbar.querySelectorAll(".sl-dots button").forEach((b, i) => b.setAttribute("aria-current", i === cardIdx ? "step" : "false"));
    cards[cardIdx].querySelectorAll(".sec h2, .big-line").forEach((h, i) => typeText(h, h.textContent, { delay: typeAt + 150 + i * 160, speed: 22 }));
  }
  const FLY = reduce ? 0 : 300;
  // throws the top card off to one side (dir -1 left, 1 right); the next card takes its place
  function fling(dir) {
    if (busy) return;
    busy = true;
    const el = cards[cardIdx], w = panel.clientWidth || 400;
    panel.classList.add("swiping");
    el.classList.remove("dragging", "hint"); el.classList.add("fly");
    el.style.transform = `translate(${dir * w * 1.25}px, 30px) rotate(${dir * 22}deg)`;
    el.style.opacity = "0";
    setTimeout(() => { cardIdx = (cardIdx + 1) % N; busy = false; panel.classList.remove("swiping"); place(); announce(); }, FLY);
  }
  // brings the previous card back in from the left, on top
  function back() {
    if (busy) return;
    busy = true;
    const k = (cardIdx - 1 + N) % N, el = cards[k], w = panel.clientWidth || 400;
    el.className = "card is-top";
    el.style.transition = "none"; el.style.zIndex = "4"; el.style.opacity = "0";
    el.style.transform = `translate(${-w * 1.25}px, 30px) rotate(-22deg)`;
    void el.offsetWidth;
    cardIdx = k; place(); el.style.zIndex = "4"; announce();
    setTimeout(() => { el.style.zIndex = ""; busy = false; }, FLY + 30);
  }
  function goCard(k) {
    if (busy || k === cardIdx) return;
    if (k === (cardIdx + 1) % N) return fling(-1);
    if (k === (cardIdx - 1 + N) % N) return back();
    cardIdx = k; place(); announce();
  }
  sbar.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.step) (+b.dataset.step > 0 ? fling(-1) : back());
    else if (b.dataset.k) goCard(+b.dataset.k);
  });
  panel.addEventListener("keydown", e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); fling(-1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
  });
  // dragging: the card follows the pointer and tilts; past the threshold it flies off, otherwise it springs back
  let sw = null;
  panel.addEventListener("pointerdown", e => {
    const top = cards[cardIdx];
    if (busy || !top || e.button > 0 || !top.contains(e.target) || e.target.closest("button, a, input, select, label")) return;
    sw = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), on: false, el: top, next: cards[(cardIdx + 1) % N], dx: 0 };
  });
  panel.addEventListener("pointermove", e => {
    if (!sw || e.pointerId !== sw.id) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y, w = panel.clientWidth || 400;
    if (!sw.on) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { sw = null; return; } // a vertical move scrolls the card
      sw.on = true;
      sw.el.classList.remove("hint"); sw.el.classList.add("dragging");
      panel.classList.add("swiping");
      sw.next.style.transition = sw.next.firstElementChild.style.transition = "none";
      try { panel.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      const sel = getSelection && getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
    sw.dx = dx;
    const p = Math.min(1, Math.abs(dx) / (w * 0.45)); // how far along the swipe is: the next card comes forward with it
    sw.el.style.transform = `translate(${dx}px, ${dy * 0.12}px) rotate(${(dx / w) * 14}deg)`;
    sw.next.style.transform = `translateY(${10 * (1 - p)}px) scale(${0.965 + 0.035 * p})`;
    sw.next.style.opacity = String(0.7 + 0.3 * p);
    sw.next.firstElementChild.style.opacity = String(p);
  });
  function release(e, cancelled) {
    if (!sw || e.pointerId !== sw.id) return;
    const d = sw; sw = null;
    if (!d.on) return;
    const w = panel.clientWidth || 400, v = d.dx / Math.max(1, performance.now() - d.t); // px per ms
    d.next.style.transition = d.next.firstElementChild.style.transition = "";
    if (!cancelled && (Math.abs(d.dx) > Math.min(130, w * 0.3) || (Math.abs(d.dx) > 36 && Math.abs(v) > 0.55))) return fling(d.dx > 0 ? 1 : -1);
    d.el.classList.remove("dragging"); // spring back
    panel.classList.remove("swiping");
    d.el.style.transform = "";
    d.next.style.transform = d.next.style.opacity = d.next.firstElementChild.style.opacity = "";
  }
  panel.addEventListener("pointerup", e => release(e, false));
  panel.addEventListener("pointercancel", e => release(e, true));

  function esri(s, km = 28) {
    const dLat = km / 2 / 111, dLon = km / 2 / (111 * Math.max(0.05, Math.cos(s.lat * Math.PI / 180)));
    const b = [s.lon - dLon, s.lat - dLat, s.lon + dLon, s.lat + dLat].map(v => v.toFixed(4)).join(",");
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${b}&bboxSR=4326&imageSR=3857&size=480,360&format=jpg&f=image`;
  }
  const img = (src, alt) => `<img src="${src}" alt="${esc(alt)}" loading="lazy" onerror="this.closest('.pair').classList.add('off')">`;
  const compareRows = list => list.map(x => `<div class="row ${x.d < 0.6 ? "bad" : ""}"><span class="lbl">${esc(x.label)}</span>
      <span>${x.txt ? esc(x.e || "unknown") : x.fmt(x.e)}</span>
      <span>${x.txt ? esc(x.tv) : x.fmt(x.tv)}${x.meta && x.meta.status && x.meta.status !== "computed" ? `<span class="st">${esc(x.meta.status)}</span>` : ""}</span>
      <span class="meter" title="closeness ${(x.d || 0).toFixed(2)}"><i style="width:${Math.round((x.d || 0) * 100)}%"></i></span></div>`).join("");

  const PANELS = {
    overview(r, t) {
      const s = r.site, R = S.report, m = S.plan.real;
      const kImg = s.nearest_known.km < 40 && (IMG.SITE_IMAGES[s.nearest_known.id] || [])[0], tImg = (IMG.BASE_IMAGES[t.id] || [])[0];
      const opts = (S.plan.target === "custom" ? `<option value="custom" selected>Your conditions (${esc(t.body)})</option>` : "") + ["Moon", "Mars"].map(b => `<optgroup label="${b}">${A.eng.targets.filter(x => x.body === b).map(x => `<option value="${x.id}" ${x.id === S.plan.target ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`).join("");
      const best = R.ranked[0], fr = R.ranked[R.fresh];
      const ans = (x, k, lbl) => x ? `<button class="answer ${S.idx === k && !S.pick ? "on" : ""}" data-jump="${k}"><span class="kicker">${lbl}</span><b>${esc(nameOf(x.site))}</b><span>${x.overall.toFixed(2)} · ${x.site.nearest_known.km < A.NEW_KM ? `${x.site.nearest_known.km.toLocaleString("en")} km from ${esc(x.site.nearest_known.name.split(",")[0])}, a known analog site` : `${x.site.nearest_known.km.toLocaleString("en")} km from any known analog site`}</span></button>` : "";
      const two = R.fresh === 0 ? `<div class="sec answers one">${ans(best, 0, "Best match, and already a new candidate")}</div>`
        : `<div class="sec answers">${ans(best, 0, "Best match overall")}${ans(fr, R.fresh, `Best new candidate (${A.NEW_KM}+ km from known sites)`)}</div>`;
      const ks = Object.entries(A.knownScores[t.id] || {}).filter(([, k]) => k.score != null).sort((a, b) => b[1].score - a[1].score)[0];
      const kn = ks && X.known.find(k => k.id === ks[0]);
      const dimRow = A.DIMS.map(d => `<span class="dim ${!R.weights[d] ? "off" : s.dims[d] >= 0.8 ? "hi" : s.dims[d] < 0.4 ? "lo" : ""}" title="${DIM_LABEL[d]}: ${!R.weights[d] ? "switched off" : `${(s.dims[d] || 0).toFixed(2)}, weight ${R.weights[d]}`}"><i style="height:${Math.round((s.dims[d] || 0) * 100)}%"></i><b>${DIM_LABEL[d]}</b>${R.weights[d] > 1 ? `<em>×${R.weights[d]}</em>` : ""}</span>`).join("");
      return `
      ${m ? `<div class="sec mission"><p class="kicker">${esc(m.agency)}. ${esc(m.status)}</p><h3>${esc(m.mission)}</h3><p>${esc(m.about)}</p>
          ${m.proxy_note ? `<p class="caveat">${esc(m.proxy_note)}</p>` : ""}
          <p class="src">${m.sources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(", ")}. Checked ${esc((window.ZENITH_MISSIONS || {}).status_checked || "")}</p></div>`
        : S.plan.why ? `<p class="read">Read as <b>${esc(t.name)}</b> (${esc(S.plan.why)}). Change it under Mission plan.</p>` : ""}
      <p class="verdict q-${R.quality}"><b>${R.quality[0].toUpperCase() + R.quality.slice(1)} match.</b> ${esc(R.qualityNote)}</p>
      ${two}
      <div class="sec"><h2>Why this place</h2><div class="dims">${dimRow}</div>
        <p class="note">Closeness to ${esc(t.name)} on each of seven dimensions, 0 to 1. The score is their weighted geometric mean, so one bad dimension pulls it down. Balanced weights give this cell ${s.balanced != null ? s.balanced.toFixed(2) : "–"}.</p></div>
      <div class="sec pair">
        <figure><div class="ph">${img(kImg ? kImg.src(640) : esri(s), "Earth site")}</div><figcaption>${esc(nameOf(s))}<span>${kImg ? esc(kImg.credit) : "28 km across, Esri World Imagery"}</span></figcaption></figure>
        <figure><div class="ph">${tImg ? img(tImg.src(640), tImg.caption) : ""}</div><figcaption>${esc(t.name)}<span>${tImg ? esc(tImg.credit) : ""}</span></figcaption></figure>
      </div>
      <div class="sec"><h2>What a field test here can cover</h2><div class="bars">${Object.entries(r.subsystems).filter(([, v]) => v).map(([k, v]) => `<div class="bar"><span>${esc(A.PARTS[k].label)}</span><span class="track"><span class="fill" data-v="${v.value.toFixed(3)}"></span><i class="cap" style="left:${Math.round(v.ceiling * 100)}%" title="Most any Earth site can cover: ${Math.round(v.ceiling * 100)}%"></i></span><span class="v">${Math.round(v.value * 100)}%</span></div>`).join("")}</div>
        <p class="note">Coverage, not similarity: dimension match × the most an Earth test can prove for that part (the tick, a team assumption). Gravity, air pressure and radiation are never covered.</p></div>
      <div class="sec"><h2>Mission plan</h2>
        <select class="target" id="targetSel" aria-label="Base site">${opts}</select>
        <button class="chip edit-cond" id="editCond">${S.plan.target === "custom" ? "Edit your conditions" : `Change ${esc(t.name)}'s conditions with sliders`}</button>
        <div class="plan-row">${Object.keys(A.PARTS).map(id => `<button class="chip" data-sub="${id}" aria-pressed="${S.plan.subsystems.includes(id)}">${esc(A.PARTS[id].label)}</button>`).join("")}</div>
        <p class="note">${S.plan.weights ? (S.plan.real ? "Using this mission's own weights. Pick parts to replace them." : "Balanced weights: all seven dimensions count the same. Pick parts to change that.") : "Each part you pick adds weight to the dimensions it depends on. No dimension is ever dropped."}</p></div>
      ${kn ? `<div class="sec"><h2>Against the best known analog</h2><div class="kv one"><div><span>${esc(kn.name)} (best cell at the site)</span><span>${ks[1].score.toFixed(2)}</span></div><div><span>This cell, same balanced weights</span><span>${s.balanced != null ? s.balanced.toFixed(2) : "–"}</span></div></div></div>` : ""}`;
    },
    similar(r, t, sp) {
      return sp.sim.length ? `<div class="sec rows"><div class="row head"><span></span><span>Here</span><span>${esc(t.name)}</span><span>Close</span></div>${compareRows(sp.sim)}</div>`
        : `<div class="empty"><b>Nothing closely matches</b>See Gaps.</div>`;
    },
    different(r, t, sp) {
      return `${sp.diff.length ? `<div class="sec rows"><div class="row head"><span></span><span>Here</span><span>${esc(t.name)}</span><span>Close</span></div>${compareRows(sp.diff)}</div>` : ""}
      <div class="sec"><h2>Not testable anywhere on Earth</h2>${S.report.cannotTest.map(c => `<div class="never"><span class="lbl">${esc(c.what)}</span><span>${esc(String(c.target).replace(/\s*\(Earth[^)]*\)/, ""))}</span><span class="e">Earth: ${esc(c.earth)}</span></div>`).join("")}
      <p class="note">Test these in a chamber, a drop tower or in flight.</p></div>`;
    },
    season(r) {
      const bm = F.bestMonths(r.site);
      if (!bm) return `<div class="empty"><b>No monthly data</b>for this cell.</div>`;
      const lo = Math.min(...bm.months.map(m => m.tmin)), hi = Math.max(...bm.months.map(m => m.tmin));
      return `<p class="big-line">${esc(bm.label)}</p>
        <div class="sec months">${bm.months.map((m, i) => `<div class="mo ${m.best ? "best" : ""} ${m.dark ? "dark" : ""}" title="${m.name}: low ${m.tmin.toFixed(0)} °C · ${m.precip.toFixed(2)} mm/day${m.dark ? " · polar night" : ""}"><span>${Math.round(m.tmin)}°</span><div class="col" style="height:${Math.round(12 + 88 * (hi - m.tmin) / Math.max(1, hi - lo))}%;animation-delay:${i * 30}ms"></div><span>${m.name[0]}</span></div>`).join("")}</div>
        <p class="note">The coldest, driest months with daylight. Bars show the average daily low. Pale bars are polar night. NASA POWER (MERRA-2) long-term monthly means.</p>`;
    },
    hazards(r) {
      return `<div class="list">${F.hazards(r.site).map(h => `<div class="item"><span class="sev ${h.level}">${h.level === "high" ? "HIGH" : h.level === "low" ? "LOW" : "MED"}</span><span><b>${esc(h.risk)}</b><p>${esc(h.prep)}</p></span></div>`).join("")}</div>
        <p class="note">Flags from the cell's measured values. Access, permits and cost are not scored.</p>`;
    },
    research(r) {
      const st = r.site.studied || [];
      return st.length ? `<div class="list">${st.map(x => `<a class="link" href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.name)}</b><span>${x.km} km away, ${esc(x.for)}</span></a>`).join("")}</div>`
        : `<div class="empty"><b>No listed study within 150 km</b>Nearest known analog site: ${esc(r.site.nearest_known.name)}, ${r.site.nearest_known.km.toLocaleString("en")} km. Our list is not complete, so check the literature before calling this new.</div>`;
    },
    fits(r) {
      const s = r.site, all = A.allTargets(s.lat, s.lon);
      const fits = [];
      for (const m of LIBRARY) {
        if (m.target === S.plan.target && JSON.stringify(A.weightsFor(m)) === JSON.stringify(S.report.weights)) continue;
        const k = A.top(m, 15).findIndex(c => A.km(c[1], c[2], s.lat, s.lon) < 150);
        if (k >= 0) fits.push({ mission: m, rank: k + 1 });
      }
      fits.sort((x, y) => x.rank - y.rank);
      return `<div class="sec"><h2>This cell against every target</h2><div class="list">${all.map(x => `<button class="fit" data-target="${x.id}"><span><b>${esc(x.name)}</b><span>${x.eligible ? `score ${x.score.toFixed(2)}, top ${topFmt(x.percentile)}%` : esc(x.ineligibleReason)}</span></span><span class="go">${x.id === S.plan.target ? "current" : "Switch to it"}</span></button>`).join("")}</div>
        <p class="note">Balanced weights.</p></div>
        ${fits.length ? `<div class="sec"><h2>Missions that rank this area in their top 15</h2><div class="list">${fits.map(f => `<button class="fit" data-id="${f.mission.id}"><span><b>${esc(f.mission.title)}</b><span>#${f.rank} for ${esc(A.target(f.mission.target).name)}</span></span><span class="go">Open</span></button>`).join("")}</div></div>` : ""}`;
    },
  };
  const BIND = {
    overview() {
      document.querySelectorAll(".answer[data-jump]").forEach(b => b.onclick = () => show(+b.dataset.jump));
      $("#editCond").onclick = () => openConditions(S.plan.target === "custom" ? X.targets.custom.conditions : A.conditionsOf(S.plan.target));
      $("#targetSel").onchange = e => { S.plan.target = e.target.value; S.plan.real = null; S.plan.weights = null; S.plan.why = null; rerun(); };
      document.querySelectorAll(".chip[data-sub]").forEach(b => b.onclick = () => {
        const id = b.dataset.sub; let a = S.plan.subsystems;
        if (S.plan.weights) { S.plan.weights = null; S.plan.real = null; a = S.plan.subsystems = [id]; }
        else if (a.includes(id)) { if (a.length > 1) a.splice(a.indexOf(id), 1); } else a.push(id);
        S.plan.why = null; rerun();
      });
    },
    fits() {
      document.querySelectorAll(".fit[data-id]").forEach(b => b.onclick = () => pick(LIBRARY.find(m => m.id === b.dataset.id)));
      document.querySelectorAll(".fit[data-target]").forEach(b => b.onclick = () => {
        if (b.dataset.target === S.plan.target) return;
        const s = current().site; S.plan.target = b.dataset.target; S.plan.real = null; S.plan.weights = null; S.plan.why = null;
        S.report = A.assess(S.plan); if (S.heat) paintHeat(); inspect(s.lat, s.lon);
      });
    },
  };

  /* ---------- click anywhere ---------- */
  function toast(msg, ms = 3200) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); }
  function inspect(lat, lon) {
    if (!S.report) {                       // from the home screen: open the target this place fits best
      const all = A.allTargets(lat, lon);
      if (!all.length) return toast("That is ocean. Click on land.");
      const best = all[0], ex = EXAMPLES.find(m => m.target === best.id);
      q.value = `${best.name}: where on Earth?`;
      go(q.value, { target: best.id, subsystems: ex.subsystems.slice() });
    }
    const r = A.inspect(lat, lon, S.plan);
    if (!r.land) return toast("That is ocean. Click on land.");
    const hit = S.report.ranked.findIndex(x => x.site.i === r.site.i);
    if (hit >= 0) return show(hit, false);
    S.pick = r;
    markers(); show(null, false);
    if (!r.site.eligible) toast(`Not ranked: ${r.site.why_not}. The numbers still show how it compares.`);
  }
  G.onClick(inspect);
  G.onPick(id => { const i = S.report ? S.report.ranked.findIndex(r => r.site.id === id) : -1; if (i >= 0) show(i); });

  /* ---------- heat layer ---------- */
  const RAMP = [[34, 52, 110], [30, 128, 146], [120, 200, 112], [250, 212, 72], [255, 122, 40]];
  function ramp(v) { const x = Math.max(0, Math.min(1, v)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i; return RAMP[i].map((c, k) => Math.round(c + (RAMP[i + 1][k] - c) * f)); }
  // The score layer is only painted when it is on, and only once per scoring pass (a new mission or new weights is a new pass).
  const heatCache = new WeakMap();
  function paintHeat() {
    if (!S.report) return;
    const P = S.report.pass, lo = P.s[P.idx[Math.floor(P.n * 0.95)]], hi = P.best;
    let buf = heatCache.get(P);
    if (!buf) {
      buf = new Uint8Array(1440 * 720 * 4); const e = A.eng;
      for (const i of P.idx) { const c = ramp((P.s[i] - lo) / (hi - lo)), o = (e.row[i] * 1440 + e.col[i]) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 235; }
      heatCache.set(P, buf);
    }
    if (heatShown !== buf) { G.setHeat(buf); heatShown = buf; }
    $("#legend").innerHTML = `<span>${lo.toFixed(2)}</span><i></i><span>${hi.toFixed(2)}</span><em>match score, ${P.n.toLocaleString("en")} cells</em>`;
  }
  let heatShown = null;
  $("#heatBtn").onclick = () => {
    if (!G.hasGL()) return toast("The score layer needs WebGL, which this browser has turned off.");
    S.heat = !S.heat; if (S.heat) paintHeat(); G.heat(S.heat); $("#heatBtn").setAttribute("aria-pressed", S.heat); $("#legend").hidden = !S.heat;
  };
  $("#flagBtn").onclick = () => setFlags(!S.flags);
  function setFlags(on) { S.flags = on; G.setFlags(on ? A.known.filter(k => !k.cave).map(k => ({ lat: k.lat, lon: k.lon, label: k.name.split(",")[0] })) : []); $("#flagBtn").setAttribute("aria-pressed", on); }

  /* ---------- sheets: case studies, evidence, phone ---------- */
  const SHEETS = {
    cases: () => `<h2>Case studies</h2><p class="lede">Three places the engine ranked highly, checked by hand against imagery and the literature.</p>
      <div class="cases">
        <a class="case" href="cases/taklamakan/index.html" target="_blank" rel="noopener"><p class="kicker">Arcadia Planitia, Mars</p><h3>Southern Taklamakan, China</h3><p>Score 0.68, top 0.04%. Flat sediment plains that match Arcadia's slope, roughness, brightness and Sun angle. No ground ice, and no analog study found at this spot.</p><span class="go">Read the case study</span></a>
        <a class="case" href="cases/yungay-jezero/index.html" target="_blank" rel="noopener"><p class="kicker">Jezero crater, Mars</p><h3>Yungay against our best Atacama cell</h3><p>Yungay, the well-known Atacama test site, scores 0.62. A cell 390 km north in the same desert scores 0.81. Same desert, a closer match on terrain and Sun angle.</p><span class="go">Read the case study</span></a>
        <button class="case" data-case="saudi"><p class="kicker">Marius Hills lava tube, Moon</p><h3>Harrat lava fields, Saudi Arabia</h3><p>Score 0.73 against the Marius Hills pit. The best known analog site we scored reaches 0.62. Basalt, dry, and the right terrain. We found no analog study of this lava field; the nearest known site is Wadi Rum, 310 km away.</p><span class="go">Open on the globe</span></button>
      </div>
      <p class="note">These are candidate sites from satellite-scale data. Nobody on the team has been there.</p>`,
    evidence: () => {
      const rows = A.eng.targets.map(t => { const r = A.rediscovery[t.id] || {}; return `<tr><td>${esc(t.name)}</td><td>${r.hits}</td><td>${r.expected_by_chance}</td></tr>`; }).join("");
      const hits = A.eng.targets.reduce((a, t) => a + ((A.rediscovery[t.id] || {}).hits || 0), 0), exp = A.eng.targets.reduce((a, t) => a + ((A.rediscovery[t.id] || {}).expected_by_chance || 0), 0);
      return `<h2>Does it find the right places?</h2>
      <p class="lede">The engine was never told where agencies test. It only sees climate, terrain, surface, ice, sunlight and rock type.</p>
      <div class="stat"><b>${hits}</b><span>of our 175 top sites (25 per target, 300 km apart) sit within 300 km of a known analog site.<br>Random bare ground would give <b class="n">${exp.toFixed(1)}</b>. Poisson p ≈ 0.00015.</span></div>
      <table class="tbl"><thead><tr><th>Target</th><th>Hits</th><th>By chance</th></tr></thead><tbody>${rows}</tbody></table>
      <p>Per target the counts are too small to mean much. Together they do.</p>
      <h3>Two kinds of evidence, one desert</h3>
      <p>We have no soil chemistry. Using only climate, terrain and rock data, the engine ranks the Atacama first for Jezero. Soil scientists reached the same desert from the other side: Navarro-González et al. (2003) showed Atacama soils near Yungay behave like Mars soils. Different data, same desert.</p>
      <h3>Where it is weak</h3>
      <p>No place on Earth is as cold as any of the seven targets, so the Moon's polar sites top out near 0.5. Malapert Massif has no robust analog at all. We show those as weak matches.</p>
      <button class="chip" id="flagFromSheet">Show the known analog sites on the globe</button>
      <p class="note">Rules were fixed before the run (scoring/DECISIONS_v1_6.md). Full tables: results/validation.md.</p>`;
    },
    phone: () => {
      const url = location.href.split("#")[0].split("?")[0];
      let svg = "";
      try { const qr = qrcode(0, "M"); qr.addData(url); qr.make(); svg = qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true }); } catch (e) { /* no QR, the address below still works */ }
      return `<h2>Open it on your phone</h2><p class="lede">Scan the code and the same app opens on your phone, with the same engine and data.</p>
      <div class="qr">${svg}</div>
      <p class="mono">${esc(url.replace(/^https?:\/\//, ""))}</p>
      <p class="note">Runs in the browser, so nothing is sent anywhere. About 20 MB on first load.</p>`;
    },
  };
  /* ---------- your own conditions: sliders -> a custom target, scored over all of Earth live ---------- */
  const RLOG = Math.log1p(2000); // the ruggedness slider is logarithmic: most of Earth is under 200 m
  const CF = [
    { k: "lat", label: "Latitude on the Moon or Mars", min: -90, max: 90, step: 0.5, unit: "°", note: "Sets the Sun: how high it gets at noon, from the body's tilt", feat: "sun_noon_elev_mean_deg" },
    { k: "tmin_C", label: "Coldest temperature", min: -270, max: 60, step: 1, unit: "°C", feat: "temp_min_K", toF: v => v + 273.15 },
    { k: "swing_K", label: "Day–night swing", min: 0, max: 320, step: 1, unit: "K", feat: "temp_daynight_range_K" },
    { k: "slope", label: "Slope", min: 0, max: 40, step: 0.1, unit: "°", feat: "slope_deg" },
    { k: "rough_m", label: "Ruggedness (height change between neighbouring points)", min: 0, max: 2000, step: 1, unit: "m", feat: "roughness_tri_m", log: true },
    { k: "albedo", label: "Brightness (albedo, 0 black to 1 white)", min: 0.02, max: 0.95, step: 0.01, unit: "", feat: "albedo_wsa_unitless" },
    { k: "precip", label: "Rain and snow", min: 0, max: 3000, step: 10, unit: "mm/yr", feat: "precip_mm_per_yr" },
  ];
  const ROCKS = [["vb", "Basalt"], ["pb", "Anorthosite, gabbro"], ["ss", "Sandstone, mudstone"], ["su", "Loose sediment"], ["sm", "Mixed sediment"], ["ev", "Salts"], ["sc", "Carbonate"], ["va", "Acid volcanic"], ["vi", "Intermediate volcanic"], ["py", "Pyroclastics"], ["mt", "Metamorphic"], ["pa", "Granite"]];
  const fmtCF = (f, v) => (f.k === "lat" ? `${Math.abs(v)}°${v >= 0 ? "N" : "S"}` : f.k === "albedo" ? (+v).toFixed(2) : `${v}${f.unit ? " " + f.unit : ""}`);
  const toRange = (f, v) => (f.log ? Math.round(Math.log1p(Math.max(0, v)) / RLOG * 1000) : v);
  const fromRange = (f, u) => (f.log ? Math.round(Math.expm1(u / 1000 * RLOG)) : +u);
  let COND = null, condT = 0;
  function openConditions(c) {
    COND = Object.assign({}, c || (X.targets.custom && X.targets.custom.conditions) || (S.plan && S.plan.target !== "custom" ? A.conditionsOf(S.plan.target) : A.conditionsOf("jezero")));
    COND.rocks = (COND.rocks || []).slice(); COND.off = (COND.off || []).slice();
    const opts = A.eng.targets.map(x => `<option value="${x.id}" ${x.id === COND.from ? "selected" : ""}>${esc(x.name)}, ${x.body}</option>`).join("");
    $("#sheetBody").innerHTML = `<h2>Your own conditions</h2>
      <p class="lede">Describe the place you are going. Zenith scores every patch of bare ground on Earth against it, live, with the same formula as the seven sites. Untick a condition to leave it out, so you can search on just the ones you care about. If a value goes past anything on Earth, we say so.</p>
      <div class="cf-top">
        <label>Start from <select class="target" id="cfFrom"><option value="">Keep my values</option>${opts}</select></label>
        <div class="seg two" role="group" aria-label="Body"><button data-body="Moon">Moon</button><button data-body="Mars">Mars</button></div>
      </div>
      <div class="cf-grid">${CF.map(f => `<div class="cf" data-k="${f.k}">
        <label class="cf-on"><input type="checkbox" data-off="${f.feat}" aria-label="Use ${esc(f.label)}"><span>${esc(f.label)}</span></label>
        <input type="number" id="cfn_${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" aria-label="${esc(f.label)} value">
        <input type="range" id="cf_${f.k}" min="${f.log ? 0 : f.min}" max="${f.log ? 1000 : f.max}" step="${f.log ? 1 : f.step}">
        <p class="cf-edge" id="cfe_${f.k}"></p></div>`).join("")}
        <div class="cf" data-feat="ground_ice_frac"><label class="cf-on"><input type="checkbox" data-off="ground_ice_frac" aria-label="Use ground ice"><span>Ground ice</span></label><div class="seg two" role="group" aria-label="Ground ice"><button data-ice="0">No</button><button data-ice="1">Yes</button></div><p class="cf-edge">Yes also lets glaciers and ice sheets count as test ground.</p></div>
      </div>
      <div class="cf" data-feat="geology_match"><label class="cf-on"><input type="checkbox" data-off="geology_match" aria-label="Use rock type"><span>Rock type (none picked = any rock)</span></label><div class="plan-row">${ROCKS.map(([r, l]) => `<button class="chip" data-rock="${r}">${l}</button>`).join("")}</div></div>
      <div id="cfOut" class="cf-out" aria-live="polite"></div>
      <button class="cta" id="cfGo">Show these matches on the globe</button>`;
    $("#sheet").hidden = false; $("#sheet").dataset.id = "conditions";
    const sync = () => {
      CF.forEach(f => { $("#cf_" + f.k).value = toRange(f, COND[f.k]); $("#cfn_" + f.k).value = COND[f.k]; });
      document.querySelectorAll("[data-body]").forEach(b => b.setAttribute("aria-pressed", b.dataset.body === COND.body));
      document.querySelectorAll("[data-ice]").forEach(b => b.setAttribute("aria-pressed", (b.dataset.ice === "1") === !!COND.ice));
      document.querySelectorAll("[data-rock]").forEach(b => b.setAttribute("aria-pressed", COND.rocks.includes(b.dataset.rock)));
      document.querySelectorAll("[data-off]").forEach(b => { b.checked = !COND.off.includes(b.dataset.off); b.closest(".cf").classList.toggle("is-off", !b.checked); });
      edges(); schedule();
    };
    const set = (k, v) => { COND[k] = v; COND.from = null; $("#cfFrom").value = ""; };
    CF.forEach(f => {
      $("#cf_" + f.k).addEventListener("input", e => { set(f.k, fromRange(f, e.target.value)); $("#cfn_" + f.k).value = COND[f.k]; edges(); schedule(); });
      $("#cfn_" + f.k).addEventListener("change", e => {
        let v = parseFloat(e.target.value);
        if (!isFinite(v)) v = COND[f.k];
        v = Math.max(f.min, Math.min(f.max, v)); // inputs past the slider ends are pulled back to them
        set(f.k, v); e.target.value = v; $("#cf_" + f.k).value = toRange(f, v); edges(); schedule();
      });
    });
    document.querySelectorAll("[data-off]").forEach(b => b.onchange = () => { const a = COND.off.filter(x => x !== b.dataset.off); if (!b.checked) a.push(b.dataset.off); COND.off = a; sync(); });
    $("#cfFrom").onchange = e => { if (e.target.value) { COND = A.conditionsOf(e.target.value); sync(); } };
    document.querySelectorAll("[data-body]").forEach(b => b.onclick = () => { set("body", b.dataset.body); sync(); });
    document.querySelectorAll("[data-ice]").forEach(b => b.onclick = () => { set("ice", b.dataset.ice === "1"); sync(); });
    document.querySelectorAll("[data-rock]").forEach(b => b.onclick = () => { const r = b.dataset.rock, a = COND.rocks; a.includes(r) ? a.splice(a.indexOf(r), 1) : a.push(r); set("rocks", a); sync(); });
    $("#cfGo").onclick = () => {
      const w = {}; A.DIMS.forEach(d => (w[d] = 1));
      if (!A.setCustom(COND)) return toast("Switch on at least one condition.");
      q.value = "Your own conditions";
      go(q.value, { target: "custom", weights: w, why: `your own conditions, ${COND.body}` });
    };
    sync();
  }
  // marks every slider that goes past what Earth has
  function edges() {
    CF.forEach(f => {
      const el = $("#cfe_" + f.k);
      if (COND.off.includes(f.feat)) { el.className = "cf-edge"; el.textContent = "Switched off: not used in the match."; return; }
      if (f.k === "lat") {
        const sun = A.sunNoonMean(COND.lat, A.TILT[COND.body]), e = A.earthEdge(f.feat, sun, COND.ice);
        el.className = "cf-edge" + (e != null ? " out" : "");
        el.textContent = `Noon Sun about ${Math.round(sun)}° up.` + (e != null ? ` Beyond Earth: no scored ground has a Sun ${sun < e ? "this low" : "this high"} (Earth's limit ${Math.round(e)}°).` : "");
        return;
      }
      const e = A.earthEdge(f.feat, f.toF ? f.toF(COND[f.k]) : COND[f.k], COND.ice);
      el.className = "cf-edge" + (e != null ? " out" : "");
      el.textContent = e == null ? "Within Earth's range." : `Beyond Earth. Closest Earth gets: ${fmtCF(f, f.toF ? Math.round(e - 273.15) : f.k === "albedo" ? e : f.k === "slope" ? Math.round(e * 10) / 10 : Math.round(e))}. Scored against that edge.`;
    });
  }
  const ALL_FEATS = CF.map(f => [f.feat, f.k === "lat" ? "Sun height" : f.label.split(" (")[0].toLowerCase()]).concat([["ground_ice_frac", "ground ice"], ["geology_match", "rock type"]]);
  const usedList = () => { const on = ALL_FEATS.filter(([f]) => !COND.off.includes(f)).map(x => x[1]); return on.length === ALL_FEATS.length ? "all conditions" : on.join(", "); };
  function schedule() { clearTimeout(condT); $("#cfOut").classList.add("busy"); condT = setTimeout(score, 180); }
  function score() {
    if ($("#sheet").hidden || !COND) return;
    const w = {}; A.DIMS.forEach(d => (w[d] = 1));
    if (!A.setCustom(COND)) { $("#cfOut").classList.remove("busy"); $("#cfOut").innerHTML = `<p class="verdict q-weak"><b>Nothing switched on.</b> Tick at least one condition to search.</p>`; $("#cfGo").disabled = true; return; }
    $("#cfGo").disabled = false;
    const R = A.assess({ target: "custom", weights: w }), b = R.ranked[0], f = R.ranked[R.fresh];
    const line = (x, lbl) => x ? `<div><span class="kicker">${lbl}</span><b>${esc(nameOf(x.site))}</b><span>${esc(placeOf(x.site))}</span><em>${x.overall.toFixed(2)}</em></div>` : "";
    $("#cfOut").classList.remove("busy");
    $("#cfOut").innerHTML = `<p class="verdict q-${R.quality}"><b>${R.quality[0].toUpperCase() + R.quality.slice(1)} match.</b> ${esc(R.qualityNote)}</p>
      <div class="cf-res">${line(b, "Closest place on Earth")}${R.fresh > 0 ? line(f, `Best new candidate, ${A.NEW_KM}+ km from known sites`) : ""}</div>
      <p class="note">Matched on ${usedList()}. Scores run 0 to 1 (1 = identical on every condition used). ${R.pass.n.toLocaleString("en")} cells scored.</p>`;
  }

  function openSheet(id) {
    if (id === "conditions") return openConditions();
    if (id === "simulate") { $("#sheetBody").innerHTML = window.ZenithSim.sheet(); $("#sheet").hidden = false; $("#sheet").dataset.id = id; return window.ZenithSim.bind(); }
    $("#sheetBody").innerHTML = SHEETS[id](); $("#sheet").hidden = false; $("#sheet").dataset.id = id;
    const sa = $("#sheetBody [data-case=saudi]");
    if (sa) sa.onclick = () => { const m = EXAMPLES.find(x => x.id === "lava-tube"); q.value = m.title; const w = {}; A.DIMS.forEach(d => (w[d] = 1)); go(m.title, { target: m.target, weights: w, subsystems: m.subsystems.slice() }); inspect(27.375, 37.375); G.flyTo(27.375, 37.375); };
    const fl = $("#flagFromSheet"); if (fl) fl.onclick = () => { setFlags(true); closeSheet(); G.zoom(1); };
  }
  function closeSheet() { $("#sheet").hidden = true; }
  document.querySelectorAll("[data-sheet]").forEach(b => b.onclick = () => ($("#sheet").hidden || $("#sheet").dataset.id !== b.dataset.sheet ? openSheet(b.dataset.sheet) : closeSheet()));
  $("#sheetClose").onclick = closeSheet;
  $("#sheet").addEventListener("click", e => { if (e.target === $("#sheet")) closeSheet(); });

  /* ---------- layout and keys ---------- */
  function layout() {
    const m = innerWidth <= 900;
    if (document.body.classList.contains("is-result")) {
      if (m) G.setLayout({ cx: 0.5, cy: 0.55, r: 0.42, maxX: 1 });
      else { const free = innerWidth - Math.min(560, innerWidth - 32) - 32; G.setLayout({ cx: free / 2 / innerWidth, cy: 0.54, r: Math.min(0.42, free / innerHeight * 0.4), maxX: free / innerWidth }); }
    } else G.setLayout({ cx: 0.5, cy: 0.44, r: m ? 0.42 : 0.33, maxX: 1 });
  }
  addEventListener("resize", layout);
  addEventListener("keydown", e => {
    if (e.key === "Escape") closeSheet();
    if (!S.report || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (e.target.closest && e.target.closest("#panel, #slideBar, .dz")) return; // arrows there move slides or sliders
    if (e.key === "ArrowRight") show(S.pick ? S.idx : S.idx + 1);
    if (e.key === "ArrowLeft") show(S.pick ? S.idx : S.idx - 1);
    if (e.key === "/") { e.preventDefault(); q.focus(); }
    if (e.key === "h") $("#heatBtn").click();
  });
  $(".brand").onclick = e => { e.preventDefault(); S.report = null; S.pick = null; document.body.className = "is-home"; $("#result").hidden = true; $("#tools").hidden = true; $("#legend").hidden = true; G.heat(false); S.heat = false; $("#heatBtn").setAttribute("aria-pressed", false); G.setMarkers([]); setFlags(false); G.zoom(1); G.spin(true); q.value = ""; layout(); closeSheet(); };

  // used by the Design controls' "Replay flight"
  window.ZenithReplay = () => (S.plan ? go(S.text, { target: S.plan.target, subsystems: S.plan.subsystems.slice() }) : pick(LIBRARY[0]));

  // "On your phone" shows a QR code of this page's own address, so it only appears when the page is on the web
  if (/^https?:$/.test(location.protocol) && !/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
    $("#phoneBtn").hidden = false;
    // home page QR: the same app on a phone, where people can tour it or play the drill game
    try { const qr = qrcode(0, "M"); qr.addData(location.href.split("#")[0].split("?")[0]); qr.make(); $("#qrHomeCode").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); $("#qrHome").hidden = false; } catch (e) { /* no QR */ }
  }
  if (/[?&]design\b/.test(location.search)) document.documentElement.classList.add("show-design");
  G.init($("#globe"));
  layout();
  function restore() {
    if (S.report) { layout(); markers(); if (S.heat) { heatShown = null; paintHeat(); } else G.heat(false); show(S.idx, { fly: true }); }
    else { G.heat(false); G.spin(true); layout(); }
  }
  window.ZenithUI = { go, pick, inspect, restore, closeSheet, state: () => S };
})();
