(function () {
  const DATA = window.ZENITH_DATA;
  const { LIBRARY, parse } = window.ZenithMission;
  const F = window.ZenithFeatures;
  const G = window.ZenithGlobe;
  const IMG = window.ANALOG_IMAGES || { BASE_IMAGES: {}, SITE_IMAGES: {} };
  const SUBS = (window.Zenith && window.Zenith.SUBSYSTEMS) || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P = x => (x == null ? "–" : Math.round(x * 100));
  const topFmt = p => { const t = Math.max(0.01, 100 - p); return t < 1 ? t.toFixed(2) : t < 10 ? t.toFixed(1) : String(Math.round(t)); };
  const coord = (la, lo) => `${Math.abs(la).toFixed(2)}°${la >= 0 ? "N" : "S"}  ${Math.abs(lo).toFixed(2)}°${lo >= 0 ? "E" : "W"}`;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  let S = { text: "", plan: null, report: null, idx: 0, tab: "overview", wi: 2 };

  /* ---------- engine ---------- */
  function runEngine(plan) {
    const r = window.Zenith.assess(plan, DATA);
    const target = r.target && r.target.candidates ? r.target : DATA.targets[plan.target];
    const all = (r.ranked || r.sites || []).map(x => ({
      site: x.site || x, overall: x.overall != null ? x.overall : x.coverage,
      subsystems: x.subsystems || x.perSubsystem || {}, stability: x.stability != null ? x.stability : (x.site || x).stability,
      tag: x.tag || ((x.site || x).kind === "gem" ? "gem" : "known"),
    }));
    const ranked = []; // neighbouring cells rank together; keep places 100 km apart
    for (const x of all) if (ranked.every(y => F.km(x.site.lat, x.site.lon, y.site.lat, y.site.lon) >= 100)) ranked.push(x);
    return { engine: r.engine || "coverage.js", target, plan: r.plan || plan, ranked: ranked.slice(0, 20), cannotTest: r.cannotTest || r.cannot_test || [] };
  }

  /* ---------- names ---------- */
  const cc = new Map();
  const country = s => { const k = s.lat + "," + s.lon; if (!cc.has(k)) cc.set(k, G.countryOf(s.lat, s.lon)); return cc.get(k); };
  function nameOf(s) {
    if (s.name) return s.name;
    const c = country(s) || "Unmapped cell";
    if (s.tags && s.tags.impact_crater) return `${s.tags.impact_crater} crater`;
    if (s.nearest_known && s.nearest_known.km < 150) return `Near ${s.nearest_known.name.split(",")[0]}`;
    return c;
  }
  function placeOf(s) {
    const c = country(s);
    return [s.name || (s.nearest_known && s.nearest_known.km < 150) ? c : null, coord(s.lat, s.lon)].filter(Boolean).join(" · ");
  }

  /* ---------- search ---------- */
  const q = $("#q"), sug = $("#suggest");
  let active = -1;
  function suggestions() {
    const v = q.value.trim().toLowerCase();
    const items = LIBRARY.filter(m => !v || m.title.toLowerCase().includes(v) || DATA.targets[m.target].name.toLowerCase().includes(v) || DATA.targets[m.target].body.toLowerCase().includes(v));
    return v && !items.length ? [{ free: true, title: q.value.trim() }] : items;
  }
  function showSuggest() {
    const items = suggestions();
    active = -1;
    sug.innerHTML = items.map((m, i) => `<li><button type="button" data-i="${i}" role="option"><span class="body">${m.free ? "GO" : DATA.targets[m.target].body.toUpperCase()}</span>${esc(m.title)}</button></li>`).join("");
    sug.hidden = false;
    sug._items = items;
  }
  function hideSuggest() { sug.hidden = true; }
  q.addEventListener("focus", showSuggest);
  q.addEventListener("input", showSuggest);
  q.addEventListener("keydown", e => {
    const n = (sug._items || []).length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (sug.hidden) showSuggest();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      sug.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-selected", i === active));
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
    lib ? pick(lib) : go(text, parse(text, DATA));
  });
  function pick(m) {
    if (!m) return;
    if (m.free) return go(m.title, parse(m.title, DATA));
    q.value = m.title; go(m.title, { target: m.target, subsystems: m.subsystems.slice() });
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
    hideSuggest(); q.blur();
    S.text = text; S.plan = { target: plan.target, subsystems: plan.subsystems }; S.idx = 0; S.tab = "overview"; S.wi = 2;
    S.report = runEngine(S.plan);
    // a new search is a film shot: letterbox in, camera flight, title card, then the panel
    const id = ++flight, cine = !reduce, res = $("#result"), body = document.body;
    body.classList.remove("is-home", "card-in");
    body.classList.add("is-result");
    body.classList.toggle("is-flying", cine);
    res.hidden = false;
    res.classList.toggle("await", cine);
    if (!cine) replay(res);
    layout();
    G.setMarkers(S.report.ranked.map((r, i) => ({ id: r.site.id, lat: r.site.lat, lon: r.site.lon, rank: i + 1, kind: r.tag, label: `${i + 1}  ${nameOf(r.site)}` })));
    const ms = show(0, { cine }) || 0;
    if (cine && S.report.ranked[0]) {
      const r = S.report.ranked[0], t = S.report.target, card = ms * 0.55;
      // the title card types itself out in the bottom film bar
      typeText($("#cEyebrow"), `Earth analog for ${t.name} · ${t.body}`, { delay: card, speed: 16 });
      typeText($("#cName"), nameOf(r.site), { delay: card + 550, speed: 70 });
      typeText($("#cCoord"), placeOf(r.site), { delay: card + 550 + 70 * nameOf(r.site).length + 150, speed: 18 });
      const later = (f, at) => setTimeout(() => { if (id === flight) f(); }, at);
      later(() => body.classList.add("card-in"), card);
      later(() => { res.classList.remove("await"); replay(res); }, ms * 0.8);
      later(() => body.classList.remove("is-flying", "card-in"), ms + 2100);
    }
    try { history.replaceState(null, "", `#${plan.target}/${plan.subsystems.join("+")}`); } catch (e) { /* file:// */ }
  }
  function rerun() {
    S.report = runEngine(S.plan); S.idx = 0;
    G.setMarkers(S.report.ranked.map((r, i) => ({ id: r.site.id, lat: r.site.lat, lon: r.site.lon, rank: i + 1, kind: r.tag, label: `${i + 1}  ${nameOf(r.site)}` })));
    show(0);
  }

  function countUp(el, to, delay = 0) {
    if (reduce) { el.textContent = to; return; }
    const run = (el._run = (el._run || 0) + 1);
    if (delay) el.textContent = 0;
    const from = +el.textContent || 0, t0 = performance.now() + delay, ms = 900;
    const tick = t => {
      if (el._run !== run) return; // a newer count took over
      const k = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Shows site i and flies the globe to it; returns the flight time in ms.
  function show(i, opts = {}) {
    const R = S.report;
    S.idx = Math.max(0, Math.min(R.ranked.length - 1, i));
    const r = R.ranked[S.idx];
    if (!r) return 0;
    const s = r.site, t = R.target;
    $("#rRank").textContent = `${S.idx + 1} of ${R.ranked.length}`;
    $("#prev").disabled = S.idx === 0; $("#next").disabled = S.idx === R.ranked.length - 1;
    const badges = [];
    if (r.tag === "gem") badges.push(`<span class="tag gem">Hidden gem</span>`);
    else if (s.kind === "known") badges.push(`<span class="tag">Known analog</span>`);
    if (r.stability != null) badges.push(r.stability >= 0.5 ? `<span class="tag" title="Stays in the top 1% in ${Math.round(r.stability * 100)}% of 200 random weightings">Stable</span>` : `<span class="tag warn" title="Stays in the top 1% in ${Math.round(r.stability * 100)}% of 200 random weightings">Weight-sensitive</span>`);
    $("#rBadges").innerHTML = badges.join("");
    G.select(s.id);
    const ms = G.flyTo(s.lat, s.lon, { cinematic: !!opts.cine });
    // a cinematic search holds the panel back until 80% of the flight; text types in as it appears
    const at = opts.cine ? ms * 0.8 : 0;
    countUp($("#rPct"), Math.round(r.overall * 100), at);
    typeText($("#rTarget"), `${t.body} · ${t.name}`, { delay: at, speed: 18 });
    typeText($("#rName"), nameOf(s), { delay: at + 200, speed: 45 });
    typeText($("#rWhere"), placeOf(s), { delay: at + 500, speed: 16 });
    renderSlides(at);
    if (window.ZenithGround) window.ZenithGround.show(s, t, { name: nameOf(s), place: placeOf(s) });
    return ms;
  }
  $("#prev").onclick = () => show(S.idx - 1);
  $("#next").onclick = () => show(S.idx + 1);

  /* ---------- tabs ---------- */
  const TABS = [
    ["overview", "Overview"], ["similar", "Similar"], ["different", "Different"], ["season", "Season"],
    ["whatif", "What if"], ["hazards", "Hazards"], ["research", "Studies"], ["fits", "Teams"],
  ];
  function current() { return S.report.ranked[S.idx]; }
  function split(s, t) {
    const rows = FEAT.map(([f, label, fmt]) => ({ f, label, fmt, e: s.earth[f], tv: t.features[f], d: s.dims[DIM[f]], meta: t.meta && t.meta[f] }))
      .filter(x => x.e != null && x.tv != null);
    rows.push({ f: "geology", label: "Rock type", e: s.tags && s.tags.rock, tv: t.rock_classes.join(", "), d: s.dims.geology, txt: true });
    const offEarth = t.out_of_earth_range || {}; // shown under "Not testable anywhere on Earth" instead
    return { sim: rows.filter(x => x.d >= 0.6), diff: rows.filter(x => x.d < 0.6 && !offEarth[x.f]) };
  }
  /* ---------- fact cards: a stack you swipe through, one card per topic ---------- */
  const panel = $("#panel"), sbar = $("#slideBar"), N = TABS.length;
  let cardIdx = 0, counts = {}, cards = [], busy = false;
  function renderSlides(typeAt = 0) {
    const r = current(), t = S.report.target, sp = split(r.site, t);
    counts = { similar: sp.sim.length, different: sp.diff.length + S.report.cannotTest.length };
    panel.innerHTML = TABS.map(([id, label], k) =>
      `<section class="card" data-card="${id}" role="group" aria-roledescription="card" aria-label="${label}, ${k + 1} of ${N}"><div class="card-body">${PANELS[id](r, t, sp)}</div></section>`).join("");
    cards = [...panel.children];
    sbar.innerHTML = `
      <button type="button" class="step sl-step" data-step="-1" aria-label="Bring back the previous card">‹</button>
      <div class="sl-mid">
        <div class="sl-head"><b id="slTitle"></b><span id="slCount"></span></div>
        <div class="sl-dots" role="group" aria-label="Cards">${TABS.map(([id, label], k) =>
          `<button type="button" data-k="${k}" aria-label="${label}${counts[id] != null ? ` (${counts[id]})` : ""}"><i></i></button>`).join("")}</div>
      </div>
      <button type="button" class="step sl-step" data-step="1" aria-label="Next card">›</button>`;
    for (const id in BIND) BIND[id](r);
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
    typeText($("#slTitle"), counts[id] != null ? `${label} · ${counts[id]}` : label, { delay: typeAt, speed: 26 });
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

  const FEAT = [
    ["temp_min_K", "Coldest", v => `${Math.round(v - 273.15)} °C`],
    ["temp_daynight_range_K", "Day–night swing", v => `${Math.round(v)} K`],
    ["slope_deg", "Slope", v => `${v.toFixed(1)}°`],
    ["roughness_tri_m", "Ruggedness", v => `${Math.round(v)} m`],
    ["albedo_wsa_unitless", "Brightness (albedo)", v => v.toFixed(2)],
    ["precip_mm_per_yr", "Rain and snow", v => `${Math.round(v)} mm/yr`],
    ["ground_ice_frac", "Ground ice", v => (v >= 0.5 ? "Yes" : "No")],
    ["sun_noon_elev_mean_deg", "Noon Sun height", v => `${Math.round(v)}°`],
  ];
  const DIM = { temp_min_K: "thermal", temp_daynight_range_K: "thermal", slope_deg: "terrain", roughness_tri_m: "terrain", albedo_wsa_unitless: "surface", precip_mm_per_yr: "aridity", ground_ice_frac: "ice", sun_noon_elev_mean_deg: "illumination" };

  const compareRows = list => list.map(x => `<div class="row ${x.d < 0.6 ? "bad" : ""}"><span class="lbl">${esc(x.label)}</span>
      <span>${x.txt ? esc(x.e || "unknown") : x.fmt(x.e)}</span>
      <span>${x.txt ? esc(x.tv) : x.fmt(x.tv)}${x.meta && x.meta.status !== "computed" ? `<span class="st">${esc(x.meta.status)}</span>` : ""}</span>
      <span class="meter"><i style="width:${Math.round((x.d || 0) * 100)}%"></i></span></div>`).join("");

  const PANELS = {
    overview(r, t) {
      const opts = ["Moon", "Mars"].map(b => `<optgroup label="${b}">${Object.values(DATA.targets).filter(x => x.body === b).map(x => `<option value="${x.id}" ${x.id === S.plan.target ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`).join("");
      return `
      <div class="sec"><h2>Mission coverage</h2><div class="bars">${Object.entries(r.subsystems).map(([k, v]) => `<div class="bar"><span>${esc((SUBS[k] && SUBS[k].label) || k)}</span><span class="track"><span class="fill" data-v="${(v || 0).toFixed(3)}"></span></span><span class="v">${P(v)}%</span></div>`).join("")}</div></div>
      <div class="sec"><h2>Mission plan</h2>
        <select class="target" id="targetSel" aria-label="Base site">${opts}</select>
        <div class="plan-row">${Object.keys(SUBS).map(id => `<button class="chip" data-sub="${id}" aria-pressed="${S.plan.subsystems.includes(id)}">${esc(SUBS[id].label)}</button>`).join("")}</div>
      </div>`;
    },
    similar(r, t, sp) {
      return sp.sim.length ? `<div class="sec rows"><div class="row head"><span></span><span>Earth</span><span>${esc(t.name)}</span><span>Match</span></div>${compareRows(sp.sim)}</div>`
        : `<div class="empty"><b>Nothing closely matches</b>See Different.</div>`;
    },
    different(r, t, sp) {
      return `${sp.diff.length ? `<div class="sec rows"><div class="row head"><span></span><span>Earth</span><span>${esc(t.name)}</span><span>Match</span></div>${compareRows(sp.diff)}</div>` : ""}
      <div class="sec"><h2>Not testable anywhere on Earth</h2>${S.report.cannotTest.map(c => `<div class="never"><span class="lbl">${esc(c.what)}</span><span>${esc(String(c.target).replace(/\s*\(Earth[^)]*\)/, ""))}</span><span class="e">Earth: ${esc(String(c.earth).replace(/^(coldest bare ground|largest on Earth): /, ""))}</span></div>`).join("")}</div>`;
    },
    season(r) {
      const bm = F.bestMonths(r.site);
      if (!bm) return `<div class="empty"><b>No monthly data</b>for this cell.</div>`;
      const lo = Math.min(...bm.months.map(m => m.tmin)), hi = Math.max(...bm.months.map(m => m.tmin));
      return `<p class="big-line">${esc(bm.label)}</p>
        <div class="sec months">${bm.months.map((m, i) => `<div class="mo ${m.best ? "best" : ""} ${m.dark ? "dark" : ""}" title="${m.name}: low ${m.tmin.toFixed(1)} °C · rain ${m.precip.toFixed(2)} mm/day${m.dark ? " · polar night" : ""}"><span>${Math.round(m.tmin)}°</span><div class="col" style="height:${Math.round(12 + 88 * (hi - m.tmin) / Math.max(1, hi - lo))}%;animation-delay:${i * 30}ms"></div><span>${m.name[0]}</span></div>`).join("")}</div>
        <p class="note">Coldest, driest months with daylight. Bars: average daily low. Pale: polar night. NASA POWER monthly means.</p>`;
    },
    whatif() {
      return `<div class="seg" role="group" aria-label="Target conditions">${["−20%", "−10%", "Now", "+10%", "+20%"].map((l, i) => `<button data-i="${i}" aria-pressed="${i === S.wi}">${l}</button>`).join("")}</div>
        <div class="seg-ends"><span>Milder</span><span>Harsher</span></div>
        <div id="wiOut"></div>
        <p class="note">Target cold, swing, slope and ruggedness shifted, every cell re-scored.</p>`;
    },
    hazards(r) {
      return `<div class="list">${F.hazards(r.site).map(h => `<div class="item"><span class="sev ${h.level}">${h.level === "high" ? "HIGH" : h.level === "low" ? "LOW" : "MED"}</span><span><b>${esc(h.risk)}</b><p>${esc(h.prep)}</p></span></div>`).join("")}</div>`;
    },
    research(r) {
      const st = r.site.studied || [];
      return st.length ? `<div class="list">${st.map(x => `<a class="link" href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.name)}</b><span>${x.km} km away · ${esc(x.for)}</span></a>`).join("")}</div>`
        : `<div class="empty"><b>No studies within 150 km</b>Nearest: ${esc(r.site.nearest_known.name)}, ${r.site.nearest_known.km} km.</div>`;
    },
    fits(r) {
      const fits = F.alsoFits(r.site, S.plan, DATA, p => runEngine(p), LIBRARY);
      const can = r.site.canada;
      return `${fits.length ? `<div class="sec list">${fits.map(f => `<button class="fit" data-id="${f.mission.id}"><span><b>${esc(f.mission.title)}</b><span>#${f.rank} for ${esc(DATA.targets[f.mission.target].name)}</span></span><span class="go">Open →</span></button>`).join("")}</div>`
        : `<div class="empty"><b>No other mission ranks it top 15</b></div>`}
      ${can ? `<div class="sec"><h2>Canada national grid</h2><div class="kv">
        <div><span>Slope</span><span>${can.slope_deg}°</span></div><div><span>Relief</span><span>${Math.round(can.relief_m)} m</span></div>
        <div><span>Albedo</span><span>${can.albedo}</span></div><div><span>Precip</span><span>${can.precip_mm_yr == null ? "–" : Math.round(can.precip_mm_yr) + " mm"}</span></div></div></div>` : ""}`;
    },
  };
  const BIND = {
    overview() {
      $("#targetSel").onchange = e => { S.plan.target = e.target.value; rerun(); };
      document.querySelectorAll(".chip[data-sub]").forEach(b => b.onclick = () => {
        const a = S.plan.subsystems, id = b.dataset.sub;
        if (a.includes(id)) { if (a.length > 1) a.splice(a.indexOf(id), 1); } else a.push(id);
        rerun();
      });
    },
    whatif(r) {
      const wi = F.whatIf(r.site);
      const upd = () => {
        const w = wi[S.wi], base = wi[2].pct, top = 100 - w.pct;
        const v = top <= 1 ? ["Holds in the top 1%", ""] : top <= 5 ? ["Still top 5%", ""] : ["Drops out of the top 5%", "down"];
        $("#wiOut").innerHTML = `<div class="readout"><b>Top ${topFmt(w.pct)}%</b></div><span class="verdict ${v[1]}">${v[0]}</span>${S.wi !== 2 ? ` <span class="note">(${w.pct - base >= 0 ? "+" : ""}${(w.pct - base).toFixed(2)} pts)</span>` : ""}`;
        document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.i === S.wi));
      };
      document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { S.wi = +b.dataset.i; upd(); });
      upd();
    },
    fits() {
      document.querySelectorAll(".fit").forEach(b => b.onclick = () => pick(LIBRARY.find(m => m.id === b.dataset.id)));
    },
  };

  /* ---------- globe ---------- */
  G.onPick(id => { const i = S.report ? S.report.ranked.findIndex(r => r.site.id === id) : -1; if (i >= 0) show(i); });
  function layout() {
    const m = innerWidth <= 900;
    if (document.body.classList.contains("is-result")) {
      if (m) G.setLayout({ cx: 0.5, cy: 0.55, r: 0.42, maxX: 1 });
      else { const free = innerWidth - Math.min(540, innerWidth - 32) - 32; G.setLayout({ cx: free / 2 / innerWidth, cy: 0.54, r: Math.min(0.42, free / innerHeight * 0.4), maxX: free / innerWidth }); }
    } else G.setLayout({ cx: 0.5, cy: 0.44, r: m ? 0.42 : 0.33, maxX: 1 });
  }
  addEventListener("resize", layout);
  addEventListener("keydown", e => {
    if (!S.report || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (e.target.closest && e.target.closest("#panel, #slideBar, .dz")) return; // arrows there move slides or sliders
    if (e.key === "ArrowRight") show(S.idx + 1);
    if (e.key === "ArrowLeft") show(S.idx - 1);
    if (e.key === "/") { e.preventDefault(); q.focus(); }
  });

  // used by the Design controls' "Replay flight"
  window.ZenithReplay = () => (S.plan ? go(S.text, { target: S.plan.target, subsystems: S.plan.subsystems.slice() }) : pick(LIBRARY[0]));

  G.init($("#globe"));
  layout();
  const h = location.hash.match(/^#(\w+)\/([\w+]+)/);
  if (h && DATA.targets[h[1]]) {
    const lib = LIBRARY.find(x => x.target === h[1]);
    q.value = lib ? lib.title : DATA.targets[h[1]].name;
    go(q.value, { target: h[1], subsystems: h[2].split("+") });
  }
})();
