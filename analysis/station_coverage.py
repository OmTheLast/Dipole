"""Mark land cells where NASA's 250 km grid has data in fewer than half the months.

Run from the repository root. Writes docs/map/coverage-<start>.bin: one byte per 2° cell,
1 where the cell is land and NASA's 250 km land-only grid (gistemp250_GHCNv4.nc.gz) has data
in fewer than half of the period's months, 0 elsewhere. The map hatches these cells.

If raw/gistemp250.nc exists, monthly coverage is recomputed from it and saved to
analysis/station_support_250km.json; otherwise the saved runs are used.
"""
import json
from pathlib import Path

import numpy as np
from matplotlib.path import Path as Polygon

DEST = Path("docs/map")
STARTS = (1980, 1900)
END = 2025
SAVED = Path("analysis/station_support_250km.json")
ROWS, COLS = 90, 180
RULE = "covered = the 250 km grid has data in at least half of the period's months"


def decode_runs(text):
    """Run lengths alternate between cells below (0) and at or above (1) half coverage, starting with 0."""
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


def monthly_coverage():
    """True where the 250 km grid has data in at least half of the period's months."""
    raw = Path("raw/gistemp250.nc")
    if raw.exists():
        from scipy.io import netcdf_file
        with netcdf_file(raw, mmap=False) as grid:
            var = grid.variables["tempanomaly"]
            time = np.datetime64("1800-01-01") + grid.variables["time"].data.astype("timedelta64[D]")
            saved = {"source": "https://data.giss.nasa.gov/pub/gistemp/gistemp250_GHCNv4.nc.gz", "rule": RULE, "periods": {}}
            for start in STARTS:
                use = (time >= np.datetime64(str(start))) & (time < np.datetime64(str(END + 1)))
                present = var.data[use] != var._FillValue
                saved["periods"][str(start)] = encode_runs(2 * present.sum(axis=0) >= use.sum())
        SAVED.write_text(json.dumps(saved, indent=1) + "\n")
    saved = json.loads(SAVED.read_text())
    return {start: decode_runs(saved["periods"][str(start)]) for start in STARTS}


def land_mask():
    """True where the cell centre lies inside a Natural Earth 1:110m land polygon."""
    land = json.loads((DEST / "land.json").read_text())
    lat, lon = np.arange(-89, 90, 2), np.arange(-179, 180, 2)
    points = np.column_stack([np.tile(lon, ROWS), np.repeat(lat, COLS)])
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


def hatched():
    covered, land = monthly_coverage(), land_mask()
    return {start: land & ~covered[start] for start in STARTS}, land


def main():
    masks, land = hatched()
    for start, mask in masks.items():
        mask.astype(np.uint8).tofile(DEST / f"coverage-{start}.bin")
        print(f"{start}–{END}: {mask.sum()} of {land.sum()} land cells have 250 km data in fewer than half the months.")


if __name__ == "__main__":
    main()
