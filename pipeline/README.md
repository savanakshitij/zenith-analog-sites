# pipeline/

Python scripts that turn raw downloads into the processed tables, all on **one shared grid**. Read [GRID.md](GRID.md) before writing any resampling code.

- **Inputs:** files in `data/raw/` (see [SOURCES.md](../data/raw/SOURCES.md)).
- **Outputs:** `data/processed/earth_features.parquet` and `data/processed/target_sites.csv` (column names in [data/processed/README.md](../data/processed/README.md)).

## Planned scripts

| Script | Does |
|---|---|
| `grid.py` | The grid helpers from GRID.md: transform, shape, `cell_id ↔ (row, col) ↔ (lat, lon)`, land mask. Everyone imports this. |
| `layers/<feature>.py` | One file per feature: read the raw file, resample to the grid, return a 720 × 1440 array. One person per file means no merge conflicts. |
| `build_features.py` | Calls every layer, stacks them, drops ocean cells, writes `earth_features.parquet`. |
| `build_targets.py` | Computes the same features for each Moon/Mars target site from LOLA/Diviner and MOLA/THEMIS/TES, writes `target_sites.csv`. |

## Units

Use the units in the column names: metres, degrees, kelvin. Albedo and fractions are 0–1. Aridity: the precipitation / potential evapotranspiration index (lower = drier), or annual precipitation in mm if PET is unavailable. Write down which one you used in this README.

## Target sites (starting list)

- **Moon:** Shackleton crater rim, Connecting Ridge, de Gerlache rim, Malapert massif (Artemis south-pole region)
- **Mars:** Jezero crater, Gale crater, Arcadia Planitia (shallow ice), Utopia Planitia

For each target, average the features over a disc about the size of one Earth cell (~25 km across) around the site center.
