"""Export the cell and regional series for the static temperature explorer."""
import csv
import json
from pathlib import Path

import netCDF4 as nc
import numpy as np

from temperature import REGIONS, YEARS, trend

DEST = Path("docs/map")


def main():
    DEST.mkdir(exist_ok=True)
    with nc.Dataset("raw/gistemp.nc") as grid:
        time = grid["time"]
        dates = nc.num2date(time[:], time.units)
        indices = [i for i, date in enumerate(dates) if YEARS[0] <= date.year <= YEARS[-1]]
        assert [(dates[i].year, dates[i].month) for i in indices] == [
            (year, month) for year in YEARS for month in range(1, 13)]
        np.testing.assert_array_equal(grid["lat"][:], np.arange(-89, 90, 2))
        np.testing.assert_array_equal(grid["lon"][:], np.arange(-179, 180, 2))
        # NaN propagates when any of a year's 12 monthly estimates is absent.
        monthly = grid["tempanomaly"][indices].astype("float64").filled(np.nan)
        annual = monthly.reshape(len(YEARS), 12, 90, 180).mean(axis=1)
    records = np.full((90, 180, 3 + len(YEARS)), np.nan, dtype="<f4")
    records[:, :, 3:] = annual.transpose(1, 2, 0)
    valid = np.isfinite(annual).all(axis=0)
    for row, col in zip(*np.where(valid)):
        records[row, col, :3] = trend(annual[:, row, col])
    records.tofile(DEST / "cells.bin")
    regional_data = np.genfromtxt("results/annual-temperatures.csv", delimiter=",", names=True)
    np.testing.assert_array_equal(regional_data["year"], YEARS)
    with open("results/trends.csv") as stream:
        summaries = {r["region"]: r for r in csv.DictReader(stream)}
    regions = {}
    for name, bounds in REGIONS.items():
        field = name.lower().replace(" ", "_") + "_anomaly_C"
        regions[name] = dict(bounds=bounds, series=regional_data[field].tolist(),
                             stats=[float(summaries[name][key]) for key in
                                    ("C_per_decade", "lower_95", "upper_95")])
    (DEST / "regions.json").write_text(json.dumps(regions, separators=(",", ":")))
    print(f"{valid.sum()} complete cells, {valid.size - valid.sum()} without full-period estimates")


if __name__ == "__main__":
    main()
