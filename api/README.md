# api/

A small FastAPI app that serves the precomputed scores. It does no heavy science at request time. It loads the Parquet files once at startup and does lookups and weighted sums.

- **Inputs:** `data/processed/earth_features.parquet`, `target_sites.csv`, `similarity_<target_id>.parquet`
- **Outputs:** JSON over HTTP for the frontend

Run from the repo root:

```bash
uvicorn api.main:app --reload    # docs at http://localhost:8000/docs
```

## Planned endpoints

| Method & path | Returns |
|---|---|
| `GET /health` | `{"ok": true}` |
| `GET /targets` | List of target sites: `target_id, body, name, lat, lon` + feature values |
| `GET /scores?target=<id>&w_elev=1&w_slope=1&...&top=5000` | `[{cell_id, lat, lon, score}]` for the heatmap. Weights default to the body defaults. Return only the top N cells so the map stays fast. |
| `GET /cell/{cell_id}?target=<id>` | Feature values for the cell and the target side by side, `sim_<feature>` per dimension, the weighted total, and the fixed "can't match on Earth" list (gravity, vacuum, radiation) |
| `GET /validation` | Contents of `validation.csv` |

Enable CORS for `http://localhost:5173` so the frontend can call it.
