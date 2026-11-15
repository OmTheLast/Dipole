"""Build the Indian regional water comparison from JPL GRACE/GRACE-FO CRI mascons."""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.dates import date2num
from matplotlib.ticker import MaxNLocator
import netCDF4 as nc
import numpy as np
from scipy.stats import theilslopes
import pandas as pd
from rasterio.features import bounds, geometry_mask
from rasterio.transform import from_origin
from scipy.linalg import solve_triangular
from scipy.optimize import minimize_scalar
from scipy.stats import t

DEST = Path("docs/water")
STATES = {"IN-RJ", "IN-PB", "IN-HR", "IN-DL"}


def regional_weights(lat, lon, features, subdivisions=32, state_codes=STATES):
    geometries = [f["geometry"] for f in features if f["properties"]["iso_3166_2"] in state_codes]
    assert len(geometries) == len(state_codes)
    west, south, east, north = np.asarray([bounds(g) for g in geometries]).T
    rows = np.flatnonzero((lat >= south.min() - .25) & (lat <= north.max() + .25))
    cols = np.flatnonzero((lon >= west.min() - .25) & (lon <= east.max() + .25))
    assert np.allclose(np.diff(lat[rows]), .5) and np.allclose(np.diff(lon[cols]), .5)
    step = .5 / subdivisions
    top = lat[rows[-1]] + .25
    transform = from_origin(lon[cols[0]] - .25, top, step, step)
    shape = (len(rows) * subdivisions, len(cols) * subdivisions)
    mask = geometry_mask(geometries, shape, transform, invert=True)
    # Spherical strip areas, including fractional grid squares along the boundary.
    edges = np.radians(top - np.arange(shape[0]+1)*step)
    strip = -np.diff(np.sin(edges)) * np.radians(step) * 6371.0088**2
    area = (mask * strip[:, None]).reshape(len(rows), subdivisions, len(cols), subdivisions).sum(axis=(1, 3))
    return slice(rows[0], rows[-1]+1), slice(cols[0], cols[-1]+1), area[::-1]


def annual_fit(seasons):
    good = seasons.dropna()
    years = good.index.to_numpy()
    design = np.column_stack([np.ones(len(years)), (years-years[0])/10])
    gaps = np.abs(years[:, None] - years)
    # Restricted likelihood for annual AR(1) errors, retaining actual calendar gaps.
    def solve(rho):
        chol = np.linalg.cholesky(rho**gaps)
        x = solve_triangular(chol, design, lower=True)
        y = solve_triangular(chol, good.to_numpy(), lower=True)
        beta = np.linalg.lstsq(x, y, rcond=None)[0]
        variance = np.sum((y-x@beta)**2)/(len(y)-2)
        information = x.T@x
        score = (len(y)-2)*np.log(variance) + 2*np.log(np.diag(chol)).sum() + np.linalg.slogdet(information)[1]
        return score, beta, variance*np.linalg.inv(information)
    rho = minimize_scalar(lambda r: solve(r)[0], bounds=(-.95, .95), method="bounded").x
    _, beta, covariance = solve(rho)
    margin = t.ppf(.975, len(years)-2) * np.sqrt(covariance[1,1])
    return dict(first=int(years[0]), last=int(years[-1]), n=len(years), intercept=beta[0],
                slope=beta[1], low=beta[1]-margin, high=beta[1]+margin, rho=rho,
                ols=float(np.polyfit(years-years[0], good, 1)[0]*10),
                sen=float(theilslopes(good, years).slope*10))


def export_water_map(ds, labels, seasons, features):
    # Display in geographic order, from 180°W to 180°E and north to south.
    lat = np.asarray(ds["lat"][:])
    lon = np.asarray(ds["lon"][:])
    assert np.allclose(lat, np.arange(-89.75, 90, .5))
    assert np.allclose(lon, np.arange(.25, 360, .5))
    land = np.asarray(ds["land_mask"][:]) == 1
    ids = np.asarray(ds["mascon_ID"][:])[land]
    _, first, index = np.unique(ids, return_index=True, return_inverse=True)
    grid = np.zeros(land.shape, dtype=int)
    grid[land] = index + 1  # Keep zero for ocean.
    grid = np.roll(grid[::-1], len(lon) // 2, axis=1)
    runs = []
    for row in grid:
        starts = np.r_[0, np.flatnonzero(np.diff(row)) + 1]
        runs.append(np.column_stack((starts, row[starts])).ravel().tolist())

    values = {}
    for year in seasons.dropna().index:
        positions = [labels.index(pd.Period(f"{year}-{month}", freq="M")) for month in (10, 11)]
        fields = ds["lwe_thickness"][positions, :, :][:, land]
        assert not np.ma.getmaskarray(fields).any()
        mean = np.asarray(fields, dtype=float).mean(axis=0)
        assert np.isfinite(mean).all() and np.allclose(mean, mean[first][index], atol=.001, rtol=0)
        values[int(year)] = np.round(mean[first], 2).tolist()

    states = []
    for feature in features:
        props = feature["properties"]
        if props["iso_3166_2"] in STATES | {"IN-MP"}:
            geometry = feature["geometry"]
            assert geometry["type"] == "Polygon"
            rings = [np.round(ring, 3).tolist() for ring in geometry["coordinates"]]
            states.append(dict(name=props["name"], center=[props["longitude"], props["latitude"]], rings=rings))
    (DEST/"map.json").write_text(json.dumps(dict(rows=runs, years=values, states=states),
                                            separators=(",", ":"), allow_nan=False))


def plots(monthly, seasons, fits):
    markers = {}
    matplotlib.rcParams["svg.hashsalt"] = "dipole-water"
    for monthly_view in [False, True]:
        fig, ax = plt.subplots(figsize=(8.4, 3.25), layout="constrained")
        fig.patch.set_alpha(0)
        ax.set_facecolor("none")
        ax.spines[["left", "top", "right"]].set_visible(False)
        ax.spines["bottom"].set_color("#a2afa9")
        ax.grid(axis="y", color="#dadfd7", linewidth=.7)
        ax.axhline(0, color="#83988e", linewidth=1)
        for region, color, marker in [("northwest", "#245c65", "o"), ("central", "#a25228", "^")]:
            if monthly_view:
                dates = monthly.index.to_timestamp()
                ax.plot(dates, monthly[region], color=color, linewidth=1)
                post = monthly.index.month.isin([10, 11])
                ax.scatter(dates[post], monthly.loc[post, region], s=7, marker=marker, color=color)
            else:
                ax.plot(seasons.index, seasons[region], marker=marker, color=color, linewidth=1, markersize=4)
                fit = fits[region]
                ends = np.array([fit["first"], fit["last"]])
                ax.plot(ends, fit["intercept"]+(ends-fit["first"])*fit["slope"]/10, "--", color=color)
        if not monthly_view:
            first, last = seasons.dropna().index[[0, -1]]
            ax.set_xticks(sorted({first, *range(2005, last, 5), last}))
        ax.tick_params(length=0, labelsize=10, pad=5, colors="#344940")
        ax.yaxis.set_major_locator(MaxNLocator(6))
        ax.set_ylabel("Water storage anomaly (cm)")
        view = "monthly" if monthly_view else "post-monsoon"
        # Freeze the final SVG layout before recording the scrubber positions.
        fig.canvas.draw()
        fig.set_layout_engine("none")
        position = ax.get_position()
        left, right = ax.get_xlim()
        markers[view] = dict(top=1-position.y1, bottom=1-position.y0, years={})
        for year in seasons.index:
            x = date2num(pd.Timestamp(year=int(year), month=10, day=16)) if monthly_view else year
            markers[view]["years"][int(year)] = position.x0 + (x-left)/(right-left)*position.width
        path = DEST / (view + ".svg")
        fig.savefig(path, metadata={"Date": None})
        path.write_text("\n".join(line.rstrip() for line in path.read_text().splitlines()) + "\n")
        plt.close(fig)
    return markers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("netcdf", type=Path)
    args = parser.parse_args()
    if not args.netcdf.name.endswith("MSCNv04CRI.nc"):
        parser.error("Expected the JPL RL06.3Mv04 CRI NetCDF file")
    features = json.loads(Path("raw/ne_10m_admin_1.geojson").read_text())["features"]
    with nc.Dataset(args.netcdf) as ds:
        v = ds["lwe_thickness"]
        assert v.units == "cm" and v.dimensions == ("time", "lat", "lon")
        values, areas = {}, {}
        for region, codes in [("northwest", STATES), ("central", {"IN-MP"})]:
            ry, cx, area = regional_weights(ds["lat"][:], ds["lon"][:], features, state_codes=codes)
            assert np.all(ds["land_mask"][ry, cx][area > 0] == 1)
            grid = v[:, ry, cx].astype(float).filled(np.nan)[:, area > 0]
            assert np.isfinite(grid).all()
            values[region] = np.average(grid, axis=1, weights=area[area > 0])
            areas[region] = round(float(area.sum()))
        tv = ds["time"]
        dates = nc.num2date(tv[:], tv.units)
        months = pd.PeriodIndex([d.strftime("%Y-%m") for d in dates], freq="M")
    # Some mission solutions use days from an adjacent month. Resolve nominal
    # JPL months only when the source date would otherwise duplicate one.
    labels = list(months)
    for period, offset, which in [("2012-01", -1, 0), ("2015-04", 1, -1)]:
        idx = [i for i, m in enumerate(labels) if str(m) == period]
        if len(idx) == 2:
            labels[idx[which]] += offset
    series = pd.DataFrame(values, index=pd.PeriodIndex(labels, freq="M"))
    assert series.index.is_unique and series.index.is_monotonic_increasing
    monthly = series.reindex(pd.period_range(series.index.min(), series.index.max(), freq="M"))
    post = monthly[monthly.index.month.isin([10, 11])]
    grouped = post.groupby(post.index.year)
    seasons = grouped.mean().where(grouped.count() == 2)
    paired = seasons.dropna()
    fits = {region: annual_fit(paired[region]) for region in paired}
    fits["difference"] = annual_fit(paired["northwest"] - paired["central"])
    DEST.mkdir(exist_ok=True)
    with nc.Dataset(args.netcdf) as ds:
        export_water_map(ds, labels, seasons, features)
    markers = plots(monthly, seasons, fits)

    def rounded(value):
        return round(float(value), 3) if pd.notna(value) else None

    records = []
    for year, means in seasons.iterrows():
        row = {"year": int(year)}
        for region in seasons:
            data = dict(october=rounded(monthly[region].get(f"{year}-10")),
                        november=rounded(monthly[region].get(f"{year}-11")), mean=rounded(means[region]))
            if region == "northwest":
                row.update(data)
            else:
                row[region] = data
        records.append(row)
    data = dict(source=args.netcdf.name, areaKm2=areas["northwest"], centralAreaKm2=areas["central"],
                start=str(monthly.index[0]), end=str(monthly.index[-1]), months=len(series),
                fit=fits["northwest"], centralFit=fits["central"], differenceFit=fits["difference"],
                markers=markers, seasons=records)
    (DEST/"series.json").write_text(json.dumps(data, indent=2, allow_nan=False)+"\n")
    monthly.rename(columns={"northwest": "anomaly_cm", "central": "madhya_pradesh_anomaly_cm"}).to_csv(
        DEST/"monthly.csv", index_label="month", float_format="%.5f")
    print(areas, fits)



if __name__ == "__main__":
    main()
