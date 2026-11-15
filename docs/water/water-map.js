// NASA's half-degree display grid points to one land value per native mascon.
const GRID_WIDTH = 720;
const GRID_HEIGHT = 360;
const stops = [
  [-100, "#843b15"], [-50, "#c77d47"], [-20, "#e8b78d"], [0, "#f5f1e0"],
  [20, "#acd7d4"], [50, "#51969b"], [100, "#205963"]
];

function color(value) {
  const upper = stops.findIndex(([limit]) => value <= limit);
  if (upper === -1) return stops.at(-1)[1];
  if (upper === 0) return stops[0][1];
  const [low, from] = stops[upper - 1];
  const [high, to] = stops[upper];
  const fraction = (value - low) / (high - low);
  const rgb = [1, 3, 5].map(i => {
    const a = parseInt(from.slice(i, i + 2), 16);
    const b = parseInt(to.slice(i, i + 2), 16);
    return Math.round(a + (b - a) * fraction);
  });
  return 'rgb(' + rgb.join(',') + ')';
}

export async function loadMap() {
  const response = await fetch("map.json?v=regions-1");
  if (!response.ok) throw Error("Water map unavailable");
  const {rows, years, states} = await response.json();
  const canvas = document.getElementById("waterMap");
  const message = document.getElementById("mapMessage");
  const sample = document.getElementById("mapSample");
  const india = document.getElementById("indiaMap");
  const world = document.getElementById("worldMap");
  const raster = document.createElement("canvas");
  raster.width = GRID_WIDTH;
  raster.height = GRID_HEIGHT;
  const cell = new Uint16Array(GRID_WIDTH * GRID_HEIGHT);
  rows.forEach((runs, row) => {
    for (let i = 0; i < runs.length; i += 2) {
      cell.fill(runs[i + 1], row * GRID_WIDTH + runs[i], row * GRID_WIDTH + (runs[i + 2] ?? GRID_WIDTH));
    }
  });
  document.getElementById("waterRamp").style.background = 'linear-gradient(to right, ' +
    stops.map(([level, hex]) => hex + ' ' + ((level + 100) / 2) + '%').join(', ') + ')';
  let season;
  let global = false;
  // Include neighboring land for context and retain the same view on every scrub.
  const home = [66, 20, 86, 33], earth = [-180, -90, 180, 90];
  let view = home.slice();
  let outlines = [];
  function setRegion(code) {
    outlines = states.filter(state => ["IN-RJ","IN-PB","IN-HR","IN-DL",code].includes(state.code));
    draw();
  }
  const bounds = () => view;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function position(west, north, width, height) {
    west = ((west + 180) % 360 + 360) % 360 - 180;
    north = clamp(north, -90 + height, 90);
    view = [west, north-height, west+width, north];
    india.setAttribute("aria-pressed", String(view.every((v,i) => Math.abs(v-home[i]) < .0001)));
    world.setAttribute("aria-pressed", String(width >= 359.999 && Math.abs(west+180) < .001));
    draw();
  }
  function zoom(factor, x=.5, y=.5) {
    const [w,s,e,n] = view, width=e-w, height=n-s;
    const ratio = clamp(factor, Math.max(width/360,height/180), width/8);
    position(w+x*width*(1-1/ratio), n-y*height*(1-1/ratio), width/ratio, height/ratio);
  }
  const zoomIn = document.getElementById("waterIn"), zoomOut = document.getElementById("waterOut");
  zoomIn.onclick = () => zoom(1.6);
  zoomOut.onclick = () => zoom(1/1.6);
  function draw() {
    if (!season || !canvas.clientWidth) return;
    const [west, south, east, north] = bounds();
    zoomIn.disabled = east-west <= 8.001;
    zoomOut.disabled = east-west >= 359.999 || north-south >= 179.999;
    canvas.classList.add("pannable");
    const w = canvas.clientWidth;
    const h = Math.round(w * (north - south) / ((east - west) * (global ? 1 : Math.cos(28 * Math.PI / 180))));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.height = h + "px";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(canvas.width / w, canvas.height / h);
    ctx.imageSmoothingEnabled = false;
    const span = east-west;
    for (const shift of east > 180 ? [0,360] : [0]) {
      ctx.drawImage(raster, (shift-180-west)*w/span, (north-90)*h/(north-south),
        360*w/span, 180*h/(north-south));
    }
    for (const shift of east > 180 ? [0,360] : [0]) {
      const x = lon => (lon+shift-west)*w/span;
      const y = lat => (north - lat) * h / (north - south);
      for (const state of outlines) {
        ctx.beginPath();
        for (const ring of state.rings) {
          ring.forEach(([lon, lat], i) => i ? ctx.lineTo(x(lon), y(lat)) : ctx.moveTo(x(lon), y(lat)));
          ctx.closePath();
        }
        ctx.lineWidth = global ? 1 : 2.8;
        ctx.strokeStyle = "#fffefa";
        ctx.stroke();
        ctx.lineWidth = global ? 0.65 : 1.25;
        ctx.strokeStyle = "#263b34";
        ctx.stroke();
      }
      if (!global) {
        ctx.font = '600 ' + (w < 500 ? 11 : 14) + 'px system-ui';
        ctx.textBaseline = "middle";
        for (const state of outlines) {
          const [lon, lat] = state.center;
          ctx.textAlign = state.name === "Delhi" ? "left" : state.name === "Haryana" ? "right" : "center";
          const dx = state.name === "Delhi" ? 5 : 0;
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#fffcf0";
          ctx.fillStyle = "#263b34";
          ctx.strokeText(state.name, x(lon) + dx, y(lat));
          ctx.fillText(state.name, x(lon) + dx, y(lat));
        }
      }
    }
  }
  function setYear(selected) {
    season = selected;
    const values = years[season.year];
    const palette = values ? values.map(color) : [];
    const ctx = raster.getContext("2d");
    rows.forEach((runs, row) => {
      for (let i = 0; i < runs.length; i += 2) {
        const id = runs[i + 1];
        ctx.fillStyle = id ? (palette[id - 1] ?? "#d3d5cd") : "#e3ebec";
        ctx.fillRect(runs[i], row, (runs[i + 2] ?? GRID_WIDTH) - runs[i], 1);
      }
    });
    message.hidden = Boolean(values);
    message.textContent = values ? "" : "Incomplete season · October and November are both required.";
    document.getElementById("mapTitle").textContent = season.year + " post-monsoon storage";
    sample.textContent = "";
    draw();
  }
  function setExtent(isGlobal) {
    global = isGlobal;
    view = (global ? earth : home).slice();
    india.setAttribute("aria-pressed", String(!global));
    world.setAttribute("aria-pressed", String(global));
    sample.textContent = "";
    draw();
  }
  india.onclick = () => setExtent(false);
  world.onclick = () => setExtent(true);
  function inspect(event) {
    if (!season || !years[season.year]) return;
    const rect = canvas.getBoundingClientRect();
    const [west, south, east, north] = bounds();
    const rawLon = west + (event.clientX - rect.left) / rect.width * (east - west);
    const lon = ((rawLon + 180) % 360 + 360) % 360 - 180;
    const lat = north - (event.clientY - rect.top) / rect.height * (north - south);
    const col = Math.max(0, Math.min(719, Math.floor((lon + 180) * 2)));
    const row = Math.max(0, Math.min(359, Math.floor((90 - lat) * 2)));
    const id = cell[row * GRID_WIDTH + col];
    sample.textContent = id ? 'Water storage near ' + Math.abs(lat).toFixed(1) + '°' + (lat < 0 ? 'S' : 'N') +
      ', ' + Math.abs(lon).toFixed(1) + '°' + (lon < 0 ? 'W' : 'E') + ' · ' +
      years[season.year][id - 1].toFixed(1).replace('-', '−') + ' cm relative to average' : "Ocean";
  }
  canvas.addEventListener("wheel", e => {
    const r = canvas.getBoundingClientRect();
    if (!season || !e.deltaY) return;
    e.preventDefault();
    zoom(Math.exp(-clamp(e.deltaY*(e.deltaMode === 1 ? 16 : 1),-300,300)*.004),
      (e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
  }, {passive:false});
  let drag;
  canvas.onpointerdown = e => {
    if (!e.isPrimary || e.button !== 0) return;
    drag = {id:e.pointerId,x:e.clientX,y:e.clientY,view:view.slice(),moved:false};
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = e => {
    if (!drag) { if (e.pointerType !== "touch") inspect(e); return; }
    if (e.pointerId !== drag.id) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy)<4) return;
    drag.moved=true;
    const [w,s,east,n]=drag.view, r=canvas.getBoundingClientRect();
    sample.textContent = "";
    position(w-dx*(east-w)/r.width,n+dy*(n-s)/r.height,east-w,n-s);
  };
  canvas.onpointerup = e => {
    if (drag?.id !== e.pointerId) return;
    if (!drag.moved) inspect(e);
    drag=null;
  };
  canvas.onlostpointercapture = canvas.onpointercancel = () => { drag=null; };
  canvas.onpointerleave = () => { sample.textContent = ""; };
  let measuredWidth = 0;
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width !== measuredWidth) {
      measuredWidth = entry.contentRect.width;
      draw();
    }
  }).observe(canvas);
  return {setYear, setRegion};
}
