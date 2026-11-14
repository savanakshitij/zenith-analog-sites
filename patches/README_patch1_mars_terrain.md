# Patch 1: Mars terrain (computed, replaces the estimates)

mars_terrain.csv: target_id, slope_deg, roughness_tri_m, relief_m, source, method

| target | slope_deg | roughness_tri_m | relief_m | mean elevation m | old slope guess |
|---|---|---|---|---|---|
| arcadia (40.0, -160.0) | 0.197 | 19.41 | 54.1 | -3923 | 0.5 |
| jezero (18.4447, 77.4508) | 2.085 | 192.37 | 1034.9 | -2395 | 2.0 |
| gale (-4.5895, 137.4417) | 4.747 | 396.88 | 3944.6 | -4083 | 5.0 |
| meridiani (-1.9462, -5.5257) | 0.301 | 28.32 | 112.4 | -1396 | 0.3 |

Method: MOLA 128 ppd median topography, area-averaged to 1.852 km pixels on a local grid (R = 3396 km), 15 x 15 pixel box (27.8 km, about 0.47 deg) centred on the site, with one extra pixel ring for the gradients. Mean pixel slope, mean TRI (Riley 1999), relief = max minus min. Same definitions as the Earth layers, so Mars roughness can now be scored.

Checks: mean elevations match published values (Jezero floor about -2.4 km, Meridiani about -1.4 km).

Caveats
- Relief depends strongly on box size. Relief at 13 / 20 / 28 / 39 km boxes: Arcadia 31/45/54/66, Jezero 332/830/1035/1040, Gale 645/2092/3945/4624, Meridiani 30/49/112/367 m. Earth 0.25 deg cells are 28 km wide only at the equator (about 18 km at 50 deg, 7 km at 75 deg), so score relief loosely or weight it down.
- Gale's box includes part of Mount Sharp, which drives its relief and slope.
- Near the equator about 45% of MOLA 128 ppd bins are interpolated, so Gale and Meridiani are slightly smoothed. Averaging to 1.85 km reduces this.
- Earth pixels are 1.85 km N-S but narrower E-W at high latitude (ETOPO lat/lon grid); Mars pixels are square 1.85 km.
