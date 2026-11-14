# Zenith Analog Sites

Team Zenith, NASA Space Apps 2026. Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars.*

## What Zenith does

1. Scores every 0.25° bare-ground cell on Earth against seven Moon and Mars base sites.
2. Scores six dimensions: thermal, aridity, terrain, surface, ice and illumination.
3. Combines them with one fixed scoring method (`scoring/score_v14.py`) and weights.
4. The mission-plan layer (`app/`) reports which Earth site can test which part of a mission plan.
5. It also reports what can only be tested in space: gravity, vacuum or atmosphere, and radiation.

## Folder map

| Folder | What is in it |
|---|---|
| `data/earth/` | Tahir's 11 Earth-layer CSVs and their README (0.25° grid). |
| `data/v1_4/` | Data v1.4 inputs and targets: `earth_features_v1_4.csv.gz` (gzipped, 66 MB unpacked), `precip_merra2_025deg.csv`, `targets.csv`, `known_sites_merged.csv`, `not_matchable.csv`, `targets_v1_4.csv` (every target value with status and source). |
| `scoring/` | `score_v14.py` (the one scoring method) and `SCORING.md` (what each version changed and why). |
| `results/` | Scores per preset, the plan pool, validation, and run summary for data v1.4. |
| `app/` | Mission-plan layer and demo page (`index.html`, `coverage.js`, `data.js`, `data.json`, `build_data.py`, `test.js`). |
| `patches/` | New data layers, one file each. |
| `case-studies/` | One folder per site: slide, screenshot, GeoTIFFs. |
| `docs/` | Pitch slides, 200-word summary, submission checklist, AI-use disclosure. |
| `SOURCES.md` | Every dataset: agency, link, resolution, use, who added it. |

## Open the demo

Open `app/index.html` in a browser. Double-click works, no server needed. `app/zenith-plan-demo.html` is the same page in one file, for sharing.

## Rerun scoring

```bash
python3 scoring/score_v14.py <data v1 folder> data/v1_4/precip_merra2_025deg.csv <output folder> patches/
```

The script reads the **data v1 folder layout** (its `targets.csv`, `earth` files and so on). That v1 folder is not in this repo yet, so put it on your own disk first. The second argument is the MERRA-2 precipitation file in `data/v1_4/`.

## Rebuild the app data

See [app/README.md](app/README.md). In short: `python3 build_data.py <data v1 folder> <data v1.1 folder> .` from `app/`.

## Run the tests

```bash
node app/test.js
```

## Version

Current version: **data v1.4**. Every rescoring gets a new version number. Slides quote the version they used.

## Team workflow

- **Never push to `main`.** Work on your own branch, `dev/<github-username>`, open a small pull request, and Kshitij merges it.
- **Stay in your folder.** Tahir works in `patches/` and `data/`. Mo works in `app/` (UI). Immanuel and Surya work in `case-studies/` and `docs/`.
- **One scoring method.** Nobody adds weights or scores outside `scoring/`.
- **Files over 50 MB go on the shared Drive, not git.** Note the Drive link in `SOURCES.md`.

Built with AI assistance (Claude). All data sources are listed in [SOURCES.md](SOURCES.md).
