// Helper for new_candidates.py: country name for each [lat, lon] pair, using the same
// d3 and Natural Earth 110m shapes as the app (zenith-app/js/globe.js countryOf).
// Reads a JSON array of [lat, lon] from stdin, writes a JSON array of names (or null).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.join(here, "..", "zenith-app", "js", "vendor");
const ctx = { console };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["d3.min.js", "topojson-client.min.js", "countries-110m.js"]) {
  vm.runInContext(readFileSync(path.join(vendor, f), "utf8"), ctx, { filename: f });
}
const d3 = ctx.d3, topojson = ctx.topojson, T = ctx.WORLD_TOPO;
const countries = topojson.feature(T, T.objects.countries).features;
const pts = JSON.parse(readFileSync(0, "utf8"));
const out = pts.map(([lat, lon]) => { const f = countries.find(c => d3.geoContains(c, [lon, lat])); return f ? f.properties.name : null; });
process.stdout.write(JSON.stringify(out));
