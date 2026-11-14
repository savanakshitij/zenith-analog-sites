# Zenith data v1.4

A rescoring of Mo's data v1 with fixes for the problems found when validating it. The Earth layers (Tahir) and the Moon and Mars targets (Mo) are unchanged, except where listed below.

Run: `python3 score_v14.py <data v1 folder> <merra precip csv> <output folder> <patches folder>` (about 20 seconds).

## Files

| File | What it is |
|---|---|
| `results/scores_<preset>.json` | Same structure as v1: `top` (25), `lesser_known` (10), `known_sites` per target |
| `results/plan_pool.json` | 330 to 490 cells per target with all five dimension scores, for the mission-plan layer |
| `results/validation.md`, `validation_v1_4.csv` | Validation against the 23 known analog sites |
| `results/run_summary.json`, `scales.json` | Counts, scales, best cell per target |
| `data/earth_features_v1_4.csv` | Tahir's layers plus the precipitation used, `bare`, `icy`, `area_w` |
| `data/targets_v1_4.csv` | Every target value with status, source and whether it is scored |
| `data/targets.csv`, `not_matchable.csv`, `known_sites_merged.csv` | Copied from v1 unchanged |
| `score_v14.py` | The scoring script |

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

## Changed in v1.3: real Mars terrain, relief not scored

- Slope and roughness for Arcadia, Jezero, Gale and Meridiani now come from MOLA elevation (Tahir, patch 1), computed the same way as Earth and the Moon. The point about Mars roughness under "What changed from v1" (item 5) and the Mars terrain limit no longer apply.
- Relief is shown but not scored. It depends strongly on box size, and a 0.25° Earth cell is 28 km wide at the equator but 18 km at 50° and 7 km at 75°, so Earth relief is not comparable across latitudes or with the 28 km target boxes. Terrain = slope and roughness.
- Scored target values: 21 computed, 20 published, 15 estimated (8 temperatures, 2 albedo values, 5 ice flags).
- Strict validation: 7 of 23.

## Changed in v1.4: geology, ground ice, tags, geology track

- **Geology is a seventh dimension.** A cell matches if its rock class (GLiM, Tahir patch 3) is one of the target's classes, or if the target is an impact site and the cell holds a confirmed impact crater. Target classes are the union of Mo's `glim_targets.csv` and Tahir's proposal: Shackleton and Malapert pb; Marius vb; Arcadia su, vb; Jezero ss, vb; Gale ss, sm; Meridiani ev, ss. Match scores 1, no match scores 0.37 (same yes/no treatment the ice flag had). Unknown rock counts as no match. All seven labels are estimates from general literature.
- **Ground ice is in the ice dimension.** `ground_ice_frac` = the surface ice flag, or the ESA CCI permafrost share where that map has a value (Mo), or elsewhere a temperature stand-in (0 at a mean ground temperature of 275 K, rising to 1 at 267 K, from NASA POWER). The stand-in agrees with the ESA map on 85% of bare-ground cells where both exist. `ground_ice_source` says which one a cell uses.
- **Tags, not scored:** rock class, impact crater in the cell, lava tube within 30 km (Mo's list of 10).
- **Geology track.** `geology_track` in each scores file lists the best cells with the right rock or a crater, ignoring the bare-ground filter. It is for sampling and drilling tests, not surface operations.
- **Wind and dust** (NASA POWER, Mo) are in the Earth table and shown in the demo, but not scored: the Mars values are still missing.
- **Validation** now has two checks: the strict rule (8 of 23) and whether the rock map recognises the geology analogs (8 of 13, with all 6 impact sites flagged).
- Scored target values: 21 computed, 20 published, 22 estimated (the 7 rock labels are new and all estimated).
- `patches/` holds every patch file used, plus `ground_temp_mean_POWER.csv` (NASA POWER mean ground temperature on the 0.25° grid).
