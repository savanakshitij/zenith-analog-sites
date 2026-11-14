# Validation, data v1.4 (balanced preset)

Two checks, reported separately. Pairings are the ones Mo wrote before any results were seen. Nothing was tuned after seeing these results.

## Check 1: strict rule on the bare-ground list (unchanged since v1)

Pass = top 10% of eligible cells on the dimension the site is famous for. Percentiles are area-weighted.

**8 pass of 23.**

| Site | Target | Signature | Signature pct | Overall pct | Cell passes filter | Result |
|---|---|---|---|---|---|---|
| Mistastin Lake crater | Malapert Massif | terrain | 75.65 | 77.93 | no | FAIL |
| Sudbury Basin | Malapert Massif | terrain | 59.32 | 73.19 | no | FAIL |
| Lonar Crater | Marius Hills lava-tube pit | terrain | 67.54 | 14.21 | no | FAIL |
| Mauna Kea | Marius Hills lava-tube pit | surface | 99.93 | 3.39 | no | PASS |
| HI-SEAS, Mauna Loa | Marius Hills lava-tube pit | surface | 96.53 | 20.49 | yes | PASS |
| Craters of the Moon | Marius Hills lava-tube pit | surface | 73.92 | 25.25 | no | FAIL |
| Black Point Lava Flow | Marius Hills lava-tube pit | surface | 94.37 | 62.34 | no | PASS |
| Lanzarote | Marius Hills lava-tube pit | surface | 99.87 | 2.89 | no | PASS |
| McMurdo Dry Valleys | Arcadia Planitia | thermal | 62.79 | 24.22 | yes | FAIL |
| Concordia Station, Dome C | Arcadia Planitia | thermal | 98.3 | 53.3 | yes | PASS |
| Axel Heiberg Island springs | Arcadia Planitia | ice | 100.0 | 9.92 | no | PASS |
| Bockfjorden, Svalbard | Arcadia Planitia | ice | 100.0 | 3.23 | yes | PASS |
| Haughton Crater, Devon Island | Jezero crater | terrain | 87.69 | 2.11 | yes | FAIL |
| Meteor Crater | Jezero crater | terrain | 71.89 | 51.53 | no | FAIL |
| Yungay, Atacama Desert | Jezero crater | aridity | 30.41 | 96.89 | yes | FAIL |
| Mars Desert Research Station | Jezero crater | aridity | 11.11 | 57.19 | yes | FAIL |
| Pilbara Craton | Jezero crater | aridity | 1.26 | 17.63 | no | FAIL |
| Nördlinger Ries | Gale crater | terrain | 67.76 | 1.3 | no | FAIL |
| Qaidam Basin | Gale crater | aridity | 59.73 | 94.77 | yes | FAIL |
| Wadi Rum | Gale crater | aridity | 83.55 | 87.6 | yes | FAIL |
| Badwater Basin, Death Valley | Meridiani Planum | aridity | 27.37 | 11.12 | yes | FAIL |
| Río Tinto | Meridiani Planum | surface | 98.14 | 2.45 | no | PASS |
| Holuhraun lava field | Meridiani Planum | surface | 71.62 | 1.08 | yes | FAIL |

## Check 2: does the rock map recognise the geology analogs? (new in v1.4)

The 13 sites with a terrain or surface signature are analogs because of their rock or their crater. The check is whether the site's cell carries the target's rock class or a confirmed impact crater.

**8 of 13 recognised.** All 6 impact sites carry a crater flag.

| Site | Target | Rock class in cell | Crater in cell | Recognised |
|---|---|---|---|---|
| Mistastin Lake crater | Malapert Massif | pa | Mistastin | yes |
| Sudbury Basin | Malapert Massif | pa | Sudbury | yes |
| Lonar Crater | Marius Hills lava-tube pit | vb | Lonar | yes |
| Mauna Kea | Marius Hills lava-tube pit | vi |  | no |
| HI-SEAS, Mauna Loa | Marius Hills lava-tube pit | vb |  | yes |
| Craters of the Moon | Marius Hills lava-tube pit | vb |  | yes |
| Black Point Lava Flow | Marius Hills lava-tube pit | ss |  | no |
| Lanzarote | Marius Hills lava-tube pit | nd |  | no |
| Haughton Crater, Devon Island | Jezero crater | sm | Haughton | yes |
| Meteor Crater | Jezero crater | vb | Barringer | yes |
| Nördlinger Ries | Gale crater | ss | Ries | yes |
| Río Tinto | Meridiani Planum | sm |  | no |
| Holuhraun lava field | Meridiani Planum | vb |  | no |

Not recognised: Mauna Kea (mapped as intermediate volcanic rock), Black Point (flow smaller than a rock-map cell), Lanzarote (no rock data at the coast), Río Tinto (geochemistry, not a rock class), Holuhraun (basalt, but paired with Meridiani, whose classes are evaporites and sandstone).

## Reading the result

- Environment analogs: Yungay ranks at the 96.9th percentile overall for Jezero, Qaidam 94.8 and Wadi Rum 87.6 for Gale. Axel Heiberg now passes on ice, because ground ice is in the data.
- Aridity rank among deserts is still not meaningful: every eligible cell is dry and the rain products disagree below 100 mm/yr.
- The best cell for Shackleton is in the McMurdo Dry Valleys, 17 km from the known site. The best cells for Marius Hills, Jezero, Gale and Meridiani are in the Atacama.

## Best cell and candidates per target

| Target | Eligible cells | Best cell | Score | Stability | Nearest known site | Candidates |
|---|---|---|---|---|---|---|
| Shackleton crater rim | 139,393 | -77.375, 161.625 | 0.2803 | 0.58 | McMurdo Dry Valleys (17 km) | 5 |
| Malapert Massif | 29,846 | 81.375, -61.625 | 0.3382 | 0.7 | Axel Heiberg Island springs (577 km) | 9 |
| Marius Hills lava-tube pit | 29,846 | -22.875, -69.875 | 0.5727 | 0.815 | Yungay, Atacama Desert (137 km) | 10 |
| Arcadia Planitia | 139,393 | 38.875, 94.625 | 0.5925 | 0.925 | Qaidam Basin (209 km) | 10 |
| Jezero crater | 29,846 | -21.625, -69.875 | 0.7398 | 0.965 | Yungay, Atacama Desert (276 km) | 10 |
| Gale crater | 29,846 | -21.625, -69.875 | 0.6305 | 0.855 | Yungay, Atacama Desert (276 km) | 10 |
| Meridiani Planum | 29,846 | -22.875, -69.625 | 0.7217 | 0.99 | Yungay, Atacama Desert (141 km) | 6 |

## Cannot be matched on Earth (target beyond every eligible cell)

- Shackleton crater rim: temp_min_K off by -43.71, temp_daynight_range_K off by +40.34, sun_noon_elev_mean_deg off by -6.91
- Malapert Massif: temp_min_K off by -83.62, temp_daynight_range_K off by +40.34, sun_noon_elev_mean_deg off by -7.01
- Marius Hills lava-tube pit: temp_min_K off by -138.62, temp_daynight_range_K off by +265.34, sun_noon_elev_mean_deg off by +0.76
- Arcadia Planitia: temp_min_K off by -43.71, temp_daynight_range_K off by +30.34
- Jezero crater: temp_min_K off by -33.62, temp_daynight_range_K off by +30.34
- Gale crater: temp_min_K off by -43.62, temp_daynight_range_K off by +30.34
- Meridiani Planum: temp_min_K off by -43.62, temp_daynight_range_K off by +30.34
