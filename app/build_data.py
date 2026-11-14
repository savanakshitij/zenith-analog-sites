"""Builds data.json / data.js for the plan layer from a scored data folder (v1.3 or later).
Usage: python3 build_data.py <data v1 folder> <scored data folder> <out folder>"""
import json, sys, glob
from pathlib import Path
import pandas as pd
V1, VX, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
LABEL = {"slope_deg": "Mean slope (deg)", "roughness_tri_m": "Roughness, TRI (m)", "relief_m": "Local relief (m)",
         "temp_min_K": "Coldest night (K)", "temp_daynight_range_K": "Day/night range (K)",
         "albedo_wsa_unitless": "Albedo", "precip_mm_per_yr": "Precipitation (mm/yr)", "ice_flag_bool": "Ice present (0/1)",
         "sun_noon_elev_mean_deg": "Mean noon sun elevation (deg)", "ground_ice_frac": "Ice at or near the surface (0 to 1)",
         "geology_match": "Rock type"}
ROCK_NAMES = {"su": "loose sediment", "vb": "basalt", "ss": "sandstone and mudstone", "pb": "gabbro and anorthosite", "sm": "mixed sediment",
              "sc": "carbonate rock", "va": "acid volcanic rock", "mt": "metamorphic rock", "pa": "granite", "vi": "intermediate volcanic rock",
              "wb": "water", "py": "pyroclastics", "pi": "intermediate plutonic rock", "ev": "evaporites (salts)", "nd": "unknown", "ig": "ice"}
tl = pd.read_csv(sorted(glob.glob(str(VX / "data/targets_v*.csv")))[-1])
nm = pd.read_csv(V1 / "data/final/not_matchable.csv")
pool = json.load(open(VX / "results/plan_pool.json"))
bal = json.load(open(VX / "results/scores_balanced.json"))["targets"]
out = {"version": "data " + pool["version"] + " (14 Nov 2026)", "targets": {}}
for tid, g in tl.groupby("target_id", sort=False):
    values = [{"feature": LABEL[r.feature], "value": None if pd.isna(r.value) else (str(r.note).split(": ", 1)[-1] if r.feature == "geology_match" else r.value),
               "status": r.status if r.scored else ("not scored" if pd.isna(r.value) else "context only"),
               "source": None if pd.isna(r.source) else r.source, "note": "" if pd.isna(r.note) else str(r.note)} for r in g.itertuples()]
    lesser = {(c["lat"], c["lon"]) for c in bal[tid]["lesser_known"]}
    for c in pool["targets"][tid]["cells"]:
        c["tags"]["rock"] = ROCK_NAMES.get(c["tags"].get("rock_abbr"), "unknown")
    cells = [{**c, "eligible": True, "ineligible_reason": "",
              "lists": ["lesser_known"] if (c["lat"], c["lon"]) in lesser else []} for c in pool["targets"][tid]["cells"]]
    known = [{"site": k["name"], "percentile": k.get("percentile"), "balanced_score": k.get("score"),
              "dims": k["dimensions"], "cell_eligible": k["cell_eligible"]}
             for k in bal[tid]["known_sites"].values() if k.get("score") is not None]
    out["targets"][g.name.iloc[0]] = {
        "id": tid, "body": g.body.iloc[0], "values": values, "out_of_earth_range": bal[tid]["out_of_earth_range"],
        "n_eligible_cells": bal[tid]["n_eligible_cells"],
        "not_matchable": [{"feature": r.parameter.replace("_", " "), "value": r.value} for r in nm[nm.target_id == tid].itertuples()],
        "cells": cells, "known_sites": known,
        "geology_track": [{**g, "rock": ROCK_NAMES.get(g["tags"].get("rock_abbr"), "unknown")} for g in bal[tid].get("geology_track", [])[:8]]}
OUT.mkdir(exist_ok=True)
json.dump(out, open(OUT / "data.json", "w"), ensure_ascii=False)
open(OUT / "data.js", "w").write("window.ZENITH_DATA = " + json.dumps(out, ensure_ascii=False) + ";\n")
print(out["version"], {n: len(t["cells"]) for n, t in out["targets"].items()})
