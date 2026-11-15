/* Guided tour: about 45 s on the home globe. Captions come from the data. Globe flights only, no mission flow.
   First visit (localStorage flag), "Replay tour" in the nav, and the #tour link. Skip button and Esc end it; a click on the page pauses it. */
(function () {
  "use strict";
  const N = window.ZenithNew, G = window.ZenithGlobe;
  if (!N || !G) return;
  const KEY = "zenith-tour-seen";
  const body = document.body;
  const fmt = n => Number(n).toLocaleString("en");
  const short = c => N.place(c).replace(/\s*\(.*$/, "");
  const T = id => N.targets.find(t => t.target_id === id);
  let el = null, timer = null, idx = -1, running = false, paused = false, due = 0, left = 0, label = "";

  function build() {
    el = document.createElement("div");
    el.id = "tour"; el.className = "tour"; el.setAttribute("role", "region"); el.setAttribute("aria-label", "Guided tour");
    el.innerHTML = '<div class="t-place" id="tPlace" hidden></div><p class="t-kick" id="tKick" hidden></p><p class="t-cap" id="tCap" aria-live="polite"></p><p class="t-sub" id="tSub"></p><div class="t-ctl"><button type="button" id="tSkip">Skip</button><button type="button" id="tResume" hidden>Resume</button></div>';
    document.body.appendChild(el);
    el.querySelector("#tSkip").onclick = () => end();
    el.querySelector("#tResume").onclick = () => resume();
  }
  const esc = x => String(x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // A new analog site, shown as a small readout: what it is, where, its score and how far from known sites.
  function place(t) {
    const n = t.best_new, pl = el.querySelector("#tPlace");
    el.querySelector("#tKick").hidden = true; el.querySelector("#tCap").hidden = true; el.querySelector("#tSub").hidden = true;
    pl.hidden = false;
    pl.innerHTML = `<p class="tp-kick"><i></i>New analog site for ${esc(t.target_name)}</p><p class="tp-name">${esc(short(n))}</p>` +
      `<div class="tp-stats"><div><b>${n.score.toFixed(2)}</b><span>Match score</span></div><div><b>${fmt(n.nearest_known_km)} km</b><span>From the nearest known site</span></div></div>` +
      `<p class="tp-tag">Not field-checked yet</p>`;
  }
  function say(cap, sub, kick) { el.querySelector("#tPlace").hidden = true; el.querySelector("#tCap").hidden = false; const k = el.querySelector("#tKick"); k.textContent = kick || ""; k.hidden = !kick; el.querySelector("#tCap").textContent = cap; el.querySelector("#tSub").textContent = sub || ""; el.querySelector("#tSub").hidden = !sub; }
  function fly(lat, lon) { G.flyTo(lat, lon, { zoom: 2.2 }); }

  function steps() {
    const sha = T("shackleton"), jez = T("jezero"), mar = T("marius"), arc = T("arcadia");
    const reh = (N.rediscovery && N.rediscovery.jezero) || null; // the app's own measure differs, so the sentence below is the agreed wording
    const line = t => `${short(t.best_new)}. New analog site for ${t.target_name}, ${t.best_new.score.toFixed(2)}. Not field-checked yet.`;
    return [
      { ms: 7000, run() { body.classList.add("is-touring"); N.setLayer(true); G.setLayerPulse(true); G.setTourLabel(null); G.zoom(0.9); G.spin(true);
          say(`We scored all of Earth for ${N.targets.length} Moon and Mars base sites and found ${N.N} new analog sites.`, "Satellites say they match. Next step: someone goes out and field-checks them."); } },
      { ms: 8000, run() { G.setLayerPulse(false); G.spin(false); fly(jez.best_new.lat, jez.best_new.lon);
          place(jez); } },
      { ms: 4000, run() { fly(mar.best_new.lat, mar.best_new.lon); place(mar); } },
      { ms: 4000, run() { fly(arc.best_new.lat, arc.best_new.lon); place(arc); } },
      { ms: 8000, run() { fly(sha.best_new.lat, sha.best_new.lon);
          say("Why are the Moon scores lower? No place on Earth is as cold as the Moon's poles, and none has that sunlight, so those conditions cannot match exactly.", "We score them on a gentler scale and flag them as weak. Lower here is expected, not a flaw.", short(sha.best_new) + ". New analog site for " + sha.target_name + ", " + sha.best_new.score.toFixed(2) + ". Not field-checked yet."); } },
      { ms: 9000, run() { const m = jez.best_match; fly(m.lat, m.lon); G.setTourLabel({ lat: m.lat, lon: m.lon, text: "Known analog. Found on its own." });
          say("How do we know it works? We never told it where agencies test. 24 of its top sites landed next to known ones. Chance gives 10."); } },
      { ms: 5000, run() { G.setTourLabel(null); N.openSheet("new-sites"); say("Pick one and go check it."); } },
      { ms: 4000, run() { N.closeSheet(); body.classList.remove("is-touring"); say("Or name your own mission."); try { N.input.focus({ preventScroll: true }); } catch (e) { /* no focus */ } } },
    ];
  }
  let S = [];

  function go(i) {
    clearTimeout(timer); idx = i;
    if (i >= S.length) return end(true);
    S[i].run(); left = S[i].ms; due = performance.now() + left;
    if (!paused) timer = setTimeout(() => go(i + 1), left);
  }
  function pause() {
    if (!running || paused) return;
    paused = true; clearTimeout(timer); left = Math.max(300, due - performance.now());
    el.querySelector("#tResume").hidden = false; el.classList.add("paused");
  }
  function resume() {
    if (!running || !paused) return;
    paused = false; el.querySelector("#tResume").hidden = true; el.classList.remove("paused");
    due = performance.now() + left; const i = idx; timer = setTimeout(() => go(i + 1), left);
  }
  function end(keepFocus) {
    if (!running) return;
    running = false; paused = false; clearTimeout(timer);
    try { localStorage.setItem(KEY, "1"); } catch (e) { /* private mode */ }
    G.setLayerPulse(false); G.setTourLabel(null); N.closeSheet(); N.setLayer(true);
    body.classList.remove("is-touring"); G.spin(true);
    if (el) { el.remove(); el = null; }
    if (history.replaceState && /[#&]tour\b/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
    if (keepFocus) try { N.input.focus({ preventScroll: true }); } catch (e) { /* no focus */ }
  }
  function start() {
    if (running) end();
    if (!body.classList.contains("is-home")) { const b = document.querySelector(".brand"); if (b) b.click(); }
    running = true; paused = false; S = steps(); build(); go(0);
  }

  // a click anywhere on the page outside the tour pauses it
  document.addEventListener("pointerdown", e => { if (running && !paused && !e.target.closest("#tour, #tourBtn")) pause(); }, true);
  addEventListener("keydown", e => { if (running && e.key === "Escape") { e.preventDefault(); end(); } }, true);
  const tb = document.getElementById("tourBtn"); if (tb) tb.onclick = start;
  addEventListener("hashchange", () => { if (/[#&]tour\b/.test(location.hash)) start(); });

  let seen = false; try { seen = !!localStorage.getItem(KEY); } catch (e) { /* treat as unseen */ }
  const deep = /[#&]tour\b/.test(location.hash), other = /[#&]sheet=/.test(location.hash);
  window.ZenithTour = { start, end, running: () => running, paused: () => paused };
  if (deep || (!seen && !other)) setTimeout(start, 700);
})();
