# scoring/

Turns feature vectors into similarity scores, and checks that the scores make sense.

- **Inputs:** `data/processed/earth_features.parquet`, `data/processed/target_sites.csv`
- **Outputs:** `data/processed/similarity_<target_id>.parquet` (`cell_id` + `sim_<feature>` per dimension, 0–1), `data/processed/validation.csv`

## Planned scripts

| Script | Does |
|---|---|
| `metrics.py` | Per-dimension similarity, e.g. `sim = exp(-((x - t) / s)^2)` where `t` is the target value and `s` the spread of that feature across Earth (robust: IQR). Returns 0–1, NaN stays NaN. |
| `weights.py` | Default weights per target body, and the weighted total: `total = Σ wᵢ·simᵢ / Σ wᵢ` over the available (non-NaN) dimensions. |
| `score.py` | Writes one similarity table per target. The weighted total is **not** stored; API/frontend compute it live from the slider weights. |
| `validate.py` | Ranks the known analogs and writes `validation.csv`. |

## Validation set

| Analog | Approx. lat, lon | Expected to match |
|---|---|---|
| Atacama Desert (Yungay) | −24.1, −70.0 | Mars (aridity, albedo) |
| Haughton Crater, Devon Island | 75.4, −89.7 | Mars + Moon (impact crater, permafrost, cold) |
| Death Valley | 36.5, −116.9 | Mars (aridity, temperature range) |
| Iceland (Holuhraun lava field) | 64.9, −16.8 | Mars + Moon (basalt, rough terrain) |

Pass criterion (adjust if needed): each analog lands in the **top 5 %** of land cells for at least one target with default weights. Report the percentile for every analog × target pair. Lesser-known high scorers are the "discoveries" for the pitch.
