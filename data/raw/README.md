# data/raw/

Downloaded source data, exactly as it came from the agency. Don't edit files here. The pipeline reads from this folder and writes to `data/processed/`.

**Everything in this folder except this README and `SOURCES.md` is gitignored.** Files over 50 MB go on the team's shared Drive folder. Each teammate downloads them into their own local `data/raw/`.

- **Inputs:** none. You fill it by downloading.
- **Outputs:** raster/NetCDF/HDF files read by `pipeline/`.
- **Rule:** every dataset you download gets a row in [SOURCES.md](SOURCES.md), including your GitHub username.

Suggested layout:

```
data/raw/
  earth/elevation/...
  earth/lst/...
  moon/lola/...
  mars/mola/...
```
