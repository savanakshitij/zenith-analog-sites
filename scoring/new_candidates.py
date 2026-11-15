"""New candidates: top sites that sit far from every known analog site. Reporting only, no scoring.

Usage (from the repo root):  python scoring/new_candidates.py
Needs Python 3 (standard library only) and Node (for country names, same shapes as the app).

Inputs (all existing, nothing is rescored):
  results/scores_balanced.json         per target: `top` = the 25 best sites at least 300 km apart (score_v16.py)
  data/v1_6/known_sites_merged.csv     the known analog sites used by the rediscovery check
  zenith-app/js/mission.js             REGIONS table, so names match the app
Outputs: results/new_candidates.json, results/new_candidates.md, zenith-app/data/new-candidates.js
Output is deterministic: running it twice gives identical files.
"""
import csv
import json
import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R_EARTH, NEW_KM, DEDUP_KM = 6371.0, 300.0, 300.0
EXPECT_HITS, EXPECT_TOTAL, EXPECT_CHANCE = 24, 175, 10.2
DIMS = ["thermal", "aridity", "terrain", "surface", "ice", "illumination", "geology"]
LABEL = {"thermal": "cold", "aridity": "dryness", "terrain": "terrain", "surface": "surface", "ice": "ice",
         "illumination": "sunlight", "geology": "rock type"}  # same wording as the app's DIM_LABEL, lower case


def hav(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return R_EARTH * 2 * math.asin(math.sqrt(min(1.0, max(0.0, a))))


def load_regions():
    src = (ROOT / "zenith-app/js/mission.js").read_text(encoding="utf-8")
    block = src[src.index("const REGIONS = ["):src.index("function region(")]
    return [(m[0], float(m[1]), float(m[2]), float(m[3]))
            for m in re.findall(r'\["([^"]+)",\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(\d+)\]', block)]


def region(regions, lat, lon):
    """Same rule as region() in mission.js: the closest centre, relative to its radius, wins."""
    best, bd = None, 1e9
    for name, la, lo, rad in regions:
        d = hav(lat, lon, la, lo)
        if d <= rad and d / rad < bd:
            bd, best = d / rad, name
    return best


def countries(points):
    out = subprocess.run(["node", str(ROOT / "scoring/new_candidates_country.mjs")], input=json.dumps(points),
                         capture_output=True, text=True, check=True, encoding="utf-8").stdout
    return json.loads(out)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    sb = json.loads((ROOT / "results/scores_balanced.json").read_text(encoding="utf-8"))
    with open(ROOT / "data/v1_6/known_sites_merged.csv", newline="", encoding="utf-8") as f:
        known = [{"id": r["id"], "name": r["name"], "lat": float(r["lat"]), "lon": float(r["lon"])} for r in csv.DictReader(f)]
    regions = load_regions()

    sites = []  # every top-25 site, with its distance to the nearest known site
    hits = total = 0
    per_target_counts = {}
    for tid, t in sb["targets"].items():
        h = 0
        for rank, s in enumerate(t["top"], 1):
            d, i = min((hav(s["lat"], s["lon"], k["lat"], k["lon"]), i) for i, k in enumerate(known))
            assert int(round(d)) == s["nearest_known"]["km"], (tid, rank, d, s["nearest_known"])
            near = d < NEW_KM  # same test as score_v16.py: `d < REDISCOVERY_KM`
            h += near
            sites.append({"tid": tid, "rank": rank, "t": t, "s": s, "d": d, "known": known[i], "near": near})
        assert h == t["rediscovery"]["hits"], (tid, h, t["rediscovery"])
        per_target_counts[tid] = {"top_sites": len(t["top"]), "within_300_km_of_known": h, "new": len(t["top"]) - h,
                                  "expected_by_chance": t["rediscovery"]["expected_by_chance"]}
        hits += h
        total += len(t["top"])
    expected = round(sum(t["rediscovery"]["expected_by_chance"] for t in sb["targets"].values()), 1)
    if (hits, total, expected) != (EXPECT_HITS, EXPECT_TOTAL, EXPECT_CHANCE):
        sys.exit(f"Reproduction failed: got {hits} of {total}, {expected} expected by chance")
    new = [x for x in sites if not x["near"]]
    assert len(new) == total - hits == 151

    # names, as the app does it (nameOf in app.js); new sites are all 300+ km from known sites
    cn = countries([[x["s"]["lat"], x["s"]["lon"]] for x in new])
    naming_gaps = []
    for x, c in zip(new, cn):
        s = x["s"]
        if s["tags"].get("impact_crater"):
            x["name"], x["name_source"] = f'{s["tags"]["impact_crater"]} crater', "impact crater in the cell"
        elif region(regions, s["lat"], s["lon"]):
            x["name"], x["name_source"] = region(regions, s["lat"], s["lon"]), "app region table"
        elif c:
            x["name"], x["name_source"] = c, "country polygon"
        else:
            x["name"], x["name_source"] = f'Cell {s["lat"]}, {s["lon"]}', "coordinates only"
            naming_gaps.append(x["name"])
        x["country"] = c

    def make(x):
        s, t = x["s"], x["t"]
        dd = s["dimensions"]
        best2 = sorted(DIMS, key=lambda d: (-dd[d], DIMS.index(d)))[:2]   # ties keep the engine's dimension order
        worst2 = sorted(DIMS, key=lambda d: (dd[d], DIMS.index(d)))[:2]
        why = (f'{LABEL[best2[0]].capitalize()} ({dd[best2[0]]:.2f}) and {LABEL[best2[1]]} ({dd[best2[1]]:.2f}) are its strongest '
               f'dimensions, and {LABEL[worst2[0]]} ({dd[worst2[0]]:.2f}) is the weakest')
        if "thermal" in worst2 and "thermal" in t["not_testable_on_earth_dims"]:
            reason = f"no place on Earth is as cold as this {t['body']} target"
            if worst2[0] == "thermal":
                why += f", which is expected because {reason}"
            else:
                why += f", with cold ({dd['thermal']:.2f}) also low, which is expected because {reason}"
        why += "."
        return {"id": f'{slug(x["name"])}-{slug(x["tid"])}-{x["rank"]}', "name": x["name"], "name_source": x["name_source"],
                "country": x["country"], "lat": s["lat"], "lon": s["lon"],
                "target": {"id": x["tid"], "name": t["name"], "body": t["body"]}, "rank_in_target": x["rank"],
                "score": s["score"], "score_display": f'{s["score"]:.2f}', "percentile": s["percentile"],
                "distance_to_nearest_known_km": int(round(x["d"])), "nearest_known_name": x["known"]["name"],
                "best_dimensions": [{"dimension": d, "score": dd[d]} for d in best2],
                "worst_dimensions": [{"dimension": d, "score": dd[d]} for d in worst2],
                "why": why, "label": "Not field-checked yet. Access and permits not assessed."}

    tids = list(sb["targets"])
    for x in new:
        x["order"] = (-x["s"]["score"], tids.index(x["tid"]), x["rank"])
    new.sort(key=lambda x: x["order"])

    best_per_target = {tid: make(next(x for x in new if x["tid"] == tid)) for tid in tids}

    # overall list: strongest first; a site within 300 km of one already kept is folded into it as `also_matches`
    kept = []
    for x in new:
        for k in kept:
            dk = hav(x["s"]["lat"], x["s"]["lon"], k["x"]["s"]["lat"], k["x"]["s"]["lon"])
            if dk < DEDUP_KM:
                k["also"].append({"target": x["t"]["name"], "id": x["tid"], "score": x["s"]["score"], "name": x["name"],
                                  "km_apart": int(round(dk))})
                break
        else:
            kept.append({"x": x, "also": []})
    overall = []
    for i, k in enumerate(kept[:10], 1):
        c = make(k["x"])
        c["overall_rank"] = i
        c["also_matches"] = k["also"]
        overall.append(c)

    result = {
        "title": "New candidates",
        "definition": ("A new candidate is a site in a target's top 25 (best cells at least 300 km apart, balanced preset, "
                       "as in the rediscovery check) that is more than 300 km from every known analog site. Distance is "
                       "great-circle (haversine, R = 6371 km) from the cell centre to the known site's coordinate."),
        "known_site_count": len(known),
        "known_sites_file": "data/v1_6/known_sites_merged.csv",
        "validation_reproduction": {"hits": hits, "top_sites": total, "expected_by_chance": expected,
                                    "matches_results_validation_md": True,
                                    "new_candidates": len(new), "per_target": per_target_counts},
        "percentile_note": ("Percentile is the engine's area-weighted percentile of the cell's score among that target's "
                            "eligible cells (the same figure as `percentile` in results/scores_balanced.json)."),
        "score_note": "score is the engine value at 4 decimals; score_display is the 2 decimal figure the app shows on cards.",
        "dimension_note": ("best_dimensions and worst_dimensions are the 2 highest and 2 lowest of the 7 dimension scores for "
                           "that cell and target. Ties keep the engine's dimension order (thermal, aridity, terrain, surface, "
                           "ice, illumination, geology)."),
        "dedup_rule": "Overall list: highest score first, one entry per site; a site within 300 km of a higher-scoring one is listed in its `also_matches`.",
        "script": "scoring/new_candidates.py",
        "generated_by": "scoring/new_candidates.py from results/scores_balanced.json (scoring v1.6). Deterministic, no timestamp.",
        "best_new_candidate_per_target": best_per_target,
        "overall_top_10": overall,
        "all_new_candidates_count": len(new),
        "naming_gaps": naming_gaps,
    }
    text = json.dumps(result, indent=1, ensure_ascii=False)
    (ROOT / "results/new_candidates.json").write_text(text + "\n", encoding="utf-8", newline="\n")
    (ROOT / "zenith-app/data/new-candidates.js").write_text(
        "window.ZENITH_NEW_CANDIDATES = " + json.dumps(result, separators=(",", ":"), ensure_ascii=False) + ";\n",
        encoding="utf-8", newline="\n")

    def dimtxt(lst):
        return ", ".join(f'{LABEL[d["dimension"]]} {d["score"]:.2f}' for d in lst)

    def row(c):
        return (f'| {c["name"]} | {c["target"]["name"]} | {c["lat"]}, {c["lon"]} | {c["score_display"]} | {c["percentile"]} | '
                f'{c["distance_to_nearest_known_km"]:,} km from {c["nearest_known_name"]} |')
    md = ["# New candidates", "", result["definition"], "",
          f'Known analog sites: {len(known)}. Check against the validation: {hits} of {total} top sites are within 300 km of a known site '
          f'(about {expected} expected by chance), so {len(new)} are new candidates.', "",
          "Every site here is not field-checked yet. Access and permits not assessed.", "",
          "## Best new candidate per target", "",
          "| Name | Target | Lat, lon | Score | Percentile | Distance to nearest known site |", "|---|---|---|---|---|---|"]
    md += [row(c) for c in best_per_target.values()]
    md += ["", "## Overall top 10", "", "| Rank | Name | Target | Lat, lon | Score | Percentile | Distance to nearest known site |",
           "|---|---|---|---|---|---|---|"]
    md += [f'| {c["overall_rank"]} ' + row(c) for c in overall]
    md += ["", "## Details", ""]
    for title, lst in (("Best per target", list(best_per_target.values())), ("Overall top 10", overall)):
        md += [f"### {title}", ""]
        for c in lst:
            line = (f'- **{c["name"]}** ({c["target"]["name"]}, score {c["score_display"]}): {c["why"]} '
                    f'Strongest: {dimtxt(c["best_dimensions"])}. Weakest: {dimtxt(c["worst_dimensions"])}.')
            if c.get("also_matches"):
                line += " Also matches: " + "; ".join(f'{a["target"]} ({a["km_apart"]} km apart, {a["score"]:.4f})' for a in c["also_matches"]) + "."
            md.append(line)
        md.append("")
    md += ["## Notes", "", "- " + result["percentile_note"], "- " + result["score_note"], "- " + result["dimension_note"],
           "- " + result["dedup_rule"],
           "- Names follow the app: crater name if the cell has a mapped impact crater, else the app's region table, else the country.", ""]
    (ROOT / "results/new_candidates.md").write_text("\n".join(md), encoding="utf-8", newline="\n")
    print(f"reproduction ok: {hits} of {total}, {expected} expected; new candidates {len(new)}; naming gaps {len(naming_gaps)}")


if __name__ == "__main__":
    main()
