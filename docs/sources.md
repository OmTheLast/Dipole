# Dipole submission sources

Copy the **Link Text** and **Link URL** into the matching section of the submission form. The last column records what each source contributed. Current milestone: the clickable global temperature map and two regional histories, 14 November 2026.

## NASA Data

| Link Text | Link URL | How Dipole used it |
| --- | --- | --- |
| JPL GRACE and GRACE-FO mascon water storage, RL06.3Mv04 CRI | https://doi.org/10.5067/TEMSC-3JC634 | Monthly water storage anomalies for the northwest India chart and global post-monsoon map. The land mask and mascon IDs locate each regional measurement. The source file spans April 2002 to September 2026. Retrieved 14 November 2026. |
| NASA JPL mascon user guide | https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/ | Documents the 2004–2009 reference average, spatial resolution, processing and optional gain factors. |
| NASA GISS Surface Temperature Analysis (GISTEMP v4) | https://data.giss.nasa.gov/gistemp/ | Primary dataset. We used monthly surface temperature anomalies to calculate annual regional and grid-cell averages and warming rates for the 1900–2025 and 1980–2025 views. Accessed 14 November 2026. |
| NASA GISTEMP global annual land–ocean temperature anomalies | https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv | The January–December global mean supplies the reference history. Local and global trends use matching years. Accessed 14 November 2026. |
| NASA GISTEMP v4 data downloads | https://data.giss.nasa.gov/gistemp/data_v4.html | Identifies the 2° Land–Ocean Temperature Index grid with 1,200 km smoothing. |
| NASA GISTEMP v4 Land–Ocean Temperature Index, monthly NetCDF file | https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz | The file used for the chart. NASA generated this snapshot on 10 November 2026. The link updates as NASA revises the data. |
| NASA GISTEMP v4 land-only analysis with 250 km smoothing, monthly NetCDF file | https://data.giss.nasa.gov/pub/gistemp/gistemp250_GHCNv4.nc.gz | Hatches land cells where the 250 km grid has data in fewer than half the months of the selected period. Accessed 14 November 2026. |
| NASA GISTEMP frequently asked questions | https://data.giss.nasa.gov/gistemp/faq/ | Explains the reference period, how NASA combines land and ocean measurements, and how it estimates values between observations. |
| Lenssen et al. (2024), A GISTEMPv4 observational uncertainty ensemble | https://doi.org/10.1029/2023JD040179 | NASA’s companion citation for GISTEMP v4. Our chart reports uncertainty calculated from the annual trends. |

## Space Agency Partner & Other Data

| Link Text | Link URL | How Dipole used it |
| --- | --- | --- |
| National Snow and Ice Data Center, Arctic Weather and Climate | https://nsidc.org/learn/parts-cryosphere/arctic-weather-and-climate | Geographic basis for approximating the Arctic Circle with the grid edge at 66°N. |
| Rantanen et al. (2022), The Arctic has warmed nearly four times faster than the globe since 1979 | https://doi.org/10.1038/s43247-022-00498-3 | Research precedent for the Arctic boundary. Dipole calculated its own rate against a different comparison region. |
| Allan et al., Seasonal Changes in the North Atlantic Cold Anomaly | https://doi.org/10.1029/2019JC015379 | Scientific context for investigating surface temperatures south of Greenland. |
| Molodtsov et al., North Atlantic temperature and salinity changes | https://doi.org/10.1038/s41612-025-01210-w | Background for studying the subpolar latitude band. Dipole selected its own longitude limits. |
| Natural Earth, 1:10m state and province boundaries v5.1.2 | https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson | Delineates Rajasthan, Punjab, Haryana and Delhi for the regional water-storage average and outlines the four areas on the water map. |
| Rodell et al. (2009), Satellite-based estimates of groundwater depletion in India | https://doi.org/10.1038/nature08238 | Defines the four-area study region. Dipole estimates total water storage. |
| Gravity Toolkit mission-month documentation | https://gravity-toolkit.readthedocs.io/en/stable/api_reference/time.html | Identifies shifted observation dates for the December 2011 and May 2015 nominal mission months. |
| Natural Earth, 1:110m land polygons | https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson | Public-domain coastline geometry used to orient visitors on the clickable world map. Retrieved 14 November 2026. |
| European Commission, GHS-POP R2023A, 2020 residential population | https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php | Counts of estimated residents at 30 arc-seconds, summed into Dipole’s 2° cells. Retrieved 14 November 2026. |
| Natural Earth, 1:10m country boundaries v5.1.2 | https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_admin_0_countries.geojson | India’s mapped boundary selects population pixels by their centres, including in cross-border temperature cells. |
| Rasterio | https://rasterio.readthedocs.io/ | Read the population raster and applied the country boundary on its native grid. |
| Schibsted Grotesk typeface, SIL Open Font License 1.1 | https://github.com/schibsted/schibsted-grotesk | The site's only typeface, self-hosted in docs/fonts from the Fontsource package. |
| Python | https://www.python.org/ | Ran the analysis and verification scripts. |
| Unidata netCDF4 for Python | https://unidata.github.io/netcdf4-python/ | Read NASA’s monthly grid, dates and missing values. |
| NumPy | https://numpy.org/ | Calculated area-weighted regional averages and annual differences. |
| statsmodels | https://www.statsmodels.org/ | Fitted temperature trends and estimated confidence intervals that account for similarities between nearby years. |
| SciPy | https://scipy.org/ | Independently read the source grid and checked the trend calculations. |
| Matplotlib | https://matplotlib.org/ | Drew the two-line chart from Dipole’s annual data. |

## AI use and planning references

AI tools assisted with planning, analysis code, numerical checks, and documentation. [OpenAI Codex](https://openai.com/codex/) · [Anthropic Claude](https://claude.ai/) · [Project workflows](https://github.com/NakliTechie/ntkit)

OpenAI Codex helped write the project README and captured its animated timeline from the explorer’s yearly temperature maps. [Playwright](https://playwright.dev/) drove the year slider and [FFmpeg](https://ffmpeg.org/) encoded the frames as a GIF. The regional chart and rates come from the project’s own GISTEMP analysis.

The team used the official challenge brief to define the four questions the product should answer and the event page to plan submission. [Challenge brief](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/) · [Event and submission instructions](https://www.spaceappschallenge.org/2026/)

## Updating the log

Add every new source when it first contributes to the project. Record its public URL and its specific use, including any reused code, text or image. For changing datasets, also record the version and access date. Add proposed datasets when they actually supply a project result.
