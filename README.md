<h1 align="center">Dipole</h1>

**Dipole is a 2026 NASA Space Apps hackathon project that lets you pick a place on a world map and see how its warming compares with the global average.**

[Open the temperature explorer](https://ompatnaik.com/Dipole/) and, once the map loads, choose **Arctic amplification**. From 1980 to 2025, the Arctic warmed by 0.69 °C per decade, compared with 0.21 °C per decade worldwide.

The explorer runs in a browser, with no account or download. Each map cell covers 2° of latitude and longitude.

[![Dipole’s world map with the Arctic selected. Beside it, the Arctic and global temperature histories show a widening gap from 1980 to 2025.](docs/images/temperature-explorer.png)](https://ompatnaik.com/Dipole/)

## Why compare places?

A global average tells you how fast the planet warmed. It can’t tell you whether the ocean south of Greenland warmed at the same pace as the Arctic. For the Space Apps challenge [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/), the team used NASA observations to measure that difference and show how certain the estimate is.

## What the team found

![Lines showing annual surface temperatures in the Arctic and the study area south of Greenland, relative to each region’s 1951–1980 average.](results/temperature.png)

Both regions warmed from 1980 to 2025. In NASA’s GISTEMP v4 data, the Arctic warmed by **0.69 °C per decade** and the ocean study area south of Greenland by **0.24 °C per decade**. The difference was **0.45 °C per decade** (95% confidence interval: 0.29 to 0.61 °C per decade). The interval describes the fitted difference over those 46 years.

[Annual temperatures used in the chart](results/annual-temperatures.csv) · [Rates and confidence intervals](results/trends.csv) · [Reproduce the chart](docs/temperature.md#reproduce-the-chart)

## Explore another place

- **Temperature:** Choose **Cell near Chennai** or click the map. Switch between **Local trend** and **Relative to global** to see why a place that warmed can still appear blue: it warmed more slowly than the world.
- **Population:** Below the map, compare India with the world. The table estimates how many people lived in faster-warming cells in 2020, and how many lived in cells without a complete temperature record.
- **Water:** Open [Water after the monsoon](https://ompatnaik.com/Dipole/water/) and switch between **2021** and **2025**. NASA’s GRACE satellites track changes in total water stored across northwest India, including water in soil, rivers and underground.

## Verify it yourself

From a clone, run the map locally with Python 3 and open [localhost:8743](http://localhost:8743/):

```sh
python3 -m http.server 8743 --bind 127.0.0.1 --directory docs
```

To reproduce the chart, follow the [Python 3.11 setup and NASA data download](docs/temperature.md#reproduce-the-chart), then run these commands from the repository root:

```sh
.venv/bin/python analysis/temperature.py        # Rebuild the chart and its data tables
.venv/bin/python analysis/check_temperature.py  # Check the results against the NASA grid
```

On the November 2026 data snapshot, the independent check matched all 92 annual regional averages and all three warming rates and confidence intervals.

## Team and sources

Om Patnaik built the regional temperature analysis and clickable map. [vihaanvajpeyi](https://github.com/vihaanvajpeyi) added the guided findings, map color scales and hatched lines that mark areas with limited weather station coverage. The project uses temperature data from NASA GISS, water observations from NASA JPL and population estimates from the European Commission.

[Temperature methods](docs/temperature.md) · [Water storage methods](docs/water/method.md) · [Data credits and AI use](docs/sources.md) · [Hackathon build plan](docs/build-plan.md)
