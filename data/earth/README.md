# Zenith Earth features, 0.25 deg grid

Format: one CSV per feature, columns cell_lat, cell_lon, <feature>_<unit>. cell_lat/lon = cell centre (e.g. 49.125, 9.125).
Land cells only (MCD12C1 water < 75% of the cell): ~349k cells. A cell is missing if too little valid data.

| File | Column | Definition |
|---|---|---|
| slope_ETOPO2022 | slope_deg | Mean slope of land pixels at ~1.85 km (ETOPO 60 arc-sec) |
| roughness_ETOPO2022 | roughness_tri_m | Mean Terrain Ruggedness Index (Riley 1999) at ~1.85 km |
| relief_ETOPO2022 | relief_m | Max minus min land elevation in the cell |
| temp_min_MOD11C3 | temp_min_K | Coldest monthly-mean NIGHT land surface temp, 2025 |
| temp_daynight_range_MOD11C3 | temp_daynight_range_K | Annual mean of (monthly day LST - monthly night LST), 2025 |
| albedo_MCD43C3 | albedo_wsa_unitless | Mean white-sky shortwave albedo, 12 mid-month dates 2025 |
| precip_IMERG | precip_mm_per_yr | Total precipitation Oct 2024-Sep 2025 (IMERG Final monthly) |
| ndvi_mean_MOD13C2 | ndvi_mean_unitless | Annual mean NDVI 2025 |
| ndvi_max_MOD13C2 | ndvi_max_unitless | Annual max NDVI 2025 (better for the "no forests" mask) |
| ice_flag_MOD10CM-MCD12C1 | ice_flag_bool | 1 if >=50% snow/ice land cover OR snow cover >=50% in every valid month (>=6 valid months) |
| barren_MCD12C1 | barren_pct | Bonus: % of cell classed barren (IGBP 16), 2025 |

Caveats
- Monthly means smooth extremes: temp_min is not the absolute coldest night.
- NDVI has no values over Antarctica/Greenland ice: treat missing NDVI as "no vegetation".
- IMERG is unreliable in hyper-arid and polar regions (e.g. Atacama shows ~32 mm/yr, real is far lower; Dry Valleys show 0).
- At 0.25 deg (~28 km), small analog sites can be averaged out (Dry Valleys cell is flagged ice because surrounding glaciers dominate).
- Slope is computed at ~1.85 km, so it is gentler than slope at rover scale.
- ETOPO 2022 is NOAA data (not NASA).

Sanity check (looks right): Amazon NDVI 0.60 / precip 1940 mm; Sahara barren 100% / NDVI 0.07; Atacama barren 99.9%, day/night range 25 K; Himalaya relief 2460 m, slope 8.4 deg.
