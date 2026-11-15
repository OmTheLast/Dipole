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
    node("waterChart").alt = monthly ? "Monthly regional water storage with October and November highlighted. Values in the CSV below." : "October–November means for each complete season. Values in the table below.";
    node("waterLegend").textContent = (monthly ? "Dark blue dots mark October and November in the monthly record." : "Teal dots show October–November means.") + " The vertical line marks the selected season. Gaps indicate missing observations.";
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
  // Compare whole periods instead of fitting a line: with 20 seasons and strong persistence,
  // the fitted slope changed by a factor of two depending on the method.
  const average = (from, to) => {
    const values = seasons.filter(s => s.year >= from && s.year <= to && s.mean !== null).map(s => s.mean);
    return {mean: values.reduce((a, b) => a + b, 0) / values.length, n: values.length};
  };
  const early = average(2004, 2009), late = average(2018, seasons.at(-1).year);
  node("waterTrend").textContent = "After the monsoon, the region averaged " + number(early.mean) + " cm in 2004–2009 (" + early.n +
    " seasons) and " + number(late.mean) + " cm in 2018–" + seasons.at(-1).year + " (" + late.n + " seasons), a difference of " +
    number(late.mean - early.mean) + " cm. Most of that drop falls between 2014 and 2018, when no complete post-monsoon season was observed and the GRACE mission handed over to GRACE-FO. NASA/JPL processes both missions as one continuous record.";
  node("waterSensitivity").textContent = "We do not report a fitted rate. A straight-line fit through " + fit.n + " seasons gave " + number(fit.slope) + " to " +
    number(fit.sen) + " cm per decade depending on the method, and the strong year-to-year persistence makes any single rate and interval unreliable.";
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
