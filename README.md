# Zenith Analog Sites

**Team Zenith · NASA Space Apps Challenge 2026 (Nov 14–15)**
Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

We score every place on Earth by how closely it matches lunar and Martian target sites, using open NASA and space agency data. The result is an interactive map. You set the weight of each dimension with sliders, and you can click any cell to see where the analogy holds and where it breaks. Gravity, vacuum and radiation can't be matched anywhere on Earth, and the tool says so.

## Method in 5 lines

1. Split Earth into one shared coarse grid (0.25°, see [pipeline/GRID.md](pipeline/GRID.md)).
2. Build a feature vector per land cell: elevation, slope, roughness, surface temperature range, aridity, albedo, ice/permafrost, mineralogy where available.
3. Build the same vector for each Moon target (LRO LOLA/Diviner) and Mars target (MOLA/THEMIS/TES).
4. Compute a 0–1 similarity per dimension, then a weighted total the user controls.
5. Check the method: known analogs (Atacama, Haughton Crater, Death Valley, Iceland) must rank high. Then show the lesser-known candidates.

## Folder map

| Folder | What lives there |
|---|---|
| [data/raw/](data/raw/) | Downloaded datasets (big files gitignored). [SOURCES.md](data/raw/SOURCES.md) lists every dataset and who downloaded it. |
| [data/processed/](data/processed/) | Small committed outputs: the cell × feature table, target-site vectors, similarity tables. |
| [pipeline/](pipeline/) | Python: raw data → processed table on the shared grid. [GRID.md](pipeline/GRID.md) is the grid contract. |
| [scoring/](scoring/) | Similarity metrics, weighting, validation against known analogs. |
| [api/](api/) | FastAPI app serving precomputed scores and per-dimension breakdowns. |
| [frontend/](frontend/) | Map dashboard: heatmap, weight sliders, click-to-inspect panel, Earth vs Moon/Mars view. |
| [docs/](docs/) | Pitch notes, demo script, submission text, limits of the analogy. |

## How to run

```bash
# one-time setup (Python 3.11+)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 1. pipeline: raw rasters -> data/processed/earth_features.parquet + target vectors
python pipeline/build_features.py
python pipeline/build_targets.py

# 2. scoring: per-dimension similarity per target + validation report
python scoring/score.py
python scoring/validate.py

# 3. API (http://localhost:8000/docs)
uvicorn api.main:app --reload

# 4. frontend (static, no build step)
cd frontend && python -m http.server 5173   # open http://localhost:5173
```

These script names are fixed now so everyone points at the same files. Each folder's README describes what the script takes in and what it writes.

## Contributing

We have 48 hours, so the rules are short:

- **Never push directly to `main`.** Everything goes in through a pull request.
- **Work on your own branch, `dev/<github-username>`**, and mostly stay inside your own folder to avoid merge conflicts.
- **Open a small pull request as soon as something works, and merge quickly.** Small and often beats big and late.
- **Files over 50 MB go on the shared Drive folder, never in git.** Record them in [data/raw/SOURCES.md](data/raw/SOURCES.md).
- **Everybody resamples to the grid in [pipeline/GRID.md](pipeline/GRID.md).** Same resolution, same CRS, same cell IDs.

### Daily loop

```bash
git checkout dev/<your-username>
git pull origin main             # pick up what others merged
# ... work, then:
git add <your files>
git commit -m "scoring: add cosine similarity per dimension"
git push
gh pr create --base main --fill  # or open the PR on github.com
```

After your PR is merged, run `git pull origin main` on your branch again and keep going.
