# Zenith data v1.2

A rescoring of Mo's data v1 with fixes for the problems found when validating it. The Earth layers (Tahir) and the Moon and Mars targets (Mo) are unchanged, except where listed below.

Run: `python3 score_v12.py <data v1 folder> <merra precip csv> <output folder>` (about 20 seconds).

## Files

| File | What it is |
|---|---|
| `results/scores_<preset>.json` | Same structure as v1: `top` (25), `lesser_known` (10), `known_sites` per target |
| `results/plan_pool.json` | 330 to 490 cells per target with all five dimension scores, for the mission-plan layer |
| `results/validation.md`, `validation_v1_2.csv` | Validation against the 23 known analog sites |
| `results/run_summary.json`, `scales.json` | Counts, scales, best cell per target |
| `data/earth_features_v1_2.csv` | Tahir's layers plus the precipitation used, `bare`, `icy`, `area_w` |
| `data/targets_scored_v1_2.csv` | The target values that were scored |
| `data/targets.csv`, `not_matchable.csv`, `known_sites_merged.csv` | Copied from v1 unchanged |
| `score_v12.py` | The scoring script |

## What changed from v1, and why

1. **Ice cells count only for targets that have ice** (Shackleton, Arcadia). In v1, 79% of eligible cells were ice sheet, 70% of them in Antarctica, which skewed every scale and percentile.
2. **Area weighting.** A 0.25° cell near the pole is far smaller than one at the equator. Scales and percentiles now weight each cell by cos(latitude). Scales come from bare-ground cells.
3. **Precipitation.** IMERG reads about 0 over ice sheets. v1.1 uses IMERG between 60°S and 60°N and NASA POWER (MERRA-2) poleward of 60° and where IMERG is missing. Rain is compared in mm, not on a log scale: every target is 0, and a log scale magnifies differences below 100 mm that the products cannot resolve.
4. **No missing dimensions.** A cell needs every feature the target has. In v1 a cell with no albedo was scored on four dimensions and could win.
5. **Mars roughness is not scored.** The v0 value is an elevation standard deviation, not the Terrain Ruggedness Index used for Earth and the Moon. Mars terrain is slope only, and that slope is still an estimate.
6. **Stability** is the share of 200 random weightings in which a cell is in the top 1% of eligible cells (v1: top 50 cells, which was stricter for larger sets).
7. The `team_criteria` preset was dropped, so there is one scoring method.

## Known limits

- **Mars terrain is still estimated.** Slope values for Arcadia, Jezero, Gale and Meridiani are guesses, and relief is blank. The MOLA files could not be downloaded in either build environment. File list: v1 `ESTIMATED_VALUES.md`.
- **Thermal is clamped.** Every target is colder and has a bigger day/night swing than anywhere on Earth, so all seven targets ask for the same thing: the coldest, most extreme bare ground. Terrain and albedo are what separate the targets.
- **Environment only.** No layer measures rock type, so basalt, impact and geochemistry analogs are not found.
- The mask thresholds (50% bare ground, NDVI 0.3) are unchanged from v1.

Scoring written with AI assistance (Claude), reviewed by Team Zenith.

## Added in v1.2: illumination

A sixth dimension, `illumination`, with one feature: `sun_noon_elev_mean_deg`, the annual mean of the Sun's elevation at local noon (0 when the Sun stays below the horizon). It is computed from latitude and axial tilt only (Earth 23.44°, Moon 1.54°, Mars 25.19°), for Earth cells and targets alike. No download. It ignores terrain shadowing and atmosphere, and it says nothing about sunlight strength or day length, which stay on the "cannot be matched" list. It has weight 1 in every preset.

Effect: the lunar polar targets now point to high-latitude bare ground (Transantarctic Mountains, northern Ellesmere and Greenland), Arcadia (40°N on Mars) to the Qaidam and northern Tibetan Plateau, and the low-latitude targets stay in the Atacama. Strict validation is unchanged at 8 of 23.
