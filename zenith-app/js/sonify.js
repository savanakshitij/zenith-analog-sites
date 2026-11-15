/*
 * Earth Jukebox, part 2 of 2: the sound engine and the player. Plain Web Audio, no libraries.
 *
 * ONE engine plays a sound profile (see js/sonify-core.js) both live (AudioContext) and offline
 * (OfflineAudioContext, used by tools/sonify_render.mjs to write the WAV files): buildScene() only
 * needs a context, so the two always sound the same. Nothing here is random.
 *
 * In the page: window.ZenithSound.update(site, target, {name, place, match}) after each result;
 * play() / stop() are what the Listen button calls. Sound starts only when the user presses Listen.
 */
(function () {
  "use strict";
  const C = window.ZenithSoundCore;
  if (!C) return;
  const PI = Math.PI, clamp = (x, a, b) => Math.min(b, Math.max(a, x)), cents = (f, c) => f * Math.pow(2, c / 1200);

  /* ================= the engine: one graph builder for live and offline ================= */
  // fade a gain, shaped for equal power (sin in, cos out), as a series of short linear ramps
  function ramp(param, from, to, t, dur) {
    param.setValueAtTime(from, t);
    for (let k = 1; k <= 12; k++) { const x = k / 12; param.linearRampToValueAtTime(from + (to - from) * (to > from ? Math.sin(x * PI / 2) : 1 - Math.cos(x * PI / 2)), t + dur * x); }
  }
  // a reverb tail from seeded noise: longer and warmer (darker) the better the match
  function impulse(ctx, secs, damp) {
    const sr = ctx.sampleRate, n = Math.floor(secs * sr), buf = ctx.createBuffer(2, n, sr), a = 1 - Math.exp(-2 * PI * damp / sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let s = 12345 + ch * 7919, y = 0;
      for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; y += a * (s / 2147483648 - 1 - y); d[i] = y * Math.exp(-6.9 * i / n) * Math.min(1, i / (0.02 * sr)); }
    }
    return buf;
  }
  const wave = (ctx, harm) => ctx.createPeriodicWave(new Float32Array(harm.length + 1), Float32Array.from([0, ...harm]));

  // scenes -> limiter -> volume ceiling -> speakers
  function buildMaster(ctx, volume) {
    const comp = ctx.createDynamicsCompressor(), gain = ctx.createGain();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 12; comp.attack.value = 0.004; comp.release.value = 0.25;
    gain.gain.value = volume; comp.connect(gain); gain.connect(ctx.destination);
    return { input: comp, gain };
  }

  // One soundscape: pad chord + drone + melody + bells for the base and the Earth site, through one reverb.
  // t0 is when it starts. schedule(upTo) queues every note that starts before upTo (the live player calls it
  // again and again; the offline renderer calls it once). Returns { out, loopSec, schedule, stop }.
  function buildScene(ctx, p, t0) {
    const step = 60 / p.tempo / 2, out = ctx.createGain(), bus = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain(), conv = ctx.createConvolver(), live = [];
    out.gain.value = 0; wet.gain.value = p.mix.wet; dry.gain.value = 1 - 0.5 * p.mix.wet;
    conv.buffer = impulse(ctx, p.mix.reverbSec, p.mix.dampHz);
    bus.connect(dry); dry.connect(out); bus.connect(conv); conv.connect(wet); wet.connect(out);
    const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const osc = (f, w) => { const o = ctx.createOscillator(); if (w) o.setPeriodicWave(w); o.frequency.value = f; o.start(t0); live.push(o); return o; };
    const swell = (to, level, tc) => { const g = gain(0, to); g.gain.setTargetAtTime(level, t0, tc); return g; };

    osc(C.mtof(p.key.root - 12), wave(ctx, [1, 0.4, 0.15])).connect(swell(bus, 0.1 * p.mix.drone, 1)); // the key's root, an octave down: it anchors the chord

    const voices = p.voices.map(v => {
      const vg = gain(v.level), w = wave(ctx, v.harm), pn = ctx.createStereoPanner && ctx.createStereoPanner();
      if (pn) { pn.pan.value = v.pan; vg.connect(pn); pn.connect(bus); } else vg.connect(bus);
      // pad: the six chord tones, each detuned by how badly its dimension matches (the base has none)
      const pf = ctx.createBiquadFilter(); pf.type = "lowpass"; pf.frequency.value = v.cutoff; pf.Q.value = v.q;
      pf.connect(swell(vg, 1, 0.6));
      p.chord.forEach((c, i) => osc(cents(c.freq, v.cents[i]), w).connect(gain(0.075 / (1 + 0.25 * i), pf)));
      osc(v.breath.hz).connect(gain(v.breath.cents, pf.detune)); // the day-night swing: the pad breathes slowly
      if (v.shimmer > 0.001) { // cloud: an airy octave above the top tones, fluttering slowly
        const sg = gain(v.shimmer * 0.6, vg); osc(v.breath.hz * 3.1).connect(gain(v.shimmer * 0.4, sg.gain));
        [3, 5].forEach(i => osc(2 * cents(p.chord[i].freq, v.cents[i])).connect(sg));
      }
      const mf = ctx.createBiquadFilter(); mf.type = "lowpass"; mf.frequency.value = clamp(v.cutoff * 2, 900, 7000); mf.connect(vg);
      const note = (ev, t) => { // melody: a soft, slightly plucked tone
        const dur = ev.len * step, pk = 0.17 * ev.vel, o = ctx.createOscillator(), g = ctx.createGain();
        o.setPeriodicWave(w); o.frequency.value = cents(C.mtof(ev.midi), v.melCents);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.03); g.gain.setTargetAtTime(pk * 0.6, t + 0.03, 0.25); g.gain.setTargetAtTime(0, t + dur, 0.12);
        o.connect(g); g.connect(mf); o.start(t); o.stop(t + dur + 1.2);
      };
      const bell = (ev, t) => { // ground ice: a high glassy bell (three inharmonic partials, long soft decay)
        [1, 2.756, 5.404].forEach((r, j) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = cents(C.mtof(ev.midi), v.bellCents) * r;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07 * v.bell * ev.vel / (1 + 1.2 * j * j), t + 0.006); g.gain.setTargetAtTime(0, t + 0.006, 1 / (1 + 0.7 * j));
          o.connect(g); g.connect(vg); o.start(t); o.stop(t + 4.5);
        });
      };
      return { v, note, bell, cm: { i: 0, loop: 0 }, cb: { i: 0, loop: 0 } };
    });

    let stopped = false;
    const pump = (list, c, upTo, fn) => {
      if (!list.length) return;
      for (;;) {
        if (c.i >= list.length) { c.i = 0; c.loop++; }
        const t = t0 + (c.loop * p.steps + list[c.i].step) * step;
        if (t > upTo) return;
        fn(list[c.i], t); c.i++;
      }
    };
    return {
      out, loopSec: p.steps * step,
      schedule(upTo) { if (!stopped) voices.forEach(o => { pump(o.v.melody, o.cm, upTo, o.note); pump(o.v.bells, o.cb, upTo, o.bell); }); },
      stop() { stopped = true; live.forEach(o => { try { o.stop(); } catch (e) { /* already stopped */ } }); out.disconnect(); },
    };
  }

  // the WAV files: the same scene on an OfflineAudioContext (mono, fade in 0.2 s, fade out 1.5 s)
  async function renderOffline(p, o) {
    o = o || {};
    const secs = o.seconds || 20, sr = o.sampleRate || 22050, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(1, Math.round(secs * sr), sr), m = buildMaster(ctx, 0.9), sc = buildScene(ctx, p, 0);
    sc.out.connect(m.input); ramp(sc.out.gain, 0, 1, 0, 0.2); ramp(sc.out.gain, 1, 0, secs - 1.5, 1.5);
    sc.schedule(secs);
    return (await ctx.startRendering()).getChannelData(0);
  }

  /* ================= the visual frame: a small window of NASA Blue Marble around the site ================= */
  let texP = null;
  const loadTex = () => texP || (texP = !window.EARTH_TEX ? Promise.resolve(null) : Promise.all(["day", "clouds"].map(k => new Promise(res => {
    const src = window.EARTH_TEX[k], i = new Image(); if (!src) return res(null);
    i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  }))).then(([day, cloud]) => (day ? { day, cloud } : null)));
  // a w x h crop of an equirectangular image, about 6 degrees tall (roughly 650 km), centred on the site
  function crop(img, lat, lon, w, h) {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true }), W = img.naturalWidth, H = img.naturalHeight, hl = 3;
    const hw = Math.min(60, hl * (w / h) / Math.max(0.15, Math.cos(lat * PI / 180))), sh = 2 * hl / 180 * H, sw = 2 * hw / 360 * W;
    const sy = clamp((90 - lat - hl) / 180 * H, 0, H - sh), sx = (lon - hw + 180) / 360 * W;
    [-W, 0, W].forEach(d => g.drawImage(img, sx + d, sy, sw, sh, 0, 0, w, h)); // the extra copies wrap across the date line
    return cv;
  }
  async function frameFor(site) { // -> { frame: {hue, sat, light, cloud}, thumb: canvas } or null (then the profile uses its stand-in)
    try {
      const t = await loadTex();
      if (!t || !site || typeof site.lat !== "number" || typeof site.lon !== "number") return null;
      const px = c => c && c.getContext("2d").getImageData(0, 0, 16, 10).data;
      return { frame: C.frameFromPixels(px(crop(t.day, site.lat, site.lon, 16, 10)), t.cloud && px(crop(t.cloud, site.lat, site.lon, 16, 10))), thumb: crop(t.day, site.lat, site.lon, 72, 45) };
    } catch (e) { return null; }
  }
  async function compose(site, target, info) { // everything for one result: the profile, its description and the frame thumbnail
    const fr = await frameFor(site), p = C.profile(site, target, info && info.match, fr && fr.frame);
    return { profile: p, text: C.describe(p, info), thumb: fr && fr.thumb, frame: fr && fr.frame };
  }
  window.ZenithSoundEngine = { buildScene, buildMaster, renderOffline, frameFor, ramp };

  /* ================= the player ================= */
  const KEY = "zenith.sound.volume", ceiling = v => 0.9 * v * v; // volume slider -> master gain, never above 0.9
  let vol = 0.6, ctx = null, master = null, cur = null, playing = false, timer = 0, prof = null, sig = "", seq = 0, tm = 0, pend = null, ui = null, watched = false;
  try { const s = localStorage.getItem(KEY); if (s != null && isFinite(+s)) vol = clamp(+s, 0, 1); } catch (e) { /* storage blocked: use the default */ }

  function build() {
    if (ui || window.ZENITH_SOUND_NO_UI || !document.body) return ui;
    const el = document.createElement("div");
    el.className = "snd"; el.hidden = true; el.setAttribute("role", "group"); el.setAttribute("aria-label", "Earth Jukebox: hear how well the Earth site matches the base");
    el.innerHTML = `<div class="snd-row">
      <button type="button" class="snd-btn" aria-pressed="false" aria-describedby="snd-text"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Listen</span></button>
      <span class="snd-frame" aria-hidden="true" title="Satellite view around the Earth site (NASA Blue Marble). It shapes the Earth voice."><canvas width="72" height="45"></canvas><i class="snd-scan"></i></span>
      <label class="snd-vol"><span>Volume</span><input type="range" min="0" max="100" step="1" value="${Math.round(vol * 100)}"></label>
    </div>
    <p class="snd-text" id="snd-text" role="status" aria-live="polite"></p>
    <p class="snd-hint">${C.HINT}</p>`;
    ui = { el, btn: el.querySelector(".snd-btn"), cv: el.querySelector("canvas"), frame: el.querySelector(".snd-frame"), scan: el.querySelector(".snd-scan"), text: el.querySelector(".snd-text"), slider: el.querySelector("input") };
    ui.btn.addEventListener("click", () => (playing ? stop() : play()));
    ui.slider.addEventListener("input", () => {
      vol = ui.slider.value / 100; try { localStorage.setItem(KEY, String(vol)); } catch (e) { /* ignore */ }
      if (master) master.gain.gain.setTargetAtTime(ceiling(vol), ctx.currentTime, 0.03);
    });
    return ui;
  }
  function mount() { // inside the ground window if there is one (it moves with it); otherwise a small floating panel
    const g = document.getElementById("ground");
    if (g) { if (ui.el.parentElement !== g) g.append(ui.el); ui.el.classList.remove("snd-float"); }
    else if (ui.el.parentElement !== document.body) { document.body.append(ui.el); ui.el.classList.add("snd-float"); }
    if (g && !watched) { watched = true; new MutationObserver(() => { if (g.hidden && playing) stop(); }).observe(g, { attributes: true, attributeFilter: ["hidden"] }); }
  }
  function paint(r) {
    mount();
    if (ui.text.textContent !== r.text) ui.text.textContent = r.text;
    ui.frame.hidden = !r.thumb;
    if (r.thumb) ui.cv.getContext("2d").drawImage(r.thumb, 0, 0);
    ui.el.style.setProperty("--loop", `${r.profile.steps * 30 / r.profile.tempo}s`);
    ui.scan.style.animation = "none"; void ui.scan.offsetWidth; ui.scan.style.animation = "";
    ui.el.hidden = false;
  }
  function setState() { if (ui) { ui.btn.setAttribute("aria-pressed", String(playing)); ui.el.classList.toggle("is-playing", playing); } }

  function startScene(p, fade) {
    const t0 = ctx.currentTime + 0.06, sc = buildScene(ctx, p, t0);
    sc.out.connect(master.input); ramp(sc.out.gain, 0, 1, t0, fade); sc.schedule(t0 + 2.5);
    sc.level = now => Math.sin(clamp((now - t0) / fade, 0, 1) * PI / 2); // where its fade-in has got to
    return sc;
  }
  function retire(sc, fade) { // fade a scene out from wherever it is, then free it
    if (!sc) return;
    const g = sc.out.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); ramp(g, sc.level(now), 0, now, fade);
    setTimeout(() => sc.stop(), (fade + 0.15) * 1000);
  }
  async function play() {
    if (playing) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { if (ui) ui.text.textContent = "Sound is not supported in this browser."; return; }
    playing = true; setState();
    try {
      if (!ctx) { ctx = new AC({ latencyHint: "playback" }); master = buildMaster(ctx, ceiling(vol)); }
      await ctx.resume();
    } catch (e) { playing = false; setState(); return; }
    if (!playing) return; // stopped while the browser was waking the audio
    if (prof) cur = startScene(prof, 0.2); // 0.2 s fade in: no click
    timer = setInterval(() => { if (cur && ctx.state === "running") cur.schedule(ctx.currentTime + 2.5); }, 300);
  }
  function stop() {
    if (!playing) return;
    playing = false; setState(); clearInterval(timer);
    retire(cur, 0.2); cur = null;
    setTimeout(() => { if (!playing && ctx && ctx.state === "running") ctx.suspend(); }, 500);
  }
  async function apply(site, target, info) {
    const my = ++seq, r = await compose(site, target, info);
    if (my !== seq) return null; // a newer result took over while the image was being read
    const s = JSON.stringify(r.profile), changed = s !== sig;
    prof = r.profile; sig = s;
    if (build()) paint(r);
    if (playing && ctx && changed) { const old = cur; cur = startScene(prof, 1.5); retire(old, 1.5); } // jukebox: crossfade to the new soundscape
    return prof;
  }
  // Called by the app for every result. Waits a moment so quick next/next/next presses settle on one sound.
  function update(site, target, info) {
    clearTimeout(tm); if (pend) pend(null);
    return new Promise(res => { pend = res; tm = setTimeout(() => { pend = null; apply(site, target, info || {}).then(res, () => res(null)); }, prof ? 250 : 0); });
  }
  addEventListener("pagehide", () => { try { if (ctx) ctx.close(); } catch (e) { /* ignore */ } });
  window.ZenithSound = { update, play, stop, compose, setVolume(v) { vol = clamp(+v || 0, 0, 1); if (ui) ui.slider.value = Math.round(vol * 100); if (master) master.gain.gain.setTargetAtTime(ceiling(vol), ctx.currentTime, 0.03); }, isPlaying: () => playing, profile: () => prof };
})();
