import {loadMap} from "./water-map.js";
async function loadWater() {
  const node = id => document.getElementById(id);
  const response = await fetch("series.json");
  if (!response.ok) throw Error("Missing regional series");
  const {seasons, fit, months, start, end, markers} = await response.json();
  const slider = node("waterYear");
  slider.min = seasons[0].year;
  slider.max = seasons.at(-1).year;
  let paintMap;
  const number = v => v === null ? "Missing" : v.toFixed(1).replace("-", "−");
  for (const season of seasons) {
    const row = node("waterRows").insertRow();
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = season.year;
    row.append(heading);
    for (const value of [season.october, season.november, season.mean]) row.insertCell().textContent = number(value);
  }
  function markChart() {
    const layout = markers[node("waterView").value];
    const marker = node("chartMarker");
    marker.style.left = (layout.years[slider.value] * 100) + "%";
    marker.style.top = (layout.top * 100) + "%";
    marker.style.bottom = ((1 - layout.bottom) * 100) + "%";
  }
  function readYear() {
    const s = seasons.find(season => season.year === Number(slider.value));
    node("yearLabel").value = slider.value;
    for (const button of document.querySelectorAll("[data-year]")) {
      button.setAttribute("aria-pressed", String(button.dataset.year === slider.value));
    }
    markChart();
    if (paintMap) paintMap(s);
    const result = s.mean === null ? "Incomplete season" : number(s.mean) + " cm relative to the reference average";
    const reading = v => v === null ? "missing" : number(v) + " cm";
    node("waterReading").textContent = s.year + " · " + result + ". October: " + reading(s.october) + ". November: " + reading(s.november) + ".";
  }
  function setView() {
    const monthly = node("waterView").value === "monthly";
    node("waterChart").src = monthly ? "monthly.svg" : "post-monsoon.svg";
    node("waterChart").alt = monthly ? "Monthly regional water storage with October and November highlighted. Values in the CSV below." : "October–November means and their fitted trend. Values in the table below.";
    node("waterLegend").textContent = (monthly ? "Dark blue dots mark October and November in the monthly record." : "Teal dots show October–November means. The dashed line shows the fitted trend.") + " The vertical line marks the selected season. Gaps indicate missing observations.";
    markChart();
  }
  const latest = seasons.filter(s => s.mean !== null).at(-1);
  slider.value = latest.year;
  slider.oninput = readYear;
  for (const button of document.querySelectorAll("[data-year]")) {
    button.onclick = () => {
      slider.value = button.dataset.year;
      readYear();
    };
  }
  node("waterView").onchange = setView;
  readYear();
  setView();
  node("waterStatus").textContent = months + " monthly observations · " + start + " to " + end;
  const interpretation = fit.low <= 0 && fit.high >= 0 ? "The interval includes zero, so these data leave the long-term rate uncertain." :
    "The interval supports a " + (fit.high < 0 ? "decline" : "rise") + " over this period.";
  node("waterTrend").textContent = "Across " + fit.n + " complete seasons (" + fit.first + "–" + fit.last + "), the fitted rate is " + number(fit.slope) + " cm per decade. Approximate 95% interval: " + number(fit.low) + " to " + number(fit.high) + " cm per decade. " + interpretation;
  node("waterSensitivity").textContent = "For comparison, ordinary least squares gives " + number(fit.ols) + " cm per decade and the median pairwise slope gives " + number(fit.sen) + ". The fitted year-to-year correlation is " + fit.rho.toFixed(2) + ". With only " + fit.n + " seasons, the slope and interval are sensitive to that assumption.";
  node("waterData").hidden = false;
  try {
    paintMap = await loadMap();
    readYear();
  } catch {
    node("mapMessage").textContent = "Could not load the water map. Reload to try again.";
    node("indiaMap").disabled = node("worldMap").disabled = true;
  }
}
loadWater().catch(() => { document.getElementById("waterStatus").textContent = "Could not load the water observations. Reload to try again."; });
