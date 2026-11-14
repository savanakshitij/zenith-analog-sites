/*
 * Earth globe. Photoreal when WebGL is available: NASA Blue Marble (day), Black Marble
 * (city lights at night) and a cloud layer, lit by one sun, with a thin atmosphere.
 * Falls back to a flat d3 globe while textures load or without WebGL.
 * Three layers: #stars (static 2D), #earth (WebGL), #globe (2D overlay: markers, labels, input).
 * Uses d3's orthographic projection for markers so they sit exactly on the shaded sphere.
 */
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let canvas, ctx, starCanvas, earthCanvas, gl = null, prog = null, uni = {}, tex = {}, ready = false;
  let W = 0, H = 0, dpr = 1;
  const countries = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries).features;
  const borders = topojson.mesh(WORLD_TOPO, WORLD_TOPO.objects.countries, (a, b) => a !== b);
  const projection = d3.geoOrthographic().clipAngle(90).precision(0.5);
  let path;
  let rotation = [10, -15, 0], spin = !reduceMotion, flying = null, pulse = 0;
  let zoom = 1, landAt = -1e9, lastT = performance.now(), starScale = 1;
  let markers = [], selected = null, onPick = null;
  // layout eases toward goal each frame, so the globe glides when the panel opens
  let layout = { cx: 0.5, cy: 0.5, r: 0.36, maxX: 1 }, goal = { ...layout }, placed = false;
  let flags = [], onClick = null, heatOn = false, heatTex = null;
  const t0 = performance.now();
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const clamp01 = t => Math.max(0, Math.min(1, t));
  // overlay colours and label font come from the page's look (CSS tokens); re-read when it changes
  let theme = { reticle: "255, 255, 255", label: "#fc3d21", ink: "#ffffff", dot: "#fc3d21", font: "'Public Sans', system-ui, sans-serif" };
  function readTheme() {
    const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
    theme = { reticle: v("--reticle-rgb") || theme.reticle, label: v("--label-bg") || theme.label, ink: v("--label-ink") || theme.ink, dot: v("--dot-bg") || theme.dot, font: v("--head-font") || theme.font };
  }
  addEventListener("zenith:look", readTheme);

  /* ---------- stars: drawn once per resize ---------- */
  function drawStars() {
    if (!starCanvas) return;
    const s = starCanvas.getContext("2d");
    starCanvas.width = W * dpr; starCanvas.height = H * dpr;
    s.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.fillStyle = "#000"; s.fillRect(0, 0, W, H);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0, n = Math.round(W * H / 1500); i < n; i++) {
      const x = rnd() * W, y = rnd() * H, k = rnd();
      const big = k < 0.04, mid = k < 0.2;
      s.globalAlpha = big ? 1 : mid ? 0.85 : 0.45 + rnd() * 0.4;
      s.fillStyle = rnd() < 0.12 ? "#cfe0ff" : rnd() < 0.06 ? "#fff1d6" : "#ffffff";
      s.beginPath(); s.arc(x, y, big ? 1.5 : mid ? 1 : 0.7, 0, 7); s.fill();
    }
    s.globalAlpha = 1;
  }

  /* ---------- twinkling stars: a few bright ones on the overlay, with diffraction spikes ---------- */
  let seedT = 11;
  const rndT = () => (seedT = (seedT * 16807) % 2147483647) / 2147483647;
  const twinkles = Array.from({ length: 70 }, () => ({ x: rndT(), y: rndT(), s: 0.6 + rndT() * 1.3, ph: rndT() * 6.28, sp: 0.5 + rndT() * 1.6 }));
  function drawTwinkles(cx, cy, r) {
    if (reduceMotion) return;
    const t = (performance.now() - t0) / 1000;
    ctx.fillStyle = "#ffffff";
    for (const s of twinkles) {
      const x = s.x * W, y = s.y * H;
      if ((x - cx) ** 2 + (y - cy) ** 2 < (r + 8) ** 2) continue; // never in front of Earth
      const a = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      ctx.globalAlpha = a * a * 0.9;
      ctx.beginPath(); ctx.arc(x, y, s.s, 0, 7); ctx.fill();
      if (s.s > 1.5) {
        ctx.globalAlpha *= 0.5;
        ctx.fillRect(x - s.s * 3.5, y - 0.35, s.s * 7, 0.7);
        ctx.fillRect(x - 0.35, y - s.s * 3.5, 0.7, s.s * 7);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- WebGL earth ---------- */
  const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  const FS = `
precision highp float;
uniform sampler2D uDay, uNight, uClouds, uHeat;
uniform float uHeatOn;
uniform vec2 uCenter; uniform float uR, uLambda, uPhi, uTime;
const float PI = 3.14159265;
void main() {
  vec2 v = (gl_FragCoord.xy - uCenter) / uR;
  float d = length(v);
  if (d > 1.0) {
    float a = exp(-(d - 1.0) * 28.0) * 0.55;          // thin outer atmosphere
    gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * a, a);
    return;
  }
  float sz = sqrt(1.0 - d * d);
  // invert d3's orthographic rotate([lambda, phi, 0])
  float Xp = sz, Yp = v.x, Zp = v.y;
  float x = Xp * cos(uPhi) + Zp * sin(uPhi);
  float y = Yp;
  float z = -Xp * sin(uPhi) + Zp * cos(uPhi);
  float lon = atan(y, x) - uLambda;
  float lat = asin(clamp(z, -1.0, 1.0));
  vec2 uv = vec2(fract((lon + PI) / (2.0 * PI)), (PI / 2.0 - lat) / PI);
  vec2 cuv = vec2(fract(uv.x - uTime * 0.0004), uv.y);

  vec3 n = vec3(v, sz);
  vec3 sun = normalize(vec3(-0.55, 0.5, 0.68));
  float diff = dot(n, sun);
  float day = smoothstep(-0.12, 0.2, diff);

  vec3 dayCol = texture2D(uDay, uv).rgb;
  dayCol = pow(dayCol, vec3(0.92)) * 1.08;
  float cloud = texture2D(uClouds, cuv).r;
  dayCol = mix(dayCol, vec3(1.0), cloud * 0.85);
  vec3 lit = dayCol * (0.25 + 0.85 * max(diff, 0.0));
  vec3 nightCol = texture2D(uNight, uv).rgb * vec3(1.0, 0.85, 0.6) * 1.4 * (1.0 - cloud * 0.7);
  vec3 col = mix(nightCol + dayCol * 0.03, lit, day);

  // sun glint on water (water is dark and blue in the day texture)
  float water = smoothstep(0.12, 0.0, dayCol.r + dayCol.g * 0.5 - dayCol.b * 0.6) * (1.0 - cloud);
  vec3 h = normalize(sun + vec3(0.0, 0.0, 1.0));
  col += vec3(0.9, 0.95, 1.0) * pow(max(dot(n, h), 0.0), 60.0) * 0.35 * water * day;

  // atmosphere at the limb, brighter on the day side
  float rim = pow(1.0 - sz, 3.0);
  col = mix(col, vec3(0.45, 0.7, 1.0), rim * (0.25 + 0.6 * day));
  if (uHeatOn > 0.5) {                                  // match-score layer: dim the photo, draw scored cells flat
    vec4 h = texture2D(uHeat, uv);
    col = mix(col * 0.28, h.rgb * (0.82 + 0.18 * max(diff, 0.0)), h.a);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

  function initGL() {
    if (!earthCanvas || !window.EARTH_TEX) return;
    gl = earthCanvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) return;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.warn("globe: WebGL shader failed, using flat globe", e); gl = null; return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const k of ["uDay", "uNight", "uClouds", "uHeat", "uHeatOn", "uCenter", "uR", "uLambda", "uPhi", "uTime"]) uni[k] = gl.getUniformLocation(prog, k);
    let loaded = 0;
    ["day", "night", "clouds"].forEach((k, i) => {
      const t = gl.createTexture(); tex[k] = t;
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      const img = new Image();
      img.onload = () => {
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        // no mipmaps: avoids a seam where longitude wraps
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (++loaded === 3) { ready = true; document.body.classList.add("globe-photo"); }
      };
      img.src = window.EARTH_TEX[k];
    });
    gl.uniform1i(uni.uDay, 0); gl.uniform1i(uni.uNight, 1); gl.uniform1i(uni.uClouds, 2); gl.uniform1i(uni.uHeat, 3);
    heatTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, heatTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  function drawGL(cx, cy, r) {
    if (earthCanvas.width !== Math.round(W * dpr) || earthCanvas.height !== Math.round(H * dpr)) {
      earthCanvas.width = Math.round(W * dpr); earthCanvas.height = Math.round(H * dpr);
    }
    gl.viewport(0, 0, earthCanvas.width, earthCanvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uni.uCenter, cx * dpr, (H - cy) * dpr);
    gl.uniform1f(uni.uR, r * dpr);
    gl.uniform1f(uni.uLambda, rotation[0] * Math.PI / 180);
    gl.uniform1f(uni.uPhi, rotation[1] * Math.PI / 180);
    gl.uniform1f(uni.uHeatOn, heatOn ? 1 : 0);
    gl.uniform1f(uni.uTime, reduceMotion ? 0 : (performance.now() - t0) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- flat fallback ---------- */
  function drawFlat(cx, cy, r) {
    const sea = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.05, cx, cy, r);
    sea.addColorStop(0, "#1f6fe0"); sea.addColorStop(0.55, "#0d4fbf"); sea.addColorStop(1, "#06266b");
    ctx.fillStyle = sea; ctx.beginPath(); path({ type: "Sphere" }); ctx.fill();
    for (const f of countries) {
      ctx.fillStyle = f.properties.name === "Antarctica" || f.properties.name === "Greenland" ? "#ffffff" : "#e9edf2";
      ctx.beginPath(); path(f); ctx.fill();
    }
    ctx.strokeStyle = "rgba(11,61,145,.25)"; ctx.lineWidth = 0.5; ctx.beginPath(); path(borders); ctx.stroke();
    ctx.strokeStyle = "rgba(140,190,255,.55)"; ctx.lineWidth = 1.2; ctx.beginPath(); path({ type: "Sphere" }); ctx.stroke();
  }

  /* ---------- overlay ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    drawStars();
  }

  // four corner brackets around a point, like a camera's focus box
  function brackets(x, y, s, color) {
    const a = Math.max(5, s * 0.38);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const px = x + sx * s, py = y + sy * s;
      ctx.moveTo(px - sx * a, py); ctx.lineTo(px, py); ctx.lineTo(px, py - sy * a);
    }
    ctx.stroke();
  }

  function draw() {
    const cx = W * layout.cx, cy = H * layout.cy, r = Math.min(W, H) * layout.r * zoom;
    projection.translate([cx, cy]).scale(r).rotate(rotation);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (gl && ready) drawGL(cx, cy, r);
    else drawFlat(cx, cy, r);
    drawTwinkles(cx, cy, r);

    const center = projection.invert([cx, cy]);
    for (const f of flags) {                                // known analog sites: small hollow squares
      if (d3.geoDistance([f.lon, f.lat], center) > Math.PI / 2 - 0.03) continue;
      const [x, y] = projection([f.lon, f.lat]);
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 1.5; ctx.strokeRect(x - 4, y - 4, 8, 8);
      if (f.label && zoom > 1.6) { ctx.font = "600 11px "; ctx.font = `600 11px ${theme.font}`; ctx.fillStyle = "#ffd23f"; ctx.fillText(f.label, x + 8, y + 4); }
    }
    const list = markers.slice().sort((a, b) => (a.id === selected) - (b.id === selected) || b.rank - a.rank);
    for (const m of list) {
      if (d3.geoDistance([m.lon, m.lat], center) > Math.PI / 2 - 0.03) continue;
      const [x, y] = projection([m.lon, m.lat]);
      const sel = m.id === selected;
      const big = !sel && (m.rank <= 3 || m.pick);
      ctx.beginPath(); ctx.arc(x, y, sel ? 6.5 : big ? 7.5 : 3.5, 0, 7);
      ctx.fillStyle = sel ? theme.dot : "#ffffff"; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = sel ? "#ffffff" : "#0b3d91"; ctx.stroke();
      if (big && m.rank) { ctx.font = `800 10px ${theme.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#0b3d91"; ctx.fillText(String(m.rank), x, y + 0.5); ctx.textAlign = "start"; ctx.textBaseline = "alphabetic"; }
      if (!sel || flying) continue;
      // target lock after landing: crosshair flash, brackets close in, then the label fades up
      const age = performance.now() - landAt, k = reduceMotion ? 1 : easeOutCubic(clamp01(age / 700));
      if (!reduceMotion && age < 1200) {
        ctx.strokeStyle = `rgba(${theme.reticle},${0.45 * (1 - age / 1200)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W * layout.maxX, y); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      brackets(x, y, 13 + 85 * (1 - k), `rgba(${theme.reticle},${0.35 + 0.65 * k})`);
      const p = (pulse % 80) / 80;
      ctx.beginPath(); ctx.arc(x, y, 8 + p * 24, 0, 7);
      ctx.strokeStyle = `rgba(${theme.reticle},${1 - p})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = reduceMotion ? 1 : clamp01((age - 300) / 400);
      label(x, y, m.label, cx + r);
      ctx.globalAlpha = 1;
    }
  }

  function label(x, y, text, maxX) {
    ctx.font = `700 13px ${theme.font}`;
    const w = ctx.measureText(text).width + 16, ly = y - 30;
    let lx = x + 12;
    if (lx + w > Math.min(W * layout.maxX - 8, maxX + 30)) lx = x - 12 - w;
    ctx.fillStyle = theme.label;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, w, 22, 6) : ctx.rect(lx, ly, w, 22); ctx.fill();
    ctx.strokeStyle = `rgba(${theme.reticle},.55)`; ctx.lineWidth = 1; ctx.stroke(); // hairline, so a dark label holds against the ocean
    ctx.fillStyle = theme.ink; ctx.fillText(text, lx + 8, ly + 15);
  }

  function frame() {
    const now = performance.now(), dt = Math.min(64, now - lastT);
    lastT = now;
    pulse++;
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
    const a = reduceMotion ? 1 : 1 - Math.exp(-dt / 280);
    for (const k in goal) layout[k] += (goal[k] - layout[k]) * a;
    if (flying) {
      // camera move in three beats: pull back, swing round, dive in.
      // Rotation finishes at 80%; the zoom keeps diving and settles at the end.
      const f = flying, t = Math.min(1, (now - f.t0) / f.ms), L = Math.log;
      rotation = f.rot(easeInOutCubic(clamp01((t - 0.06) / 0.74)));
      zoom = Math.exp(t < f.tOut
        ? L(f.z0) + (L(f.zOut) - L(f.z0)) * easeInOutSine(t / f.tOut)
        : L(f.zOut) + (L(f.z1) - L(f.zOut)) * easeInOutCubic((t - f.tOut) / (1 - f.tOut)));
      if (t >= 1) { flying = null; landAt = now; }
    } else if (spin) rotation[0] += 0.06;
    // stars drift with the camera for a little depth
    const sc = 1 + (zoom - 1) * 0.05;
    if (starCanvas && Math.abs(sc - starScale) > 0.0005) { starScale = sc; starCanvas.style.transform = `scale(${sc.toFixed(4)})`; }
    draw();
    requestAnimationFrame(frame);
  }

  // Flies the camera to a place and returns the flight time in ms.
  // cinematic: a long pull-back-and-dive for a new search; otherwise a short hop between sites.
  function flyTo(lat, lon, opts = {}) {
    spin = false;
    const z1 = opts.zoom || 2.4, tilt = 8 / z1;
    const from = rotation.slice();
    let lam = -lon;
    while (lam - from[0] > 180) lam -= 360;   // shortest way round
    while (lam - from[0] < -180) lam += 360;
    const to = [lam, -lat + tilt, 0];
    if (reduceMotion) { rotation = to; zoom = z1; flying = null; landAt = performance.now(); return 0; }
    const dist = d3.geoDistance([-from[0], -from[1]], [lon, lat - tilt]); // radians, 0..π
    const z0 = zoom, near = Math.min(1, dist / 0.8);
    const cine = !!opts.cinematic;
    const zOut = cine ? Math.max(0.6, Math.min(z0, 1) * (1 - 0.35 * dist / Math.PI))
      : Math.max(1, Math.min(z0, z1) * (1 - 0.6 * near));
    const ms = cine ? 2600 + 1600 * dist / Math.PI : 1100 + 1300 * near;
    flying = { t0: performance.now(), ms, rot: d3.interpolate(from, to), z0, zOut, z1, tOut: cine ? 0.38 : 0.45 };
    return ms;
  }

  function init(c) {
    canvas = c; ctx = canvas.getContext("2d");
    starCanvas = document.getElementById("stars");
    earthCanvas = document.getElementById("earth");
    path = d3.geoPath(projection, ctx);
    readTheme();
    resize(); addEventListener("resize", resize);
    initGL();
    let drag = null;
    const stop = () => { if (flying) landAt = performance.now(); flying = null; spin = false; };
    canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, r: rotation.slice(), moved: false }; stop(); });
    // mouse wheel zooms on desktop; on phones the page scrolls instead
    canvas.addEventListener("wheel", e => {
      if (innerWidth <= 900) return;
      e.preventDefault(); stop();
      zoom = Math.max(0.7, Math.min(5, zoom * Math.exp(-e.deltaY * 0.0015)));
    }, { passive: false });
    addEventListener("pointermove", e => {
      if (!drag) return;
      const k = 70 / projection.scale();
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
      rotation = [drag.r[0] + (e.clientX - drag.x) * k * 2, Math.max(-85, Math.min(85, drag.r[1] - (e.clientY - drag.y) * k * 2)), 0];
    });
    addEventListener("pointerup", e => {
      if (drag && !drag.moved && onPick) {
        projection.translate([W * layout.cx, H * layout.cy]).scale(Math.min(W, H) * layout.r * zoom).rotate(rotation);
        let best = null, bd = 14;
        for (const m of markers) {
          const p = projection([m.lon, m.lat]);
          const d = Math.hypot(p[0] - e.clientX, p[1] - e.clientY);
          if (d < bd && d3.geoDistance([m.lon, m.lat], projection.invert([W * layout.cx, H * layout.cy])) < Math.PI / 2) { bd = d; best = m; }
        }
        if (best) onPick(best.id);
        else if (onClick && Math.hypot(e.clientX - W * layout.cx, e.clientY - H * layout.cy) < Math.min(W, H) * layout.r * zoom && e.target === canvas) {
          const ll = projection.invert([e.clientX, e.clientY]);
          if (ll) onClick(ll[1], ll[0]);
        }
      }
      drag = null;
    });
    requestAnimationFrame(frame);
  }

  /* Match-score layer. rgba: Uint8Array of 1440 x 720 x 4, row 0 = north, column 0 = 180°W. */
  function setHeat(rgba) {
    if (!gl || !heatTex) return false;
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, heatTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1440, 720, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  }

  function countryOf(lat, lon) {
    const f = countries.find(c => d3.geoContains(c, [lon, lat]));
    return f ? f.properties.name : null;
  }

  window.ZenithGlobe = {
    init, flyTo, countryOf,
    isPhotoreal: () => !!(gl && ready),
    setMarkers: (m) => { markers = m; },
    setFlags: (f) => { flags = f; }, setHeat, heat: (on) => { heatOn = !!on; }, hasGL: () => !!gl,
    onClick: (fn) => { onClick = fn; }, zoom: (z) => { zoom = z; },
    select: (id) => { selected = id; },
    setLayout: (l) => { goal = { ...goal, ...l }; if (!placed || reduceMotion) layout = { ...goal }; placed = true; },
    onPick: (fn) => { onPick = fn; },
    spin: (on) => { spin = on && !reduceMotion; },
  };
})();
