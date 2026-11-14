# The shared grid (do not change without telling the team)

Every Earth layer is resampled to exactly this grid. If your array isn't 720 × 1440 with this transform, it's wrong.

| Property | Value |
|---|---|
| CRS | **EPSG:4326** (WGS84 lat/lon) |
| Resolution | **0.25° × 0.25°** (~28 km at the equator) |
| Extent | lon −180 → 180, lat 90 → −90 |
| Shape | **720 rows × 1440 cols** |
| Origin | top-left corner (lon −180, lat 90) |
| Affine transform | `rasterio.transform.from_origin(-180, 90, 0.25, 0.25)` |

## Cell ID scheme

```
row     = 0 at the top (90°N), increasing southward, 0..719
col     = 0 at the left (180°W), increasing eastward, 0..1439
cell_id = row * 1440 + col                 # integer, 0..1,036,799

lat_center = 90  - 0.125 - 0.25 * row
lon_center = -180 + 0.125 + 0.25 * col

row = cell_id // 1440
col = cell_id %  1440
```

Example: Death Valley (36.5°N, 116.9°W) → row 214, col 252 → `cell_id` 308412.

## How to resample

```python
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling

DST_TRANSFORM = from_origin(-180, 90, 0.25, 0.25)
DST_SHAPE = (720, 1440)

def to_grid(src_path, resampling=Resampling.average):
    with rasterio.open(src_path) as src:
        dst = np.full(DST_SHAPE, np.nan, dtype="float32")
        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            src_transform=src.transform, src_crs=src.crs,
            dst_transform=DST_TRANSFORM, dst_crs="EPSG:4326",
            resampling=resampling, dst_nodata=np.nan,
        )
    return dst
```

| Kind of layer | Resampling |
|---|---|
| Continuous (elevation, temperature, albedo, precipitation) | `Resampling.average` |
| Slope | compute at **native** resolution first, then `average` |
| Roughness | std-dev of native elevation inside each cell (compute at native resolution, then aggregate) |
| Categorical (permafrost class, land cover) | convert to a 0–1 fraction per cell, or use `Resampling.mode` |

For NetCDF/HDF (xarray): set the CRS, then use `rioxarray`'s `reproject` with the same transform and shape. Or regrid with `xarray.coarsen` if the source is already a regular lat/lon grid that divides evenly into 0.25°.

## Land mask

Keep a cell when **≥ 50 %** of it is land. Ocean cells are dropped from `earth_features.parquet` (about 2/3 of the grid). The mask lives in `pipeline/grid.py` so everyone uses the same one.

## Moon and Mars

Target sites are points, not grid cells. Use each body's own lat/lon (IAU planetocentric), average features over a ~25 km disc around the site, and write them to the same columns as the Earth table. Slope and roughness must use the same definitions and the same ~baseline length as on Earth, or they won't be comparable.
