"""Flag map cells that survive a false discovery rate test and land cells far from stations.

Run from the repository root after export_map.py. The script reads docs/map/cells-<start>.bin and
writes docs/map/flags-<start>.bin (one byte per 2° cell) plus docs/map/significance.json.

Bits in each flag byte:
  1  local trend passes the Benjamini–Hochberg test at q = 0.05 across all complete cells
  2  local-minus-global trend passes the same test
  4  land cell with NASA 250 km station data in fewer than half of the period's months,
     so the 1,200 km map value there is mostly interpolated from distant stations

Each cell's p-value is recovered from its exported 95% interval. export_map.py builds that interval
from Newey–West standard errors and a t distribution with n − 2 degrees of freedom, so
p = 2·P(T > |slope / se|) with se = half-width / t(0.975, n − 2).

Station support comes from NASA's 250 km land-only grid (gistemp250_GHCNv4.nc.gz). If
raw/gistemp250.nc exists, it is recomputed from that file and saved to
analysis/station_support_250km.json; otherwise the saved runs are used.
"""
import json
from pathlib import Path

import numpy as np
from matplotlib.path import Path as Polygon
from scipy.stats import t

DEST = Path("docs/map")
STARTS = (1980, 1900)
END = 2025
Q = 0.05
SUPPORT = Path("analysis/station_support_250km.json")
ROWS, COLS = 90, 180


def p_values(rates, lows, highs, n):
    critical = t.ppf(0.975, n - 2)
    se = (highs - lows) / 2 / critical
    return 2 * t.sf(np.abs(rates / se), n - 2)


def benjamini_hochberg(p, q=Q):
    """Boolean mask of discoveries. NaN p-values are never discoveries and are not counted."""
    shape = np.shape(p)
    p = np.asarray(p, dtype=float).ravel()
    finite = np.flatnonzero(np.isfinite(p))
    order = finite[np.argsort(p[finite], kind="stable")]
    m = order.size
    passed = p[order] <= q * np.arange(1, m + 1) / m
    mask = np.zeros(p.shape, dtype=bool)
    if passed.any():
        mask[order[: np.flatnonzero(passed)[-1] + 1]] = True
    return mask.reshape(shape)


def decode_runs(text):
    """Run lengths alternate between unsupported (0) and supported (1) cells, starting with 0."""
    values, state = [], False
    for length in map(int, text.split(",")):
        values += [state] * length
        state = not state
    assert len(values) == ROWS * COLS
    return np.array(values).reshape(ROWS, COLS)


def encode_runs(mask):
    runs, state, length = [], False, 0
    for value in mask.ravel():
        if value == state:
            length += 1
        else:
            runs.append(length)
            state, length = value, 1
    runs.append(length)
    return ",".join(map(str, runs))


def station_support():
    raw = Path("raw/gistemp250.nc")
    if raw.exists():
        from scipy.io import netcdf_file
        with netcdf_file(raw, mmap=False) as grid:
            var = grid.variables["tempanomaly"]
            days = grid.variables["time"].data.astype("timedelta64[D]")
            time = np.datetime64("1800-01-01") + days
            saved = {"source": "https://data.giss.nasa.gov/pub/gistemp/gistemp250_GHCNv4.nc.gz",
                     "rule": "supported = 250 km land value present in at least half of the period's months",
                     "periods": {}}
            for start in STARTS:
                use = (time >= np.datetime64(str(start))) & (time < np.datetime64(str(END + 1)))
                present = var.data[use] != var._FillValue
                supported = 2 * present.sum(axis=0) >= use.sum()
                saved["periods"][str(start)] = encode_runs(supported)
        SUPPORT.write_text(json.dumps(saved, indent=1) + "\n")
    saved = json.loads(SUPPORT.read_text())
    return {start: decode_runs(saved["periods"][str(start)]) for start in STARTS}


def land_mask():
    """True where the cell centre lies inside a Natural Earth 1:110m land polygon."""
    land = json.loads((DEST / "land.json").read_text())
    lat = np.arange(-89, 90, 2)
    lon = np.arange(-179, 180, 2)
    points = np.column_stack([np.repeat(lon[None, :], ROWS, 0).ravel(), np.repeat(lat[:, None], COLS, 1).ravel()])
    inside = np.zeros(len(points), dtype=bool)
    for feature in land["features"]:
        geometry = feature["geometry"]
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        for polygon in polygons:
            outer = Polygon(polygon[0]).contains_points(points)
            for hole in polygon[1:]:
                outer &= ~Polygon(hole).contains_points(points)
            inside |= outer
    return inside.reshape(ROWS, COLS)


def main():
    periods = json.loads((DEST / "periods.json").read_text())
    support = station_support()
    land = land_mask()
    summary = {"q": Q, "test": "Benjamini–Hochberg over all complete cells", "periods": {}}
    for start in STARTS:
        n = len(periods[str(start)]["series"])
        records = np.fromfile(DEST / f"cells-{start}.bin", dtype="<f4").reshape(ROWS, COLS, 6 + n).astype(float)
        flags = np.zeros((ROWS, COLS), dtype=np.uint8)
        stats = {}
        for bit, offset, name in ((1, 0, "local"), (2, 3, "relative")):
            p = p_values(*(records[:, :, offset + k] for k in range(3)), n)
            passed = benjamini_hochberg(p)
            flags[passed] |= bit
            raw_pass = int((p < 0.05).sum())
            stats[name] = {"cells": int(np.isfinite(p).sum()), "raw_p_below_0.05": raw_pass,
                           "fdr_discoveries": int(passed.sum()),
                           "largest_passing_p": float(p[passed].max()) if passed.any() else None}
        sparse = land & ~support[start]
        flags[sparse] |= 4
        stats["sparse_land_cells"] = int(sparse.sum())
        stats["land_cells"] = int(land.sum())
        flags.tofile(DEST / f"flags-{start}.bin")
        summary["periods"][str(start)] = stats
        print(start, stats)
    (DEST / "significance.json").write_text(json.dumps(summary, indent=1) + "\n")


if __name__ == "__main__":
    main()
