"""Build zenith-app/data/zenith-data.js from the team's data v1.5 (+ Mo's patches, NASA POWER monthly
climatology, the Canada national grid).

Run:
  python3 tools/build_data.py --v15 <unzipped zenith_data_v1_5 folder> \
      --handoff /mnt/project-files/handoff --canada <canada_national_parameter_grid.csv>

Nothing in the output is invented: values are copied from the data files or computed from them here.
The scoring formula is the one in v1.5 score_v15.py (same scales, masks, geometric mean, area-weighted
percentiles, same random seed for stability); the script checks that it reproduces plan_pool.json.
Added on top: what-if percentiles (targets made harsher/milder), monthly climate, studied-here links,
Canada close-up values.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument("--v15", required=True)
ap.add_argument("--handoff", default="/mnt/project-files/handoff")
ap.add_argument("--canada", default=None)
ap.add_argument("--pool-n", type=int, default=150, help="best pool cells kept per target")
ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "data" / "zenith-data.js"))
a = ap.parse_args()
V, H = Path(a.v15), Path(a.handoff)

# ---- constants copied from v1.5 score_v15.py ----
LOG1P = ["roughness_tri_m", "relief_m"]
DIMENSIONS = {
    "thermal": ["temp_min_K", "temp_daynight_range_K"], "aridity": ["precip_mm_per_yr"],
    "terrain": ["slope_deg", "roughness_tri_m"], "surface": ["albedo_wsa_unitless"], "ice": ["ground_ice_frac"],
    "illumination": ["sun_noon_elev_mean_deg"], "geology": ["geology_match"],
}
DIMS = list(DIMENSIONS)
FEATURES = ["slope_deg", "roughness_tri_m", "relief_m", "temp_min_K", "temp_daynight_range_K", "albedo_wsa_unitless",
            "precip_mm_per_yr", "ground_ice_frac", "sun_noon_elev_mean_deg", "geology_match"]
ROCK = {"shackleton": {"pb"}, "malapert": {"pb"}, "marius": {"vb"}, "arcadia": {"su", "vb"}, "jezero": {"ss", "vb"},
        "gale": {"ss", "sm"}, "meridiani": {"ev", "ss"}}
IMPACT_RELEVANT = {"shackleton", "malapert", "jezero", "gale"}
FLOOR, RUNS, SEED = 0.01, 200, 20261114
WHATIF = [-0.2, -0.1, 0.1, 0.2]  # + = harsher (colder, bigger day/night swing, steeper, rougher)


def hav(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    q = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(np.asarray(lon2) - lon1) / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(np.clip(q, 0, 1)))


def tf(name, x):
    x = np.asarray(x, dtype=float)
    return np.log1p(np.clip(x, 0, None)) if name in LOG1P else x


def r3(v):
    return None if v is None or pd.isna(v) or not np.isfinite(float(v)) else round(float(v), 3)


def key(la, lo):
    return (int(np.floor(la * 4)), int(np.floor(lo * 4)))  # cell centres sit at .125/.375/...


print("loading v1.5…")
earth = pd.read_csv(V / "data/earth_features_v1_5.csv.gz", low_memory=False)
scales = json.load(open(V / "results/scales.json"))
scores = json.load(open(V / "results/scores_balanced.json"))
pool = json.load(open(V / "results/plan_pool.json"))
nm = pd.read_csv(V / "data/not_matchable.csv")
ks = pd.read_csv(V / "data/known_sites_merged.csv")
tl = pd.read_csv(V / "data/targets_v1_5.csv")
tbase = pd.read_csv(V / "data/targets.csv").set_index("target_id")
ROCK_NAMES = dict(pd.read_csv(V / "patches/rock_classes.csv")[["rock_abbr", "name"]].itertuples(index=False))
earth_index = {key(r[0], r[1]): i for i, r in enumerate(earth[["cell_lat", "cell_lon"]].itertuples(index=False))}

# ---- NASA POWER monthly long-term means (MERRA-2, 0.5 x 0.625) ----
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def load_power(fname):
    p = pd.read_csv(H / "raw-data/1_nasa_power_climate" / fname, usecols=["lat", "lon"] + MONTHS)
    return {(round(r[0] / 0.5), round(r[1] / 0.625)): [round(float(v), 2) for v in r[2:]] for r in p.itertuples(index=False)}


def power_at(dct, lat, lon):
    k = round(((lon + 180) % 360 - 180) / 0.625)
    if k * 0.625 >= 180:
        k = round(-180 / 0.625)
    return dct.get((round(lat / 0.5), k))


print("loading POWER monthly…")
tmin_m, tmax_m, prec_m = (load_power(f) for f in ["TS_MIN_AVG_degC.csv", "TS_MAX_AVG_degC.csv", "PRECTOTCORR_mm_per_day.csv"])

# ---- studied-here links (Immanuel's list + Mo's lava tubes) ----
studies = []
imm = pd.read_csv(H / "team-raw-data/analog_sites_all.csv")
for r in imm.itertuples():
    if pd.isna(r.latitude) or pd.isna(r.study_url):
        continue
    studies.append({"name": r.site, "country": r.country, "lat": float(r.latitude), "lon": float(r.longitude),
                    "what": "" if pd.isna(r.notes) else str(r.notes)[:220], "url": r.study_url, "for": r.analog_for})
for r in pd.read_csv(H / "patches/lava_tubes.csv").itertuples():
    studies.append({"name": r.name, "country": r.country, "lat": float(r.lat), "lon": float(r.lon),
                    "what": r.used_by, "url": r.source_link, "for": "Moon and Mars (lava tube)"})

# ---- Canada national grid (close-up values for Canadian cells) ----
canada = {}
if a.canada:
    cg = pd.read_csv(a.canada)
    for r in cg.itertuples(index=False):
        canada[key(r.cell_lat, r.cell_lon)] = {
            "slope_deg": r3(r.mean_slope_deg), "roughness_m": r3(r.surface_roughness_m), "relief_m": r3(r.local_relief_m),
            "albedo": r3(r.albedo_unitless), "precip_mm_yr": r3(r.annual_precip_mm_per_year), "ndvi": r3(r.ndvi_unitless),
            "ice": r.ice_flag == "yes", "dem_res_m": int(r.dem_overview_resolution_m)}
    print("canada cells", len(canada))

# ---- targets (wide) from targets_v1_5.csv ----
targets = {}
for tid, g in tl.groupby("target_id", sort=False):
    row = g.iloc[0]
    targets[tid] = {"name": row["name"], "body": row["body"],
                    "values": {r.feature: (None if pd.isna(r.value) else float(r.value)) for r in g.itertuples()},
                    "meta": {r.feature: {"status": r.status, "scored": bool(r.scored),
                                         "source": None if pd.isna(r.source) else str(r.source)[:200],
                                         "note": None if pd.isna(r.note) else str(r.note)[:240]} for r in g.itertuples()}}

rng = np.random.default_rng(SEED)  # same seed and target order as score_v15.py -> identical stability
out_targets = {}
for tid in tbase.index:  # same order as score_v15.py
    T = targets[tid]
    t = T["values"]
    earth["geology_match"] = (earth.rock_abbr.isin(ROCK[tid]) | (earth.impact_crater.notna() & (tid in IMPACT_RELEVANT))).astype(float)
    feats = [f for f in FEATURES if t.get(f) is not None]
    mask = earth.bare | (earth.icy if tbase.at[tid, "ice_flag_bool"] == 1 else False)
    el = earth[mask & earth[feats].notna().all(axis=1)].reset_index(drop=True)
    aw = el.area_w.values
    ranges = {f: (float(tf(f, el[f]).min()), float(tf(f, el[f]).max())) for f in feats}

    def dims_for(df, tv):
        res = {}
        for dim, fs in DIMENSIONS.items():
            sims = []
            for f in fs:
                if tv.get(f) is None:
                    continue
                tc = min(max(float(tf(f, [tv[f]])[0]), ranges[f][0]), ranges[f][1])
                sims.append(np.exp(-np.abs(tf(f, df[f].values) - tc) / scales[f]))
            res[dim] = np.mean(np.vstack(sims), axis=0)
        return np.column_stack([res[d] for d in DIMS])

    def geo(D):
        return np.exp(np.log(np.clip(D, FLOOR, None)).mean(1))

    D = dims_for(el, t)
    n = len(el)
    k = max(50, int(round(0.01 * n)))
    logD = np.log(np.clip(D, FLOOR, None))
    counts = np.zeros(n)
    for _ in range(RUNS):
        w = rng.dirichlet([1.0] * len(DIMS))
        counts[np.argpartition(-(logD @ w), k)[:k]] += 1
    stab = counts / RUNS
    bal = geo(D)

    def sorter(s):
        o = np.argsort(s)
        return s[o], np.cumsum(aw[o]) / aw.sum()

    def wpct(v, sc):
        i = np.searchsorted(sc[0], v, side="right")
        return round(float(sc[1][i - 1] if i > 0 else 0.0) * 100, 2)

    bal_s = sorter(bal)
    wi_scores, wi_sorted = {}, {}
    for p in WHATIF:
        t2 = dict(t)
        for f, sgn in [("temp_min_K", -1), ("temp_daynight_range_K", 1), ("slope_deg", 1), ("roughness_tri_m", 1)]:
            if t2.get(f) is not None:
                t2[f] = t2[f] * (1 + sgn * p)
        wi_scores[p] = (t2, geo(dims_for(el, t2)))
        wi_sorted[p] = sorter(wi_scores[p][1])
    el_index = {key(la, lo): i for i, (la, lo) in enumerate(zip(el.cell_lat.values, el.cell_lon.values))}

    # check: reproduce plan_pool.json
    pc = pool["targets"][tid]["cells"]
    err = max(abs(bal[el_index[key(c["lat"], c["lon"])]] - c["balanced_score"]) + abs(stab[el_index[key(c["lat"], c["lon"])]] - c["stability"]) for c in pc)
    print(f"{tid}: {n} eligible cells, max diff vs plan_pool {err:.4f}")
    assert err < 2e-3, "scoring does not reproduce v1.5"

    lesser = {key(r["lat"], r["lon"]) for r in scores["targets"][tid]["lesser_known"]}
    cands, seen = [], []

    def add(lat, lon, kind, name=None, known_id=None):
        for (la, lo) in seen:
            if hav(lat, lon, la, lo) < 25:
                return
        kk = key(lat, lon)
        if kk not in earth_index:
            return
        row = earth.iloc[earth_index[kk]]
        ei = el_index.get(kk)
        if ei is not None:
            dd, sc = D[ei], float(bal[ei])
        else:
            rdf = pd.DataFrame([row])
            if rdf[feats].isna().any(axis=None):
                return
            dd = dims_for(rdf, t)[0]
            sc = float(geo(dd[None, :])[0])
        wi = {}
        for p, (t2, s2) in wi_scores.items():
            v = float(s2[ei]) if ei is not None else float(geo(dims_for(pd.DataFrame([row]), t2))[0])
            wi[f"{int(round(p * 100)):+d}"] = wpct(v, wi_sorted[p])
        dk = hav(lat, lon, ks.lat.values, ks.lon.values)
        j = int(np.argmin(dk))
        stu = [{**{x: s[x] for x in ("name", "country", "what", "url", "for")}, "km": round(float(hav(lat, lon, s["lat"], s["lon"])))}
               for s in studies if hav(lat, lon, s["lat"], s["lon"]) <= 150]
        stu.sort(key=lambda s: s["km"])
        cands.append({
            "id": f"{tid}-{len(cands)}", "lat": float(lat), "lon": float(lon), "kind": kind, "name": name, "known_id": known_id,
            "eligible": ei is not None,
            "dims": {d: round(float(dd[i]), 3) for i, d in enumerate(DIMS)},
            "score": round(sc, 4), "percentile": wpct(sc, bal_s),
            "stability": None if ei is None else round(float(stab[ei]), 3),
            "whatif": wi,
            "earth": {f: r3(row[f]) for f in FEATURES + ["relief_m", "ice_flag_bool", "barren_pct", "ndvi_max_unitless", "permafrost_pct", "ground_temp_mean_K"]},
            "ground_ice_source": row["ground_ice_source"],
            "precip_source": row["precip_source"],
            "tags": {"rock": None if pd.isna(row["rock_abbr"]) else ROCK_NAMES.get(str(row["rock_abbr"]), str(row["rock_abbr"])),
                     "rock_abbr": None if pd.isna(row["rock_abbr"]) else str(row["rock_abbr"]),
                     "impact_crater": None if pd.isna(row["impact_crater"]) else str(row["impact_crater"]),
                     "lava_tube": None if pd.isna(row["lava_tube"]) else str(row["lava_tube"])},
            "hazard": {"wind_m_s": r3(row["wind_m_s"]), "dust_aod": r3(row["aod_unitless"]), "permafrost_pct": r3(row["permafrost_pct"])},
            "monthly": {"tmin_C": power_at(tmin_m, lat, lon), "tmax_C": power_at(tmax_m, lat, lon), "precip_mm_day": power_at(prec_m, lat, lon)},
            "nearest_known": {"name": ks.name.iloc[j], "km": round(float(dk[j]))},
            "studied": stu[:6],
            "canada": canada.get(kk),
        })
        seen.append((lat, lon))

    for kid, kr in scores["targets"][tid]["known_sites"].items():  # named sites first
        if not kr.get("cave"):
            add(kr["lat"], kr["lon"], "known", kr["name"], kid)
    for c in sorted(pc, key=lambda c: -c["balanced_score"]):
        kk = key(c["lat"], c["lon"])
        is_gem = kk in lesser
        if len(cands) > a.pool_n + 40 and not is_gem:
            continue
        add(c["lat"], c["lon"], "gem" if is_gem else ("known-area" if c["km_to_known"] < 150 else "unlisted"))

    tv = {f: t.get(f) for f in FEATURES + ["relief_m"]}
    oor = {}
    for f in feats:
        tt = float(tf(f, [t[f]])[0])
        lo, hi = ranges[f]
        tc = min(max(tt, lo), hi)
        if tc != tt:
            edge = float(np.expm1(tc)) if f in LOG1P else tc
            oor[f] = {"target": t[f], "earth_edge": round(edge, 2)}
    out_targets[tid] = {
        "id": tid, "name": T["name"], "body": T["body"],
        "lat": float(tbase.at[tid, "cell_lat"]), "lon": float(tbase.at[tid, "cell_lon"]),
        "features": tv, "meta": T["meta"], "icy": bool(tbase.at[tid, "ice_flag_bool"] == 1),
        "rock_classes": sorted(ROCK[tid]), "impact_counts": tid in IMPACT_RELEVANT,
        "n_eligible_cells": n, "out_of_earth_range": oor,
        "not_matchable": [{"parameter": r.parameter, "value": r.value, "source": r.source} for r in nm[nm.target_id == tid].itertuples()],
        "candidates": cands,
    }
    print(f"   {len(cands)} candidates")

data = {
    "version": "Zenith data v1.5 (team, 14 Nov 2026) + NASA POWER monthly + Canada national grid",
    "dimensions": DIMENSIONS,
    "targets": out_targets,
}
js = "/* generated by tools/build_data.py from data v1.5; do not edit by hand */\nwindow.ZENITH_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":"), default=float) + ";\n"
Path(a.out).write_text(js)
print("wrote", a.out, round(len(js) / 1e6, 2), "MB")
