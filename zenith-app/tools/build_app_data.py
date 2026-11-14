"""Build the web app's data files from data v1.6 and the live engine export.

  python3 tools/build_app_data.py --repo <repo root> --raw <folder with raw-data/ and team-raw-data/> \
      --old <old zenith-data.js, for target source notes> --stability <stability.json from tools/stability.js>

Writes data/engine-data.js (the v1.6 engine data, embedded so the page opens from a file),
data/extras.js (monthly climate, wind, dust, stability per cell; studies; known sites; target notes)
and data/missions.js. Nothing is invented: every value is copied or computed from team files.
"""
import argparse, base64, json, re, subprocess
from pathlib import Path
import numpy as np, pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument("--repo", required=True); ap.add_argument("--raw", required=True)
ap.add_argument("--old", required=True); ap.add_argument("--stability", required=True)
a = ap.parse_args()
R, RAW, OUT = Path(a.repo), Path(a.raw), Path(__file__).resolve().parent.parent / "data"
E = R / "app/map"
params = json.load(open(E / "engine_params.json"))
binb = open(E / "earth_cells.bin", "rb").read()
n = params["n_cells"]
(OUT / "engine-data.js").write_text("window.ZENITH_EMBED={params:" + json.dumps(params, separators=(",", ":")) + ',bin:"' + base64.b64encode(binb).decode() + '"};')
row = np.frombuffer(binb, dtype="<u2", count=n, offset=0); col = np.frombuffer(binb, dtype="<u2", count=n, offset=2 * n)
lat = 89.875 - row * 0.25; lon = -179.875 + col * 0.25

earth = pd.read_csv(R / "data/v1_6/earth_features_v1_6.csv.gz", usecols=["cell_lat", "cell_lon", "wind_m_s", "aod_unitless", "bare", "icy", "lava_tube", "impact_crater"], low_memory=False)
ek = {(round(float(r[0]) * 8), round(float(r[1]) * 8)): i for i, r in enumerate(earth[["cell_lat", "cell_lon"]].itertuples(index=False))}
ei = np.array([ek.get((round(float(la) * 8), round(float(lo) * 8)), -1) for la, lo in zip(lat, lon)])
assert (ei >= 0).mean() > 0.999, "engine cells do not line up with earth_features_v1_6"
keep = np.where((ei >= 0) & (earth.bare.values[ei] | earth.icy.values[ei]))[0]   # cells that can be scored
print("cells", n, "scorable", len(keep))

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
def power(fname):
    p = pd.read_csv(RAW / "raw-data/1_nasa_power_climate" / fname, usecols=["lat", "lon"] + MONTHS)
    return {(round(r[0] / 0.5), round(r[1] / 0.625)): np.array(r[2:], dtype=float) for r in p.itertuples(index=False)}
def at(d, la, lo):
    k = round(((lo + 180) % 360 - 180) / 0.625)
    if k * 0.625 >= 180: k = round(-180 / 0.625)
    return d.get((round(la / 0.5), k))
tmin, prec = power("TS_MIN_AVG_degC.csv"), power("PRECTOTCORR_mm_per_day.csv")
m = len(keep)
T = np.full((m, 12), -128, dtype=np.int8); P = np.full((m, 12), 255, dtype=np.uint8)
for j, i in enumerate(keep):
    t, p = at(tmin, lat[i], lon[i]), at(prec, lat[i], lon[i])
    if t is not None and not np.isnan(t).any(): T[j] = np.clip(np.round(t), -127, 127)
    if p is not None and not np.isnan(p).any(): P[j] = np.clip(np.round(np.array(p) * 20), 0, 254)   # 0.05 mm/day steps
w = earth.wind_m_s.values[ei[keep]]; d = earth.aod_unitless.values[ei[keep]]
Wn = np.where(np.isnan(w), 255, np.clip(np.round(w * 10), 0, 254)).astype(np.uint8)
Dn = np.where(np.isnan(d), 255, np.clip(np.round(d * 100), 0, 254)).astype(np.uint8)
stab = json.load(open(a.stability)); pos = {int(i): j for j, i in enumerate(keep)}
S = {}
for tid, mp in stab.items():
    arr = np.zeros(m, dtype=np.uint8)
    for i, c in mp.items():
        if int(i) in pos: arr[pos[int(i)]] = c
    S[tid] = base64.b64encode(arr.tobytes()).decode()
b64 = lambda x: base64.b64encode(np.ascontiguousarray(x).tobytes()).decode()

tags = {}
for j, i in enumerate(keep):
    r = earth.iloc[ei[i]]
    if isinstance(r.impact_crater, str) or isinstance(r.lava_tube, str):
        tags[int(i)] = {"impact_crater": r.impact_crater if isinstance(r.impact_crater, str) else None, "lava_tube": r.lava_tube if isinstance(r.lava_tube, str) else None}

studies = []
for r in pd.read_csv(RAW / "team-raw-data/analog_sites_all.csv").itertuples():
    if pd.isna(r.latitude) or pd.isna(r.study_url): continue
    studies.append({"name": r.site, "country": r.country, "lat": float(r.latitude), "lon": float(r.longitude), "url": r.study_url, "for": r.analog_for})
for r in pd.read_csv(R / "patches/lava_tubes.csv").itertuples():
    studies.append({"name": r.name, "country": r.country, "lat": float(r.lat), "lon": float(r.lon), "url": r.source_link, "for": "Moon and Mars (lava tube)"})

known = [{"id": r.id, "name": r.name, "country": r.country, "lat": float(r.lat), "lon": float(r.lon), "cave": bool(r.cave)} for r in pd.read_csv(R / "data/v1_6/known_sites_merged.csv").itertuples()]
sb = json.load(open(R / "results/scores_balanced.json"))
known_scores = {tid: {kid: {"score": k.get("score"), "pct": k.get("percentile"), "lat": k.get("lat"), "lon": k.get("lon"), "eligible": k.get("cell_eligible")} for kid, k in t["known_sites"].items()} for tid, t in sb["targets"].items()}
redis = {tid: t.get("rediscovery") for tid, t in sb["targets"].items()}

# target notes (sources, status, not-matchable values) come from the earlier build; values come from the v1.6 engine
txt = Path(a.old).read_text(); old = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
tl = pd.read_csv(R / "data/v1_6/targets_v1_6.csv")
targets = {}
for t in params["targets"]:
    o = old["targets"][t["id"]]; g = tl[tl.target_id == t["id"]]
    meta = {r.feature: {"status": r.status, "source": None if pd.isna(r.source) else str(r.source)[:200]} for r in g.itertuples()} if "status" in g else o["meta"]
    targets[t["id"]] = {"id": t["id"], "name": t["name"], "body": t["body"], "lat": o["lat"], "lon": o["lon"],
        "features": {f: v["target"] for f, v in t["features"].items()}, "meta": meta, "rock_classes": t["rock_match"],
        "out_of_earth_range": {f: {"target": t["features"][f]["target"], "earth_edge": t["features"][f]["clamped_target"]} for f in t["out_of_earth_range"] if f in ("temp_min_K", "temp_daynight_range_K")},
        "not_matchable": o["not_matchable"], "n_eligible": t["n_eligible"]}

extras = {"version": "data v1.6", "keep": b64(keep.astype("<u4")), "tmin": b64(T), "precip": b64(P), "wind": b64(Wn), "dust": b64(Dn), "stability": S,
          "tags": tags, "studies": studies, "known": known, "knownScores": known_scores, "rediscovery": redis, "targets": targets}
(OUT / "extras.js").write_text("window.ZENITH_EXTRAS=" + json.dumps(extras, separators=(",", ":"), ensure_ascii=False) + ";")
mj = json.load(open(R / "missions/missions.json"))
(OUT / "missions.js").write_text("window.ZENITH_MISSIONS=" + json.dumps(mj, separators=(",", ":"), ensure_ascii=False) + ";")
for f in ["engine-data.js", "extras.js", "missions.js"]: print(f, round((OUT / f).stat().st_size / 1e6, 2), "MB")
print(json.dumps(redis)[:400])
