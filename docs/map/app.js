"use strict";

const $ = id => document.getElementById(id);
const map = $("map");
const plot = $("plot");
const cols = 180, rows = 90;
// The page opens on the warming-hole finding: 1900–2025, relative to global, North Atlantic.
let firstYear = 1900, years, stride, mode = "relative", periods, period, land;
let byYear = false, selectedYear = 2015, scrubFrame;
let fitLine, requestedYear = firstYear;
let activeCase = "hole";
const files = new Map();
const colors = [[33,89,129], [141,188,203], [243,238,219], [228,154,99], [164,57,47]];
let population, cells, coverage, regions, base, selected, series, selectedBounds;
// Colour limits (°C/decade) chosen per view so that roughly the largest 2% of cells saturate.
// One fixed ±1 scale washed out the long-period differences, which are about ±0.1.
const limits = {absolute: {1980: 1, 1900: 0.3}, relative: {1980: 0.6, 1900: 0.15}};
const cases = {
  hole: {start: 1900, mode: "relative", region: "North Atlantic"},
  arctic: {start: 1980, mode: "relative", region: "Arctic"},
  recent: {start: 1900, mode: "relative", region: "Arctic"},
};
const fmt = (n, digits = 2) => (n < 0 ? "−" : "+") + Math.abs(n).toFixed(digits);
function storyText(name) {
  const r80 = periods[1980].regions, r00 = periods[1900].regions;
  const range = r => fmt(r.relative[1]) + " to " + fmt(r.relative[2]);
  if (name === "hole") {
    const na = r00["North Atlantic"], na80 = r80["North Atlantic"];
    return "Since 1900 the ocean south of Greenland warmed " + fmt(na.stats[0]) +
      " °C/decade while the world warmed " + fmt(na.globalRate) + ". That puts it " + fmt(na.relative[0]) +
      " °C/decade relative to the globe (95% interval " + range(na) + "). The ten most below-global cells on the 1900–2025 map all sit in this box. " +
      "Over 1980–2025 the same box is " + fmt(na80.relative[0]) + " (interval " + range(na80) +
      "), so the hole is a long-run feature that a 45-year window cannot resolve.";
  }
  if (name === "arctic") {
    const a = r80.Arctic;
    return "Since 1980 the Arctic warmed " + fmt(a.stats[0]) + " °C/decade, " +
      (a.stats[0] / a.globalRate).toFixed(1) + "× the global " + fmt(a.globalRate) + ". The gap is " +
      fmt(a.relative[0]) + " °C/decade (95% interval " + range(a) + "). Same planet, same years, very different rates.";
  }
  const a = r00.Arctic, a80 = r80.Arctic;
  return "Fitted over " + a.fitStart + "–2025 (the Arctic record has a gap in " + (a.fitStart - 1) +
    "), the Arctic runs only " + fmt(a.relative[0]) + " °C/decade above the globe (interval " + range(a) + "), against " +
    fmt(a80.relative[0]) + " since 1980. The chart shows why: a warm Arctic spell in the 1930s–40s flattens the long-run line. " +
    "Most of the excess Arctic warming is recent.";
}
const changeText = n => (n < 0 ? "−" : "+") + Math.abs(n).toFixed(2);
const latText = v => Math.abs(v) + "°" + (v > 0 ? "N" : v < 0 ? "S" : "");
const lonText = v => Math.abs(v) + "°" + (v > 0 ? "E" : v < 0 ? "W" : "");
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
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
function positionView(left, top) {
  const limit = 1 - 1 / viewport.zoom;
  viewport.left = clamp(left, 0, limit);
  viewport.top = clamp(top, 0, limit);
}
function drawMap(bounds) {
  const {ctx, width:w, height:h} = contextFor(map);
  const {left, top, zoom} = viewport;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, left * base.width, top * base.height, base.width / zoom, base.height / zoom, 0, 0, w, h);
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
    ? "Estimated 2020 residents in this cell: " + population.cellResidents[selection.cell].toLocaleString("en-US")
    : "";
  selectedBounds=bounds;
  if (reveal && viewport.zoom > 1) {
    const centerX = ((bounds[2] + bounds[3]) / 2 + 180) / 360;
    const centerY = (90 - (bounds[0] + bounds[1]) / 2) / 180;
    const span = 1 / viewport.zoom;
    if (centerX < viewport.left || centerX > viewport.left + span ||
        centerY < viewport.top || centerY > viewport.top + span)
      positionView(centerX - span / 2, centerY - span / 2);
  }
  const [s,n,west,east]=bounds;
  if (selection.region) $("coords").reset();
  $("name").textContent=name;
  $("kind").textContent=selection.region?"Region average":"Grid cell";
  $("bounds").textContent=latText(s)+"–"+latText(n)+" · "+(east-west===360?"All longitudes":lonText(west)+"–"+lonText(east));
  if (byYear) {
    fitLine = null;
    showAnnualDetails();
  } else {
    showTrendDetails(stats, relative, fitStart, globalRate, selection.cell);
  }
  for (const button of $("presets").querySelectorAll("button")) {
    button.setAttribute("aria-pressed",String(button.dataset.region ? selection.region===button.dataset.region :
      selection.cell===cellAt(+button.dataset.lat,+button.dataset.lon)));
  }
  $("annual").replaceChildren(...Array.from(series,(v,i)=>{
    const row=document.createElement("tr");
    row.insertCell().textContent=firstYear+i;row.insertCell().textContent=Number.isFinite(v)?changeText(v):"Missing";
    row.insertCell().textContent=changeText(period.series[i]);
    return row;
  }));
  plot.setAttribute("aria-label","Annual anomalies for "+name+". Values available in the table below.");
  drawMap(bounds); drawSeries(series);
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
  $("reference").textContent = "Global anomaly: " + changeText(period.series[i]) + " °C";
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
  $("metricLabel").textContent = showGap ? "Local minus global trend" : "Estimated local change" + (valid ? " · " + fitPeriod : "");
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
    interpretation = low > 0 ? "The fitted interval suggests faster warming than the globe." :
      high < 0 ? "The fitted interval suggests slower warming than the globe." : "The interval includes zero. The trends cannot be distinguished here.";
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
  $("zoomLevel").textContent = viewport.zoom + "×";
  $("zoomOut").disabled = $("worldView").disabled = viewport.zoom === 1;
  $("zoomIn").disabled = viewport.zoom === maxZoom;
  tip.hidden = true;
  drawMap(selectedBounds);
}
$("zoomIn").onclick = () => {
  const [south, north, west, east] = selectedBounds;
  const x = (((west + east) / 2 + 180) / 360 - viewport.left) * viewport.zoom;
  const y = ((90 - (south + north) / 2) / 180 - viewport.top) * viewport.zoom;
  const visible = x >= 0 && x <= 1 && y >= 0 && y <= 1;
  setZoom(viewport.zoom * 2, visible ? x : 0.5, visible ? y : 0.5);
};
$("zoomOut").onclick = () => setZoom(viewport.zoom / 2);
$("worldView").onclick = () => setZoom(1);

function pointerCell(event, rect) {
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  return cellAt(90 - 180 * (viewport.top + y / viewport.zoom),
    -180 + 360 * (viewport.left + x / viewport.zoom));
}
function hoverCell(event, rect) {
  const cell = pointerCell(event, rect);
  const value = cells[cell * stride + mapField()];
  const lat = -89 + 2 * Math.floor(cell / cols), lon = -179 + 2 * (cell % cols);
  const metric = byYear ? selectedYear + " anomaly" : mode === "relative" ? "Local − global" : "Local trend";
  const reading = Number.isFinite(value) ? fmt(value) + (byYear ? " °C" : " °C/decade") : $("missingLabel").textContent;
  tip.textContent = latText(lat) + " · " + lonText(lon) + "\n" + metric + "  " + reading;
  tip.hidden = false;
  tip.style.left = clamp(event.clientX - rect.left + 12, 0, rect.width - tip.offsetWidth) + "px";
  tip.style.top = clamp(event.clientY - rect.top + 12, 0, rect.height - tip.offsetHeight) + "px";
}
map.addEventListener("wheel", event => {
  if (!selectedBounds || (!event.ctrlKey && document.activeElement !== map) || !event.deltaY) return;
  event.preventDefault();
  const rect = map.getBoundingClientRect();
  setZoom(viewport.zoom * (event.deltaY < 0 ? 2 : 0.5),
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
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  if (viewport.zoom === 1) return;
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
  const b=e.target.closest("button"); if (!b) return;
  show(b.dataset.region ? {region:b.dataset.region} : {cell:cellAt(+b.dataset.lat,+b.dataset.lon)});
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
  $("comparisonCaption").textContent = byYear ? selectedYear + " temperatures in °C above or below the 1951–1980 average." : "Warming rates in °C per decade. Each region and its global comparison use the same years.";
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
  $("exposureCaption").textContent = "Estimated 2020 residents, classified by " + firstYear + "–" + period.end + " temperature trends.";
  $("exposureData").hidden = false;
  const rows = [];
  for (const [label, counts] of [["India", groups.india], ["World", groups.world]]) {
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
  const share = 100 * groups.india.faster / groups.india.valid;
  $("indiaFasterBar").style.width = share + "%";
  $("indiaFasterLabel").textContent = share.toFixed(1) + "% faster than global";
  $("indiaOtherLabel").textContent = (100 - share).toFixed(1) + "% at or below global";
  $("exposureIntervals").textContent = "";
}

function render(reveal = false) {
  tip.hidden = true;
  $("zoomIn").disabled = viewport.zoom === maxZoom;
  for (const button of $("periods").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String(Number(button.dataset.start) === firstYear));
  for (const button of $("modes").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  for (const button of $("views").querySelectorAll("button"))
    button.setAttribute("aria-pressed", String((button.dataset.view === "annual") === byYear));
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
  $("missingLabel").textContent = byYear ? "Missing this year" : "Incomplete record";
  map.setAttribute("aria-label", "World temperature " + (byYear ? "anomaly" : "trend") + " map. Click a cell or move with the arrow keys.");
  $("legendText").textContent = byYear ? "Temperature above or below the 1951–1980 average" : mode === "relative" ? "Local minus global · blue below global, red above" : "Temperature trend";
  makeMap(land);
  regionalTable();
  showExposure();
  show(selected || {region: cases[activeCase]?.region || "Arctic"}, reveal);
}

async function selectPeriod(start, reveal = false) {
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
        return {data, marks};
      }).catch(error => { files.delete(start); throw error; }));
    }
    const {data, marks} = await files.get(start);
    if (requestedYear !== start) return;
    firstYear = start;
    period = periods[start];
    years = period.series.length;
    stride = years + 6;
    regions = period.regions;
    cells = data;
    coverage = marks;
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
    population = await get("population-2020.json").then(r => r.json());
    showExposure();
    if (selected) show(selected, false);
  } catch {
    $("exposureCaption").textContent = "The population estimates could not load. Reload to try again.";
  }
}
async function load() {
  loadPopulation();
  [periods, land] = await Promise.all([
    get("periods.json").then(r => r.json()), get("land.json").then(r => r.json())
  ]);
  $("views").disabled = false;
  $("cases").disabled = false;
  $("periods").disabled = false;
  $("modes").disabled = false;
  await selectPeriod(firstYear);
}
load().catch(() => { $("status").textContent = "The map data could not load. Reload the page to try again."; });

// Redraw once the web font arrives so chart labels use it.
if (document.fonts) document.fonts.ready.then(() => { if (cells) render(); });
