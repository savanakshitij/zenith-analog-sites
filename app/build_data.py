"""Builds data.json / data.js for the plan layer from data v1.1.
Usage: python3 build_data.py <v1_folder> <v1_1_folder> <out_folder>"""
import json, sys
from pathlib import Path
import pandas as pd
V1, V11, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
FEATURES = ["slope_deg", "roughness_tri_m", "relief_m", "temp_min_K", "temp_daynight_range_K",
            "albedo_wsa_unitless", "precip_mm_per_yr", "ice_flag_bool"]
LABEL = {"slope_deg": "Mean slope (deg)", "roughness_tri_m": "Roughness, TRI (m)", "relief_m": "Local relief (m)",
         "temp_min_K": "Coldest night (K)", "temp_daynight_range_K": "Day/night range (K)",
         "albedo_wsa_unitless": "Albedo", "precip_mm_per_yr": "Precipitation (mm/yr)", "ice_flag_bool": "Ice present (0/1)"}
tg = pd.read_csv(V1 / "data/final/targets.csv")
scored = pd.read_csv(V11 / "data/targets_scored_v1_1.csv").set_index("target_id")
nm = pd.read_csv(V1 / "data/final/not_matchable.csv")
pool = json.load(open(V11 / "results/plan_pool.json"))["targets"]
bal = json.load(open(V11 / "results/scores_balanced.json"))["targets"]
out = {"version": "data v1.1 (14 Nov 2026)", "targets": {}}
for t in tg.to_dict("records"):
    tid = t["target_id"]
    values = []
    for f in FEATURES:
        v, used = t[f], not pd.isna(scored.at[tid, f])
        note = t.get(f + "_note")
        values.append({"feature": LABEL[f], "value": None if pd.isna(v) else v,
                       "status": t[f + "_status"] if used else "not scored",
                       "source": None if pd.isna(t.get(f + "_source")) else t.get(f + "_source"),
                       "note": "" if pd.isna(note) else str(note)})
    lesser = {(c["lat"], c["lon"]) for c in bal[tid]["lesser_known"]}
    cells = [{**c, "eligible": True, "ineligible_reason": "",
              "lists": ["lesser_known"] if (c["lat"], c["lon"]) in lesser else []} for c in pool[tid]["cells"]]
    known = [{"site": k["name"], "percentile": k.get("percentile"), "balanced_score": k.get("score"),
              "dims": k["dimensions"], "cell_eligible": k["cell_eligible"]}
             for k in bal[tid]["known_sites"].values() if k.get("score") is not None]
    out["targets"][t["name"]] = {
        "id": tid, "body": t["body"], "values": values, "out_of_earth_range": bal[tid]["out_of_earth_range"],
        "n_eligible_cells": bal[tid]["n_eligible_cells"],
        "not_matchable": [{"feature": r.parameter.replace("_", " "), "value": r.value} for r in nm[nm.target_id == tid].itertuples()],
        "cells": cells, "known_sites": known}
OUT.mkdir(exist_ok=True)
json.dump(out, open(OUT / "data.json", "w"), ensure_ascii=False)
open(OUT / "data.js", "w").write("window.ZENITH_DATA = " + json.dumps(out, ensure_ascii=False) + ";\n")
for n, t in out["targets"].items():
    print(f"{n:28} cells={len(t['cells'])} lesser={sum('lesser_known' in c['lists'] for c in t['cells'])} known={len(t['known_sites'])}")
