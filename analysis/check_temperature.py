"""Independently check the saved numbers with SciPy's reader and raw packed values."""
import csv

import numpy as np
from scipy.io import netcdf_file
from scipy.stats import linregress, t

from temperature import YEARS, trend


def check():
    with netcdf_file("raw/gistemp.nc", mmap=False) as grid:
        dates = np.datetime64("1800-01-01") + grid.variables["time"].data.astype("timedelta64[D]")
        packed = grid.variables["tempanomaly"]
        lat = grid.variables["lat"].data.astype(float)
        lon = grid.variables["lon"].data.astype(float)
        area = np.sin(np.deg2rad(lat + 1)) - np.sin(np.deg2rad(lat - 1))
        mask_arctic = np.broadcast_to((lat[:, None] >= 66), (90, 180))
        mask_atlantic = ((lat[:, None] >= 50) & (lat[:, None] < 60)
                         & (lon >= -50) & (lon < -30))
        assert (mask_arctic.sum(), mask_atlantic.sum()) == (2160, 50)
        saved = np.genfromtxt("results/annual-temperatures.csv", delimiter=",", skip_header=1)
        np.testing.assert_array_equal(saved[:, 0], YEARS)
        for col, mask in enumerate((mask_arctic, mask_atlantic), start=1):
            weights = np.broadcast_to(area[:, None], mask.shape)[mask]
            for row, year in enumerate(YEARS):
                months = packed.data[(dates >= np.datetime64(str(year))) &
                                     (dates < np.datetime64(str(year + 1)))][:, mask]
                monthly, fractions = [], []
                for month in months:
                    ok = month != packed._FillValue
                    fractions.append(weights[ok].sum() / weights.sum())
                    monthly.append(np.average(month[ok] * float(packed.scale_factor), weights=weights[ok]))
                assert len(monthly) == 12 and min(fractions) >= 0.8
                np.testing.assert_allclose(np.mean(monthly), saved[row, col], atol=1e-7)
                np.testing.assert_allclose(min(fractions), saved[row, col + 2], atol=1e-7)

    with open("results/trends.csv") as stream:
        rates = list(csv.DictReader(stream))
    for values, row in zip([saved[:, 1], saved[:, 2], saved[:, 1] - saved[:, 2]], rates, strict=True):
        fit = linregress(YEARS, values)
        slope = fit.slope * 10
        np.testing.assert_allclose(slope, float(row["C_per_decade"]))
        # Independent scalar Bartlett-weighted covariance for a centered time axis.
        x = (YEARS - YEARS.mean()) / 10
        score = x * (values - (fit.intercept + YEARS * fit.slope))
        variance_sum = np.dot(score, score)
        for lag in range(1, 4):
            variance_sum += 2 * (1 - lag / 4) * np.dot(score[lag:], score[:-lag])
        variance = variance_sum * len(x) / (len(x) - 2) / np.dot(x, x)**2
        half_width = t.ppf(0.975, len(x) - 2) * np.sqrt(variance)
        np.testing.assert_allclose([slope - half_width, slope + half_width],
                                   [float(row["lower_95"]), float(row["upper_95"])])
    known = 1 + 0.03 * (YEARS - 1980)
    np.testing.assert_allclose(trend(known)[0], 0.30, atol=1e-10)
    print("Matched 92 annual means, 92 coverage fractions and all three slopes and confidence intervals.")
    print("Known trend recovered:", trend(known)[0], "degrees per decade.")
    print("Lowest monthly coverage in each region:", saved[:, 3:].min(axis=0))


if __name__ == "__main__":
    check()
