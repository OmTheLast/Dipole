"""Export lightweight country polygons for in-browser geolocation from the population boundary source."""
import json
import sys
from pathlib import Path


def thin(points, tolerance=.005):
    """Douglas-Peucker simplification in degrees, preserving ring closure and small islands."""
    keep = {0, len(points) - 1}
    segments = [(0, len(points) - 1)]
    while segments:
        lo, hi = segments.pop()
        x, y = points[lo][:2]
        dx, dy = points[hi][0] - x, points[hi][1] - y
        length = dx * dx + dy * dy
        best, pivot = tolerance**2, None
        for i in range(lo + 1, hi):
            a, b = points[i][0] - x, points[i][1] - y
            t = min(1, max(0, (a * dx + b * dy) / length)) if length else 0
            dist = (a - t * dx)**2 + (b - t * dy)**2
            if dist > best:
                best, pivot = dist, i
        if pivot is not None:
            keep.add(pivot)
            segments.extend([(lo, pivot), (pivot, hi)])
    indices = sorted(keep) if len(keep) >= 4 else range(len(points))
    return [[round(v, 4) for v in points[i][:2]] for i in indices]


if __name__ == "__main__":
    root = Path("docs/map")
    countries = json.loads((root / "population-2020.json").read_text())["countries"]
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("raw/ne_10m_admin_0_countries_ind.geojson")
    output = []
    for feature in json.loads(source.read_text())["features"]:
        code = feature["properties"]["ADM0_A3"]
        if code not in countries:
            continue
        g = feature["geometry"]
        for polygon in g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]:
            rings = [thin(ring) for ring in polygon]
            x, y = zip(*rings[0])
            output.append([code, [min(x), min(y), max(x), max(y)], rings])
    (root / "country-outlines.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
