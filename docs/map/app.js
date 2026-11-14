"use strict";

const $ = id => document.getElementById(id);
const map = $("map");
const plot = $("plot");
const cols = 180, rows = 90;
let firstYear = 1980, years, stride, mode = "absolute", periods, period, land;
let byYear = false, selectedYear = 2015, scrubFrame;
let fitLine, requestedYear = firstYear;
const files = new Map();
const colors = [[33,89,129], [141,188,203], [243,238,219], [228,154,99], [164,57,47]];
let cells, regions, base, selected, series, selectedBounds;
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

function makeMap(land) {
  if (!base) {
    base = document.createElement("canvas");
    base.width = 1440;
    base.height = 720;
    coastlines = coastlineLayer(land);
  }
  const limit = byYear ? 3 : 1;
  const field = byYear ? 6 + selectedYear - firstYear : (mode === "relative" ? 3 : 0);
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
  ctx.drawImage(coastlines, 0, 0);
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
  canvas.width = Math.max(1, Math.round(width*dpr));
  canvas.height = Math.max(1, Math.round(height*dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(canvas.width/width, canvas.height/height);
  return {ctx, width, height};
}
function drawMap(bounds) {
  const {ctx, width:w, height:h} = contextFor(map);
  ctx.drawImage(base,0,0,w,h);
  const [s,n,west,east] = bounds;
  const x=(west+180)*w/360, y=(90-n)*h/180;
  const bw=(east-west)*w/360, bh=(n-s)*h/180;
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
  ctx.font="11px monospace";ctx.fillStyle="#4b6057";ctx.textAlign="right";
  for (const tick of new Set([lo,0,hi])) {
    ctx.fillText(tick,left-5,y(tick)+3);ctx.beginPath();ctx.moveTo(left,y(tick));ctx.lineTo(right,y(tick));
    ctx.strokeStyle=tick===0?"#98a69c":"#dee3db";ctx.lineWidth=1;ctx.stroke();
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
  line(period.series, "#99683a");
  line(values, "#275d50");
  if (fitLine) line(fitLine.values, "#263632", true);
  ctx.setLineDash([]);
  if (byYear) {
    const index = selectedYear - firstYear;
    const x = left + index / (years - 1) * (right - left);
    ctx.strokeStyle = "#505952";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,bottom); ctx.stroke();
    for (const [v, color] of [[period.series[index], "#99683a"], [values[index], "#275d50"]]) {
      if (!Number.isFinite(v)) continue;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y(v),4,0,2*Math.PI); ctx.fill();
    }
    ctx.fillStyle = "#22352f";
    ctx.textAlign = "center";
    ctx.fillText(String(selectedYear),clamp(x,left+14,right-14),top-2);
  }
  ctx.textAlign="left";ctx.fillText(String(firstYear),left,h-2);
  ctx.textAlign="right";ctx.fillText("2025",right,h-2);
}
function show(selection) {
  if (!cells) return;
  selected = selection;
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
  selectedBounds=bounds;
  const [s,n,west,east]=bounds;
  if (selection.region) $("coords").reset();
  $("name").textContent=name;
  $("kind").textContent=selection.region?"Region average":"Grid cell";
  $("bounds").textContent=latText(s)+"–"+latText(n)+" · "+(east-west===360?"All longitudes":lonText(west)+"–"+lonText(east));
  if (byYear) {
    fitLine = null;
    showAnnualDetails();
  } else {
    showTrendDetails(stats, relative, fitStart, globalRate);
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
}
function showTrendDetails(stats, relative, fitStart, globalRate) {
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
    interpretation = low > 0 ? "The local trend is above the global trend." :
      high < 0 ? "The local trend is below the global trend." : "The interval includes zero. The trends cannot be distinguished here.";
  } else if (valid) {
    interpretation = low > 0 ? "The interval supports warming here." :
      high < 0 ? "The interval supports cooling here." : "The interval includes zero. The direction is uncertain.";
  }
  $("explain").textContent = interpretation;
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
map.addEventListener("click",e=>{
  const b=map.getBoundingClientRect();
  show({cell:cellAt(90-180*(e.clientY-b.top)/b.height,-180+360*(e.clientX-b.left)/b.width)});
});
map.addEventListener("keydown",e=>{
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
  $("comparisonCaption").textContent = byYear ? selectedYear + " temperatures in °C above or below the 1951–1980 average." : "Warming rates in °C per decade. Each region and its global comparison use the same years.";
  $("comparison").replaceChildren(...Object.entries(regions).map(([name, region]) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = name;
    row.append(label);
    const i = selectedYear - firstYear;
    const local = region.series[i], global = period.series[i];
    row.insertCell().textContent = byYear ? selectedYear : region.fitStart ? region.fitStart + "–" + period.end : "Incomplete";
    const metrics = byYear ? [local, global, Number.isFinite(local) ? local-global : null]
      : [region.stats?.[0], region.globalRate, region.relative?.[0]];
    for (const value of metrics) {
      row.insertCell().textContent = Number.isFinite(value) ? changeText(value) : "—";
    }
    return row;
  }));
}

function render() {
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
  $("scaleLow").textContent = byYear ? "≤ −3" : "≤ −1";
  $("scaleHigh").textContent = byYear ? "≥ +3" : "≥ +1";
  $("missingLabel").textContent = byYear ? "Missing this year" : "Incomplete record";
  map.setAttribute("aria-label", "World temperature " + (byYear ? "anomaly" : "trend") + " map. Click a cell or move with the arrow keys.");
  $("legendText").textContent = byYear ? "Temperature above or below the 1951–1980 average" : mode === "relative" ? "Local minus global · blue below global, red above" : "Temperature trend";
  makeMap(land);
  regionalTable();
  show(selected || {region:"Arctic"});
}

async function selectPeriod(start) {
  requestedYear = start;
  $("status").textContent = "Loading " + start + "–2025…";
  try {
    if (!files.has(start)) {
      files.set(start, get("cells-" + start + ".bin").then(r => r.arrayBuffer()).then(buffer => {
        const size = (periods[start].series.length + 6) * cols * rows * 4;
        if (buffer.byteLength !== size) throw Error("Incomplete map file");
        return new Float32Array(buffer);
      }).catch(error => { files.delete(start); throw error; }));
    }
    const data = await files.get(start);
    if (requestedYear !== start) return;
    firstYear = start;
    period = periods[start];
    years = period.series.length;
    stride = years + 6;
    regions = period.regions;
    cells = data;
    render();
    $("status").textContent = "";
  } catch {
    if (requestedYear === start) $("status").textContent = "Could not load this period. Select it again to retry.";
  }
}

$("views").addEventListener("click", event => {
  if (!cells || !event.target.dataset.view) return;
  byYear = event.target.dataset.view === "annual";
  render();
});
$("year").addEventListener("input", () => {
  selectedYear = Number($("year").value);
  $("yearValue").value = selectedYear;
  if (scrubFrame) return;
  scrubFrame = requestAnimationFrame(() => {
    scrubFrame = null;
    if (!byYear) return;
    makeMap(land);
    drawMap(selectedBounds);
    showAnnualDetails();
    drawSeries(series);
    regionalTable();
  });
});

$("periods").addEventListener("click", event => {
  if (event.target.dataset.start) selectPeriod(Number(event.target.dataset.start));
});
$("modes").addEventListener("click", event => {
  if (cells && event.target.dataset.mode) {
    mode = event.target.dataset.mode;
    render();
  }
});

async function load() {
  [periods, land] = await Promise.all([
    get("periods.json").then(r => r.json()), get("land.json").then(r => r.json())
  ]);
  $("views").disabled = false;
  $("periods").disabled = false;
  $("modes").disabled = false;
  await selectPeriod(firstYear);
}
load().catch(() => { $("status").textContent = "The map data could not load. Reload the page to try again."; });
