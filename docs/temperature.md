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
