"""Exports what the browser engine needs from data v1.6.
Usage: python3 export_engine_data.py <data v1.6 folder> <out folder>
Writes earth_cells.bin (quantized land-cell features), engine_params.json (targets, scales, ranges, percentile tables)."""
import json, sys
from pathlib import Path
import numpy as np, pandas as pd

V, OUT = Path(sys.argv[1]), Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
DIMS = ["thermal", "aridity", "terrain", "surface", "ice", "illumination", "geology"]
DIMENSIONS = {"thermal": ["temp_min_K", "temp_daynight_range_K"], "aridity": ["precip_mm_per_yr"], "terrain": ["slope_deg", "roughness_tri_m"],
              "surface": ["albedo_wsa_unitless"], "ice": ["ground_ice_frac"], "illumination": ["sun_noon_elev_mean_deg"], "geology": ["geology_match"]}
LOG1P = ["roughness_tri_m"]
ROCK = {"shackleton": ["pb"], "malapert": ["pb"], "marius": ["vb"], "arcadia": ["su", "vb"], "jezero": ["ss", "vb"], "gale": ["ss", "sm"], "meridiani": ["ev", "ss"]}
IMPACT = ["shackleton", "malapert", "jezero", "gale"]
ROCKS = ["nd", "su", "vb", "ss", "pb", "sm", "sc", "va", "mt", "pa", "vi", "wb", "py", "pi", "ev", "ig"]
# quantization: (column, offset, scale, dtype)  stored = round((value - offset) * scale); missing = max of dtype
Q = [("temp_min_K", 150, 100, np.uint16), ("temp_daynight_range_K", -20, 500, np.uint16), ("precip_mm_per_yr", 0, 5, np.uint16),
     ("slope_deg", 0, 1000, np.uint16), ("roughness_tri_m", 0, 10, np.uint16), ("albedo_wsa_unitless", 0, 50000, np.uint16),
     ("ground_ice_frac", 0, 1000, np.uint16), ("ndvi_max_unitless", -1, 10000, np.uint16), ("barren_pct", 0, 100, np.uint16)]

e = pd.read_csv(V / "data/earth_features_v1_6.csv", low_memory=False)
e = e.sort_values(["cell_lat", "cell_lon"]).reset_index(drop=True)
row = np.round((89.875 - e.cell_lat.values) / 0.25).astype(np.uint16)
col = np.round((e.cell_lon.values + 179.875) / 0.25).astype(np.uint16)
assert np.allclose(89.875 - row * 0.25, e.cell_lat) and np.allclose(-179.875 + col * 0.25, e.cell_lon)
parts, qmeta = [row, col], []
for c, off, sc, dt in Q:
    v = e[c].to_numpy(float); mx = np.iinfo(dt).max
    q = np.where(np.isnan(v), mx, np.clip(np.round((v - off) * sc), 0, mx - 1)).astype(dt)
    err = np.nanmax(np.abs(np.where(np.isnan(v), np.nan, q / sc + off - v)))
    qmeta.append({"name": c, "offset": off, "scale": sc, "missing": int(mx), "max_quant_error": round(float(err), 6)}); parts.append(q)
rock = np.array([ROCKS.index(a) if a in ROCKS else 0 for a in e.rock_abbr.fillna("nd")], np.uint8)
u8 = lambda x: np.asarray(x, dtype=np.uint8)
flags = (u8(e.bare) | (u8(e.icy) * 2) | (u8(e.impact_crater.notna()) * 4) | (u8(e.ice_flag_bool.fillna(0)) * 8)).astype(np.uint8)
n = len(e)
buf = b"".join(p.astype(p.dtype.newbyteorder("<")).tobytes() for p in parts) + rock.tobytes() + flags.tobytes()
(OUT / "earth_cells.bin").write_bytes(buf)

# ---- per-target parameters, reproduced from score_v16 and checked against its output ----
scales = json.load(open(V / "results/scales.json")); wide = json.load(open(V / "results/scales_wide.json"))
B = json.load(open(V / "results/scores_balanced.json"))["targets"]
def tf(f, x): return np.log1p(np.clip(np.asarray(x, float), 0, None)) if f in LOG1P else np.asarray(x, float)
TILT = {"Earth": 23.44, "Moon": 1.54, "Mars": 25.19}
def sun(lat, tilt):
    L = np.linspace(0, 2 * np.pi, 360, endpoint=False); d = np.degrees(np.arcsin(np.sin(np.radians(tilt)) * np.sin(L)))
    return np.clip(90 - np.abs(np.asarray(lat, float)[..., None] - d), 0, None).mean(-1)
# use the quantized values so the browser and the percentile tables agree exactly
E = pd.DataFrame({c: np.where(p == m["missing"], np.nan, p / m["scale"] + m["offset"]) for (c, *_), p, m in zip(Q, parts[2:], qmeta)})
E["sun_noon_elev_mean_deg"] = np.round(sun(e.cell_lat.values, TILT["Earth"]), 2)
E["rock"] = e.rock_abbr.fillna("nd").values; E["crater"] = e.impact_crater.notna().values
E["bare"] = e.bare.values; E["icy"] = e.icy.values; E["aw"] = e.area_w.values
params = {"version": "data v1.6", "grid_deg": 0.25, "n_cells": n, "dims": DIMS, "dimensions": DIMENSIONS, "log1p": LOG1P, "floor": 0.01,
          "rocks": ROCKS, "quant": qmeta, "earth_tilt": TILT["Earth"], "targets": []}
for tid, T in B.items():
    tf_vals = T["target_features"]
    E["geology_match"] = (E.rock.isin(ROCK[tid]) | (E.crater & (tid in IMPACT))).astype(float)
    feats = [f for fs in DIMENSIONS.values() for f in fs if tf_vals.get(f) is not None]
    elig = (E.bare | (E.icy & (tf_vals.get("ground_ice_frac") == 1))) & E[feats].notna().all(axis=1)
    el = E[elig]
    rng = {f: [float(tf(f, el[f]).min()), float(tf(f, el[f]).max())] for f in feats}
    fdef = {}
    for f in feats:
        tt = float(tf(f, [tf_vals[f]])[0]); lo, hi = rng[f]; tc = min(max(tt, lo), hi)
        fdef[f] = {"target": tf_vals[f], "clamped_target": tc, "scale": wide[f] if tc != tt else scales[f], "clamped": tc != tt}
    def dimsof(df):
        out = {}
        for d, fs in DIMENSIONS.items():
            out[d] = np.mean([np.exp(-np.abs(tf(f, df[f]) - fdef[f]["clamped_target"]) / fdef[f]["scale"]) for f in fs if f in fdef], axis=0)
        return pd.DataFrame(out, index=df.index)
    D = dimsof(el)[DIMS].to_numpy(); keep = T["earth_testable_dims"]
    lg = np.log(np.clip(D, 0.01, None)); full = np.exp(lg.mean(1)); kk = [DIMS.index(d) for d in keep]; et = np.exp(lg[:, kk].mean(1))
    def cdf(s, w):
        o = np.argsort(s); s, w = s[o], w[o]; c = np.cumsum(w) / w.sum(); q = np.linspace(0, 1, 2001)
        return [round(float(x), 5) for x in np.interp(q, c, s)]
    best = T["top"][0]
    got = full.max()
    params["targets"].append({"id": tid, "name": T["name"], "body": T["body"], "features": fdef, "rock_match": ROCK[tid], "impact_relevant": tid in IMPACT,
                              "ice_cells_allowed": bool(tf_vals.get("ground_ice_frac") == 1), "earth_testable_dims": keep,
                              "not_testable_on_earth": T["not_testable_on_earth_dims"], "out_of_earth_range": T["out_of_earth_range"],
                              "n_eligible": int(len(el)), "cdf_full": cdf(full, el.aw.to_numpy()), "cdf_earth_testable": cdf(et, el.aw.to_numpy()),
                              "check": {"python_v16_best": best["score"], "export_best": round(float(got), 4)}})
    print(f"{tid:10} eligible={len(el):6} best v16={best['score']:.4f} export={got:.4f}")
(OUT / "engine_params.json").write_text(json.dumps(params))
print("bytes", len(buf), "| quant errors", {m['name']: m['max_quant_error'] for m in qmeta})
