import {loadMap} from "./water-map.js";
async function loadWater() {
  const node = id => document.getElementById(id);
  const response = await fetch("series.json");
  if (!response.ok) throw Error("Missing regional series");
  const {seasons, fit, centralFit, differenceFit, months, start, end, markers} = await response.json();
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
    for (const value of [season.october, season.november, season.mean, season.central.october, season.central.november, season.central.mean]) row.insertCell().textContent = number(value);
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
    node("waterReading").textContent = s.mean === null
      ? s.year + " · Incomplete season. See the table for available months."
      : s.year + " · Northwest India " + number(s.mean) + " cm · Madhya Pradesh " +
        number(s.central.mean) + " cm, each relative to its own 2004–2009 average.";

  }
  function setView() {
    const monthly = node("waterView").value === "monthly";
    node("waterChart").src = monthly ? "monthly.svg" : "post-monsoon.svg";
    node("waterChart").alt = "Water storage in northwest India and Madhya Pradesh. Exact values are available in the table or monthly CSV.";
    node("waterLegend").textContent = "Teal circles show northwest India. Rust triangles show Madhya Pradesh. " +
      (monthly ? "Markers highlight October and November." : "Dashed lines show the fitted rates.") +
      " The vertical line marks the selected season. Gaps indicate missing observations.";
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
  node("waterTrend").textContent = fit.n + " shared October–November seasons from " + fit.first + " to " + fit.last +
    ". A rate of +1 cm per decade means storage increased by the equivalent of a 1 cm layer across the region every ten years.";
  for (const [name, estimate] of [["Northwest India", fit], ["Madhya Pradesh", centralFit], ["Northwest minus Madhya Pradesh", differenceFit]]) {
    const row = node("trendRows").insertRow();
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = name;
    row.append(heading);
    row.insertCell().textContent = number(estimate.slope);
    row.insertCell().textContent = number(estimate.low) + " to " + number(estimate.high);
  }
  const describe = (name, estimate) => estimate.low <= 0 && estimate.high >= 0
    ? name + "’s interval includes zero, so its direction is uncertain."
    : name + "’s interval stays " + (estimate.low > 0 ? "above" : "below") + " zero, supporting " +
      (estimate.low > 0 ? "an increase." : "a decrease.");
  node("regionalReading").textContent = describe("Northwest India", fit) + " " + describe("Madhya Pradesh", centralFit);
  node("pairedReading").textContent = differenceFit.high < 0
    ? "Post-monsoon storage in northwest India declined relative to Madhya Pradesh. The interval for the gap stays below zero."
    : differenceFit.low > 0 ? "Post-monsoon storage in northwest India increased relative to Madhya Pradesh. The interval for the gap stays above zero."
    : "The interval for the gap includes zero, so the difference in rates remains uncertain.";
  node("waterSensitivity").textContent = "We first subtract Madhya Pradesh’s reading from northwest India’s in each shared season, then fit a trend to those differences. Each fit estimates its own year-to-year correlation, so subtracting the two regional rates can give a different number. Ordinary least squares gives a gap of " + number(differenceFit.ols) + " cm per decade and the median pairwise slope gives " + number(differenceFit.sen) + ".";
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
