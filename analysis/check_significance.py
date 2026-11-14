"""Check field_significance.py: p-value recovery, the BH step, a null simulation and the flag files."""
import json

import numpy as np
from statsmodels.api import OLS, add_constant
from statsmodels.stats.multitest import multipletests

from field_significance import DEST, STARTS, Q, benjamini_hochberg, p_values, station_support, land_mask


def hac_fit(values, years):
    """Same fit as temperature.trend, returning the statsmodels p-value too."""
    design = add_constant((years - years.mean()) / 10)
    fit = OLS(values, design).fit(cov_type="HAC", use_t=True, cov_kwds={"maxlags": 3, "use_correction": True})
    return fit.params[1], *fit.conf_int()[1], fit.pvalues[1]


def ar1(rng, n, phi, size):
    noise = rng.normal(size=(n, size))
    for i in range(1, n):
        noise[i] += phi * noise[i - 1]
    return noise


def main():
    rng = np.random.default_rng(2026)

    # 1. The p-value recovered from the exported interval equals statsmodels' own p-value.
    for n in (46, 126):
        years = np.arange(2025 - n + 1, 2026)
        for slope in (0, 0.01, 0.03):
            y = slope * (years - years[0]) + 0.2 * ar1(rng, n, 0.3, 1)[:, 0]
            rate, low, high, p = hac_fit(y, years)
            np.testing.assert_allclose(p_values(np.array(rate), np.array(low), np.array(high), n), p, rtol=1e-6)

    # 2. The BH step matches statsmodels, including NaN handling.
    for _ in range(100):
        p = np.concatenate([rng.uniform(size=300), rng.uniform(0, 0.01, size=rng.integers(0, 100))])
        p[rng.uniform(size=p.size) < 0.1] = np.nan
        finite = np.isfinite(p)
        expected = np.zeros(p.size, dtype=bool)
        expected[finite] = multipletests(p[finite], alpha=Q, method="fdr_bh")[0]
        np.testing.assert_array_equal(benjamini_hochberg(p), expected)

    # 3. On pure AR(1) noise (no trend anywhere), BH removes most of the chance flags. Neither count is 5%:
    # with 46 years, Newey–West p-values are anti-conservative (about 14% of null cells fall below
    # 0.05 at lag-1 autocorrelation 0.3), so the BH dots inherit some of that optimism.
    n, cells = 46, 2000
    years = np.arange(1980, 2026)
    results = np.array([hac_fit(y, years)[3] for y in ar1(rng, n, 0.3, cells).T])
    raw, fdr = (results < 0.05).sum(), benjamini_hochberg(results).sum()
    print(f"Null simulation, {cells} trendless cells: raw p < 0.05 flags {raw}, BH at q = {Q} flags {fdr}.")
    assert fdr < raw / 4

    # 4. Flag files agree with the cell files and the saved station support.
    support = station_support()
    land = land_mask()
    summary = json.loads((DEST / "significance.json").read_text())
    for start in STARTS:
        length = len(json.loads((DEST / "periods.json").read_text())[str(start)]["series"])
        records = np.fromfile(DEST / f"cells-{start}.bin", dtype="<f4").reshape(90, 180, 6 + length)
        flags = np.fromfile(DEST / f"flags-{start}.bin", dtype=np.uint8).reshape(90, 180)
        complete = np.isfinite(records[:, :, 0])
        assert not (flags[~complete] & 3).any(), "significance bits must only mark complete cells"
        np.testing.assert_array_equal((flags & 4) > 0, land & ~support[start])
        for bit, name in ((1, "local"), (2, "relative")):
            assert ((flags & bit) > 0).sum() == summary["periods"][str(start)][name]["fdr_discoveries"]
        print(f"{start}–2025: flag file consistent with {complete.sum()} complete cells.")


if __name__ == "__main__":
    main()
