"""Build 2020 population exposure from the inputs listed in docs/temperature.md."""
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.errors import WindowError
from rasterio.transform import Affine
from rasterio.windows import Window
from rasterio.features import geometry_mask, geometry_window

DEST = Path("docs/map")
RASTER = Path("raw/GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif")
BORDERS = Path("raw/ne_10m_admin_0_countries_ind.geojson")
SHAPE = (90, 180)


def aggregate(src, window, mask=None):
    """Sum people, assigning each population pixel by its centre to a GISTEMP cell."""
    transform = src.window_transform(window)
    lon = transform.c + (np.arange(window.width) + 0.5) * transform.a
    lat = transform.f + (np.arange(window.height) + 0.5) * transform.e
    col = np.floor(((lon + 180) % 360) / 2).astype(int)
    row = np.floor((lat + 90) / 2).astype(int)
    values = src.read(1, window=window, masked=True).filled(0)
    if mask is not None:
        values[~mask] = 0
    # The source extends slightly past the dateline, including inhabited pixels.
    valid = values > 0
    rr, cc = np.nonzero(valid)
    if np.any((row[rr] < 0) | (row[rr] >= 90)):
        raise ValueError("Populated pixel outside the temperature grid")
    ids = row[rr] * 180 + col[cc]
    return np.bincount(ids, weights=values[valid], minlength=16200).reshape(SHAPE)


def summarize(population, records):
    trend, lower = records[:, :, 3], records[:, :, 4]
    valid = np.isfinite(trend)
    def count(mask):
        return round(float(population[mask].sum()))
    return dict(valid=count(valid), faster=count(trend > 0), aboveInterval=count(lower > 0),
                excluded=count(~valid))


def country_grid(src, geometry):
    """Bound memory and avoid spanning entire oceans for island groups."""
    result = np.zeros(SHAPE)
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for rings in polygons:
        polygon = {"type": "Polygon", "coordinates": rings}
        try:
            bounds = geometry_window(src, [polygon])
        except WindowError:
            continue  # Geometry falls outside the population raster.
        for row in range(bounds.row_off, bounds.row_off + bounds.height, 1024):
            for col in range(bounds.col_off, bounds.col_off + bounds.width, 1024):
                window = Window(col, row, min(1024, bounds.col_off + bounds.width - col),
                                min(1024, bounds.row_off + bounds.height - row))
                inside = geometry_mask([polygon], (window.height, window.width),
                                       src.window_transform(window), invert=True)
                if inside.any():
                    result += aggregate(src, window, inside)
    # GHS-POP extends one pixel centre past each side of the dateline.
    # Test those centres against the country at their wrapped longitude.
    for col, shift in [(0, 360), (src.width - 1, -360)]:
        lon, _ = src.xy(0, col)
        if -180 <= lon < 180:
            continue
        edge = Window(col, 0, 1, src.height)
        transform = Affine.translation(shift, 0) * src.window_transform(edge)
        inside = geometry_mask([geometry], (src.height, 1), transform, invert=True)
        if inside.any():
            result += aggregate(src, edge, inside)
    return result


def main():
    countries = json.loads(BORDERS.read_text())["features"]
    records = {}
    for start in (1900, 1980):
        datafile = DEST / f"cells-{start}.bin"
        records[start] = np.fromfile(datafile, dtype="<f4").reshape(*SHAPE, 6 + 2026 - start)
    world = np.zeros(SHAPE)
    with rasterio.open(RASTER) as src:
        assert src.crs.to_epsg() == 4326 and src.transform.b == src.transform.d == 0
        for _, window in src.block_windows(1):
            world += aggregate(src, window)
        periods = {start: {"world": summarize(world, grid), "countries": {}} for start, grid in records.items()}
        names = {}
        for feature in countries:
            national = country_grid(src, feature["geometry"])
            if national.sum() < 0.5:
                continue
            assert np.all(national <= world + 1e-4)
            props = feature["properties"]
            code = props["ADM0_A3"]
            names[code] = props["NAME_EN"]
            for start, grid in records.items():
                periods[start]["countries"][code] = summarize(national, grid)
    # Keep the original India entry for earlier clients of this data file.
    for period in periods.values():
        period["india"] = period["countries"]["IND"]
    data = dict(year=2020, cellResidents=np.rint(world).astype(int).ravel().tolist(),
                countries=names, periods=periods)
    path = DEST / "population-2020.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    temporary.replace(path)
    print(f"Published estimates locally for {len(names)} countries and territories.")


if __name__ == "__main__":
    main()
