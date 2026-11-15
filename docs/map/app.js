"use strict";

const $ = id => document.getElementById(id);
const map = $("map");
const plot = $("plot");
const cols = 180, rows = 90;
const entry = new URLSearchParams(location.search);
let firstYear = entry.get("start") === "1980" ? 1980 : 1900;
let years, stride, mode = entry.get("mode") === "absolute" ? "absolute" : "relative", periods, period, land;
let byYear = entry.get("view") === "annual";
const linkedYear = Number(entry.get("year"));
let selectedYear = Number.isInteger(linkedYear) && linkedYear >= firstYear && linkedYear <= 2025 ? linkedYear : 2015, scrubFrame;
let fitLine, requestedYear = firstYear;
let activeCase = firstYear === 1900 ? "hole" : null;
const files = new Map();
const colors = [[33,89,129], [141,188,203], [243,238,219], [228,154,99], [164,57,47]];
let overlayCounts, significance;
const sigToggle = $("sigToggle");
sigToggle.checked = entry.get("crosses") === "1";
const testBit = () => mode === "relative" ? 2 : 1;
function crossesVisible() {
  return significance && !byYear && sigToggle.checked;
}
function cellSignificance(cell) {
  if (!Number.isFinite(cells[cell * stride])) return "Map-wide check: incomplete record.";
  return significance[cell] & testBit() ? "× Passes the map-wide check." : "Does not pass the map-wide check.";
}
function updateSignificanceKey() {
  sigToggle.disabled = byYear || !significance;
  let caption = "";
  if (byYear) caption = "Available in Trend view.";
  else if (!significance) caption = "Marker data unavailable for this period.";
  else if (sigToggle.checked) {
    const bit = testBit();
    const count = significance.reduce((sum, flag) => sum + Number(Boolean(flag & bit)), 0);
    const test = mode === "relative" ? "a difference from global warming" : "a local trend";
    caption = count.toLocaleString("en-US") + " of " + period.complete.toLocaleString("en-US") +
      " complete grid squares pass the check for " + test + " (5% false discovery rate).";
  }
  $("sigCaption").textContent = caption;
}
sigToggle.addEventListener("change", () => {
  updateSignificanceKey();
  if (selected) show(selected, false);
});
let population, cells, coverage, regions, base, selected, series, selectedBounds;
// Colour limits (°C/decade) chosen per view so that roughly the largest 2% of cells saturate.
// One fixed ±1 scale washed out the long-period differences, which are about ±0.1.
const limits = {absolute: {1980: 1, 1900: 0.3}, relative: {1980: 0.6, 1900: 0.15}};
const cases = {
  hole: {start: 1900, mode: "relative", region: "North Atlantic"},
  arctic: {start: 1980, mode: "relative", region: "Arctic"},
  recent: {start: 1900, mode: "relative", region: "Arctic"},
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function linkedPlace() {
  const lat = entry.get("lat"), lon = entry.get("lon");
  if (lat?.trim() && lon?.trim() && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180)
    return {cell:cellAt(Number(lat),Number(lon))};
  const region = entry.get("region");
  return ["Arctic", "North Atlantic"].includes(region) ? {region} : null;
}
const initialPlace = linkedPlace();
if (initialPlace || byYear || mode === "absolute") activeCase = null;
const finding = cases[entry.get("finding")];
if (finding && finding.start === firstYear && finding.region === initialPlace?.region && !byYear && mode === finding.mode)
  activeCase = entry.get("finding");
let privateLocationCell;
let saveTimer, lastSave = 0;
function saveView() {
  clearTimeout(saveTimer); saveTimer = undefined;
  if (!document.body.dataset.explorerReady || document.body.dataset.touring || !selected) return;
  const url = new URL(location.href), params = url.searchParams;
  params.delete("tour");
  for (const key of ["lat","lon","region","finding","year","country","layer","crosses"]) params.delete(key);
  if (selected.region) params.set("region", selected.region);
  else if (selected.cell !== privateLocationCell) {
    params.set("lat", 2 * Math.floor(selected.cell / cols) - 89);
    params.set("lon", 2 * (selected.cell % cols) - 179);
  }
  params.set("start", firstYear);
  params.set("view", byYear ? "annual" : "trend");
  params.set("mode", mode);
  if (byYear) params.set("year", selectedYear);
  if (activeCase) params.set("finding", activeCase);
  if ($("exposureCountry").value) params.set("country", $("exposureCountry").value);
  const layer = $("mapPopulation").value;
  if (layer) params.set("layer", layer === "world" ? "world" : "population");
  if (sigToggle.checked) params.set("crosses", "1");
  if (url.href !== location.href) history.replaceState(history.state,"",url);
  lastSave = performance.now();
}
function rememberView() {
  if (!document.body.dataset.explorerReady || document.body.dataset.touring) return;
  const delay = lastSave + 450 - performance.now();
  clearTimeout(saveTimer);
  if (delay > 0) saveTimer = setTimeout(saveView, delay);
  else saveView();
}
window.addEventListener("pagehide", () => { if (saveTimer) saveView(); });
const fmt = (n, digits = 2) => (n < 0 ? "−" : "+") + Math.abs(n).toFixed(digits);
function storyText(name) {
  const recent = periods[1980].regions, long = periods[1900].regions;
  if (name === "hole") {
    const sea = long["North Atlantic"];
    return "Since 1900, the ocean south of Greenland warmed by " + sea.stats[0].toFixed(2) +
      " °C per decade. The world warmed by " + sea.globalRate.toFixed(2) +
      " °C per decade. Switch to 1980–2025 to see whether that gap holds over the shorter record.";
  }
  const arctic = recent.Arctic;
  if (name === "arctic") return "Since 1980, the Arctic warmed at " +
    (arctic.stats[0] / arctic.globalRate).toFixed(1) + " times the global rate. Compare the Arctic and world lines in the chart.";
  return "The Arctic’s complete regional record starts in " + long.Arctic.fitStart +
    ". Over that longer period it warmed at " + (long.Arctic.stats[0] / long.Arctic.globalRate).toFixed(1) +
    " times the global rate. Switch to 1980–2025 to compare.";
}
const changeText = n => (n < 0 ? "−" : "+") + Math.abs(n).toFixed(2);
const latText = v => Math.abs(v) + "°" + (v > 0 ? "N" : v < 0 ? "S" : "");
const lonText = v => Math.abs(v) + "°" + (v > 0 ? "E" : v < 0 ? "W" : "");
// Paint the grid at its native resolution; reuse the coastline during scrubbing.
const gridImage = document.createElement("canvas");
gridImage.width = cols;
gridImage.height = rows;
const gridContext = gridImage.getContext("2d");
const pixels = gridContext.createImageData(cols, rows);
const palette = Array.from({length: 513}, (_, i) => {
  const position = i / 128;
  const segment = Math.min(3, Math.floor(position));
  return colors[segment].map((v, j) => Math.round(v + (position-segment)*(colors[segment+1][j]-v)));
});
const missingColor = [166,169,165];
let coastlines;

function mapField() {
  return byYear ? 6 + selectedYear - firstYear : (mode === "relative" ? 3 : 0);
}

function makeMap(land) {
  if (!base) {
    base = document.createElement("canvas");
    base.width = 1440;
    base.height = 720;
    coastlines = coastlineLayer(land);
  }
  const limit = byYear ? 3 : limits[mode][firstYear];
  const field = mapField();
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      const v = cells[(r*cols+c)*stride + field];
      const rgb = Number.isFinite(v) ? palette[Math.round((clamp(v / limit, -1, 1) + 1) * 256)] : missingColor;
      const offset = ((rows-1-r)*cols+c)*4;
      pixels.data.set(rgb, offset);
      pixels.data[offset+3] = 255;
    }
  }
  gridContext.putImageData(pixels, 0, 0);
  const ctx = base.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(gridImage, 0, 0, base.width, base.height);
  if (!byYear && coverage) drawHatching(ctx);
  ctx.drawImage(coastlines, 0, 0);
}
// Hatching: land cells where NASA's 250 km grid has data in fewer than half the months.
function drawHatching(ctx) {
  const size = base.width / cols;
  ctx.strokeStyle = "rgba(24,36,33,.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = r*cols + c, x = c*size, y = (rows-1-r)*size;
      if (coverage[id] && Number.isFinite(cells[id*stride])) { ctx.moveTo(x, y + size); ctx.lineTo(x + size, y); }
    }
  }
  ctx.stroke();
}
function coastlineLayer(land) {
  const layer = document.createElement("canvas");
  layer.width = base.width;
  layer.height = base.height;
  const ctx = layer.getContext("2d");
  ctx.scale(4, 4);
  ctx.strokeStyle = "#374d50"; ctx.lineWidth = .24;
  for (const feature of land.features) {
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => {
          if (!i || Math.abs(lon-ring[i-1][0]) > 180) ctx.moveTo(lon+180, 90-lat);
          else ctx.lineTo(lon+180, 90-lat);
        });
      }
      ctx.stroke();
    }
  }
  return layer;
}
function contextFor(canvas) {
  const {width, height} = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(width*dpr));
  const pixelHeight = Math.max(1, Math.round(height*dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(canvas.width/width, 0, 0, canvas.height/height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return {ctx, width, height};
}
// Positions and viewport offsets are fractions of the full world image.
const viewport = {left: 0, top: 0, zoom: 1};
const maxZoom = 8;
const wrapWorld = x => x - Math.floor(x);
function positionView(left, top) {
  const limit = 1 - 1 / viewport.zoom;
  viewport.left = wrapWorld(left);
  viewport.top = clamp(top, 0, limit);
}
function drawMap(bounds) {
  const {ctx, width:w, height:h} = contextFor(map);
  const {left, top, zoom} = viewport;
  ctx.imageSmoothingEnabled = false;
  const copies = left + 1 / zoom > 1 ? [left, left-1] : [left];
  for (const origin of copies) {
    ctx.drawImage(base, -origin*w*zoom, -top*h*zoom, w*zoom, h*zoom);
  }
  for (const origin of copies) {
    if (overlayCounts) drawPopulation(ctx, w, h, origin);
    if (crossesVisible()) drawCrosses(ctx, w, h, origin);
    drawSelection(ctx, bounds, w, h, origin, top, zoom);
  }
}
function drawSelection(ctx, bounds, w, h, left, top, zoom) {
  const [s,n,west,east] = bounds;
  const x=((west+180)/360-left)*w*zoom, y=((90-n)/180-top)*h*zoom;
  const bw=(east-west)*w*zoom/360, bh=(n-s)*h*zoom/180;
  ctx.fillStyle="rgba(28,59,55,.12)";
  ctx.fillRect(x,y,bw,bh);
  ctx.strokeStyle="white"; ctx.lineWidth=4; ctx.strokeRect(x,y,bw,bh);
  ctx.strokeStyle="#183c35"; ctx.lineWidth=1.6; ctx.strokeRect(x,y,bw,bh);
  if (selected.cell !== undefined) {
    ctx.beginPath(); ctx.arc(x+bw/2,y+bh/2,8,0,2*Math.PI);
    ctx.strokeStyle="white"; ctx.lineWidth=4; ctx.stroke();
    ctx.strokeStyle="#183c35"; ctx.lineWidth=1.8; ctx.stroke();
  }
}
function drawCrosses(ctx, width, height, left) {
  const cellWidth = width * viewport.zoom / cols, cellHeight = height * viewport.zoom / rows;
  const size = Math.min(cellWidth, cellHeight);
  const arm = Math.min(2.5, size * .17);
  const bit = testBit();
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    // Upper-right of the cell, leaving its centre for the population dot.
    const y = ((rows - row - .80) / rows - viewport.top) * height * viewport.zoom;
    if (y < -arm || y > height + arm) continue;
    for (let col = 0; col < cols; col++) {
      if (!(significance[row * cols + col] & bit)) continue;
      const x = ((col + .80) / cols - left) * width * viewport.zoom;
      if (x < -arm || x > width + arm) continue;
      ctx.moveTo(x - arm, y - arm); ctx.lineTo(x + arm, y + arm);
      ctx.moveTo(x - arm, y + arm); ctx.lineTo(x + arm, y - arm);
    }
  }
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = Math.min(2.4, size * .22); ctx.stroke();
  ctx.strokeStyle = "#372042"; ctx.lineWidth = Math.min(1.25, size * .12); ctx.stroke();
}
function drawPopulation(ctx, width, height, left) {
  const cellWidth = width * viewport.zoom / cols;
  const cellHeight = height * viewport.zoom / rows;
  const scale = Math.min(cellWidth, cellHeight, 18);
  ctx.fillStyle = "#17283b";
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = Math.min(1, scale * .09);
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    const y = ((rows - row - .5) / rows - viewport.top) * height * viewport.zoom;
    if (y < -scale || y > height + scale) continue;
    for (let col = 0; col < cols; col++) {
      const count = overlayCounts[row * cols + col];
      if (!count) continue;
      const x = ((col + .5) / cols - left) * width * viewport.zoom;
      if (x < -scale || x > width + scale) continue;
      const fraction = count >= 1e7 ? .44 : count >= 1e6 ? .32 : count >= 1e5 ? .22 : .11;
      const radius = Math.max(.45, scale * fraction);
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
    }
  }
  ctx.fill();
  ctx.stroke();
}

function overlayReading(cell) {
  const scope = $("mapPopulation").selectedOptions[0].textContent;
  return "2020 residents (" + scope + "): " + (overlayCounts[cell] || 0).toLocaleString("en-US");
}

function setPopulationLayer(scope) {
  $("mapPopulation").value = scope;
  $("populationKey").hidden = !scope;
  const isCountry = scope && scope !== "world";
  overlayCounts = isCountry ? population.countryCells[scope] : scope ? population.cellResidents : null;
  if (isCountry) {
    $("exposureCountry").value = scope;
    showExposure();
    // Start at an inhabited cell even for island and overseas territories.
    const entries = Object.entries(overlayCounts);
    if (entries.length) {
      const [cell] = entries.reduce((a, b) => a[1] >= b[1] ? a : b);
      show({cell: Number(cell)}, false);
      setZoom(4);
      positionView((Number(cell) % cols + .5) / cols - .5 / viewport.zoom,
        1 - (Math.floor(Number(cell) / cols) + .5) / rows - .5 / viewport.zoom);
    }
  } else if (scope === "world") {
    setZoom(1);
  }
  $("layerCaption").textContent = "";
  if (scope) {
    const name = $("mapPopulation").selectedOptions[0].textContent;
    $("layerCaption").textContent = "Dots show estimated 2020 residents in each 2° grid square (" + name +
      "). Larger dots mean more people. The background shows temperature.";
  }
  tip.hidden = true;
  show(selected, false);
}

$("mapPopulation").addEventListener("change", event => setPopulationLayer(event.target.value));
$("showCountryLayer").addEventListener("click", () => {
  setPopulationLayer($("exposureCountry").value);
  document.querySelector(".layers").open = true;
  $("mapPopulation").focus();
  $("populationMap").scrollIntoView();
});

function drawSeries(values) {
  const {ctx, width:w, height:h} = contextFor(plot);
  const valid = [...values, ...period.series, ...(fitLine?.values || [])].filter(Number.isFinite);
  const lo=Math.floor(Math.min(0,...valid)), hi=Math.max(lo+1,Math.ceil(Math.max(0,...valid)));
  const left=29,right=w-8,top=12,bottom=h-19;
  const y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  ctx.font='12px "Schibsted Grotesk", sans-serif';ctx.fillStyle="#56697b";ctx.textAlign="right";
  for (const tick of new Set([lo,0,hi])) {
    ctx.fillText(tick,left-5,y(tick)+3);ctx.beginPath();ctx.moveTo(left,y(tick));ctx.lineTo(right,y(tick));
    ctx.strokeStyle=tick===0?"#8a9cab":"#e1e8ed";ctx.lineWidth=1;ctx.stroke();
  }
  function line(points, color, dashed = false) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 2.2 : 1.6;
    ctx.setLineDash(dashed ? [5, 3] : []);
    points.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      const x = left + i / (years - 1) * (right - left);
      if (!i || !Number.isFinite(points[i - 1])) ctx.moveTo(x, y(v));
      else ctx.lineTo(x, y(v));
    });
    ctx.stroke();
  }
  line(period.series, "#d0794f");
  line(values, "#1d5f86");
  if (fitLine) line(fitLine.values, "#12263a", true);
  ctx.setLineDash([]);
  if (byYear) {
    const index = selectedYear - firstYear;
    const x = left + index / (years - 1) * (right - left);
    ctx.strokeStyle = "#505952";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,bottom); ctx.stroke();
    for (const [v, color] of [[period.series[index], "#d0794f"], [values[index], "#1d5f86"]]) {
      if (!Number.isFinite(v)) continue;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y(v),4,0,2*Math.PI); ctx.fill();
    }
    ctx.fillStyle = "#12263a";
    ctx.textAlign = "center";
    ctx.fillText(String(selectedYear),clamp(x,left+14,right-14),top-2);
  }
  ctx.textAlign="left";ctx.fillText(String(firstYear),left,h-2);
  ctx.textAlign="right";ctx.fillText("2025",right,h-2);
}
function show(selection, reveal = true) {
  if (!cells) return;
  selected = selection;
  tip.hidden = true;
  if (activeCase && selection.region !== cases[activeCase].region) {
    activeCase = null;
    for (const button of $("cases").querySelectorAll("button")) button.setAttribute("aria-pressed", "false");
    $("story").hidden = true;
  }
  let stats, relative, bounds, name, fitStart = firstYear, globalRate = period.stats[0];
  if (selection.region) {
    ({stats, relative, bounds, series, fitStart, globalRate} = regions[selection.region]); name=selection.region;
  } else {
    const id=selection.cell, row=Math.floor(id/cols), col=id%cols;
    const south=-90+2*row, west=-180+2*col;
    bounds=[south,south+2,west,west+2];
    stats=cells.subarray(id*stride,id*stride+3);
    relative=cells.subarray(id*stride+3,id*stride+6);
    series=cells.subarray(id*stride+6,(id+1)*stride);
    name=latText(south+1)+" · "+lonText(west+1);
    $("coords").elements.lat.value=south+1;
    $("coords").elements.lon.value=west+1;
  }
  $("cellResidents").textContent = population && selection.cell !== undefined
    ? "Estimated 2020 residents in this grid square: " + population.cellResidents[selection.cell].toLocaleString("en-US")
    : "";
  if (overlayCounts && selection.cell !== undefined) $("cellResidents").textContent = overlayReading(selection.cell);
  $("cellSig").textContent = crossesVisible() && selection.cell !== undefined ? cellSignificance(selection.cell) : "";
  selectedBounds=bounds;
  if (reveal && viewport.zoom > 1) {
    const centerX = ((bounds[2] + bounds[3]) / 2 + 180) / 360;
    const centerY = (90 - (bounds[0] + bounds[1]) / 2) / 180;
    const span = 1 / viewport.zoom;
    if (wrapWorld(centerX - viewport.left) > span ||
        centerY < viewport.top || centerY > viewport.top + span)
      positionView(centerX - span / 2, centerY - span / 2);
  }
  const [s,n,west,east]=bounds;
  if (selection.region) $("coords").reset();
  $("name").textContent=name;
  $("kind").textContent=selection.region?"Region average":"Grid square";
  const matchingCity = [...$("city").options].find(option => {
    if (!option.value || selection.cell === undefined) return false;
    const [lat,lon] = option.value.split(",").map(Number);
    return cellAt(lat,lon) === selection.cell;
  });
  $("city").value = matchingCity?.value || "";
  $("bounds").textContent=latText(s)+"–"+latText(n)+" · "+(east-west===360?"All longitudes":lonText(west)+"–"+lonText(east));
  if (byYear) {
    fitLine = null;
    showAnnualDetails();
  } else {
    showTrendDetails(stats, relative, fitStart, globalRate, selection.cell);
  }
  for (const button of $("presets").querySelectorAll("[data-region]")) {
    button.setAttribute("aria-pressed",String(selection.region === button.dataset.region));
  }
  $("annual").replaceChildren(...Array.from(series,(v,i)=>{
    const row=document.createElement("tr");
    row.insertCell().textContent=firstYear+i;row.insertCell().textContent=Number.isFinite(v)?changeText(v):"Missing";
    row.insertCell().textContent=changeText(period.series[i]);
    return row;
  }));
  plot.setAttribute("aria-label","Annual anomalies for "+name+". Values available in the table below.");
  updateMapReading();
  drawMap(bounds); drawSeries(series);
  if (reveal && window.matchMedia("(max-width:640px)").matches)
    $("mapReading").scrollIntoView({block:"nearest", behavior:"instant"});
}
function updateMapReading() {
  $("mapReading").hidden = false;
  $("readingPlace").textContent = selected.region || ($("city").value ? $("city").selectedOptions[0].textContent + " · " : "Grid square · ") + $("name").textContent;
  let reading;
  if (byYear) {
    const value = series[selectedYear - firstYear];
    reading = Number.isFinite(value) ? (value === 0 ? selectedYear + " matched the 1951–1980 average here." :
      selectedYear + " was " + Math.abs(value).toFixed(2) + " °C " + (value > 0 ? "warmer" : "cooler") + " than the 1951–1980 average here.") : "There are too few observations for " + selectedYear + ".";
  } else {
    const offset = mode === "relative" ? 3 : 0;
    const place = selected.region && regions[selected.region];
    const stats = place ? (offset ? place.relative : place.stats) : cells.subarray(selected.cell * stride + offset, selected.cell * stride + offset + 3);
    const span = (place ? place.fitStart : firstYear) + "–" + period.end;
    if (!stats || !Number.isFinite(stats[0])) reading = "There are too few complete years to estimate a trend here.";
    else if (offset) {
      const local = place ? place.stats[0] : cells[selected.cell * stride];
      if (stats[1] > 0) reading = "This place warmed faster than the world over " + span + ".";
      else if (stats[2] < 0) reading = local >= 0
        ? "This place warmed more slowly than the world over " + span + "."
        : "The estimated local temperature fell while the world warmed over " + span + ".";
      else reading = "Over " + span + ", the observations are too uncertain to tell whether this place warmed faster or slower than the world.";
    } else reading = "Over " + span + ", " + (stats[1] > 0 ? "this place warmed." : stats[2] < 0 ? "this place cooled." : "the direction of temperature change is uncertain.");
  }
  $("readingText").textContent = reading;
  $("detailAnswer").textContent = reading;
  rememberView();
}
function showAnnualDetails() {
  const i = selectedYear - firstYear;
  const value = series[i];
  const available = Number.isFinite(value);
  $("coverage").textContent = "";
  $("metricLabel").textContent = selectedYear + " · difference from the 1951–1980 average";
  $("change").textContent = available ? changeText(value) + " °C" : "Missing estimate";
  $("change").style.color = available && value < 0 ? "#215981" : "";
  $("rate").textContent = "";
  $("reference").textContent = "World temperature difference from its 1951–1980 average: " + changeText(period.series[i]) + " °C";
  $("interval").textContent = "";
  $("explain").textContent = available ? "" : "Too little coverage for an annual estimate here.";
  $("sparse").textContent = "";
}
function showTrendDetails(stats, relative, fitStart, globalRate, cell) {
  const showGap = mode === "relative";
  const [rate, low, high] = (showGap ? relative : stats) || [];
  const valid = Number.isFinite(rate);
  const count = [...series].filter(Number.isFinite).length;
  const fitPeriod = fitStart + "–" + period.end;
  $("coverage").textContent = count + " of " + years + " annual estimates available." +
    (valid && fitStart !== firstYear ? " Continuous record used for both trends: " + fitPeriod + "." : "");
  $("metricLabel").textContent = showGap ? "Difference from the global warming rate" : "Estimated local change" + (valid ? " · " + fitPeriod : "");
  const scale = showGap ? 1 : (period.end - fitStart) / 10;
  const units = showGap ? " °C/decade" : " °C";
  $("change").textContent = valid ? changeText(rate * scale) + units : "Incomplete record";
  $("change").style.color = valid && rate < 0 ? "#215981" : "";
  $("rate").textContent = valid ? "Local trend: " + changeText(stats[0]) + " °C/decade." : "";
  $("reference").textContent = "Global trend · " + (valid ? fitPeriod : firstYear + "–" + period.end) +
    ": " + changeText(valid ? globalRate : period.stats[0]) + " °C/decade.";
  $("interval").textContent = valid ? "95% interval: " + changeText(low*scale) + " to " + changeText(high*scale) + units + "." : "";
  let interpretation = "The record is incomplete for this period.";
  if (valid && showGap) {
    interpretation = low > 0 ? "The fitted interval suggests faster warming than the world." :
      high < 0 ? "The fitted interval suggests slower warming than the world." : "The 95% interval includes zero, so the observations cannot distinguish the two warming rates.";
  } else if (valid) {
    interpretation = low > 0 ? "The fitted interval suggests warming here." :
      high < 0 ? "The fitted interval suggests cooling here." : "The interval includes zero. The direction is uncertain.";
  }
  $("explain").textContent = interpretation;
  $("sparse").textContent = cell !== undefined && coverage[cell] ?
    "NASA’s 250 km grid has data here in fewer than half the months." : "";
  fitLine = null;
  if (valid) {
    const offset = fitStart - firstYear;
    const fitValues = series.slice(offset);
    const mean = fitValues.reduce((sum, v) => sum + v, 0) / fitValues.length;
    const middle = (fitStart + period.end) / 2;
    fitLine = {values: Array.from(series, (_, i) => i < offset ? null : mean + stats[0] * (firstYear + i - middle) / 10)};
  }
}
function cellAt(lat,lon) {
  return clamp(Math.floor((lat+90)/2),0,rows-1)*cols+clamp(Math.floor((lon+180)/2),0,cols-1);
}
const tip = $("cellTip");
let drag = null;
function setZoom(zoom, x = 0.5, y = 0.5) {
  if (!selectedBounds) return;
  const oldZoom = viewport.zoom;
  viewport.zoom = clamp(zoom, 1, maxZoom);
  const delta = 1 / oldZoom - 1 / viewport.zoom;
  positionView(viewport.left + x * delta, viewport.top + y * delta);
  map.classList.toggle("zoomed", viewport.zoom > 1);
  $("zoomLevel").textContent = Number(viewport.zoom.toFixed(1)) + "×";
  $("zoomOut").disabled = viewport.zoom === 1;
  $("worldView").disabled = viewport.zoom === 1 && viewport.left === 0;
  $("zoomIn").disabled = viewport.zoom === maxZoom;
  tip.hidden = true;
  drawMap(selectedBounds);
}
$("zoomIn").onclick = () => {
  const [south, north, west, east] = selectedBounds;
  const x = wrapWorld(((west + east) / 2 + 180) / 360 - viewport.left) * viewport.zoom;
  const y = ((90 - (south + north) / 2) / 180 - viewport.top) * viewport.zoom;
  const visible = x >= 0 && x <= 1 && y >= 0 && y <= 1;
  setZoom(viewport.zoom * 2, visible ? x : 0.5, visible ? y : 0.5);
};
$("zoomOut").onclick = () => setZoom(viewport.zoom / 2);
$("worldView").onclick = () => {
  setZoom(1);
  positionView(0,0);
  $("worldView").disabled = true;
  drawMap(selectedBounds);
};

function pointerCell(event, rect) {
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  return cellAt(90 - 180 * (viewport.top + y / viewport.zoom),
    -180 + 360 * wrapWorld(viewport.left + x / viewport.zoom));
}
function hoverCell(event, rect) {
  const cell = pointerCell(event, rect);
  const value = cells[cell * stride + mapField()];
  const lat = -89 + 2 * Math.floor(cell / cols), lon = -179 + 2 * (cell % cols);
  let reading = $("missingLabel").textContent;
  if (Number.isFinite(value)) {
    if (!byYear && mode === "relative") {
      const local = cells[cell * stride];
      const magnitude = rate => Math.abs(rate) < 0.005 ? "less than 0.01" : Math.abs(rate).toFixed(2);
      const localReading = local === 0 ? "No estimated local change." :
        "This square " + (local > 0 ? "warmed" : "cooled") + " by " + magnitude(local) + " °C per decade.";
      const gap = value === 0 ? "The local rate matched the world’s." :
        "Its rate was " + magnitude(value) + " °C per decade " + (value > 0 ? "above" : "below") + " the world’s rate.";
      reading = localReading + "\n" + gap;
    } else {
      reading = byYear ? selectedYear + " anomaly  " + fmt(value) + " °C" : "Local trend  " + fmt(value) + " °C/decade";
    }
  }
  tip.textContent = latText(lat) + " · " + lonText(lon) + "\n" + reading;
  if (crossesVisible()) tip.textContent += "\n" + cellSignificance(cell);
  if (overlayCounts) tip.textContent += "\n" + overlayReading(cell);
  tip.hidden = false;
  tip.style.left = clamp(event.clientX - rect.left + 12, 0, rect.width - tip.offsetWidth) + "px";
  tip.style.top = clamp(event.clientY - rect.top + 12, 0, rect.height - tip.offsetHeight) + "px";
}
map.addEventListener("wheel", event => {
  if (!selectedBounds || !event.deltaY) return;
  event.preventDefault();
  const rect = map.getBoundingClientRect();
  setZoom(viewport.zoom * Math.exp(-clamp(event.deltaY * (event.deltaMode === 1 ? 16 : 1), -300, 300) * .004),
    (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
}, {passive: false});
map.addEventListener("pointerdown", event => {
  if (!cells || !event.isPrimary || event.button !== 0) return;
  tip.hidden = true;
  drag = {id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.left, top: viewport.top, moved: false};
  map.setPointerCapture(event.pointerId);
});
map.addEventListener("pointermove", event => {
  if (!cells || !event.isPrimary) return;
  const rect = map.getBoundingClientRect();
  if (!drag) {
    if (event.pointerType !== "touch") hoverCell(event, rect);
    return;
  }
  if (event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  $("worldView").disabled = false;
  map.classList.add("dragging");
  positionView(drag.left - dx / (rect.width * viewport.zoom), drag.top - dy / (rect.height * viewport.zoom));
  drawMap(selectedBounds);
});
map.addEventListener("pointerup", event => {
  if (drag?.id !== event.pointerId) return;
  const wasTap = !drag.moved;
  endDrag(event);
  if (wasTap) show({cell: pointerCell(event, map.getBoundingClientRect())});
});
function endDrag(event) {
  if (drag?.id !== event.pointerId) return;
  drag = null;
  map.classList.remove("dragging");
}
map.addEventListener("pointercancel", endDrag);
map.addEventListener("lostpointercapture", endDrag);
map.addEventListener("pointerleave", () => { tip.hidden = true; });
map.addEventListener("keydown",e=>{
  if (e.key === "Escape") tip.hidden = true;
  if (!selected || !["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) return;
  e.preventDefault();
  let id=selected.cell;
  if (id===undefined) {
    const [s,n,w,ea]=regions[selected.region].bounds;
    id=cellAt((n+s)/2,(w+ea)/2);
  }
  let r=Math.floor(id/cols), c=id%cols;
  r+=Number(e.key==="ArrowUp")-Number(e.key==="ArrowDown");
  c+=Number(e.key==="ArrowRight")-Number(e.key==="ArrowLeft");
  show({cell:clamp(r,0,rows-1)*cols+(c+cols)%cols});
});
$("cases").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || !cells) return;
  const story = cases[button.dataset.case];
  activeCase = button.dataset.case;
  byYear = false;
  mode = story.mode;
  selected = {region: story.region};
  // Always go through selectPeriod: it records this as the latest request, so a slower,
  // earlier load (e.g. 1980 for another preset) is ignored when it finishes.
  selectPeriod(story.start, true);
});
$("presets").addEventListener("click",e=>{
  const button = e.target.closest("[data-region]");
  if (button) show({region:button.dataset.region});
});
$("city").addEventListener("change", () => {
  if (!$("city").value) return;
  const [lat,lon] = $("city").value.split(",").map(Number);
  show({cell:cellAt(lat,lon)});
  $("mapReading").scrollIntoView({block:"nearest"});
});
$("coords").addEventListener("submit",e=>{
  e.preventDefault();
  show({cell:cellAt(+e.target.elements.lat.value,+e.target.elements.lon.value)});
});
new ResizeObserver(()=>{if (selectedBounds) drawMap(selectedBounds);}).observe($("map").parentElement);
new ResizeObserver(()=>{if (series) drawSeries(series);}).observe(plot);
async function get(file) {
  const response = await fetch("map/" + file);
  if (!response.ok) throw Error(file + " unavailable");
  return response;
}

function regionalTable() {
  $("timeHeading").textContent = byYear ? "Year" : "Years fitted";
  const starts = Object.values(regions).map(r => r.fitStart);
  const mixed = !byYear && new Set(starts).size > 1;
  const shortened = Object.entries(regions).filter(([, r]) => r.fitStart && r.fitStart !== firstYear);
  $("comparisonNote").textContent = mixed ? shortened.map(([name, r]) => "* " + name + " is fitted over " + r.fitStart + "–" +
    period.end + " because its record has a gap in " + (r.fitStart - 1) + ". Its global column uses the same years. " +
    "Rows with different years are not a like-for-like comparison.").join(" ") : "";
  $("comparisonCaption").textContent = byYear ? selectedYear + " temperatures in °C above or below the 1951–1980 average." : "Warming rates in °C per decade. Each row compares the region with the world over the same years.";
  $("comparison").replaceChildren(...Object.entries(regions).map(([name, region]) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = name;
    row.append(label);
    const i = selectedYear - firstYear;
    const local = region.series[i], global = period.series[i];
    const fitted = region.fitStart ? region.fitStart + "–" + period.end + (mixed && region.fitStart !== firstYear ? " *" : "") : "Incomplete";
    row.insertCell().textContent = byYear ? selectedYear : fitted;
    if (mixed && region.fitStart !== firstYear) row.classList.add("shortfit");
    const metrics = byYear ? [local, global, Number.isFinite(local) ? local-global : null]
      : [region.stats?.[0], region.globalRate, region.relative?.[0]];
    for (const value of metrics) {
      row.insertCell().textContent = Number.isFinite(value) ? changeText(value) : "—";
    }
    return row;
  }));
}

const people = new Intl.NumberFormat("en-US", {notation: "compact", maximumFractionDigits: 2});
function showExposure() {
  if (!population || !period) return;
  const groups = population.periods[firstYear];
  const code = $("exposureCountry").value;
  const name = population.countries[code];
  const country = groups.countries[code];
  $("exposureHeading").textContent = "Who lived in places warming faster than the world in " + firstYear + "–" + period.end + "?";
  $("exposureCaption").textContent = "Population is the 2020 estimate. Changing the temperature period changes which grid squares qualify.";
  rememberView();
  $("exposureData").hidden = false;
  const rows = [];
  for (const [label, counts] of [[name, country], ["World", groups.world]]) {
    const row = document.createElement("tr");
    const title = document.createElement("th");
    title.scope = "row";
    title.textContent = label;
    row.append(title);
    const share = counts.valid ? (100 * counts.faster / counts.valid).toFixed(1) + "%" : "—";
    for (const value of [counts.faster, share, counts.valid, counts.excluded]) {
      const cell = row.insertCell();
      cell.textContent = typeof value === "number" ? people.format(value) : value;
      if (typeof value === "number") cell.title = value.toLocaleString("en-US") + " estimated residents";
    }
    rows.push(row);
  }
  $("exposureRows").replaceChildren(...rows);
  $("countryBarCaption").textContent = "Residents in " + name + " with a temperature trend";
  const share = country.valid ? 100 * country.faster / country.valid : null;
  $("countryFasterBar").parentElement.hidden = share === null;
  $("countryFasterBar").style.width = (share ?? 0) + "%";
  $("countryFasterLabel").textContent = share === null ? "No residents have a complete trend for this period."
    : share.toFixed(1) + "% faster than global";
  $("countryOtherLabel").textContent = share === null ? "" : (100 - share).toFixed(1) + "% at or below global";
  $("exposureIntervals").textContent = "";
}

function render(reveal = false) {
  if (!byYear) yearPlayer.stop();
  tip.hidden = true;
  $("zoomIn").disabled = viewport.zoom === maxZoom;
  for (const button of $("periods").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String(Number(button.dataset.start) === firstYear));
  for (const button of $("modes").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  for (const button of $("views").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String((button.dataset.view === "annual") === byYear));
  $("certaintyHeading").hidden = byYear;
  $("modes").hidden = byYear;
  $("scrubber").hidden = !byYear;
  $("fitKey").hidden = byYear;
  $("year").min = firstYear;
  $("startLabel").textContent = firstYear;
  selectedYear = clamp(selectedYear, firstYear, period.end);
  $("year").value = selectedYear;
  $("yearValue").value = selectedYear;
  $("legendUnits").textContent = byYear ? "°C" : "°C / decade";
  const limit = byYear ? 3 : limits[mode][firstYear];
  $("scaleLow").textContent = "≤ −" + limit;
  $("scaleHigh").textContent = "≥ +" + limit;
  $("overlayKey").hidden = byYear;
  for (const button of $("cases").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String(button.dataset.case === activeCase));
  $("story").textContent = activeCase ? storyText(activeCase) : "";
  $("story").hidden = !activeCase;
  $("missingLabel").textContent = byYear ? "Grey · missing this year" : "Grey · record has gaps";
  map.setAttribute("aria-label", "World temperature " + (byYear ? "anomaly" : "trend") + " map. Select a grid square or move with the arrow keys.");
  $("relativeLegend").hidden = byYear || mode !== "relative";
  $("legendText").textContent = byYear ? "Temperature above or below the 1951–1980 average" : mode === "relative" ? "Warming rate compared with the world" : "Local temperature trend · blue cooled, red warmed";
  updateSignificanceKey();
  makeMap(land);
  regionalTable();
  showExposure();
  show(selected || {region: "North Atlantic"}, reveal);
}

async function selectPeriod(start, reveal = false) {
  yearPlayer.stop();
  requestedYear = start;
  $("status").textContent = "Loading " + start + "–2025…";
  try {
    if (!files.has(start)) {
      files.set(start, get("cells-" + start + ".bin").then(r => r.arrayBuffer()).then(buffer => {
        const size = (periods[start].series.length + 6) * cols * rows * 4;
        if (buffer.byteLength !== size) throw Error("Incomplete map file");
        return new Float32Array(buffer);
      }).then(async data => {
        const marks = new Uint8Array(await get("coverage-" + start + ".bin").then(r => r.arrayBuffer()));
        if (marks.length !== cols * rows) throw Error("Incomplete coverage file");
        let flags = null;
        try {
          const bytes = new Uint8Array(await get("significance-" + start + ".bin").then(r => r.arrayBuffer()));
          if (bytes.length === cols * rows && bytes.every(v => v <= 3)) flags = bytes;
        } catch { /* Temperature and population still work without the optional overlay. */ }
        return {data, marks, flags};
      }).catch(error => { files.delete(start); throw error; }));
    }
    const {data, marks, flags} = await files.get(start);
    if (requestedYear !== start) return;
    firstYear = start;
    period = periods[start];
    years = period.series.length;
    stride = years + 6;
    regions = period.regions;
    cells = data;
    coverage = marks;
    significance = flags;
    for (const id of ["views","cases","periods","modes","city"]) $(id).disabled = false;
    render(reveal);
    $("status").textContent = "";
  } catch {
    if (requestedYear === start) $("status").textContent = "Could not load this period. Select it again to retry.";
  }
}

$("views").addEventListener("click", event => {
  if (!cells || !event.target.dataset.view) return;
  byYear = event.target.dataset.view === "annual";
  activeCase = null;
  render();
});
$("year").addEventListener("input", () => {
  selectedYear = Number($("year").value);
  $("yearValue").value = selectedYear;
  if (scrubFrame) return;
  scrubFrame = requestAnimationFrame(() => {
    scrubFrame = null;
    if (!byYear) return;
    tip.hidden = true;
    makeMap(land);
    drawMap(selectedBounds);
    showAnnualDetails();
    updateMapReading();
    drawSeries(series);
    regionalTable();
  });
});

$("periods").addEventListener("click", event => {
  if (event.target.dataset.start) { activeCase = null; selectPeriod(Number(event.target.dataset.start)); }
});
$("modes").addEventListener("click", event => {
  if (cells && event.target.dataset.mode) {
    mode = event.target.dataset.mode;
    activeCase = null;
    render();
  }
});

async function loadPopulation() {
  try {
    population = await get("population-2020.json?v=population-overlay").then(r => r.json());
    const selector = $("exposureCountry");
    const entries = Object.entries(population.countries).sort((a, b) => a[1].localeCompare(b[1], "en"));
    selector.replaceChildren(...entries.map(([code, name]) => new Option(name, code)));
    const country = entry.get("country");
    selector.value = Object.hasOwn(population.countries, country) ? country : "IND";
    $("layerCountries").replaceChildren(...entries.map(([code, name]) => new Option(name, code)));
    selector.addEventListener("change", () => {
      if ($("mapPopulation").value && $("mapPopulation").value !== "world") setPopulationLayer(selector.value);
      else showExposure();
    });
    showExposure();
    if (selected) show(selected, false);
  } catch {
    $("exposureCaption").textContent = "The population estimates could not load. Reload to try again.";
  }
}
const yearPlayer = timelinePlayer($("playYears"), $("year"));

async function load() {
  const peopleReady = loadPopulation();
  [periods, land] = await Promise.all([
    get("periods.json").then(r => r.json()), get("land.json").then(r => r.json())
  ]);
  selected = initialPlace;
  await selectPeriod(firstYear);
  // Period buttons also let visitors retry a failed initial request.
  $("periods").disabled = false;
  await peopleReady;
  if (selectedBounds && population?.countryCells) {
    $("mapPopulation").disabled = false;
    $("showCountryLayer").disabled = false;
    document.dispatchEvent(new Event("population-ready"));
    if (["population","world"].includes(entry.get("layer"))) {
      document.querySelector(".layers").open = true;
      const linkedCase = activeCase;
      setPopulationLayer(entry.get("layer") === "world" ? "world" : $("exposureCountry").value);
      if (initialPlace) {
        selected = initialPlace;
        activeCase = linkedCase;
        render(true);
      }
    }
  }
  document.body.dataset.explorerReady = "true";
  document.dispatchEvent(new Event("explorer-ready"));
}
load().catch(() => { $("status").textContent = "The map data could not load. Reload the page to try again."; });

// Redraw once the web font arrives so chart labels use it.
if (document.fonts) document.fonts.ready.then(() => { if (cells) render(); });
