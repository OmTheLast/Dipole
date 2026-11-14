"use strict";

const $ = id => document.getElementById(id);
const map = $("map");
const plot = $("plot");
const cols = 180, rows = 90, years = 46, stride = years + 3;
const firstYear = 1980, decades = 4.5;
const colors = [[33,89,129], [141,188,203], [243,238,219], [228,154,99], [164,57,47]];
let cells, regions, base, selected, series, selectedBounds;
const changeText = n => (n < 0 ? "−" : "+") + Math.abs(n).toFixed(2);
const latText = v => Math.abs(v) + "°" + (v > 0 ? "N" : v < 0 ? "S" : "");
const lonText = v => Math.abs(v) + "°" + (v > 0 ? "E" : v < 0 ? "W" : "");
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function rateColor(rate) {
  if (!Number.isFinite(rate)) return "#a6a9a5";
  const value = 2 * (clamp(rate, -1, 1) + 1);
  const i = Math.min(3, Math.floor(value));
  return "rgb(" + colors[i].map((v, j) => Math.round(v + (value-i)*(colors[i+1][j]-v))).join(",") + ")";
}
function makeMap(land) {
  base = document.createElement("canvas");
  base.width = 1440; base.height = 720;
  const ctx = base.getContext("2d");
  ctx.scale(4, 4);
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      ctx.fillStyle = rateColor(cells[(r*cols+c)*stride]);
      ctx.fillRect(2*c, 178-2*r, 2, 2);
    }
  }
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
  const valid = [...values].filter(Number.isFinite);
  if (!valid.length) {ctx.fillStyle="#526259";ctx.fillText("No complete annual estimates",10,h/2);return;}
  const lo=Math.floor(Math.min(0,...valid)), hi=Math.max(lo+1,Math.ceil(Math.max(0,...valid)));
  const left=29,right=w-8,top=12,bottom=h-19;
  const y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  ctx.font="11px monospace";ctx.fillStyle="#4b6057";ctx.textAlign="right";
  for (const tick of new Set([lo,0,hi])) {
    ctx.fillText(tick,left-5,y(tick)+3);ctx.beginPath();ctx.moveTo(left,y(tick));ctx.lineTo(right,y(tick));
    ctx.strokeStyle=tick===0?"#98a69c":"#dee3db";ctx.lineWidth=1;ctx.stroke();
  }
  ctx.beginPath();ctx.strokeStyle="#275d50";ctx.lineWidth=2;
  values.forEach((v,i)=>{
    if (!Number.isFinite(v)) return;
    const x=left+i/(years-1)*(right-left);
    if (!i || !Number.isFinite(values[i-1])) ctx.moveTo(x,y(v)); else ctx.lineTo(x,y(v));
    ctx.fillRect(x-1,y(v)-1,2,2);
  });
  ctx.stroke(); ctx.textAlign="left";ctx.fillText("1980",left,h-2);
  ctx.textAlign="right";ctx.fillText("2025",right,h-2);
}
function show(selection) {
  if (!cells) return;
  selected = selection;
  let stats, bounds, name;
  if (selection.region) {
    ({stats, bounds, series} = regions[selection.region]); name=selection.region;
  } else {
    const id=selection.cell, row=Math.floor(id/cols), col=id%cols;
    const south=-90+2*row, west=-180+2*col;
    bounds=[south,south+2,west,west+2];
    stats=cells.subarray(id*stride,id*stride+3);
    series=cells.subarray(id*stride+3,(id+1)*stride);
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
  const [rate, low, high]=stats;
  const valid=Number.isFinite(rate);
  $("change").textContent=valid ? changeText(rate*decades)+" °C" : "Incomplete record";
  $("change").style.color=valid && rate < 0?"#215981":"";
  $("rate").textContent=valid ? changeText(rate)+" °C per decade" : "";
  $("interval").textContent=valid ? "95% interval for total change: "+changeText(low*decades)+" to "+changeText(high*decades)+" °C." : "";
  $("explain").textContent=valid ? (low>0?"The interval supports warming here.":high<0?"The interval supports cooling here.":"The interval includes zero. The direction is uncertain.") :
    [...series].filter(Number.isFinite).length+" of 46 years have all 12 months. A full-period trend needs all 46.";
  for (const button of $("presets").querySelectorAll("button")) {
    button.setAttribute("aria-pressed",String(button.dataset.region ? selection.region===button.dataset.region :
      selection.cell===cellAt(+button.dataset.lat,+button.dataset.lon)));
  }
  $("annual").replaceChildren(...Array.from(series,(v,i)=>{
    const row=document.createElement("tr");
    row.insertCell().textContent=firstYear+i;row.insertCell().textContent=Number.isFinite(v)?changeText(v):"Missing";
    return row;
  }));
  plot.setAttribute("aria-label","Annual anomalies for "+name+". Values available in the table below.");
  drawMap(bounds); drawSeries(series);
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
async function load() {
  const get=async file=>{
    const res=await fetch("map/"+file);
    if (!res.ok) throw Error(file+" unavailable");
    return res;
  };
  const [bytes,regionData,land]=await Promise.all([
    get("cells.bin").then(r=>r.arrayBuffer()), get("regions.json").then(r=>r.json()), get("land.json").then(r=>r.json())
  ]);
  if(bytes.byteLength!==cols*rows*stride*4) throw Error("Incomplete temperature file");
  cells=new Float32Array(bytes);regions=regionData;
  makeMap(land);show({region:"Arctic"});$("status").textContent="";
}
load().catch(()=>{$("status").textContent="The map data could not load. Reload the page to try again.";});
