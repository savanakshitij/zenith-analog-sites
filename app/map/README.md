# Click anywhere on Earth (data v1.6)

Scores any spot you click against the seven Moon and Mars targets, in the browser, with the same formula as `scoring/score_v16.py`. Checked against the Python output: largest score difference 0.0003 over 241 cells.

## Files

| File | What it is |
|---|---|
| `zenith-engine.js` | The engine. No dependencies. |
| `earth_cells.bin` | 349,031 land cells, features packed as 16-bit integers (8.4 MB, about 3.9 MB gzipped). |
| `engine_params.json` | Targets, scales, ranges and percentile tables, exported from data v1.6. |
| `map.html` | Clickable world map. Needs a web server: run `python3 -m http.server` in this folder and open http://localhost:8000/map.html. |
| `zenith-map-standalone.html` | The same page with the data embedded (11 MB). Opens by double-click, no server, no internet. Use it as the backup for the live demo. |
| `export_engine_data.py` | Rebuilds the `.bin` and `.json` from a data folder. |
| `check_engine.js` | `node check_engine.js . ../../results/scores_balanced.json` compares the engine with the Python scores. |

## For Mo: putting it on the globe

```js
const zen = await ZenithEngine.load('app/map');      // folder with earth_cells.bin and engine_params.json

// on globe click:
const r = zen.scoreAt(lat, lon);
// r.land === false  -> ocean; r.message says so
// r.features        -> the cell's data (temperatures, rain, slope, rock, ...)
// r.targets         -> seven results, best first. Each has:
//   name, body, score, earthTestableScore, percentile, eligible, ineligibleReason,
//   dims {thermal, aridity, terrain, surface, ice, illumination, geology}, notTestableOnEarth

// globe colouring, about 0.2 s for the whole planet:
const s = zen.scoreAll('jezero');                     // or 'best'; Float32Array per land cell, NaN = not scored
const [lat_i, lon_i] = zen.cellLatLon(i);             // position of cell i
// mission-plan weights: zen.scoreAll('jezero', { weights: { terrain: 3, thermal: 1, ... } })
// Earth-testable score: zen.scoreAll('jezero', { earthTestable: true })
```

Easiest globe route: draw the `scoreAll` result into a 1440 x 720 canvas exactly as `map.html` does, and use that canvas as the globe's texture (globe.gl and three.js both accept a canvas).

## What a click means

- A cell is 0.25° (about 28 km at the equator).
- Cells that are vegetated, wet or ice sheet still get a score, but are marked "not scored" with the reason, the same rule as the engine's rankings. Ice counts only for Shackleton and Arcadia.
- Percentile = share of scored cells for that target that this cell beats (area-weighted). It's only shown for cells that pass the filter.
- Temperature is out of Earth's reach for all seven targets and is marked with *. The Earth-testable score leaves it out.

Written with AI assistance (Claude), reviewed by Team Zenith.
