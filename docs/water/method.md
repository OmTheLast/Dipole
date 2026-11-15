# Rebuild the regional water comparison

Download the JPL RL06.3Mv04 CRI NetCDF from [NASA PO.DAAC](https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4). For the November 2026 snapshot, copy GRCTellus.JPL.200204_202609.GLO.RL06.3M.MSCNv04CRI.nc into raw/. NASA's published MD5 is 1567b9401ec2a704aab16598fcce5e70.

From the repository root with the analysis requirements installed, run

```sh
curl -fL https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson -o raw/ne_10m_admin_1.geojson
.venv/bin/python analysis/water.py raw/GRCTellus.JPL.200204_202609.GLO.RL06.3M.MSCNv04CRI.nc
```

The selector pairs northwest India (Rajasthan, Punjab, Haryana and Delhi) with Madhya Pradesh or Uttar Pradesh. Each region uses its own 2004–2009 GRACE reference and the same October and November observations. The script weights the grid by area inside each boundary, using 32 × 32 subdivisions per half-degree pixel. It exports both regional histories, the monthly CSV, seasonal readings and global land map.

A seasonal comparison requires both months in both regions. In this snapshot, 20 of the 24 seasons from 2002 to 2025 qualify for either pair. The summary compares six shared seasons in 2004–2009 with eight in 2018–2025. These are descriptive differences. Missing seasons in 2015–2017 limit the timing we can infer. The northwest India straight-line fit is sensitive to the method and to year-to-year persistence.

The map takes the October and November mean at each land location for every complete season. It uses NASA’s land mask and native measurement areas (mascons). The export checks that land cells sharing a mascon agree to within 0.001 cm, then stores one value per mascon rounded to 0.01 cm. The half-degree display grid preserves the original boundaries. The fixed palette spans −100 to +100 cm relative to the local 2004–2009 average. More extreme values use the endpoint colors and retain their values when inspected. An incomplete season appears in gray.
