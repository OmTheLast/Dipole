"""Check the hatching files against the saved 250 km coverage runs and the land outline."""
import numpy as np

from station_coverage import DEST, ROWS, COLS, decode_runs, encode_runs, hatched

rng = np.random.default_rng(0)
for _ in range(20):
    mask = rng.uniform(size=(ROWS, COLS)) < rng.uniform()
    np.testing.assert_array_equal(decode_runs(encode_runs(mask)), mask)

masks, land = hatched()
for start, expected in masks.items():
    saved = np.fromfile(DEST / f"coverage-{start}.bin", dtype=np.uint8).reshape(ROWS, COLS)
    assert set(np.unique(saved)) <= {0, 1}
    np.testing.assert_array_equal(saved.astype(bool), expected)
    assert not (saved.astype(bool) & ~land).any(), "only land cells are hatched"
    print(f"{start}–2025: {saved.sum()} hatched land cells match the saved coverage and land outline.")
