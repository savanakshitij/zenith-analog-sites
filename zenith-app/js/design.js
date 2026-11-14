/* Design controls: switch the panel look and tune see-through, blur, corners, accent and the film effect.
   Settings are kept in this browser only. */
(function () {
  const root = document.documentElement;
  const LOOKS = [["classic", "Classic"], ["frost", "Frost"], ["night", "Night glass"], ["hud", "Hologram"]];
  const DEFAULT_LOOK = "night", DEFAULT_FONT = "inter";
  // [id, name, preview face]: text / headings / numbers are set in css/app.css (data-font)
  const FONTS = [["original", "Original", "'Public Sans'"], ["inter", "Inter", "Inter"], ["clean", "Mono digits", "'DejaVu Sans Mono'"],
    ["mission", "Mission", "'Barlow Condensed'"], ["scifi", "Sci-fi", "'Chakra Petch'"], ["orbit", "Orbit", "Orbitron"]];
  const ACCENTS = [["#fc3d21", "Red"], ["#ff9f1c", "Amber"], ["#2ec5ff", "Cyan"], ["#ffffff", "White"]];
  const KEY = "zenith-design-3";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked */ } };
  let st = load();

  const toggle = document.createElement("button");
  toggle.type = "button"; toggle.className = "dz-toggle";
  toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-controls", "dz");
  toggle.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>Design`;

  const pop = document.createElement("section");
  pop.id = "dz"; pop.className = "dz"; pop.hidden = true; pop.setAttribute("aria-label", "Design");
  pop.innerHTML = `
    <div class="dz-row"><span class="dz-lbl">Look</span>
      <div class="dz-looks" role="group" aria-label="Look">${LOOKS.map(([id, l]) => `<button type="button" data-look="${id}">${l}</button>`).join("")}</div></div>
    <div class="dz-row"><span class="dz-lbl">Font</span>
      <div class="dz-fonts" role="group" aria-label="Font">${FONTS.map(([id, l, face]) => `<button type="button" data-font="${id}" style="font-family:${face},sans-serif">${l}</button>`).join("")}</div></div>
    <label class="dz-row" for="dzAlpha"><span class="dz-lbl">See-through <output id="dzAlphaV"></output></span><input id="dzAlpha" type="range" min="0" max="95"></label>
    <label class="dz-row" for="dzBlur"><span class="dz-lbl">Blur <output id="dzBlurV"></output></span><input id="dzBlur" type="range" min="0" max="40"></label>
    <label class="dz-row" for="dzRadius"><span class="dz-lbl">Corners <output id="dzRadiusV"></output></span><input id="dzRadius" type="range" min="0" max="32"></label>
    <div class="dz-row"><span class="dz-lbl">Accent</span>
      <div class="dz-sw" role="group" aria-label="Accent colour">${ACCENTS.map(([c, n]) => `<button type="button" data-accent="${c}" style="--sw:${c}" aria-label="${n}" title="${n}"></button>`).join("")}</div></div>
    <label class="dz-check" for="dzFilm"><input id="dzFilm" type="checkbox">Film bars and title card</label>
    <div class="dz-foot"><button type="button" id="dzReplay">Replay flight</button><button type="button" id="dzReset">Reset</button></div>`;
  document.body.append(toggle, pop);
  const $ = id => document.getElementById(id);

  function apply() {
    root.dataset.look = st.look || DEFAULT_LOOK;
    root.dataset.font = st.font || DEFAULT_FONT;
    const set = (k, v) => (v == null ? root.style.removeProperty(k) : root.style.setProperty(k, v));
    set("--panel-alpha", st.alpha == null ? null : String(1 - st.alpha / 100));
    set("--panel-blur", st.blur == null ? null : st.blur + "px");
    set("--radius", st.radius == null ? null : st.radius + "px");
    set("--accent", st.accent || null);
    document.body.classList.toggle("no-film", st.film === false);
    // show the values in force, including the look's own defaults
    const cs = getComputedStyle(root);
    const see = Math.round((1 - parseFloat(cs.getPropertyValue("--panel-alpha"))) * 100);
    const blur = Math.round(parseFloat(cs.getPropertyValue("--panel-blur")) || 0);
    const rad = Math.round(parseFloat(cs.getPropertyValue("--radius")) || 0);
    $("dzAlpha").value = see; $("dzAlphaV").textContent = see + "%";
    $("dzBlur").value = blur; $("dzBlurV").textContent = blur + " px";
    $("dzRadius").value = rad; $("dzRadiusV").textContent = rad + " px";
    $("dzFilm").checked = st.film !== false;
    pop.querySelectorAll("[data-look]").forEach(b => b.setAttribute("aria-pressed", b.dataset.look === root.dataset.look));
    pop.querySelectorAll("[data-font]").forEach(b => b.setAttribute("aria-pressed", b.dataset.font === root.dataset.font));
    dispatchEvent(new Event("zenith:look")); // the globe re-reads its overlay colours and label font
    const acc = (st.accent || cs.getPropertyValue("--accent")).trim().toLowerCase();
    pop.querySelectorAll("[data-accent]").forEach(b => b.setAttribute("aria-pressed", b.dataset.accent === acc));
  }
  const change = patch => { st = { ...st, ...patch }; save(); apply(); };

  pop.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.look) change({ look: b.dataset.look, alpha: null, blur: null, radius: null });
    else if (b.dataset.font) change({ font: b.dataset.font });
    else if (b.dataset.accent) change({ accent: b.dataset.accent });
    else if (b.id === "dzReset") { st = {}; save(); apply(); }
    else if (b.id === "dzReplay" && window.ZenithReplay) window.ZenithReplay();
  });
  $("dzAlpha").addEventListener("input", e => change({ alpha: +e.target.value }));
  $("dzBlur").addEventListener("input", e => change({ blur: +e.target.value }));
  $("dzRadius").addEventListener("input", e => change({ radius: +e.target.value }));
  $("dzFilm").addEventListener("change", e => change({ film: e.target.checked }));

  const open = on => { pop.hidden = !on; toggle.setAttribute("aria-expanded", on); };
  toggle.addEventListener("click", () => open(pop.hidden));
  addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { open(false); toggle.focus(); } });
  addEventListener("pointerdown", e => { if (!pop.hidden && !pop.contains(e.target) && !toggle.contains(e.target)) open(false); });

  apply();
})();
