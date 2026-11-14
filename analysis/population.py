"""Build 2020 population exposure from the inputs listed in docs/temperature.md."""
import json
from pathlib import Path

import numpy as np
import rasterio
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


def main():
    countries = json.loads(BORDERS.read_text())["features"]
    india = next(f["geometry"] for f in countries if f["properties"]["ADM0_A3"] == "IND")
    world = np.zeros(SHAPE)
    with rasterio.open(RASTER) as src:
        assert src.crs.to_epsg() == 4326 and src.transform.b == src.transform.d == 0
        for _, window in src.block_windows(1):
            world += aggregate(src, window)
        window = geometry_window(src, [india])
        inside = geometry_mask([india], (int(window.height), int(window.width)),
                               src.window_transform(window), invert=True)
        national = aggregate(src, window, inside)
    assert np.all(national <= world + 1e-4)
    data = dict(year=2020, cellResidents=np.rint(world).astype(int).ravel().tolist(), periods={})
    for start in (1900, 1980):
        datafile = DEST / f"cells-{start}.bin"
        records = np.fromfile(datafile, dtype="<f4").reshape(*SHAPE, 6 + 2026 - start)
        data["periods"][start] = {
            "world": summarize(world, records), "india": summarize(national, records)}
    (DEST / "population-2020.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(json.dumps(data["periods"], indent=2))


if __name__ == "__main__":
    main()
