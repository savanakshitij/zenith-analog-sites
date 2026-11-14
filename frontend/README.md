# frontend/

The map dashboard. Keep it a **static page with no build step**: `index.html`, `app.js` and `style.css`, with MapLibre GL JS (or Leaflet) loaded from a CDN. Nothing to install, nothing to break during the demo.

- **Inputs:** the API (`http://localhost:8000`), see [api/README.md](../api/README.md)
- **Outputs:** what the judges see

Run:

```bash
cd frontend
python -m http.server 5173       # open http://localhost:5173
```

## Features (in priority order)

1. **Target picker**: choose a Moon or Mars target site.
2. **Heatmap layer**: Earth cells colored by weighted score (`GET /scores`).
3. **Weight sliders**: one per dimension. Re-fetch scores on change (debounced ~300 ms).
4. **Click-to-inspect panel**: per-dimension bars for the clicked cell (`GET /cell/{id}`). Show where the analogy works and where it breaks, plus the always-unmatched rows: gravity, vacuum, radiation.
5. **Side-by-side view**: Earth cell next to the target site (target image or hillshade, plus its feature values).
6. **Known-analog markers**: Atacama, Haughton, Death Valley, Iceland pinned on the map with their rank.

If the API isn't ready yet, develop against a static `sample_scores.json` with the same shape as the `/scores` response.
