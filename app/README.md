# Zenith mission-plan layer

Owner: Kshitij Savanna. Turns a mission plan into a coverage report: which Earth sites can test which parts of the plan, and which parts can only be tested in space.

Open `index.html` in a browser (double-click works, no server). `zenith-plan-demo.html` is the same page as one file, for sharing.

## Files

| File | What it is |
|---|---|
| `coverage.js` | The logic. Presets, subsystems, ceilings and `Zenith.assess(plan, data)`. No dependencies. |
| `data.js` / `data.json` | Input data (v1.1): 7 Moon and Mars targets, their shortlisted Earth cells, known analog sites. |
| `index.html` | Demo page. Restyle it freely, the logic stays in `coverage.js`. |
| `build_data.py` | Rebuilds the data files from data v1 and v1.1. |
| `test.js` | `node test.js` checks the arithmetic and the rules below. |

## How coverage is computed

1. A plan has a target (for example Jezero crater) and weights that say how much of its risk sits in each of 8 subsystems.
2. Four subsystems are scored from Mo's dimension scores for each Earth cell:
   mobility = terrain, thermal = thermal, resources = ice, surface and dust = mean(aridity, surface).
3. `coverage = match × ceiling`. The ceiling is the most an Earth field test can validate for that subsystem
   (mobility 0.8, thermal 0.9, resources 0.7, surface 0.6). These are team assumptions.
4. Gravity, vacuum or atmosphere, and radiation are space only: always 0, but their weight still counts, so they pull the total down.
5. Illumination and power has no data layer yet. It counts as 0 and is flagged "no data yet".
6. `plan coverage = sum(weight × coverage)`, with weights normalised to 1.

## Using it from the real frontend

```js
const out = Zenith.assess({ target: 'Jezero crater', weights: { surface: 25, mobility: 25, thermal: 15, gravity: 10 } }, data);
out.sites[0].planCoverage   // 0..1
out.sites[0].subsystems     // per subsystem: weight, match, ceiling, coverage, why
out.sites[0].verdict        // one sentence
out.ceilingCoverage         // best any Earth site could reach for this plan
out.spaceOnlyShare          // share of risk that only space can test
out.notMatchable            // gravity, pressure, radiation, day length for the target
```

## Limits (say these out loud)

- **It reranks a shortlist.** `data.json` holds 330 to 490 cells per target (the top 200 under each of four presets, from data v1.1). A plan with very unusual weights could favour a cell outside that shortlist.
- **Mars terrain is still estimated** (slope guesses, no roughness or relief), so mobility coverage for the Mars plans is the weakest number here.
- **Thermal match is low everywhere** (best about 0.5). No place on Earth is as cold as the targets, and the page says so.
- **Preset weights and ceilings are illustrative.** They were set from mission logic before looking at rankings. They are not NASA numbers.
- Illumination has no data layer and counts as zero.

## Rebuilding the data

`python3 build_data.py <data v1 folder> <data v1.1 folder> .` then nothing in `coverage.js` or `index.html` has to change.

Written with AI assistance (Claude), reviewed by Team Zenith.
