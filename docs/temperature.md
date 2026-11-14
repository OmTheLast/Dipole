# The Arctic and the ocean south of Greenland, 1980–2025

The Arctic warmed by 0.69°C per decade. The North Atlantic box warmed by 0.24°C per decade. The paired annual record puts the difference at 0.45°C per decade, with a 95% confidence interval of 0.29 to 0.61°C per decade.

![Annual regional temperature anomalies](../results/temperature.png)

## How to read the lines

Zero is the 1951–1980 reference for each region. Each point represents one calendar year. For example, in 2015 the Arctic was 2.02°C above its reference and the Atlantic box was 0.82°C below its own. That cold Atlantic year sits within an overall warming trend for this box and period.

| Region or comparison | Temperature trend (°C per decade) | 95% interval |
| --- | ---: | ---: |
| Arctic | +0.69 | +0.59 to +0.79 |
| North Atlantic box | +0.24 | +0.09 to +0.38 |
| Arctic minus North Atlantic box | +0.45 | +0.29 to +0.61 |

## Region and data choices

The Arctic cap spans 66–90°N across all longitudes. The 66°N edge of NASA’s grid is close to the Arctic Circle at about 66.5°N. The cap includes both land and ocean. [NSIDC Arctic definitions](https://nsidc.org/learn/parts-cryosphere/arctic-weather-and-climate)

The North Atlantic box spans 50–60°N and 50–30°W. We chose this offshore area south of Greenland before reading the trends. It covers 50 grid cells and represents a specific part of the basin. Research on the subpolar Atlantic gives context for asking how surface temperatures evolve there. Differences in region, season or study period can change the result. [Seasonal changes in the North Atlantic cold anomaly](https://doi.org/10.1029/2019JC015379)

We used NASA’s GISTEMP v4 Land–Ocean Temperature Index on its 2° grid with 1,200 km smoothing. It combines air temperatures over land with sea surface temperatures over open water. The grid already contains monthly anomalies relative to 1951–1980. The November 10, 2026 source file was accessed on November 14, 2026. [GISTEMP Team, NASA GISS](https://data.giss.nasa.gov/gistemp/) · [Lenssen et al., 2024](https://doi.org/10.1029/2023JD040179)

## Calculation and uncertainty

Each monthly average weights valid cells by area using the cosine of latitude. This matters in the Arctic, where the grid cells get narrower toward the pole. We required values for at least 80% of each region’s area in every month and all 12 months in a year. All 552 months passed in both regions. Complete grid coverage includes NASA’s estimates between measurements. [NASA’s explanation of the grid](https://data.giss.nasa.gov/gistemp/faq/)

We fitted a straight line to each series and to their difference in the same 46 years. The intervals use Newey–West standard errors with three annual lags, a finite-sample correction and a t critical value. They describe uncertainty in the fitted linear rates conditional on this GISTEMP series. They exclude additional uncertainty in the underlying NASA temperature estimates. Establishing the physical cause would require other evidence.

## Reproduce the chart

From the repository root, use Python 3.11. The first two commands install the recorded analysis environment. The download is about 25 MB.

```sh
python3.11 -m venv .venv
.venv/bin/python -m pip install -r analysis/requirements.txt
mkdir -p raw
curl -fL --retry 3 -o raw/gistemp.nc.gz https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz
shasum -a 256 raw/gistemp.nc.gz
gzip -dc raw/gistemp.nc.gz > raw/gistemp.nc
.venv/bin/python analysis/temperature.py
.venv/bin/python analysis/check_temperature.py
```

The SHA-256 of the compressed NASA file for this chart is `f7788db9044d0f0e3f9561ad5d0fd82e59cdfdb82ea8a10244f78f2cb032a3c7`. NASA updates the file monthly and may revise earlier estimates. The exact downloaded file is retained in the project’s local raw data folder.

The second script reads the packed temperature values with a separate NetCDF reader, calculates the area of each latitude band from its edges, and checks the exported means and slopes. A known rise of 0.30°C per decade checks the time and unit conversion.

[Annual data and coverage](../results/annual-temperatures.csv) · [Trend estimates and confidence intervals](../results/trends.csv)

## Explore a grid cell

[Open the temperature map](https://ompatnaik.com/Dipole/). Click the map, move with the arrow keys, or enter coordinates. The marker and outlined box identify the selected cell. The Chennai preset selects the coastal grid cell containing the city. Each location covers two degrees in both latitude and longitude.

Of 16,200 cells, 15,805 have all 46 complete calendar years. The map reports a rate for these cells using the same trend fit as the regional analysis. Multiplying the rate and its interval by 4.5 gives the **fitted** change over the 45 years between 1980 and 2025. These pointwise intervals describe the selected cell. The map color shows rate alone. At cells with gaps the chart and table show the available complete years.

### Comparing two periods with the global record

The explorer also covers 1900–2025. In each view, the relative trend is the fitted slope of the annual local anomaly minus the annual global anomaly. Its interval uses the same fit on that difference. The history chart shows both original annual series and the local fitted line.

For the longer period, 11,794 cells have complete histories. The North Atlantic region meets the coverage rule in all 126 years. The Arctic meets it in 111 years. Its last gap is 1920, so the Arctic trend and its global reference both use the continuous record from 1921 through 2025. The chart retains the earlier annual values that meet the coverage rule.

To rebuild the explorer, download the NASA global table in addition to the grid above. The global table snapshot used here has SHA-256 `a7b1939db2e7e484c798e925e0f07f8184356c52ac0e7ce264adcd0f25e81253`.

```sh
curl -fL --retry 2 'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv' -o raw/global.csv
.venv/bin/python analysis/export_map.py
.venv/bin/python analysis/check_map.py
.venv/bin/python analysis/field_significance.py
.venv/bin/python analysis/check_significance.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

### Map-wide significance and interpolated cells

The map tests thousands of cells at once. We convert each cell's 95% interval back to its p-value (the interval comes from Newey–West standard errors and a t distribution with n − 2 degrees of freedom) and apply the Benjamini–Hochberg false discovery rate test at q = 0.05 across all complete cells. The test runs separately for each period and for local and relative trends. Cells that do not pass carry a dot. [Benjamini and Hochberg, 1995](https://doi.org/10.1111/j.2517-6161.1995.tb02031.x)

| Period | Map | Complete cells | Raw p < 0.05 | Pass FDR (q = 0.05) |
| --- | --- | ---: | ---: | ---: |
| 1980–2025 | Local trend | 15,805 | 12,279 | 12,118 |
| 1980–2025 | Local − global | 15,805 | 9,690 | 8,919 |
| 1900–2025 | Local trend | 11,794 | 11,531 | 11,527 |
| 1900–2025 | Local − global | 11,794 | 6,538 | 5,856 |

`check_significance.py` confirms the recovered p-values equal statsmodels' own, that the test matches statsmodels' `fdr_bh`, and runs a null simulation. On 2,000 trendless AR(1) series (46 years, lag-1 correlation 0.3), 263 pointwise tests fell below p = 0.05 and 27 passed the FDR test. Newey–West p-values with 46 years are therefore anti-conservative (about 13% false positives instead of 5%). The FDR step removes most chance flags, but single-cell intervals remain somewhat too narrow.

NASA's standard grid fills cells from stations up to 1,200 km away. To show where that matters, we used NASA's 250 km land-only grid. A land cell is hatched when the 250 km grid has a value in fewer than half of the period's months: 850 of 5,392 land cells for 1980–2025 and 1,049 for 1900–2025. Land means the cell centre lies inside the Natural Earth outline. Ocean cells use sea surface temperatures and are not hatched. The saved station-support mask is in `analysis/station_support_250km.json`. To recompute it, download the 250 km grid to `raw/gistemp250.nc` before running `field_significance.py`:

```sh
curl -fL -o raw/gistemp250.nc.gz https://data.giss.nasa.gov/pub/gistemp/gistemp250_GHCNv4.nc.gz
gzip -dc raw/gistemp250.nc.gz > raw/gistemp250.nc
```
