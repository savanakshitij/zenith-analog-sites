# Future missions for the search bar

`missions.json` lists 9 real upcoming Moon and Mars missions, each mapped to one of our 7 targets, with the 3 best Earth test sites the v1.6 engine finds under weights that fit that mission. Mission statuses were checked on 14 Nov 2026, and each mission has source links.

## For Mo: plugging it into the UI

1. Load `missions.json`. Each entry in `missions[]` is one search suggestion.
2. Use `suggestion` as the suggestion text. Search over `suggestion`, `mission`, `agency` and `target_name`.
3. When a user picks a mission:
   - fly the globe to `best_sites[0]` and drop pins on all three `best_sites` (each has `name`, `lat`, `lon`, `score`, `percentile`)
   - show `status`, `about`, `needs_to_test` and the `sources` links in the side panel
   - show `match_quality` with `match_note` (strong / moderate / weak). **Show this. Don't hide the weak ones.** Moon missions are weak or moderate because nothing on Earth is that cold.
   - if `target_is_proxy` is true, show `proxy_note` (Rosalind Franklin and Tianwen-3 don't land on one of our 7 targets)
   - per site, `good_match` and `weak_match` list the dimensions that match well or badly. Use them for the "why this site" line.
4. If you have the engine loaded, you can rescore live: `eng.scoreAll(m.target_id, { weights: m.weights })` gives the same ranking.

## The missions

| Mission | Target used | Best Earth site | Score | Match |
|---|---|---|---|---|
| Rosalind Franklin (ESA, launch late 2028) | Jezero (proxy for Oxia Planum) | Pampa del Tamarugal, Atacama | 0.83 | strong |
| Tianwen-3 (CNSA, 2028–29 window) | Arcadia (proxy for northern plains) | Southern Taklamakan | 0.78 | strong |
| Crewed Mars base, buried ice (concept) | Arcadia | Qaidam Basin | 0.70 | strong |
| Lunar Terrain Vehicles (NASA, Artemis IV) | Shackleton | Eastern Pamir | 0.53 | moderate |
| VIPER (NASA, late 2027) | Shackleton | McMurdo Dry Valleys | 0.52 | moderate |
| Chang'e-7 (CNSA, postponed) | Shackleton | McMurdo Dry Valleys | 0.50 | moderate |
| Chandrayaan-5 / LUPEX (ISRO and JAXA, ~2028) | Shackleton | Karakoram, north of K2 | 0.49 | weak |
| Chang'e-8 (CNSA, ~2028) | Shackleton | Iran–Pakistan border | 0.44 | weak |
| Artemis IV crewed landing (NASA, early 2028) | Malapert | Karakoram | 0.43 | weak |

Left out on purpose: NASA/ESA Mars Sample Return. Congress gave it no funding for FY2026.

## How the sites are picked

- The engine and data are the same as the main ranking (v1.6). Only the dimension weights change per mission. They live in `missions_input.json`. We set them from what each mission has to test (rover missions weight terrain, ice prospectors weight ice) **before** looking at results.
- We keep the top cells that sit at least 500 km apart, so the 3 sites are different regions, not neighbouring cells.
- Rerun: `node missions/compute.js <folder with zenith-engine.js, engine_params.json, earth_cells.bin>`. It writes `missions_scored.json`. Site names and status text were then added by hand.

## What to say in the pitch

- Mars missions have strong Earth test sites. The Atacama for Rosalind Franklin is a known analog region, so that one is validation. The southern Taklamakan for Tianwen-3 is not a published analog site.
- Moon missions don't. Best scores are around 0.5 because no place on Earth gets near lunar polar cold. Present these as "test the rover and drill here, test the thermal system in a chamber".
- These are candidate test sites. Nobody has checked them in the field, and access and permits (China, Pakistan, Antarctica) are not scored.
