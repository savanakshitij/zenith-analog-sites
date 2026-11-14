# SOURCES (Earth side, Tahir)

Raw files live in Downloads\zenith_raw (not on GitHub, 6.2 GB). URL lists in zenith_urls/.

| Parameter | Dataset | Provider | Resolution | Time span | Files |
|---|---|---|---|---|---|
| Surface temp (annual min, day/night range) | MOD11C3 v061, Terra LST monthly CMG | NASA LP DAAC | 0.05 deg | Jan-Dec 2025 | 12 |
| NDVI vegetation mask | MOD13C2 v061, Terra vegetation indices monthly CMG | NASA LP DAAC | 0.05 deg | Jan-Dec 2025 | 12 |
| Slope, roughness, local relief | ETOPO 2022 v1, 60 arc-sec, surface elevation (GeoTIFF) | NOAA NCEI (not NASA) | ~1.85 km | static | 1 |
| Albedo | MCD43C3 v061, BRDF/albedo daily CMG (16-day window), 15th of each month | NASA LP DAAC | 0.05 deg | 2025, 12 dates | 12 |
| Aridity / precipitation | GPM IMERG Final monthly v07 (GPM_3IMERGM) | NASA GES DISC | 0.1 deg | Oct 2024-Sep 2025* | 12 |
| Ice flag (context) | MOD10CM v061, Terra snow cover monthly CMG | NASA NSIDC DAAC | 0.05 deg | Jan-Dec 2025 | 12 |
| Ice flag + barren class | MCD12C1 v061, land cover yearly CMG | NASA LP DAAC | 0.05 deg | 2025 | 1 |

*IMERG Final monthly only available through Sep 2025 as of 14 Nov 2026, so a full 12-month cycle Oct 2024-Sep 2025 is used.

Caveats
- Monthly LST means smooth extremes: "annual min" = minimum of monthly means.
- Albedo = mean of 12 mid-month snapshots.
- All checked: file counts, HDF4/HDF5/TIFF headers, sizes match NASA CMR; ETOPO TIFF verified complete.

## Patches
| Parameter | Dataset | Provider | Link | Resolution |
|---|---|---|---|---|
| Mars slope, roughness, relief (Arcadia, Jezero, Gale, Meridiani) | MOLA MEGDR 128 ppd topography (MGS-M-MOLA-5-MEGDR-L3-V1.0), tiles megt44n000hb, megt44n180hb, megt00n090hb, megt00n270hb | NASA PDS Geosciences Node | https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/ | 1/128 deg (~463 m at equator) |
| Rock type (OTHER SOURCE, not NASA) | Global Lithological Map GLiM v1.0, gridded 0.5 deg (Hartmann and Moosdorf 2012) | PANGAEA | https://doi.org/10.1594/PANGAEA.788537 | 0.5 deg |
| Impact craters (OTHER SOURCE, not NASA) | Earth Impact Database (PASSC, Univ. of New Brunswick), 199 confirmed structures; Internet Archive snapshot 2024-05-10; 14 coordinates from Wikidata/Wikipedia | PASSC via web.archive.org | http://www.passc.net/EarthImpactDatabase/ | point list |
| Mars surface temperature (4 sites) | Mars Climate Database v6.2 web interface (LMD/OU/IAA/ESA/CNES), climatology scenario; climate model | LMD | https://www-mars.lmd.jussieu.fr/mcd_python/ | point queries (high-resolution mode) |
| Moon polar temperature (Shackleton, Malapert) | LRO Diviner Polar Cumulative Products, bolometric temperature, diurnal local-time bins (Williams et al. 2019) | NASA PDS Geosciences Node | https://pds-geosciences.wustl.edu/lro/lro-l-dlre-4-rdr-v1/lrodlr_1001/data/pcp/diurnal/ltim/pols/ | 240 m |
