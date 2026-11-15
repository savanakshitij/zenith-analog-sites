# New candidates

A new candidate is the best cell at least 500 km from all 37 known analog sites.

Balanced weights, as the app uses with no mission picked. Same rule and code as the app (NEW_KM = 500 in zenith-app/js/bridge.js). Regenerate with `node scoring/new_candidates.mjs`.

Land cells: 349,031. Bare-ground cells scored: 29,846.

## Best match and best new candidate per target

| Target | Best match overall | Score | Best new candidate | Score | Km to nearest known site |
|---|---|---|---|---|---|
| Shackleton crater rim | McMurdo Dry Valleys | 0.42 | Kunlun Mountains, China (36.6N, 84.9E) | 0.39 | 629 (Dalangtan playa, Qaidam Basin) |
| Malapert Massif | Baluchistan, Iran–Pakistan border | 0.46 | same place | 0.46 | 1,685 (Tso Kar Valley, Ladakh (ISRO HOPE)) |
| Marius Hills lava-tube pit | Harrat lava fields, NW Saudi Arabia | 0.73 | Southern Libya, north of the Tibesti Mountains (23.1N, 18.6E) | 0.71 | 1,609 (Balos Cove, Santorini) |
| Arcadia Planitia | Qaidam Basin, China | 0.70 | Southern Taklamakan, Xinjiang, China (37.9N, 84.6E) | 0.69 | 618 (Dalangtan playa, Qaidam Basin) |
| Jezero crater | Pampa del Tamarugal, Atacama, Chile | 0.81 | Tibesti Mountains, northern Chad (21.4N, 17.4E) | 0.73 | 1,836 (Mount Etna) |
| Gale crater | Southern Peru coast | 0.73 | Eastern Yemen, south of the Rub' al Khali (15.4N, 50.9E) | 0.65 | 1,144 (Dallol, Danakil Depression) |
| Meridiani Planum | Atacama Desert, Chile | 0.76 | Nubian Desert near Abu Simbel and Lake Nasser, southern Egypt (22.6N, 31.9E) | 0.68 | 849 (Wadi Rum) |

## Why each new candidate

- Shackleton crater rim: Strongest on ice (1.00) and dryness (0.52); weakest on sunlight (0.16).
- Malapert Massif: Strongest on ice (1.00) and rock type (1.00); weakest on sunlight (0.13).
- Marius Hills lava-tube pit: Strongest on ice (1.00) and rock type (1.00); weakest on cold (0.23), and no place on Earth is that cold.
- Arcadia Planitia: Strongest on rock type (1.00) and surface (0.99); weakest on cold (0.32), and no place on Earth is that cold.
- Jezero crater: Strongest on ice (1.00) and rock type (1.00); weakest on cold (0.23), and no place on Earth is that cold.
- Gale crater: Strongest on ice (1.00) and rock type (1.00); weakest on cold (0.18), and no place on Earth is that cold.
- Meridiani Planum: Strongest on ice (1.00) and rock type (1.00); weakest on cold (0.17), and no place on Earth is that cold.

## Top 10 new candidates across all targets

One entry per place. Sites within 300 km of a higher-scoring one are merged and listed under other targets.

| # | Place | Target | Score | Rank | Km to nearest known site | Also matches |
|---|---|---|---|---|---|---|
| 1 | Tibesti Mountains, northern Chad (21.4N, 17.4E) | Jezero crater | 0.73 | 20 | 1,836 | Marius Hills lava-tube pit 0.71, Gale crater 0.64, Meridiani Planum 0.63, Malapert Massif 0.39, Shackleton crater rim 0.31 |
| 2 | Hadhramaut, Yemen (13.6N, 46.4E) | Jezero crater | 0.71 | 38 | 659 | Gale crater 0.65, Marius Hills lava-tube pit 0.64, Meridiani Planum 0.61, Malapert Massif 0.35, Shackleton crater rim 0.28 |
| 3 | Rub' al Khali, Arabia (15.1N, 50.9E) | Jezero crater | 0.71 | 43 | 1,142 | Gale crater 0.65, Meridiani Planum 0.58, Marius Hills lava-tube pit 0.55, Malapert Massif 0.34, Shackleton crater rim 0.27 |
| 4 | Harrat lava fields, NW Saudi Arabia (25.1N, 37.6E) | Jezero crater | 0.70 | 46 | 540 | Marius Hills lava-tube pit 0.69, Meridiani Planum 0.58, Gale crater 0.55, Arcadia Planitia 0.47, Malapert Massif 0.39, Shackleton crater rim 0.32 |
| 5 | Eastern Desert near Marsa Alam, Egypt (25.1N, 34.6E) | Jezero crater | 0.70 | 50 | 500 | Meridiani Planum 0.67, Marius Hills lava-tube pit 0.61, Gale crater 0.59, Arcadia Planitia 0.52, Malapert Massif 0.38, Shackleton crater rim 0.31 |
| 6 | Southern Taklamakan, Xinjiang, China (37.9N, 84.6E) | Arcadia Planitia | 0.69 | 3 | 618 | Marius Hills lava-tube pit 0.57, Jezero crater 0.56, Gale crater 0.54, Malapert Massif 0.40, Shackleton crater rim 0.39 |
| 7 | Sahara, Algeria (25.9N, 7.6E) | Jezero crater | 0.69 | 75 | 1,492 | Marius Hills lava-tube pit 0.68, Meridiani Planum 0.62, Gale crater 0.59, Arcadia Planitia 0.54, Malapert Massif 0.38, Shackleton crater rim 0.30 |
| 8 | Nubian Desert near Abu Simbel and Lake Nasser, southern Egypt (22.6N, 31.9E) | Meridiani Planum | 0.68 | 4 | 849 | Jezero crater 0.65, Marius Hills lava-tube pit 0.60, Gale crater 0.57, Arcadia Planitia 0.48, Malapert Massif 0.34, Shackleton crater rim 0.27 |
| 9 | Sahara, Algeria (25.9N, 4.6E) | Jezero crater | 0.68 | 88 | 1,406 | Meridiani Planum 0.60, Gale crater 0.58, Marius Hills lava-tube pit 0.57, Arcadia Planitia 0.53, Malapert Massif 0.40, Shackleton crater rim 0.32 |
| 10 | Haruj volcanic field, Libya (27.6N, 17.4E) | Marius Hills lava-tube pit | 0.68 | 21 | 1,148 | Jezero crater 0.61, Meridiani Planum 0.60, Arcadia Planitia 0.53, Gale crater 0.49, Malapert Massif 0.35, Shackleton crater rim 0.28 |

Not field-checked yet. Access and permits not assessed.
