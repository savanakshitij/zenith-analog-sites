#!/usr/bin/env node
/*
 * Earth Jukebox: render the WAV files and audio/playlist.json with the SAME engine the app plays live.
 * A headless Chromium (Playwright) loads js/sonify.js and renders each soundscape on an OfflineAudioContext.
 * Playwright is used only by this tool; the app itself has no dependencies and no build step.
 *
 *   node tools/sonify_render.mjs --all                    (the default) every mission in the app (the 7 examples, then any new target in the data)
 *   node tools/sonify_render.mjs --target jezero          one target (works for any target id in data/zenith-data.js)
 *   options: --site <rank> (1 = best Earth analog, default)  --seconds 20  --out audio  --rate 22050
 * Needs: Node 18+, and Playwright with Chromium installed (npm i -g playwright && npx playwright install chromium).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const seconds = +opt("seconds", 20), rank = +opt("site", 1), rate = +opt("rate", 22050), out = path.resolve(opt("out", path.join(APP, "audio")));
const only = opt("target", null);
if (args.includes("--help")) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, "")); process.exit(0); }

const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }

// A bare page with just what the engine needs. The app's own scripts are loaded in the same order as index.html.
const src = f => pathToFileURL(path.join(APP, f)).href;
for (const f of ["js/vendor/d3.min.js", "js/vendor/topojson-client.min.js", "js/vendor/countries-110m.js", "js/earth-textures.js", "data/zenith-data.js", "js/coverage-stub.js", "js/mission.js", "js/sonify-core.js", "js/sonify.js"]) if (!fs.existsSync(path.join(APP, f))) { console.error(`Missing ${f} (the app files this tool loads). Update the list at the top of tools/sonify_render.mjs if it moved.`); process.exit(1); }
const page_html = `<!doctype html><meta charset="utf-8"><script>window.ZENITH_SOUND_NO_UI = true;</script>
${["js/vendor/d3.min.js", "js/vendor/topojson-client.min.js", "js/vendor/countries-110m.js", "js/earth-textures.js", "data/zenith-data.js"].map(f => `<script src="${src(f)}"></script>`).join("\n")}
<script src="${src("js/coverage.js")}" onerror="this.remove()"></script>
${["js/coverage-stub.js", "js/mission.js", "js/sonify-core.js", "js/sonify.js"].map(f => `<script src="${src(f)}"></script>`).join("\n")}`;
const tmp = path.join(os.tmpdir(), `zenith-sonify-${process.pid}.html`);
fs.writeFileSync(tmp, page_html);

const browser = await pw.chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
let failed = false;
const errors = [];
try {
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(pathToFileURL(tmp).href);
  // (nothing here needs three.js; if a future page does, route its cdnjs URL to a local copy with page.route)

  // the missions to render: the app's examples, plus any target that has no example yet (so a new target gets sound with no extra work)
  const missions = await page.evaluate(() => {
    const D = window.ZENITH_DATA, L = window.ZenithMission.LIBRARY.slice();
    for (const t of Object.values(D.targets)) if (!L.some(m => m.target === t.id)) L.push({ id: t.id, title: `${t.body} base at ${t.name}`, target: t.id, subsystems: ["rover", "habitat", "science"] });
    return L;
  });
  const pick = only ? missions.filter(m => m.target === only) : missions;
  if (!pick.length) throw new Error(`No target "${only}". Known: ${[...new Set(missions.map(m => m.target))].join(", ")}`);
  fs.mkdirSync(out, { recursive: true });

  const wav = (f32, sr) => { // 16-bit mono PCM
    const n = f32.length, b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i])) * 32767), 44 + i * 2);
    return b;
  };

  const list = [];
  for (const m of pick) {
    const r = await page.evaluate(async ({ m, rank, seconds, rate }) => {
      const rep = window.Zenith.assess({ target: m.target, subsystems: m.subsystems }, window.ZENITH_DATA), target = rep.target && rep.target.candidates ? rep.target : window.ZENITH_DATA.targets[m.target];
      const all = (rep.ranked || rep.sites || []).map(x => ({ site: x.site || x, overall: x.overall != null ? x.overall : x.coverage })), ranked = [];
      const km = (a, b, c, d) => { const q = Math.PI / 180, x = Math.sin((c - a) * q / 2) ** 2 + Math.cos(a * q) * Math.cos(c * q) * Math.sin((d - b) * q / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
    for (const x of all) if (ranked.every(y => km(x.site.lat, x.site.lon, y.site.lat, y.site.lon) >= 100)) ranked.push(x); // as the app does: places 100 km apart
      const r = ranked[rank - 1]; if (!r) throw new Error(`no site ranked ${rank}`);
      // the Earth site's name, the way js/app.js writes it
      const feats = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries).features, s = r.site;
      const c = (feats.find(f => d3.geoContains(f, [s.lon, s.lat])) || { properties: {} }).properties.name || null, near = s.nearest_known && s.nearest_known.km < 150;
      const name = s.name || (s.tags && s.tags.impact_crater ? `${s.tags.impact_crater} crater` : near ? `Near ${s.nearest_known.name.split(",")[0]}` : c || "Unmapped cell");
      const place = [s.name || near ? c : null, `${Math.abs(s.lat).toFixed(2)}°${s.lat >= 0 ? "N" : "S"}  ${Math.abs(s.lon).toFixed(2)}°${s.lon >= 0 ? "E" : "W"}`].filter(Boolean).join(" · ");
      const comp = await window.ZenithSound.compose(s, target, { name, place, match: r.overall });
      const f = await window.ZenithSoundEngine.renderOffline(comp.profile, { seconds, sampleRate: rate });
      const u8 = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let bin = ""; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      const p = comp.profile;
      return { b64: btoa(bin), name, place, target: target.name, body: target.body, match: r.overall, text: comp.text, frame: comp.frame || null, key: `${p.key.name} ${p.key.scale}`, bpm: p.tempo, detune: p.totalDetune, lat: s.lat, lon: s.lon };
    }, { m, rank, seconds, rate });
    const buf = Buffer.from(r.b64, "base64"), f32 = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    let pk = 0, ss = 0; for (const v of f32) { pk = Math.max(pk, Math.abs(v)); ss += v * v; }
    const rms = Math.sqrt(ss / f32.length), g = Math.min(0.1259 / (rms || 1), 0.89 / (pk || 1)); // same loudness for every file (-18 dBFS RMS), peak never above 0.89
    const file = `${m.id}.wav`; fs.writeFileSync(path.join(out, file), wav(f32.map(v => v * g), rate));
    list.push({
      id: m.id, title: `${r.target} (${r.body}) and ${r.name}`, mission: m.title, target: r.target, body: r.body, site: r.name, place: r.place, rank,
      match_pct: Math.round(r.match * 100), key: r.key, bpm: r.bpm, file, seconds, sample_rate: rate, description: r.text,
      how_to_listen: "The base sits a little to the left, the Earth site a little to the right. Wobbling or beating between them means a mismatch.",
      frame: r.frame && { ...r.frame, source: "NASA Visible Earth Blue Marble (public domain), a stand-in for NASA Earth Information Center frames" },
    });
    console.log(`${file.padEnd(22)} ${String(Math.round(r.match * 100)).padStart(3)}%  ${r.key.padEnd(20)} ${String(r.bpm).padStart(3)} bpm  ${r.name}`);
  }
  // playlist.json: a full run rewrites it; a single target is merged in, so the other entries stay
  const pl = path.join(out, "playlist.json");
  let merged = list;
  if (only && fs.existsSync(pl)) { try { const old = JSON.parse(fs.readFileSync(pl, "utf8")).tracks || []; merged = [...old.map(o => list.find(n => n.id === o.id) || o), ...list.filter(n => !old.some(o => o.id === n.id))]; } catch { /* unreadable: rewrite */ } }
  fs.writeFileSync(pl, JSON.stringify({ name: "Zenith Earth Jukebox", about: "Each track pairs a Moon or Mars base with its best Earth analog site. Two voices share one key and one chord; the Earth voice is detuned by how badly each measured dimension matches, so beating means a mismatch. See docs/SONIFICATION.md.", tracks: merged }, null, 2) + "\n");
  console.log(`wrote ${list.length} file(s) and ${path.relative(process.cwd(), pl)}`);
} catch (e) { console.error(e.message); failed = true; } finally { await browser.close(); fs.rmSync(tmp, { force: true }); }
if (failed) process.exit(1);
if (errors.length) { console.error("page errors:\n" + errors.join("\n")); process.exit(1); }
