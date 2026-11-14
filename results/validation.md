# Validation, data v1.6 (balanced preset)

Rules R1 to R4 were written down before this run (`DECISIONS_v1_6.md`). Nothing was tuned after seeing results.

## 1. Rediscovery (new, the main check)

For each target, how many of the 25 best sites (at least 300 km apart) lie within 300 km of one of the known analog sites, against what random bare ground would give.

| Target | Hits | Expected by chance |
|---|---|---|
| Shackleton crater rim | 5 | 1.3 |
| Malapert Massif | 3 | 1.51 |
| Marius Hills lava-tube pit | 2 | 1.51 |
| Arcadia Planitia | 5 | 1.3 |
| Jezero crater | 2 | 1.51 |
| Gale crater | 4 | 1.51 |
| Meridiani Planum | 3 | 1.51 |

**Total: 24 hits against 10.2 expected by chance (Poisson p = 0.0001).** Per target the counts are small and not significant on their own; together they are.

## 2. Known sites against our best cells (site box)

Every named site is scored as the best cell within 0.375° of its coordinate (R1). This is fairer to known sites than v1.5, which used the one cell the coordinate fell in. Percentiles compare a best-of-up-to-9-cells score with single cells, so they lean upward, equally for known sites and candidates.

| Target | Best known site | Score | Percentile | Our best cell | Score | Not testable on Earth |
|---|---|---|---|---|---|---|
| Shackleton crater rim | McMurdo Dry Valleys | 0.3798 | 99.9 | -77.375, 161.625 | 0.4173 | thermal |
| Malapert Massif | Badwater Basin, Death Valley | 0.3799 | 97.54 | 28.625, 61.125 | 0.4613 | thermal |
| Marius Hills lava-tube pit | Yungay, Atacama Desert | 0.6241 | 99.48 | 27.375, 37.375 | 0.7293 | thermal |
| Arcadia Planitia | Dalangtan playa, Qaidam Basin | 0.6523 | 99.71 | 38.875, 95.125 | 0.6953 | thermal |
| Jezero crater | Yungay, Atacama Desert | 0.6195 | 98.82 | -20.625, -69.875 | 0.805 | thermal |
| Gale crater | Wadi Rum | 0.5668 | 98.93 | -17.625, -71.125 | 0.7315 | thermal |
| Meridiani Planum | Yungay, Atacama Desert | 0.5422 | 94.25 | -22.875, -69.625 | 0.762 | thermal |

## 3. Strict rule (unchanged since v1)

Pass = top 10% on the dimension the site is famous for. The site box raises these percentiles, so the count is not comparable with v1.5.

**10 pass of 23.**

| Site | Target | Signature | Signature pct | Overall pct | Cell passes filter | Result |
|---|---|---|---|---|---|---|
| Mistastin Lake crater | Malapert Massif | terrain | 75.65 | 20.47 | no | FAIL |
| Sudbury Basin | Malapert Massif | terrain | 59.32 | 25.99 | no | FAIL |
| Lonar Crater | Marius Hills lava-tube pit | terrain | 73.24 | 14.88 | no | FAIL |
| Mauna Kea | Marius Hills lava-tube pit | surface | 96.53 | 8.26 | yes | PASS |
| HI-SEAS, Mauna Loa | Marius Hills lava-tube pit | surface | 96.53 | 8.26 | yes | PASS |
| Craters of the Moon | Marius Hills lava-tube pit | surface | 82.11 | 46.03 | no | FAIL |
| Black Point Lava Flow | Marius Hills lava-tube pit | surface | 91.22 | 67.82 | no | PASS |
| Lanzarote | Marius Hills lava-tube pit | surface | 99.18 | 18.17 | no | PASS |
| McMurdo Dry Valleys | Arcadia Planitia | thermal | 57.8 | 29.44 | yes | FAIL |
| Concordia Station, Dome C | Arcadia Planitia | thermal | 98.38 | 44.55 | yes | PASS |
| Axel Heiberg Island springs | Arcadia Planitia | ice | 100.0 | 13.11 | no | PASS |
| Bockfjorden, Svalbard | Arcadia Planitia | ice | 53.43 | 9.72 | no | FAIL |
| Haughton Crater, Devon Island | Jezero crater | terrain | 87.69 | 1.62 | yes | FAIL |
| Meteor Crater | Jezero crater | terrain | 95.86 | 62.09 | no | PASS |
| Yungay, Atacama Desert | Jezero crater | aridity | 77.29 | 98.82 | yes | FAIL |
| Mars Desert Research Station | Jezero crater | aridity | 11.58 | 76.4 | yes | FAIL |
| Pilbara Craton | Jezero crater | aridity | 1.58 | 27.71 | no | FAIL |
| Nördlinger Ries | Gale crater | terrain | 74.18 | 1.86 | no | FAIL |
| Qaidam Basin | Gale crater | aridity | 50.7 | 78.1 | yes | FAIL |
| Wadi Rum | Gale crater | aridity | 93.12 | 98.93 | yes | PASS |
| Badwater Basin, Death Valley | Meridiani Planum | aridity | 29.43 | 21.79 | yes | FAIL |
| Río Tinto | Meridiani Planum | surface | 96.5 | 6.24 | no | PASS |
| Holuhraun lava field | Meridiani Planum | surface | 90.95 | 2.13 | yes | PASS |
