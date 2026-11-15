"""Run from the repository root after downloading the NASA grid (see docs/temperature.md)."""
import csv
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import netCDF4 as nc
import numpy as np
from statsmodels.api import OLS, add_constant


YEARS = np.arange(1980, 2026)
REGIONS = {"Arctic": (66, 90, -180, 180), "North Atlantic": (50, 60, -50, -30)}
OUTPUT = Path("results")


def annual_series(grid, times, bounds):
    south, north, west, east = bounds
    lat = grid["lat"][:]
    lon = grid["lon"][:]
    rows = np.flatnonzero((lat >= south) & (lat < north))
    cols = np.flatnonzero((lon >= west) & (lon < east))
    values = grid["tempanomaly"][times, rows, cols].astype("float64").filled(np.nan)
    weights = np.broadcast_to(np.cos(np.deg2rad(lat[rows].astype(float)))[:, None], values.shape[1:])
    covered = np.sum(np.isfinite(values) * weights, axis=(1, 2))
    coverage = covered / weights.sum()
    monthly = np.nansum(values * weights, axis=(1, 2)) / covered
    monthly[coverage < 0.80] = np.nan
    return monthly.reshape(-1, 12).mean(axis=1), coverage.reshape(-1, 12).min(axis=1)


def fit_trend(values, years):
    # Center the year and express time in decades. Gaps would retain their actual dates.
    design = add_constant((years - years.mean()) / 10)
    return OLS(values, design, missing="drop").fit(cov_type="HAC", use_t=True,
                 cov_kwds={"maxlags": 3, "use_correction": True})


def trend(values, years=YEARS):
    fit = fit_trend(values, years)
    return (fit.params[1], *fit.conf_int()[1])


def write_csv(name, header, rows):
    with (OUTPUT / name).open("w", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def chart(series, rates):
    fig, ax = plt.subplots(figsize=(10, 5.9))
    fig.subplots_adjust(left=.09, right=.97, bottom=.17, top=.77)
    fig.text(.09, .93, "Warming in the Arctic and south of Greenland",
             fontsize=21, weight="bold", color="#172f41")
    fig.text(.09, .875, "Annual surface temperature relative to each region’s 1951–1980 average",
             fontsize=12, color="#425867")
    for (name, values), color in zip(series.items(), ["#ad451e", "#146389"]):
        ax.plot(YEARS, values, color=color, lw=2.3,
                label=f"{name}   {rates[name][0]:+.2f} °C/decade")
    ax.legend(loc="lower left", bbox_to_anchor=(0, 1.01), frameon=False, ncol=2, borderaxespad=0)
    ax.axhline(0, color="#829199", linewidth=.9)
    ax.grid(axis="y", color="#e0e5e8")
    ax.set_axisbelow(True)
    ax.set(xlim=(1980, 2025), ylabel="Temperature anomaly (°C)",
           xticks=[1980, 1990, 2000, 2010, 2020, 2025])
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.tick_params(length=0, pad=7)
    fig.text(.09, .075, "Arctic: 66–90°N, all longitudes   •   North Atlantic: 50–60°N, 50–30°W", fontsize=10)
    fig.text(.09, .033, "Source: NASA GISS, GISTEMP v4 land–ocean temperature index   |   Dipole", fontsize=10)
    fig.savefig(OUTPUT / "temperature.png", dpi=170)
    plt.close(fig)


def main():
    OUTPUT.mkdir(exist_ok=True)
    series, coverage = {}, {}
    with nc.Dataset("raw/gistemp.nc") as grid:
        time = grid["time"]
        dates = nc.num2date(time[:], time.units, calendar=getattr(time, "calendar", "standard"))
        times = [i for i, d in enumerate(dates) if YEARS[0] <= d.year <= YEARS[-1]]
        assert [(dates[i].year, dates[i].month) for i in times] == [
            (y, m) for y in YEARS for m in range(1, 13)]
        for name, bounds in REGIONS.items():
            series[name], coverage[name] = annual_series(grid, times, bounds)

    rates = {name: trend(values) for name, values in series.items()}
    rates["Arctic minus North Atlantic"] = trend(series["Arctic"] - series["North Atlantic"])
    assert np.isclose(trend(2 + 0.03 * (YEARS - YEARS[0]))[0], .3)
    write_csv("annual-temperatures.csv",
              ["year", "arctic_anomaly_C", "north_atlantic_anomaly_C",
               "arctic_min_monthly_area_fraction", "north_atlantic_min_monthly_area_fraction"],
              zip(YEARS, *series.values(), *coverage.values()))
    write_csv("trends.csv", ["region", "C_per_decade", "lower_95", "upper_95"],
              ((name, *rate) for name, rate in rates.items()))
    chart(series, rates)


if __name__ == "__main__":
    main()
