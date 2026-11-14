# Zenith data v1.6

Current version. Builds on v1.5 (sourced Mars and Moon temperatures) with four rules written before the run: see `DECISIONS_v1_6.md`. Full history of v1.1 to v1.5 is in git and in `scoring/SCORING.md` of earlier versions.

Run: `python3 score_v16.py <data v1 folder> <merra precip csv> <output folder> <patches folder>` (about 40 seconds).

## What's new
- Named sites are scored over a site box (best cell within 0.375°), the same for known analogs and our candidates.
- Features where the target is beyond Earth's range use a wider, less sensitive scale.
- Every cell and named site has an `earth_testable_score`, which leaves out dimensions Earth cannot reach (thermal, for all seven targets). The full `score` stays the headline.
- `results/benchmark.csv`: best cell, best known site and named candidates per target, both scores.
- `results/validation.md`: rediscovery check (24 hits against 10.2 expected by chance), benchmark, strict rule.
- Each scores file now has `named_candidates`, `rediscovery`, `earth_testable_dims` and `not_testable_on_earth_dims` per target.

## Limits
- Malapert has no robust Earth analog: its best match depends on how much sunlight and cold count.
- 28 km cells, 0.5° rock map, no soil chemistry, no access or logistics data.
- Desert rainfall below about 100 mm a year is not reliable.
- Sun angle, temperature and ground ice all depend partly on latitude, so latitude is counted more than once.

Scoring written with AI assistance (Claude), reviewed by Team Zenith.
