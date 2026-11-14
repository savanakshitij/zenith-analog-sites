"""Zenith data v1.6: v1.5 plus three rules fixed before the run (see DECISIONS_v1_6.md):
 R1 site box: named sites are scored as the best cell within 0.375 deg of their coordinate (up to 3x3 cells)
 R2 damping: a feature whose target lies outside Earth's range uses a wider scale (area-weighted p5-p95 of bare cells)
 R3 Earth-testable score: leaves out a dimension when every feature in it is outside Earth's range by more than its scale
 R4 rediscovery check (reporting only): top-25 cells within 300 km of a known analog, against chance.
Based on v1.5: v1.4 plus sourced Mars and Moon temperatures (Tahir patches 2 and 4).
Based on v1.4: v1.3 plus a geology dimension (rock class and impact craters, Tahir patch 3) and ground ice
(ESA CCI permafrost, Mo) in the ice dimension. Adds a "geology track" list that ignores the bare-ground filter.

Usage: python3 score_v14.py <v1_folder> <merra_precip_csv> <out_folder> <patches_folder>

Changes from v1 (all decided before this script was first run, see DECISIONS_v1_1.md):
 1. Ice cells are eligible only for targets that have ice (Shackleton, Arcadia).
 2. Scales and percentiles are weighted by cell area (cos latitude), scales come from bare-ground cells.
 3. Precipitation: IMERG between 60S and 60N, NASA POWER / MERRA-2 poleward of 60 deg and where IMERG
    is missing. Compared on a linear scale (v1 used log1p).
 4. A cell must have every feature the target has. No skipped dimensions.
 5. Mars roughness is dropped (the v0 value is an elevation std, not TRI). Mars terrain = slope only.
 6. Stability = share of 200 random weight sets in which the cell is in the top 1% (v1: top 50 cells).
Written with AI assistance (Claude), reviewed by Team Zenith.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

V1, MERRA, OUT, PATCH = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
MARS = PATCH / "mars_terrain.csv"
(OUT / "results").mkdir(parents=True, exist_ok=True)
(OUT / "data").mkdir(parents=True, exist_ok=True)

FEATURES = ["slope_deg", "roughness_tri_m", "relief_m", "temp_min_K", "temp_daynight_range_K",
            "albedo_wsa_unitless", "precip_mm_per_yr", "ground_ice_frac", "sun_noon_elev_mean_deg", "geology_match"]
EXTRA = ["ice_flag_bool", "permafrost_pct", "barren_pct", "ndvi_max_unitless", "wind_m_s", "aod_unitless"]
TAGS = ["rock_abbr", "impact_crater", "lava_tube"]
# Rock classes counted as a match per target: union of Mo's glim_targets.csv (code and alt code) and Tahir's proposal.
ROCK = {"shackleton": {"pb"}, "malapert": {"pb"}, "marius": {"vb"}, "arcadia": {"su", "vb"}, "jezero": {"ss", "vb"},
        "gale": {"ss", "sm"}, "meridiani": {"ev", "ss"}}
IMPACT_RELEVANT = {"shackleton", "malapert", "jezero", "gale"}  # a confirmed impact crater in the cell also counts
GEO_TRACK_N = 15
BOX_DEG = 0.375       # R1
REDISCOVERY_KM = 300  # R4
# Named candidate sites from the literature check (team sync 17:40); scored with the same site box as known sites
CANDIDATES = {
    "marius": [("NW Saudi lava field", 27.375, 37.375), ("Southern Danakil (Afar)", 13.125, 42.375)],
    "arcadia": [("Southern Taklamakan", 37.625, 83.625)],
    "shackleton": [("Transantarctic Mountains", -85.125, 166.875)],
    "malapert": [("Northern Greenland coast", 81.375, -61.625)],
    "gale": [("Southern Peru (extends Pampas de La Joya)", -17.625, -71.125)],
}
TILT_DEG = {"Earth": 23.44, "Moon": 1.54, "Mars": 25.19}  # axial tilt relative to the orbit around the Sun


def sun_noon_elev_mean(lat, tilt):
    """Annual mean of the Sun's elevation at local noon (deg), counted as 0 when the Sun stays below the horizon.
    Depends only on latitude and axial tilt. Ignores terrain shadowing and atmosphere."""
    L = np.linspace(0, 2 * np.pi, 360, endpoint=False)
    decl = np.degrees(np.arcsin(np.sin(np.radians(tilt)) * np.sin(L)))
    elev = 90 - np.abs(np.asarray(lat, float)[..., None] - decl)
    return np.clip(elev, 0, None).mean(axis=-1)
LOG1P = ["roughness_tri_m", "relief_m"]
DIMENSIONS = {
    "thermal": ["temp_min_K", "temp_daynight_range_K"],
    "aridity": ["precip_mm_per_yr"],
    "terrain": ["slope_deg", "roughness_tri_m"],  # relief is context only: it depends on box size, and Earth cells shrink with latitude
    "surface": ["albedo_wsa_unitless"],
    "ice": ["ground_ice_frac"],
    "illumination": ["sun_noon_elev_mean_deg"],
    "geology": ["geology_match"],
}
DIMS = list(DIMENSIONS)
PRESETS = {  # unchanged from v1 config (team_criteria left out: one scoring method only)
    "balanced":         {"thermal": 1, "aridity": 1, "terrain": 1, "surface": 1, "ice": 1, "illumination": 1, "geology": 1},
    "ice_resources":    {"thermal": 2, "aridity": 0.5, "terrain": 1, "surface": 1, "ice": 3, "illumination": 1, "geology": 1},
    "landing_mobility": {"thermal": 1, "aridity": 1, "terrain": 3, "surface": 1, "ice": 0.5, "illumination": 1, "geology": 1},
    "thermal_testing":  {"thermal": 3, "aridity": 1, "terrain": 1, "surface": 1.5, "ice": 0.5, "illumination": 1, "geology": 1},
}
FLOOR, RUNS, SEED = 0.01, 200, 20261114
TOP_N, SPACING_KM, LESSER_N, LESSER_KM, STAB_MIN, POOL_N = 25, 300, 10, 150, 0.5, 200
SIGNATURE = {  # same pairings as v1 (written before any results were seen)
    "dryvalleys": ("arcadia", "thermal"), "concordia": ("arcadia", "thermal"), "haughton": ("jezero", "terrain"),
    "axelheiberg": ("arcadia", "ice"), "svalbard": ("arcadia", "ice"), "mistastin": ("malapert", "terrain"),
    "sudbury": ("malapert", "terrain"), "meteorcrater": ("jezero", "terrain"), "ries": ("gale", "terrain"),
    "lonar": ("marius", "terrain"), "atacama": ("jezero", "aridity"), "qaidam": ("gale", "aridity"),
    "badwater": ("meridiani", "aridity"), "riotinto": ("meridiani", "surface"), "mdrs": ("jezero", "aridity"),
    "pilbara": ("jezero", "aridity"), "maunakea": ("marius", "surface"), "hiseas": ("marius", "surface"),
    "cratersmoon": ("marius", "surface"), "blackpoint": ("marius", "surface"), "lanzarote": ("marius", "surface"),
    "holuhraun": ("meridiani", "surface"), "wadirum": ("gale", "aridity"),
}


def hav(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(np.asarray(lon2) - lon1) / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def tf(name, x):
    x = np.asarray(x, dtype=float)
    return np.log1p(np.clip(x, 0, None)) if name in LOG1P else x


def wquantile(x, w, q):
    o = np.argsort(x)
    x, w = x[o], w[o]
    c = (np.cumsum(w) - 0.5 * w) / w.sum()
    return float(np.interp(q, c, x))


def wpct(val, sorted_x, cum_w):
    """Area-weighted percentile (0-100) of val within a sorted array."""
    i = np.searchsorted(sorted_x, val, side="right")
    return round(float(cum_w[i - 1] if i > 0 else 0.0) * 100, 2)


def r3(v):
    return None if v is None or not np.isfinite(v) else round(float(v), 3)


def main():
    earth = pd.read_csv(V1 / "data/final/earth_features.csv")
    merra = pd.read_csv(MERRA)
    assert (earth.cell_lat.values == merra.cell_lat.values).all() and (earth.cell_lon.values == merra.cell_lon.values).all()
    imerg = earth.precip_mm_per_yr.copy()
    polar = earth.cell_lat.abs() > 60
    use_merra = polar | imerg.isna()
    earth["precip_imerg_mm_per_yr"] = imerg
    earth["precip_merra2_mm_per_yr"] = merra.merra_mm.round(1)
    earth["precip_mm_per_yr"] = np.where(use_merra, merra.merra_mm, imerg).round(1)
    earth["precip_source"] = np.where(use_merra, "MERRA-2", "IMERG")
    nd = earth.ndvi_max_unitless
    noveg = (nd <= 0.3) | nd.isna()
    earth["bare"] = (earth.barren_pct >= 50) & noveg & (earth.ice_flag_bool == 0)
    earth["icy"] = (earth.ice_flag_bool == 1) & noveg
    earth["area_w"] = np.cos(np.radians(earth.cell_lat))
    earth["sun_noon_elev_mean_deg"] = sun_noon_elev_mean(earth.cell_lat.values, TILT_DEG["Earth"]).round(2)
    key = ["cell_lat", "cell_lon"]
    for f in ["rock_GLiM.csv", "permafrost_ESACCI.csv", "wind_POWER.csv", "dust_POWER.csv", "ground_temp_mean_POWER.csv"]:
        earth = earth.merge(pd.read_csv(PATCH / f, low_memory=False), on=key, how="left", validate="one_to_one")
    # ground ice: surface ice flag, or ESA permafrost share where the map has a value, else a temperature stand-in
    # (0 at a mean ground temperature of 275 K, rising to 1 at 267 K)
    standin = np.clip((275 - earth.ground_temp_mean_K) / 8, 0, 1)
    frozen = (earth.permafrost_pct / 100).where(earth.permafrost_pct.notna(), standin)
    earth["ground_ice_source"] = np.where(earth.ice_flag_bool == 1, "surface ice flag", np.where(earth.permafrost_pct.notna(), "ESA CCI permafrost", "temperature stand-in"))
    earth["ground_ice_frac"] = np.maximum(earth.ice_flag_bool, frozen).round(3)
    lt = pd.read_csv(PATCH / "lava_tubes.csv")
    earth["lava_tube"] = None
    for r in lt.itertuples():
        d = hav(r.lat, r.lon, earth.cell_lat.values, earth.cell_lon.values)
        earth.loc[d < 30, "lava_tube"] = r.name
    earth["impact_crater"] = earth.impact_crater.where(earth.impact_crater.notna(), None)
    earth["geology_match"] = 0.0
    earth.drop(columns=["eligible"]).to_csv(OUT / "data/earth_features_v1_6.csv", index=False)

    targets = pd.read_csv(V1 / "data/final/targets.csv")
    mars = targets.body == "Mars"
    mt = pd.read_csv(MARS).set_index("target_id")
    for f in ["slope_deg", "roughness_tri_m", "relief_m"]:
        targets.loc[mars, f] = targets.loc[mars, "target_id"].map(mt[f])
        targets.loc[mars, f + "_status"] = "computed"
        targets.loc[mars, f + "_source"] = "MOLA MEGDR 128 ppd (NASA PDS)"
        targets.loc[mars, f + "_note"] = "Tahir patch 1: 1.85 km pixels, 28 km box, same method as Earth and Moon"
    # v1.5: sourced temperatures (Tahir patches 2 and 4) replace the estimates and single-season rover values
    for fn, status, note in [("mars_temps.csv", "model", "Tahir patch 2: Mars Climate Database v6.2, 02:00 and 14:00 local time, 12 points through the Mars year"),
                             ("moon_temps.csv", "computed", "Tahir patch 4: Diviner PCP bolometric temperature, mean of the 28 km box (includes permanently shadowed ground)")]:
        tp = pd.read_csv(PATCH / fn).set_index("target_id")
        sel = targets.target_id.isin(tp.index)
        for f in ["temp_min_K", "temp_daynight_range_K"]:
            targets[f] = targets[f].astype(float)
            targets.loc[sel, f] = targets.loc[sel, "target_id"].map(tp[f])
            targets.loc[sel, f + "_status"] = status
            targets.loc[sel, f + "_source"] = targets.loc[sel, "target_id"].map(tp["source"])
            targets.loc[sel, f + "_note"] = note
    targets["sun_noon_elev_mean_deg"] = [round(float(sun_noon_elev_mean(la, TILT_DEG[b])), 2) for la, b in zip(targets.cell_lat, targets.body)]
    targets["ground_ice_frac"] = targets["ice_flag_bool"]
    targets["ground_ice_frac_status"] = targets["ice_flag_bool_status"]
    targets["ground_ice_frac_source"] = targets.get("ice_flag_bool_source")
    targets["ground_ice_frac_note"] = "1 = water ice documented at or next to the site"
    targets["geology_match"] = 1.0
    targets["geology_match_status"] = "estimated"
    targets["geology_match_source"] = "GLiM class labels from Mo (glim_targets.csv) and Tahir (targets_rock_PROPOSED.csv)"
    targets["geology_match_note"] = ["rock classes counted as a match: " + ", ".join(sorted(ROCK[t])) + ("; or a confirmed impact crater in the cell" if t in IMPACT_RELEVANT else "") for t in targets.target_id]
    targets["sun_noon_elev_mean_deg_status"] = "computed"
    targets["sun_noon_elev_mean_deg_source"] = "latitude and axial tilt"
    targets["sun_noon_elev_mean_deg_note"] = "Ignores terrain shadowing"
    scored_feats = {f for fs in DIMENSIONS.values() for f in fs}
    long = [{"target_id": t["target_id"], "name": t["name"], "body": t["body"], "feature": f, "value": t[f],
             "status": t[f + "_status"], "scored": f in scored_feats and not pd.isna(t[f]),
             "source": t.get(f + "_source"), "note": t.get(f + "_note")} for t in targets.to_dict("records") for f in FEATURES]
    pd.DataFrame(long).to_csv(OUT / "data/targets_v1_6.csv", index=False)
    ks = pd.read_csv(V1 / "data/final/known_sites_merged.csv")

    # ---- scales: area-weighted IQR over bare-ground cells ----
    bare = earth[earth.bare]
    scales, wide = {}, {}
    for f in FEATURES:
        ok = bare[f].notna()
        x, w = tf(f, bare.loc[ok, f]), bare.loc[ok, "area_w"].to_numpy()
        s = wquantile(x, w, 0.75) - wquantile(x, w, 0.25)
        scales[f] = s if s > 0 else 1.0
        sw = wquantile(x, w, 0.95) - wquantile(x, w, 0.05)
        wide[f] = max(sw, scales[f])
    scales["geology_match"] = 1.0
    wide["geology_match"] = 1.0
    (OUT / "results/scales_wide.json").write_text(json.dumps(wide, indent=1))  # yes/no feature, same treatment as the old ice flag
    (OUT / "results/scales.json").write_text(json.dumps(scales, indent=1))

    rng = np.random.default_rng(SEED)
    out = {p: {"version": "v1.6", "preset": p, "weights": PRESETS[p], "scales": scales, "dimensions": DIMENSIONS,
               "grid_deg": 0.25, "targets": {}} for p in PRESETS}
    pool_out, val_rows, summary = {}, [], {"targets": {}}

    def dims_for(df, t, ranges):
        res, oor = {}, {}
        for dim, feats in DIMENSIONS.items():
            sims = []
            for f in feats:
                if pd.isna(t[f]):
                    continue
                tt = float(tf(f, [t[f]])[0])
                lo, hi = ranges[f]
                tc = min(max(tt, lo), hi)
                sc = scales[f]
                if tc != tt:
                    oor[f] = round(float(t[f]) - (float(np.expm1(tc)) if f in LOG1P else tc), 2)
                    sc = wide[f]  # R2
                sims.append(np.exp(-np.abs(tf(f, df[f].values) - tc) / sc))
            res[dim] = np.mean(np.vstack(sims), axis=0)
        return pd.DataFrame(res, index=df.index), oor

    def geo(D, w, keep=None):
        wv = np.array([w[d] if (keep is None or d in keep) else 0.0 for d in DIMS], float)
        return np.exp((wv * np.log(np.clip(D, FLOOR, None))).sum(1) / wv.sum())

    def earth_testable_dims(t, ranges, feats):
        """R3: drop a dimension if every scored feature in it lies outside Earth's range by more than its IQR scale."""
        drop = []
        for d, fs in DIMENSIONS.items():
            used = [f for f in fs if f in feats]
            if not used:
                continue
            far = []
            for f in used:
                tt = float(tf(f, [t[f]])[0])
                lo, hi = ranges[f]
                gap = lo - tt if tt < lo else (tt - hi if tt > hi else 0.0)
                far.append(gap > scales[f])
            if all(far):
                drop.append(d)
        return [d for d in DIMS if d not in drop], drop

    for t in targets.to_dict("records"):
        tid = t["target_id"]
        earth["geology_match"] = (earth.rock_abbr.isin(ROCK[tid]) | (earth.impact_crater.notna() & (tid in IMPACT_RELEVANT))).astype(float)
        feats = [f for f in FEATURES if not pd.isna(t[f])]
        mask = earth.bare | (earth.icy if t["ice_flag_bool"] == 1 else False)
        el = earth[mask & earth[feats].notna().all(axis=1)].reset_index(drop=True)
        lat, lon, aw = el.cell_lat.values, el.cell_lon.values, el.area_w.values
        ranges = {f: (float(tf(f, el[f]).min()), float(tf(f, el[f]).max())) for f in feats}
        dims, oor = dims_for(el, t, ranges)
        keep_et, drop_et = earth_testable_dims(t, ranges, feats)
        D = dims[DIMS].to_numpy()
        n = len(el)
        k = max(50, int(round(0.01 * n)))
        logD = np.log(np.clip(D, FLOOR, None))
        counts = np.zeros(n)
        for _ in range(RUNS):
            w = rng.dirichlet([1.0] * len(DIMS))
            counts[np.argpartition(-(logD @ w), k)[:k]] += 1
        stab = counts / RUNS
        near = np.zeros(n, bool)
        dnear = np.full(n, np.inf)
        inear = np.zeros(n, int)
        for i, s in enumerate(ks.itertuples()):
            d = hav(s.lat, s.lon, lat, lon)
            near |= d < LESSER_KM
            upd = d < dnear
            dnear[upd], inear[upd] = d[upd], i
        dim_sorted = {}
        for j, d in enumerate(DIMS):
            o = np.argsort(D[:, j])
            dim_sorted[d] = (D[o, j], np.cumsum(aw[o]) / aw.sum())
        bal = geo(D, PRESETS["balanced"])
        pool_idx = set()
        summary["targets"][tid] = {"name": t["name"], "eligible_cells": n, "ice_cells_included": bool(t["ice_flag_bool"] == 1),
                                   "features_scored": feats, "out_of_earth_range": oor, "stability_top_k": k,
                                   "earth_testable_dims": keep_et, "not_testable_on_earth_dims": drop_et}

        def site_row(s):
            d = (earth.cell_lat - s.lat).abs() + ((earth.cell_lon - s.lon + 180) % 360 - 180).abs()
            return earth.loc[d.idxmin()]

        def site_box(slat, slon, w):
            """R1: best complete cell within BOX_DEG of the site; returns (row, dims_row, score, et_score, n_cells, point_score)."""
            dl = (earth.cell_lat - slat).abs()
            dn = ((earth.cell_lon - slon + 180) % 360 - 180).abs()
            box = earth[(dl < BOX_DEG) & (dn < BOX_DEG) & earth[feats].notna().all(axis=1)]
            if box.empty:
                return None
            bd, _ = dims_for(box, t, ranges)
            bv = bd[DIMS].to_numpy()
            sc = geo(bv, w)
            et = geo(bv, w, keep_et)
            j = int(np.argmax(sc))
            pr = site_row(type("S", (), {"lat": slat, "lon": slon}))
            ps = None
            if bool(pr[feats].notna().all()):
                pdm, _ = dims_for(pd.DataFrame([pr]), t, ranges)
                ps = round(float(geo(pdm[DIMS].to_numpy(), w)[0]), 4)
            return box.iloc[j], bv[j], float(sc[j]), float(et[j]), len(box), ps

        for preset, w in PRESETS.items():
            score = geo(D, w)
            et_score = geo(D, w, keep_et)
            o = np.argsort(score)
            ss, cw = score[o], np.cumsum(aw[o]) / aw.sum()
            oe = np.argsort(et_score)
            se, cwe = et_score[oe], np.cumsum(aw[oe]) / aw.sum()

            def rec(i):
                dd = {d: r3(D[i, j]) for j, d in enumerate(DIMS)}
                wk = min(DIMS, key=lambda d: dd[d])
                return {"lat": float(lat[i]), "lon": float(lon[i]), "score": round(float(score[i]), 4),
                        "percentile": wpct(score[i], ss, cw), "earth_testable_score": round(float(et_score[i]), 4),
                        "earth_testable_percentile": wpct(et_score[i], se, cwe), "dimensions": dd, "weakest_dimension": wk,
                        "weakest_value": dd[wk], "stability": round(float(stab[i]), 3),
                        "earth": {f: r3(el.at[i, f]) for f in FEATURES + EXTRA},
                        "tags": {g: (None if pd.isna(el.at[i, g]) else str(el.at[i, g])) for g in TAGS},
                        "precip_source": el.at[i, "precip_source"],
                        "nearest_known": {"id": str(ks.id.iloc[inear[i]]), "name": ks.name.iloc[inear[i]], "km": int(round(dnear[i]))}}

            order = np.argsort(-score)
            pool_idx.update(order[:POOL_N].tolist())
            top = []
            for i in order:
                if all(hav(lat[i], lon[i], lat[j], lon[j]) >= SPACING_KM for j in top):
                    top.append(i)
                    if len(top) == TOP_N:
                        break
            lesser = []
            for i in np.argsort(-bal):
                if near[i] or stab[i] < STAB_MIN:
                    continue
                if all(hav(lat[i], lon[i], lat[j], lon[j]) >= LESSER_KM for j in lesser):
                    lesser.append(i)
                    if len(lesser) == LESSER_N:
                        break
            pool_idx.update(lesser)
            # geology track: right rock (or crater), any vegetation; for sampling and drilling tests, not surface operations
            gt = earth[(earth.geology_match == 1) & earth[feats].notna().all(axis=1) & ~earth.rock_abbr.isin(["wb", "ig", "nd"])].reset_index(drop=True)
            geo_track = []
            if len(gt):
                gd, _ = dims_for(gt, t, ranges)
                gs = geo(gd[DIMS].to_numpy(), w)
                keep = []
                for i in np.argsort(-gs):
                    if all(hav(gt.cell_lat[i], gt.cell_lon[i], gt.cell_lat[j], gt.cell_lon[j]) >= LESSER_KM for j in keep):
                        keep.append(i)
                        if len(keep) == GEO_TRACK_N:
                            break
                for i in keep:
                    dk = hav(gt.cell_lat[i], gt.cell_lon[i], ks.lat.values, ks.lon.values)
                    geo_track.append({"lat": float(gt.cell_lat[i]), "lon": float(gt.cell_lon[i]), "score": round(float(gs[i]), 4),
                                      "dimensions": {d: r3(gd[d].iloc[i]) for d in DIMS},
                                      "passes_bare_ground_filter": bool(gt.bare[i] or (gt.icy[i] and t["ice_flag_bool"] == 1)),
                                      "earth": {f: r3(gt.at[i, f]) for f in FEATURES + EXTRA},
                                      "tags": {g: (None if pd.isna(gt.at[i, g]) else str(gt.at[i, g])) for g in TAGS},
                                      "nearest_known": {"name": ks.name.iloc[int(np.argmin(dk))], "km": int(round(dk.min()))}})
            known = {}
            for s in ks.drop_duplicates("id").itertuples():
                bx = site_box(s.lat, s.lon, w)
                row = bx[0] if bx else site_row(s)
                complete = bx is not None
                eligible = bool(complete and (row.bare or (row.icy and t["ice_flag_bool"] == 1)))
                if complete:
                    _, kvv, ksc, ket, nbox, pscore = bx
                    kv = kvv[None, :]
                    known[s.id] = {"name": s.name, "lat": float(row.cell_lat), "lon": float(row.cell_lon), "cell_eligible": eligible,
                                   "score": round(ksc, 4), "percentile": wpct(ksc, ss, cw),
                                   "earth_testable_score": round(ket, 4), "earth_testable_percentile": wpct(ket, se, cwe),
                                   "point_cell_score": pscore, "box_cells": nbox,
                                   "dimensions": {d: r3(kv[0, j]) for j, d in enumerate(DIMS)},
                                   "dimension_percentiles": {d: wpct(kv[0, j], *dim_sorted[d]) for j, d in enumerate(DIMS)},
                                   "validation_site": bool(s.validation), "cave": bool(s.cave)}
                else:
                    known[s.id] = {"name": s.name, "lat": float(row.cell_lat), "lon": float(row.cell_lon), "cell_eligible": False,
                                   "score": None, "note": "cell has missing data", "validation_site": bool(s.validation), "cave": bool(s.cave)}
                if preset == "balanced" and s.id in SIGNATURE and SIGNATURE[s.id][0] == tid:
                    sig = SIGNATURE[s.id][1]
                    kk = known[s.id]
                    sp = kk.get("dimension_percentiles", {}).get(sig)
                    val_rows.append({"site": s.name, "target": t["name"], "signature": sig, "signature_pct": sp,
                                     "overall_pct": kk.get("percentile"), "cell_eligible": eligible,
                                     "pass": bool(sp is not None and sp >= 90),
                                     **{f"pct_{d}": kk.get("dimension_percentiles", {}).get(d) for d in DIMS},
                                     "geology_match": bool(row.geology_match == 1), "rock": row.rock_abbr,
                                     "crater_in_cell": None if pd.isna(row.impact_crater) else str(row.impact_crater),
                                     "cell_precip": r3(row.precip_mm_per_yr), "cell_slope": r3(row.slope_deg),
                                     "cell_temp_min": r3(row.temp_min_K), "cell_ice": r3(row.ice_flag_bool)})
            cands = []
            for cname, clat, clon in CANDIDATES.get(tid, []):
                bx = site_box(clat, clon, w)
                if bx:
                    crow, cvv, csc, cet, nbox, pscore = bx
                    cands.append({"name": cname, "lat": float(crow.cell_lat), "lon": float(crow.cell_lon), "score": round(csc, 4),
                                  "percentile": wpct(csc, ss, cw), "earth_testable_score": round(cet, 4),
                                  "earth_testable_percentile": wpct(cet, se, cwe), "box_cells": nbox,
                                  "passes_bare_ground_filter": bool(crow.bare or (crow.icy and t["ice_flag_bool"] == 1)),
                                  "dimensions": {d: r3(cvv[j]) for j, d in enumerate(DIMS)}})
            redis = None
            if preset == "balanced":
                kl, ko = ks.lat.values, ks.lon.values
                within = np.zeros(n, bool)
                for a, b in zip(kl, ko):
                    within |= hav(a, b, lat, lon) < REDISCOVERY_KM
                hits = int(sum(within[i] for i in top))
                share = float(aw[within].sum() / aw.sum())
                redis = {"top_n": len(top), "within_km": REDISCOVERY_KM, "hits": hits,
                         "expected_by_chance": round(share * len(top), 2), "area_share_near_known": round(share, 4)}
                summary["targets"][tid]["rediscovery"] = redis
            out[preset]["targets"][tid] = {
                "name": t["name"], "body": t["body"], "n_eligible_cells": n,
                "target_features": {f: (None if pd.isna(t[f]) else t[f]) for f in FEATURES},
                "out_of_earth_range": oor, "earth_testable_dims": keep_et, "not_testable_on_earth_dims": drop_et,
                "named_candidates": cands, "rediscovery": redis, "top": [rec(i) for i in top], "lesser_known": [rec(i) for i in lesser], "geology_track": geo_track,
                "known_sites": known}
        pool = sorted(pool_idx, key=lambda i: -bal[i])
        pool_out[tid] = {"name": t["name"], "body": t["body"], "cells": [
            {"lat": float(lat[i]), "lon": float(lon[i]), "balanced_score": round(float(bal[i]), 4), "stability": round(float(stab[i]), 3),
             "dims": {d: r3(D[i, j]) for j, d in enumerate(DIMS)},
             "earth": {f: r3(el.at[i, f]) for f in FEATURES + EXTRA},
             "tags": {g: (None if pd.isna(el.at[i, g]) else str(el.at[i, g])) for g in TAGS},
             "nearest_known": ks.name.iloc[inear[i]], "km_to_known": int(round(dnear[i]))} for i in pool]}
        b = out["balanced"]["targets"][tid]
        summary["targets"][tid].update({"best": b["top"][0], "n_lesser_known": len(b["lesser_known"]), "pool_cells": len(pool)})

    for p in PRESETS:
        (OUT / f"results/scores_{p}.json").write_text(json.dumps(out[p], ensure_ascii=False))
    (OUT / "results/plan_pool.json").write_text(json.dumps({"version": "v1.6", "targets": pool_out}, ensure_ascii=False))
    val = pd.DataFrame(val_rows)
    val.to_csv(OUT / "results/validation_v1_6.csv", index=False)
    summary["validation"] = {"pass": int(val["pass"].sum()), "total": len(val),
                             "overall_top10pct": int((val.overall_pct >= 90).sum()), "overall_top25pct": int((val.overall_pct >= 75).sum())}
    summary["scales"] = scales
    summary["bare_cells"] = int(earth.bare.sum())
    summary["icy_cells"] = int(earth.icy.sum())
    (OUT / "results/run_summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
    print(json.dumps({k: v for k, v in summary.items() if k != "targets"}, indent=1))
    for tid, s in summary["targets"].items():
        b = s["best"]
        print(f"{tid:10} n={s['eligible_cells']:6} best={b['lat']:8.3f},{b['lon']:9.3f} score={b['score']:.3f} stab={b['stability']:.2f} near={b['nearest_known']['name'][:28]} ({b['nearest_known']['km']} km) dims={b['dimensions']} lesser={s['n_lesser_known']} pool={s['pool_cells']}")
    print(val[["site", "target", "signature", "signature_pct", "overall_pct", "cell_eligible", "pass", "geology_match", "rock", "crater_in_cell"]].to_string())


if __name__ == "__main__":
    main()
