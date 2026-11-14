# data/processed/

Small, committed outputs that every other part of the project reads. Keep each file well under 50 MB. Parquet is preferred because it's small and keeps types. Use CSV only for tiny tables you want to read on GitHub.

| File | Written by | Read by | Contents |
|---|---|---|---|
| `earth_features.parquet` | `pipeline/build_features.py` | scoring | One row per land cell of the shared grid (see [pipeline/GRID.md](../../pipeline/GRID.md)) |
| `target_sites.csv` | `pipeline/build_targets.py` | scoring, api, frontend | One row per Moon/Mars target site, with the same feature columns |
| `similarity_<target_id>.parquet` | `scoring/score.py` | api | `cell_id` + one `sim_<feature>` column (0–1) per dimension |
| `validation.csv` | `scoring/validate.py` | docs | Rank/percentile of the known analogs for each target |

## Column names (shared contract)

```
cell_id, lat, lon,
elev_m, slope_deg, roughness_m, tsurf_range_k, aridity, albedo,
ice_frac, permafrost_frac, [mineral_* optional]
```

`target_sites.csv` adds `target_id, body (moon|mars), name` in front of the feature columns. Missing values are empty (NaN), never 0. If you add a feature, add the column here and tell the team.
