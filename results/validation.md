# Validation, data v1.3 (balanced preset)

Percentiles are area-weighted, among the cells eligible for that target (bare ground, plus ice cells for Shackleton and Arcadia).
Pass = top 10% on the dimension the site is famous for. Same pairings and rule as v1. Nothing was tuned after seeing these results.

**Strict rule: 7 pass of 23.** 11 of the 23 sites sit in a cell that passes the bare-ground filter.

| Site | Target | Signature | Signature pct | Overall pct | Cell passes filter | Result |
|---|---|---|---|---|---|---|
| Mistastin Lake crater | Malapert Massif | terrain | 75.65 | 66.46 | no | FAIL |
| Sudbury Basin | Malapert Massif | terrain | 59.32 | 59.1 | no | FAIL |
| Lonar Crater | Marius Hills lava-tube pit | terrain | 67.54 | 4.28 | no | FAIL |
| Mauna Kea | Marius Hills lava-tube pit | surface | 99.93 | 3.04 | no | PASS |
| HI-SEAS, Mauna Loa | Marius Hills lava-tube pit | surface | 96.53 | 5.63 | yes | PASS |
| Craters of the Moon | Marius Hills lava-tube pit | surface | 73.92 | 6.52 | no | FAIL |
| Black Point Lava Flow | Marius Hills lava-tube pit | surface | 94.37 | 61.32 | no | PASS |
| Lanzarote | Marius Hills lava-tube pit | surface | 99.87 | 2.45 | no | PASS |
| McMurdo Dry Valleys | Arcadia Planitia | thermal | 62.79 | 24.59 | yes | FAIL |
| Concordia Station, Dome C | Arcadia Planitia | thermal | 98.3 | 58.35 | yes | PASS |
| Axel Heiberg Island springs | Arcadia Planitia | ice | 56.54 | 5.82 | no | FAIL |
| Bockfjorden, Svalbard | Arcadia Planitia | ice | 100.0 | 3.63 | yes | PASS |
| Haughton Crater, Devon Island | Jezero crater | terrain | 87.69 | 1.92 | yes | FAIL |
| Meteor Crater | Jezero crater | terrain | 71.89 | 25.78 | no | FAIL |
| Yungay, Atacama Desert | Jezero crater | aridity | 30.41 | 97.63 | yes | FAIL |
| Mars Desert Research Station | Jezero crater | aridity | 11.11 | 61.27 | yes | FAIL |
| Pilbara Craton | Jezero crater | aridity | 1.26 | 5.22 | no | FAIL |
| Nördlinger Ries | Gale crater | terrain | 67.76 | 0.31 | no | FAIL |
| Qaidam Basin | Gale crater | aridity | 59.73 | 85.88 | yes | FAIL |
| Wadi Rum | Gale crater | aridity | 83.55 | 91.23 | yes | FAIL |
| Badwater Basin, Death Valley | Meridiani Planum | aridity | 27.37 | 4.42 | yes | FAIL |
| Río Tinto | Meridiani Planum | surface | 98.14 | 1.84 | no | PASS |
| Holuhraun lava field | Meridiani Planum | surface | 71.62 | 0.78 | yes | FAIL |

## Reading the result

- 12 sites sit in cells the filter removes. They are geology analogs (impact structures, basalt, acid iron chemistry) in vegetated or mixed land, and most are far smaller than a 27 km cell.
- Aridity rank among deserts is not meaningful: every eligible cell is dry and the rain products disagree below 100 mm/yr.
- Overall score: Yungay ranks at the 97.6th percentile for Jezero, Wadi Rum 91 and Qaidam 86 for Gale.
- The best cell for Shackleton is in the McMurdo Dry Valleys, 17 km from the known analog site. The best cells for Marius Hills, Jezero, Gale and Meridiani are in the Atacama, 137 to 276 km from Yungay.

## Best cell and candidates per target

| Target | Eligible cells | Best cell | Score | Stability | Nearest known site | Candidates |
|---|---|---|---|---|---|---|
| Shackleton crater rim | 139,393 | -77.375, 161.625 | 0.2679 | 0.64 | McMurdo Dry Valleys (17 km) | 6 |
| Malapert Massif | 29,846 | 81.375, -61.625 | 0.394 | 0.8 | Axel Heiberg Island springs (577 km) | 8 |
| Marius Hills lava-tube pit | 29,846 | -22.875, -69.875 | 0.6165 | 0.955 | Yungay, Atacama Desert (137 km) | 9 |
| Arcadia Planitia | 139,393 | 38.875, 94.625 | 0.5416 | 0.885 | Qaidam Basin (209 km) | 10 |
| Jezero crater | 29,846 | -21.625, -69.875 | 0.7036 | 0.945 | Yungay, Atacama Desert (276 km) | 10 |
| Gale crater | 29,846 | -21.625, -69.875 | 0.5838 | 0.805 | Yungay, Atacama Desert (276 km) | 10 |
| Meridiani Planum | 29,846 | -22.875, -69.625 | 0.6835 | 0.94 | Yungay, Atacama Desert (141 km) | 6 |

## Cannot be matched on Earth (target beyond every eligible cell)

- Shackleton crater rim: temp_min_K off by -43.71, temp_daynight_range_K off by +40.34, sun_noon_elev_mean_deg off by -6.91
- Malapert Massif: temp_min_K off by -83.62, temp_daynight_range_K off by +40.34, sun_noon_elev_mean_deg off by -7.01
- Marius Hills lava-tube pit: temp_min_K off by -138.62, temp_daynight_range_K off by +265.34, sun_noon_elev_mean_deg off by +0.76
- Arcadia Planitia: temp_min_K off by -43.71, temp_daynight_range_K off by +30.34
- Jezero crater: temp_min_K off by -33.62, temp_daynight_range_K off by +30.34
- Gale crater: temp_min_K off by -43.62, temp_daynight_range_K off by +30.34
- Meridiani Planum: temp_min_K off by -43.62, temp_daynight_range_K off by +30.34
