# Zenith web app (prototype)

Team Zenith, NASA Space Apps 2026: *Identify Earth locations that analog the permanent Moon base locations and Mars.*

Describe a Moon or Mars mission in plain words. Zenith turns it into a mission plan (base site + the parts to test), ranks Earth sites by how much of that plan they can rehearse, and lists what Earth can't test at all, with numbers.

**Run it:** open `index.html` in a browser. Static files only, no server, no build step, works offline (satellite and Moon/Mars photos need internet). Also works on GitHub Pages.

## Screens

1. **Home:** only the globe and a search bar. Focus the bar to get the 7 example missions, or type your own.
2. **Result:** a new search plays like a film shot: letterbox bars slide in, the camera pulls back, swings round and dives in on the best Earth site, a crosshair locks on, a title card names the place, and the panel slides in on landing. Previous/next makes a shorter hop; the mouse wheel zooms. The panel shows the site, the target, a big match %, previous/next through the top 20 places, and Stable / Weight-sensitive and Hidden gem tags.
3. **Eight fact cards in a stack** (drag the top card and it tilts and follows; let go past the threshold and it flies off, either way, and the next card comes up; ‹ brings the last card back; dots jump; ← → work when the stack has focus; the same card stays on top when you step to another site): Overview (coverage per mission part, editable plan), Similar, Different (including what Earth can't test anywhere), Season (best months), What if (±10–20% harsher or milder), Hazards (with prep), Studies (published research nearby) and Teams (other missions that fit the same place).

Design: black space with a white panel, a blue and white globe, red for the signal and blue for data (a NASA-inspired palette; no NASA insignia, which needs NASA approval), set in Public Sans with tabular figures. Motion respects reduced motion (no flight, no film bars). Keys: `/` jumps to search, ← → step through the sites.

Default look: **Night glass** (a very see-through pane of dark glass: Earth's night side and the stars show through, lightly blurred; light text, blue numbers and bars) set in Inter, numbers included. On phones the panel is more solid so text stays readable over the globe. Text types itself out: the place name, coordinates, section headings, the film title card, and example missions in the empty search box.

**Design button** (next to the logo): four panel looks (Classic, Frost, Night glass, Hologram), six fonts, see-through, blur, corners, accent colour, film bars on/off and Replay flight. Settings stay in the viewer's browser. Each look is a set of CSS tokens at the end of `css/app.css` (`:root[data-look="…"]`), so changing a look or making it the default is a CSS-only edit.

## Files

| Path | What |
|---|---|
| `index.html`, `css/app.css` | Page and styles |
| `js/coverage.js` | **Not here yet.** The team's engine. Drop it in and it replaces the preview engine automatically. |
| `js/coverage-stub.js` | Preview engine with the same call: `Zenith.assess(plan, data)`. Only defines `window.Zenith` if `coverage.js` didn't. |
| `js/app.js` | UI. `normalizeReport()` adapts the engine's output if the real `coverage.js` returns a different shape. |
| `js/mission.js` | Plain words → plan (keyword rules, no API) + the 7 example missions |
| `js/features.js` | Best time of year, hazards, what-if, "also a fit for" |
| `js/globe.js` | Globe: WebGL photoreal Earth (d3 flat fallback), markers, camera flights (`flyTo`), target lock, twinkling stars |
| `js/design.js` | Design button: panel looks and their settings |
| `js/ground.js` | Ground comparison window: the Earth site and its Moon or Mars target as two 3D terrain blocks (three.js r128 from cdnjs). Built from each place's measured slope, ruggedness and brightness, with craters, pits and ice where the data records them; both share one height scale. Illustrations of those numbers, not survey maps. |
| `js/earth-textures.js` | Earth day, night-lights and cloud images as data URIs (so WebGL works from `file://`) |
| `js/vendor/` | d3 7.9.0, topojson-client 3.1.0, world country outlines |
| `js/images.js` | Moon/Mars and known-site photos (Wikimedia Commons) |
| `data/zenith-data.js` | Generated data (1.8 MB). Do not edit by hand. |
| `tools/build_data.py` | Builds `data/zenith-data.js` |

## Data

`tools/build_data.py` builds everything from the team's **data v1.5** (`zenith_data_v1_5.zip`) and checks that it reproduces `plan_pool.json` scores and stability exactly before writing anything. Per target it keeps the best ~150 cells of the v1.5 plan pool, every lesser-known candidate and every named known site.

```bash
python3 tools/build_data.py --v15 <unzipped zenith_data_v1_5> \
  --handoff <folder with raw-data/, team-raw-data/, patches/> \
  --canada canada_national_parameter_grid.csv
```

Added on top of v1.5, all computed from team files: what-if percentiles (all eligible cells re-scored with the v1.5 formula), NASA POWER MERRA-2 monthly temperature and rain (`raw-data/1_nasa_power_climate`), studied-here links (`team-raw-data/analog_sites_all.csv`, `patches/lava_tubes.csv`), Canada grid values.

## Honest limits

- The preview engine's mapping from mission parts to dimensions (e.g. rover = 60% terrain, 20% surface, 20% aridity) is a placeholder until `coverage.js` arrives.
- Earth's coldest bare ground is still far warmer than every target, so all targets ask for "as cold as possible". Terrain, albedo, light and rock type separate them.
- Best months use long-term monthly means at a 0.5° point; they say nothing about access, permits or cost.
- Unnamed sites are named by country only (110 m country outlines).

Built with AI assistance (Claude), reviewed by Team Zenith.
