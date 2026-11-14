# Data sources

One row per dataset. Links are blank where the source READMEs in this repo do not give one. Add a row for every new file, including in `patches/`.

| Dataset | Agency | Link | Resolution | Used for | Added by |
|---|---|---|---|---|---|
| MODIS LST, MOD11C3 (monthly, 2025): coldest night temp (`temp_min_MOD11C3.csv`), day/night range (`temp_daynight_range_MOD11C3.csv`) | NASA LP DAAC | | Monthly 2025 (spatial scale not stated in README) | Thermal dimension | Tahir (`data/earth/`) |
| MODIS vegetation, MOD13C2 (2025): annual mean NDVI (`ndvi_mean_MOD13C2.csv`), annual max NDVI (`ndvi_max_MOD13C2.csv`) | NASA LP DAAC | | Annual 2025 (spatial scale not stated in README) | Surface dimension, vegetation mask | Tahir (`data/earth/`) |
| MODIS albedo, MCD43C3 (12 mid-month dates, 2025): white-sky albedo (`albedo_MCD43C3.csv`) | NASA LP DAAC | | 12 dates, 2025 (spatial scale not stated in README) | Surface dimension | Tahir (`data/earth/`) |
| MODIS land cover, MCD12C1 (2025): barren fraction (`barren_MCD12C1.csv`), water mask used for land-only cells | NASA LP DAAC | | Annual 2025 (spatial scale not stated in README) | Surface dimension, land mask | Tahir (`data/earth/`) |
| MODIS snow/ice, MOD10CM with MCD12C1 (2025): ice flag (`ice_flag_MOD10CM-MCD12C1.csv`) | NASA NSIDC / LP DAAC | | Monthly 2025 (spatial scale not stated in README) | Ice dimension | Tahir (`data/earth/`) |
| GPM IMERG Final monthly, Oct 2024 to Sep 2025 total (`precip_IMERG.csv`) | NASA GES DISC | | Monthly (spatial scale not stated in README) | Aridity; unreliable over hyper-arid and polar areas (see README) | Tahir (`data/earth/`) |
| NASA POWER MERRA-2 precipitation, climatology (`data/v1_3/precip_merra2_025deg.csv`); used poleward of 60° and where IMERG is missing | NASA POWER (MERRA-2) | https://power.larc.nasa.gov/docs/services/aws/ | 0.5° × 0.625° native; resampled to 0.25° grid | Aridity (v1.2 precipitation) | Not stated in archive (`Zenith_raw_data.zip`) |
| ETOPO 2022 (NOAA): slope (`slope_ETOPO2022.csv`), roughness as TRI (`roughness_ETOPO2022.csv`), relief (`relief_ETOPO2022.csv`) | NOAA NCEI | | 60 arc-second (~1.85 km) | Terrain dimension | Tahir (`data/earth/`) |
| LRO LOLA altimetry shots (LOLA RDR point clouds, `LolaRDR_*.copc.laz`) | NASA LRO LOLA, distributed by USGS Astrogeology on AWS | https://astrogeo-ard.s3.us-west-2.amazonaws.com/moon/lro/lola/ | Individual shots, gridded to 1.85 km | Moon target slope, roughness and relief (`data/v1_3/targets.csv`) | Mo (data v1) |
| Mars MOLA MEGDR 128 ppd topography (MGS-M-MOLA-5-MEGDR-L3-V1.0), tiles megt44n000hb, megt44n180hb, megt00n090hb, megt00n270hb | NASA PDS Geosciences Node | https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/ | 1/128° (~463 m at the equator), averaged to 1.85 km | Mars target slope, roughness and relief (`patches/mars_terrain.csv`, used from data v1.3) | Tahir (patch 1) |

Notes:
- The Earth layers use the 0.25° grid of `data/earth/README.md`.
- Mars terrain is computed from MOLA since data v1.3. Relief is shown but not scored (see `scoring/SCORING.md`).
