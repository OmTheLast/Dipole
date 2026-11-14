"""Check explorer files against NASA's packed grid and independent linear fits."""
import json
import numpy as np
from scipy.io import netcdf_file
from scipy.stats import t

from export_map import DEST, STARTS, END, global_history


def check_rates(values, years, records):
    x = (years - years.mean()) / 10
    slope = x @ values / (x @ x)
    residual = values - values.mean(axis=0) - x[:, None] * slope
    score = x[:, None] * residual
    variance = (score**2).sum(axis=0)
    for lag in range(1, 4):
        variance += 2 * (1 - lag / 4) * (score[lag:] * score[:-lag]).sum(axis=0)
    n = len(years)
    width = t.ppf(.975, n - 2) * np.sqrt(variance * n / (n - 2)) / (x @ x)
    np.testing.assert_allclose(records, np.column_stack((slope, slope - width, slope + width)), atol=1e-6)


def main():
    periods = json.loads((DEST / "periods.json").read_text())
    global_table = global_history()
    with netcdf_file("raw/gistemp.nc", mmap=False) as grid:
        time = np.datetime64("1800-01-01") + grid.variables["time"].data.astype("timedelta64[D]")
        var = grid.variables["tempanomaly"]
        for start in STARTS:
            years = np.arange(start, END + 1)
            period = periods[str(start)]
            global_series = np.array([global_table[y] for y in years])
            np.testing.assert_array_equal(period["series"], global_series)
            check_rates(global_series[:, None], years, [period["stats"]])
            records = np.fromfile(DEST / f"cells-{start}.bin", dtype="<f4").reshape(90, 180, 6 + len(years))
            packed = var.data[(time >= np.datetime64(str(start))) & (time < np.datetime64(str(END+1)))]
            monthly = np.where(packed == var._FillValue, np.nan, packed * float(var.scale_factor))
            annual = monthly.reshape(len(years), 12, 90, 180).mean(axis=1)
            np.testing.assert_allclose(records[:, :, 6:], annual.transpose(1, 2, 0), atol=1e-6)
            valid = np.isfinite(annual).all(axis=0)
            assert np.isnan(records[~valid, :6]).all() and valid.sum() == period["complete"]
            check_rates(annual[:, valid], years, records[valid, :3])
            check_rates(annual[:, valid] - global_series[:, None], years, records[valid, 3:6])
            for name, region in period["regions"].items():
                series = np.array(region["series"], dtype=float)
                use = years >= region["fitStart"]
                assert np.isfinite(series[use]).all()
                if not use.all():
                    assert np.isnan(series[np.flatnonzero(use)[0] - 1])
                check_rates(series[use, None], years[use], [region["stats"]])
                check_rates((series - global_series)[use, None], years[use], [region["relative"]])
                np.testing.assert_allclose(region["globalRate"], np.polyfit(years[use], global_series[use], 1)[0] * 10)
                if start == 1980:
                    saved = np.genfromtxt("results/annual-temperatures.csv", delimiter=",", names=True)
                    np.testing.assert_allclose(series, saved[name.lower().replace(" ", "_") + "_anomaly_C"])
            print(f"{start}–{END}: checked {valid.size} histories and {valid.sum()} pairs of trend estimates.")


if __name__ == "__main__":
    main()
