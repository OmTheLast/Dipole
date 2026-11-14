"""Export both explorer periods. See docs/temperature.md for the two input files."""
import csv
import json
from pathlib import Path

import netCDF4 as nc
import numpy as np

from temperature import REGIONS, annual_series, trend

DEST = Path("docs/map")
STARTS = (1980, 1900)
END = 2025


def global_history():
    with open("raw/global.csv", newline="", encoding="utf-8-sig") as stream:
        next(stream)  # NASA's title line precedes the column names.
        return {int(row["Year"]): float(row["J-D"]) for row in csv.DictReader(stream)
                if min(STARTS) <= int(row["Year"]) <= END}


def regional_summary(grid, indices, years, global_values, bounds):
    series, _ = annual_series(grid, indices, bounds)
    # Keep gaps in the chart. Fit only a continuous block ending in the last year.
    missing = np.flatnonzero(~np.isfinite(series))
    start = int(missing[-1] + 1) if missing.size else 0
    result = {"bounds": bounds, "series": [float(v) if np.isfinite(v) else None for v in series]}
    if len(years) - start < 5:  # A three-lag covariance needs enough consecutive observations.
        return dict(result, stats=None, relative=None, fitStart=None, globalRate=None)
    dates, local, reference = years[start:], series[start:], global_values[start:]
    return dict(result, fitStart=int(dates[0]), stats=trend(local, dates),
                relative=trend(local - reference, dates), globalRate=trend(reference, dates)[0])


def main():
    global_table = global_history()
    metadata = {}
    with nc.Dataset("raw/gistemp.nc") as grid:
        time = grid["time"]
        dates = nc.num2date(time[:], time.units)
        np.testing.assert_array_equal(grid["lat"][:], np.arange(-89, 90, 2))
        np.testing.assert_array_equal(grid["lon"][:], np.arange(-179, 180, 2))
        for start in STARTS:
            years = np.arange(start, END + 1)
            reference = np.array([global_table[y] for y in years])
            indices = [i for i, date in enumerate(dates) if start <= date.year <= END]
            assert [(dates[i].year, dates[i].month) for i in indices] == [
                (y, m) for y in years for m in range(1, 13)]
            monthly = grid["tempanomaly"][indices].astype("float64").filled(np.nan)
            annual = monthly.reshape(len(years), 12, 90, 180).mean(axis=1)
            records = np.full((90, 180, 6 + len(years)), np.nan, dtype="<f4")
            records[:, :, 6:] = annual.transpose(1, 2, 0)
            valid = np.isfinite(annual).all(axis=0)
            for row, col in zip(*np.where(valid)):
                local = annual[:, row, col]
                records[row, col, :3] = trend(local, years)
                records[row, col, 3:6] = trend(local - reference, years)
            records.tofile(DEST / f"cells-{start}.bin")
            metadata[start] = dict(end=END, series=reference.tolist(), stats=trend(reference, years),
                                   complete=int(valid.sum()), regions={
                                       name: regional_summary(grid, indices, years, reference, bounds)
                                       for name, bounds in REGIONS.items()})
    (DEST / "periods.json").write_text(json.dumps(metadata, allow_nan=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
