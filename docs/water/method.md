# Rebuild the two-region India water comparison

Download the JPL RL06.3Mv04 CRI NetCDF from [NASA PO.DAAC](https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4). For the November 2026 snapshot, copy GRCTellus.JPL.200204_202609.GLO.RL06.3M.MSCNv04CRI.nc into raw/. NASA's published MD5 is 1567b9401ec2a704aab16598fcce5e70.

From the repository root with the analysis requirements installed, run

```sh
curl -fL https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson -o raw/ne_10m_admin_1.geojson
.venv/bin/python analysis/water.py raw/GRCTellus.JPL.200204_202609.GLO.RL06.3M.MSCNv04CRI.nc
```

The script writes both charts, the monthly CSV, the seasonal values and the global land map in this directory. It weights the area inside each region’s boundaries with 32 × 32 subdivisions per half-degree pixel. A separate check with 96 × 96 subdivisions agreed within 0.03 cm for every October and November in the snapshot.

The seasonal fit uses generalized least squares with annual AR(1) errors and actual calendar-year gaps. Restricted likelihood estimates correlation within −0.95 to +0.95. The 95% t interval conditions on that estimate. With 20 shared seasons, the northwest India estimate reaches the upper correlation bound. The table and monthly observations show the full series underlying the slope.

The map takes the October and November mean at each land location for every complete season. It uses NASA’s land mask and native measurement areas (mascons). The export checks that land cells sharing a mascon agree to within 0.001 cm, then stores one value per mascon rounded to 0.01 cm. The half-degree display grid preserves the original boundaries. The fixed palette spans −100 to +100 cm relative to the local 2004–2009 average. More extreme values use the endpoint colors and retain their values when inspected. An incomplete season appears in gray.

Madhya Pradesh (IN-MP) was selected before calculating its trend. It is a large inland neighbor of Rajasthan and shares the October–November post-monsoon window described in section 3.1 of the [Central Ground Water Board’s 2024 state assessment](https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1743585614534718415file.pdf). Both regions use their own area-weighted 2004–2009 reference and the same complete seasons. For the contrast, fit the annual northwest-minus-Madhya-Pradesh differences directly with the same GLS method. Each of the three fits estimates its own correlation. Their conditional intervals omit satellite and boundary uncertainty. Regional estimates may share some satellite signal near their border.
