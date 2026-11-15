/* Background music: the demo video's score, looped quietly.
 * Browsers block sound until the visitor interacts, so it starts on the first tap, click or key.
 * The corner button mutes and unmutes; the choice is remembered in this browser. */
(function () {
  const KEY = "zenith-music-muted";
  const here = document.currentScript && document.currentScript.src;
  const src = here ? new URL("../audio/bg-music.mp3", here).href : "audio/bg-music.mp3";
  let muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (e) { /* storage blocked */ }

  const audio = new Audio(src);
  audio.loop = true; audio.preload = "auto"; audio.volume = 0;
  const TARGET = 0.32;
  let fadeT = null;
  function fade(to, ms, then) {
    clearInterval(fadeT);
    const from = audio.volume, t0 = performance.now();
    fadeT = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      audio.volume = from + (to - from) * k;
      if (k >= 1) { clearInterval(fadeT); then && then(); }
    }, 30);
  }
  function play() {
    if (muted) return;
    const p = audio.play();
    if (p && p.then) p.then(() => fade(TARGET, 1500)).catch(() => {});
    else fade(TARGET, 1500);
  }
  function stop() { fade(0, 400, () => audio.pause()); }

  // the corner button
  const btn = document.createElement("button");
  btn.className = "music-btn"; btn.type = "button";
  const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function paint() {
    btn.innerHTML = muted ? ICON_OFF : ICON_ON;
    btn.setAttribute("aria-label", muted ? "Turn music on" : "Mute music");
    btn.title = muted ? "Music off" : "Music on";
    btn.setAttribute("aria-pressed", String(!muted));
  }
  btn.addEventListener("click", e => {
    e.stopPropagation();
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (err) { /* storage blocked */ }
    paint();
    muted ? stop() : play();
  });
  paint();

  const css = document.createElement("style");
  css.textContent = `.music-btn{position:fixed;z-index:60;right:16px;bottom:16px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.22);background:rgba(10,14,24,.6);color:#fff;cursor:pointer;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:transform 120ms ease,background-color 150ms}
.music-btn:hover{background:rgba(10,14,24,.85)}.music-btn:active{transform:scale(.94)}
.music-btn[aria-pressed=false]{color:rgba(255,255,255,.6)}
.music-btn:focus-visible{outline:2px solid #fc3d21;outline-offset:2px}
.music-btn.in-bar{position:relative;right:auto;bottom:auto;width:34px;height:34px;flex:none;pointer-events:auto;order:2}`;
  document.head.appendChild(css);
  // sit in the page's top bar when it has one (no overlap with panels), else in the bottom-right corner
  const mount = () => { const bar = document.querySelector("header.top"); if (bar) { btn.classList.add("in-bar"); bar.appendChild(btn); } else document.body.appendChild(btn); };
  document.body ? mount() : addEventListener("DOMContentLoaded", mount);

  // start on the first interaction anywhere on the page
  const first = () => { ["pointerdown", "keydown", "touchstart"].forEach(t => removeEventListener(t, first, true)); play(); };
  ["pointerdown", "keydown", "touchstart"].forEach(t => addEventListener(t, first, true));
  // pause while the tab is hidden
  document.addEventListener("visibilitychange", () => { if (document.hidden) audio.pause(); else if (!muted && audio.currentTime > 0) audio.play().catch(() => {}); });

  window.ZenithMusic = { mute: () => { if (!muted) btn.click(); }, unmute: () => { if (muted) btn.click(); } };
})();
