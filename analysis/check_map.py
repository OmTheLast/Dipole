"""Cross-check the browser export against packed NASA values and independent linear fits."""
import json

import numpy as np
from scipy.io import netcdf_file
from scipy.stats import t

from export_map import DEST
from temperature import YEARS


def main():
    records = np.fromfile(DEST / "cells.bin", dtype="<f4").reshape(90, 180, 49)
    with netcdf_file("raw/gistemp.nc", mmap=False) as grid:
        time = np.datetime64("1800-01-01") + grid.variables["time"].data.astype("timedelta64[D]")
        var = grid.variables["tempanomaly"]
        packed = var.data[(time >= np.datetime64("1980")) & (time < np.datetime64("2026"))]
        monthly = np.where(packed == var._FillValue, np.nan, packed * float(var.scale_factor))
        annual = monthly.reshape(46, 12, 90, 180).mean(axis=1)
    np.testing.assert_allclose(records[:, :, 3:], annual.transpose(1, 2, 0), atol=1e-6)
    valid = np.isfinite(annual).all(axis=0)
    assert np.isnan(records[~valid, :3]).all()
    x = (YEARS - YEARS.mean()) / 10
    values = annual[:, valid]
    slope = x @ values / (x @ x)
    residual = values - values.mean(axis=0) - x[:, None] * slope
    score = x[:, None] * residual
    variance = (score**2).sum(axis=0)
    for lag in range(1, 4):
        variance += 2 * (1 - lag / 4) * (score[lag:] * score[:-lag]).sum(axis=0)
    width = t.ppf(.975, 44) * np.sqrt(variance * 46/44) / (x @ x)
    np.testing.assert_allclose(records[valid, :3], np.column_stack((slope, slope-width, slope+width)), atol=1e-6)
    regions = json.loads((DEST / "regions.json").read_text())
    for name, row in regions.items():
        region = np.genfromtxt("results/annual-temperatures.csv", delimiter=",", names=True)
        np.testing.assert_allclose(row["series"], region[name.lower().replace(" ", "_") + "_anomaly_C"])
    print(f"Checked {valid.size} cell histories and {valid.sum()} trend and interval triples.")
    for label, mask in [("Incomplete", ~valid), ("Cooling", records[:, :, 2] < 0)]:
        r, c = np.argwhere(mask)[0]
        print(label, "cell center", 2*r-89, 2*c-179)


if __name__ == "__main__":
    main()
