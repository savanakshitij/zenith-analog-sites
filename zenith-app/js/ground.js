/*
 * Ground comparison window: the Earth site and its Moon or Mars target as two 3D terrain blocks,
 * side by side, turned together. Uses three.js (r128) from cdnjs.
 *
 * The blocks are built from each place's measured values in data/zenith-data.js:
 *   mean slope sets how steep the ground is, ruggedness sets how much fine detail it has,
 *   brightness (albedo) and surface type set the colour, and craters, pits and ice are added
 *   where the data records them. They illustrate those numbers; they are not survey maps.
 * Both blocks share one vertical scale, so the comparison is fair.
 */
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const N = 81, PATCH_M = 12000, DX = PATCH_M / (N - 1); // a 12 km square, 150 m grid

  /* ---------- window ---------- */
  const win = document.createElement("section");
  win.className = "ground"; win.id = "ground"; win.hidden = true;
  win.setAttribute("aria-label", "Ground comparison in 3D");
  win.innerHTML = `
    <header class="g-head">
      <span class="g-title">Ground comparison</span>
      <span class="g-tools">
        <button type="button" class="g-btn" data-act="size" aria-label="Enlarge" title="Enlarge">⤢</button>
        <button type="button" class="g-btn" data-act="hide" aria-label="Hide" title="Hide">–</button>
      </span>
    </header>
    <div class="g-stage">
      <canvas class="g-canvas" aria-hidden="true"></canvas>
      <div class="g-lab" data-side="0"><span class="g-eye"></span><b class="g-name"></b><span class="g-stats"></span></div>
      <div class="g-lab" data-side="1"><span class="g-eye"></span><b class="g-name"></b><span class="g-stats"></span></div>
    </div>
    <p class="g-note"></p>`;
  const pill = document.createElement("button");
  pill.type = "button"; pill.className = "g-pill"; pill.hidden = true; pill.textContent = "3D ground";
  document.body.append(win, pill);
  const stage = win.querySelector(".g-stage"), canvas = win.querySelector(".g-canvas");
  const labs = [...win.querySelectorAll(".g-lab")], note = win.querySelector(".g-note");

  let userHidden = false, big = false, current = null;
  const inPanel = matchMedia("(max-width: 1100px)");
  function place() {
    // wide screens: a small window floating over the globe; narrower: inside the results panel
    if (inPanel.matches) { const bar = document.getElementById("slideBar"); if (bar && win.nextElementSibling !== bar) bar.before(win); }
    else if (win.parentElement !== document.body) document.body.append(win);
    win.classList.toggle("in-panel", inPanel.matches);
    sync();
  }
  inPanel.addEventListener ? inPanel.addEventListener("change", place) : inPanel.addListener(place);
  function sync() {
    const on = !!current && document.body.classList.contains("is-result");
    win.hidden = !on || userHidden;
    pill.hidden = !on || !userHidden || inPanel.matches;
    if (!win.hidden && window.THREE) { resize(); kick(); }
  }
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  win.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "hide") { userHidden = true; sync(); pill.focus(); }
    if (b.dataset.act === "size") {
      big = !big; win.classList.toggle("big", big);
      b.setAttribute("aria-label", big ? "Make smaller" : "Enlarge"); b.title = b.getAttribute("aria-label"); b.textContent = big ? "⤡" : "⤢";
      requestAnimationFrame(() => { resize(); kick(); });
    }
  });
  pill.addEventListener("click", () => { userHidden = false; sync(); });

  if (!window.THREE) {
    stage.innerHTML = `<p class="g-fallback">The 3D ground view needs an internet connection to load. Everything else works.</p>`;
    window.ZenithGround = { show(site, target, info) { current = { site, target, info }; sync(); } };
    place();
    return;
  }

  /* ---------- terrain from measured values ---------- */
  function hash(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // fractal value noise; p is how much each finer layer keeps (more = rougher)
  function fbm(rnd, p) {
    const out = new Float32Array(N * N);
    let amp = 1, freq = 2;
    for (let o = 0; o < 6; o++) {
      const g = freq + 1, lat = Float32Array.from({ length: g * g }, () => rnd() * 2 - 1);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = i / (N - 1) * freq, y = j / (N - 1) * freq;
        const xi = Math.min(freq - 1, Math.floor(x)), yi = Math.min(freq - 1, Math.floor(y));
        let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        const a = lat[yi * g + xi], b = lat[yi * g + xi + 1], c = lat[(yi + 1) * g + xi], d = lat[(yi + 1) * g + xi + 1];
        out[j * N + i] += amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy);
      }
      amp *= p; freq *= 2;
    }
    return out;
  }
  function meanSlopeDeg(h) {
    let s = 0, n = 0;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const gx = (h[j * N + i + 1] - h[j * N + i - 1]) / (2 * DX), gy = (h[(j + 1) * N + i] - h[(j - 1) * N + i]) / (2 * DX);
      s += Math.atan(Math.hypot(gx, gy)); n++;
    }
    return (s / n) * 180 / Math.PI;
  }
  // an impact crater (bowl and raised rim) or a steep-walled pit, in metres
  function crater(f, cx, cy, R, depth, rim, pit) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const r = Math.hypot(i * DX - cx, j * DX - cy) / R;
      let h;
      if (pit) h = r < 1 ? -depth * (1 - Math.pow(r, 6)) : 0;
      else h = r < 1 ? depth * (r * r - 1) + rim : rim * Math.pow(1 / r, 3);
      f[j * N + i] += h;
    }
  }

  // spec: { slope, rough, seed, craters: [{x,y,R}], pits: [...] }
  function field(spec) {
    const rnd = rng(spec.seed);
    // ruggedness relative to slope picks how much fine detail there is
    const ratio = spec.rough / Math.max(1, Math.tan(Math.max(0.05, spec.slope) * Math.PI / 180) * 1000);
    const p = Math.max(0.32, Math.min(0.66, 0.5 + 0.15 * Math.log2(ratio / 5)));
    const base = fbm(rnd, spec.icy ? p - 0.1 : p);
    const feat = new Float32Array(N * N);
    for (const c of spec.craters) crater(feat, c.x, c.y, c.R, c.R * 0.4, c.R * 0.07, false);
    for (const c of spec.pits) crater(feat, c.x, c.y, c.R, c.R * 0.18, 0, true); // shallow: real skylights are tens of metres deep
    // keep features from making the ground steeper than measured
    const fs = meanSlopeDeg(feat);
    if (fs > spec.slope * 0.7 && fs > 0) for (let k = 0; k < feat.length; k++) feat[k] *= (spec.slope * 0.7) / fs;
    // scale the noise until the mean slope matches the measured one
    let k = spec.slope / Math.max(1e-6, meanSlopeDeg(base));
    const h = new Float32Array(N * N);
    for (let it = 0; it < 4; it++) {
      for (let q = 0; q < h.length; q++) h[q] = base[q] * k + feat[q];
      const s = meanSlopeDeg(h);
      if (!s || Math.abs(s - spec.slope) < 0.02 * spec.slope) break;
      k *= spec.slope / s;
    }
    let lo = Infinity, hi = -Infinity;
    for (const v of h) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return { h, lo, hi, relief: hi - lo };
  }

  // colours: Earth by surface type, Moon grey, Mars rust; brightness follows albedo
  function surfaceColour(kind, v) {
    const a = v.albedo == null ? 0.2 : v.albedo;
    if (kind === "Moon") { const g = Math.min(0.7, 0.3 + 1.1 * a); return [g, g, g * 1.03]; }
    if (kind === "Mars") { const b = Math.min(1.15, 0.85 + a); return [0.68 * b, 0.4 * b, 0.26 * b]; }
    if (v.icy) return [0.86, 0.89, 0.94];
    const b = Math.max(0.65, Math.min(1.15, 0.8 + 0.9 * (a - 0.2)));
    return (v.precip != null && v.precip < 250) ? [0.7 * b, 0.58 * b, 0.44 * b] : [0.5 * b, 0.47 * b, 0.4 * b];
  }

  function earthSpec(s) {
    const e = s.earth || {}, rnd = rng(hash(s.id) ^ 0x9e37);
    const craters = [], pits = [];
    if (s.tags && s.tags.impact_crater) craters.push({ x: PATCH_M * 0.5, y: PATCH_M * 0.5, R: 3200 });
    if (s.tags && s.tags.lava_tube) pits.push({ x: PATCH_M * (0.35 + rnd() * 0.3), y: PATCH_M * (0.35 + rnd() * 0.3), R: 260 });
    const icy = (e.ground_ice_frac != null && e.ground_ice_frac >= 0.5) || (e.albedo_wsa_unitless != null && e.albedo_wsa_unitless >= 0.45);
    return { slope: e.slope_deg || 0.3, rough: e.roughness_tri_m || 20, seed: hash(s.id), craters, pits, icy,
      look: { albedo: e.albedo_wsa_unitless, precip: e.precip_mm_per_yr, icy } };
  }
  function targetSpec(t) {
    const f = t.features || {}, rnd = rng(hash(t.id) ^ 0x51ed);
    const craters = [], pits = [];
    if (/rim/i.test(t.name)) craters.push({ x: PATCH_M * 1.05, y: PATCH_M * 0.55, R: PATCH_M * 0.6 }); // the rim of a large crater crosses the patch
    if (t.impact_counts) {
      const n = t.body === "Moon" ? 7 : 3;
      for (let k = 0; k < n; k++) craters.push({ x: PATCH_M * (0.1 + rnd() * 0.8), y: PATCH_M * (0.1 + rnd() * 0.8), R: 300 + rnd() * (t.body === "Moon" ? 1400 : 900) });
    }
    if (/lava|pit/i.test(t.name)) pits.push({ x: PATCH_M * 0.55, y: PATCH_M * 0.45, R: 650 });
    return { slope: f.slope_deg || 0.3, rough: f.roughness_tri_m || 20, seed: hash(t.id), craters, pits, icy: !!t.icy,
      look: { albedo: f.albedo_wsa_unitless } };
  }

  /* ---------- three.js scene: two blocks, one renderer ---------- */
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setScissorTest(true);

  const views = [0, 1].map(() => {
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xdde6ff, 0x24262e, 0.6));
    const sun = new T.DirectionalLight(0xffffff, 1.05);
    sun.position.set(-2.2, 2.6, 1.4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.1, far: 10 });
    sun.shadow.bias = -0.0015;
    scene.add(sun);
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
    return { scene, camera, group: null };
  });

  function block(fd, ve, colour, seed) {
    const g = new T.Group(), rnd = rng(seed);
    const toY = m => (m - fd.lo) * ve / PATCH_M * 2; // 12 km across = 2 units
    const geo = new T.PlaneGeometry(2, 2, N - 1, N - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const span = Math.max(1e-6, fd.relief);
    for (let v = 0; v < pos.count; v++) {
      const i = v % N, j = Math.floor(v / N), m = fd.h[j * N + i];
      pos.setY(v, toY(m));
      const shade = (0.9 + 0.18 * (m - fd.lo) / span) * (1 + (rnd() - 0.5) * 0.06);
      col[v * 3] = colour[0] * shade; col[v * 3 + 1] = colour[1] * shade; col[v * 3 + 2] = colour[2] * shade;
    }
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const top = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
    top.castShadow = top.receiveShadow = true;
    g.add(top);
    // side walls down to a flat base, like a core sample
    const base = -0.16, verts = [], idx = [];
    const edge = (pts) => {
      const o = verts.length / 3;
      pts.forEach(([x, z, y]) => { verts.push(x, y, z, x, base, z); });
      for (let k = 0; k < pts.length - 1; k++) { const a = o + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    };
    const at = (i, j) => [-1 + 2 * i / (N - 1), -1 + 2 * j / (N - 1), toY(fd.h[j * N + i])];
    const r = [...Array(N).keys()];
    edge(r.map(i => at(i, N - 1)));            // near side
    edge(r.map(j => at(N - 1, N - 1 - j)));    // right side
    edge(r.map(i => at(N - 1 - i, 0)));        // far side
    edge(r.map(j => at(0, j)));                // left side
    const sg = new T.BufferGeometry();
    sg.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    sg.setIndex(idx); sg.computeVertexNormals();
    const wall = new T.Color(colour[0] * 0.32, colour[1] * 0.32, colour[2] * 0.32);
    const sides = new T.Mesh(sg, new T.MeshStandardMaterial({ color: wall, roughness: 1, metalness: 0, side: T.DoubleSide }));
    sides.castShadow = sides.receiveShadow = true;
    g.add(sides);
    g.position.y = -0.35;
    return g;
  }
  function dispose(g) { if (!g) return; g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }

  /* ---------- camera, drag to turn, slow turn when idle ---------- */
  let yaw = -0.6, pitch = 0.5, drag = null, lastTouch = 0, raf = 0;
  function aim(v) {
    // far enough back that the whole block fits the view's width and height
    const vf = v.camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * v.camera.aspect);
    const r = Math.max(1.55 / Math.tan(hf), 1.25 / Math.tan(vf)) + 1.1;
    v.camera.position.set(r * Math.cos(pitch) * Math.sin(yaw), r * Math.sin(pitch), r * Math.cos(pitch) * Math.cos(yaw));
    v.camera.lookAt(0, 0.28, 0); // aim above the block so it sits low, clear of the labels
  }
  function render() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const stacked = w < 360; // very narrow: one above the other
    views.forEach((v, k) => {
      const vw = stacked ? w : w / 2, vh = stacked ? h / 2 : h;
      const x = stacked ? 0 : k * vw, y = stacked ? (1 - k) * vh : 0;
      v.camera.aspect = vw / vh; v.camera.updateProjectionMatrix(); aim(v);
      renderer.setViewport(x, y, vw, vh); renderer.setScissor(x, y, vw, vh);
      renderer.render(v.scene, v.camera);
    });
    win.classList.toggle("stacked", stacked);
  }
  function loop() {
    raf = 0;
    if (win.hidden || !current) return;
    const idle = !drag && performance.now() - lastTouch > 2500 && !reduce;
    if (idle) yaw += 0.0035;
    render();
    if (idle || drag) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) renderer.setSize(w, h, false);
  }
  new ResizeObserver(() => { resize(); kick(); }).observe(stage);
  canvas.addEventListener("pointerdown", e => {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    kick();
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    yaw = drag.yaw - (e.clientX - drag.x) * 0.012;
    pitch = Math.max(0.18, Math.min(1.15, drag.pitch + (e.clientY - drag.y) * 0.006));
    lastTouch = performance.now();
  });
  const end = e => { if (drag && e.pointerId === drag.id) { drag = null; lastTouch = performance.now(); kick(); } };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  /* ---------- public: called by the app for each result ---------- */
  const fmt = (v, d = 0) => (v == null ? "–" : (+v).toFixed(d));
  // Building two 81 x 81 terrain blocks costs tens of milliseconds, so it never runs inside the caller's frame:
  // it waits for opts.delay (the camera flight), then runs in three idle steps. A newer call cancels an older one.
  let token = 0, timer = 0;
  const idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 16));
  function show(site, target, info, opts) {
    const my = ++token; clearTimeout(timer);
    current = { site, target, info };
    sync();
    const run = () => {
      let es, ts, fe, ft, ve;
      const steps = [
        () => { es = earthSpec(site); ts = targetSpec(target); fe = field(es); },
        () => { ft = field(ts); ve = Math.max(1, Math.min(10, Math.round(0.3 * PATCH_M / Math.max(1, fe.relief, ft.relief) * 2) / 2)); },
        () => {
          // one vertical scale for both, so heights compare directly
          const blocks = [block(fe, ve, surfaceColour("Earth", es.look), es.seed), block(ft, ve, surfaceColour(target.body, ts.look), ts.seed)];
          views.forEach((v, k) => { if (v.group) { v.scene.remove(v.group); dispose(v.group); } v.group = blocks[k]; v.scene.add(v.group); });
          label(site, target, info, fe, ft, ve);
        },
      ];
      const next = () => { if (my !== token) return; steps.shift()(); if (steps.length) idle(next); };
      idle(next);
    };
    const d = (opts && opts.delay) || 0;
    d > 0 ? (timer = setTimeout(run, d)) : run();
  }
  function label(site, target, info, fe, ft, ve) {
    const e = site.earth || {}, f = target.features || {};
    const set = (k, eye, name, slope, rough, alb, relief) => {
      labs[k].querySelector(".g-eye").textContent = eye;
      labs[k].querySelector(".g-name").textContent = name;
      labs[k].querySelector(".g-stats").innerHTML = `<span>${fmt(slope, 1)}° slope</span><span>${fmt(rough)} m rugged</span><span>albedo ${fmt(alb, 2)}</span><span>${fmt(relief)} m relief</span>`;
    };
    set(0, "Earth site", info && info.name, e.slope_deg, e.roughness_tri_m, e.albedo_wsa_unitless, fe.relief);
    set(1, `${target.body} target`, target.name, f.slope_deg, f.roughness_tri_m, f.albedo_wsa_unitless, ft.relief);
    note.textContent = `12 km squares built from each place's measured slope, ruggedness and brightness, not survey maps. Same scale, height ×${ve}. Drag to turn.`;
    win.setAttribute("aria-label", `Ground comparison in 3D: ${(info && info.name) || "Earth site"} on Earth beside ${target.name}`);
    sync();
  }
  window.ZenithGround = { show };
  place();
})();
