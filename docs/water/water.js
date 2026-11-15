import {loadMap} from "./water-map.js?v=regions-1";

async function loadWater() {
  const node = id => document.getElementById(id);
  const response = await fetch("series.json?v=regions-1");
  if (!response.ok) throw Error("Missing regional series");
  const {seasons, fit, months, start, end, comparisons} = await response.json();
  const slider = node("waterYear");
  const selector = node("waterComparison");
  for (const [key, region] of Object.entries(comparisons)) selector.add(new Option(region.name, key));
  const number = value => value === null ? "Missing" : value.toFixed(1).replace("-", "−");
  const pair = () => comparisons[selector.value];
  slider.min = seasons[0].year;
  slider.max = seasons.at(-1).year;
  slider.value = seasons.filter(s => s.mean !== null && s[selector.value].mean !== null).at(-1).year;
  const player = timelinePlayer(node("playWater"), slider);
  let map;
  function markChart() {
    const layout = pair().markers[node("waterView").value];
    const marker = node("chartMarker");
    marker.style.left = (layout.years[slider.value] * 100) + "%";
    marker.style.top = (layout.top * 100) + "%";
    marker.style.bottom = ((1 - layout.bottom) * 100) + "%";
  }
  function readYear() {
    const season = seasons.find(s => s.year === Number(slider.value));
    node("yearLabel").value = slider.value;
    for (const button of document.querySelectorAll("[data-year]")) {
      button.setAttribute("aria-pressed", String(button.dataset.year === slider.value));
    }
    markChart();
    map?.setYear(season);
    const other = season[selector.value].mean;
    node("waterReading").textContent = season.mean === null || other === null
      ? season.year + " · Incomplete season. Open the table below to see which months were observed."
      : season.year + " · Northwest India " + number(season.mean) + " cm · " + pair().name + " " + number(other) + " cm. Each reading is relative to that region’s own average.";
  }
  function setView() {
    const view = node("waterView").value;
    node("waterChart").src = view + pair().suffix + ".svg";
    node("waterChart").alt = "Water storage in northwest India and " + pair().name + ". Exact values are in the table and monthly CSV.";
    node("waterLegend").textContent = "Teal circles show northwest India. Rust triangles show " + pair().name +
      (view === "monthly" ? " in October and November. Lines show the monthly record." : ". Each point averages October and November.") +
      " The vertical line marks the selected season. Gaps indicate missing observations.";
    markChart();
  }
  function setComparison() {
    const key = selector.value;
    const name = pair().name;
    node("otherHeading").textContent = name + " (cm)";
    node("historyHeading").textContent = "Northwest India and " + name;
    const table = node("waterRows");
    table.replaceChildren();
    for (const season of seasons) {
      const row = table.insertRow();
      const heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = season.year;
      row.append(heading);
      for (const region of [season, season[key]]) {
        for (const value of [region.october, region.november, region.mean]) row.insertCell().textContent = number(value);
      }
    }
    const paired = seasons.filter(s => s.mean !== null && s[key].mean !== null);
    const early = paired.filter(s => s.year >= 2004 && s.year <= 2009);
    const late = paired.filter(s => s.year >= 2018);
    const average = (years, field) => years.reduce((sum, s) => sum + (field ? s[field].mean : s.mean), 0) / years.length;
    const change = field => number(average(late, field) - average(early, field));
    node("waterTrend").textContent = "From 2004–2009 (" + early.length + " shared seasons) to 2018–" + late.at(-1).year +
      " (" + late.length + " shared seasons), average post-monsoon storage changed by " +
      change(null) + " cm in northwest India and " + change(key) + " cm in " + name +
      ". No complete seasons were observed in 2015–2017.";
    node("waterStatus").textContent = paired.length + " shared October–November seasons · " + months + " monthly observations from " + start + " to " + end;
    node("waterMapCaption").textContent = "Outlines mark the four areas of northwest India and " + name +
      ". Map colours show October–November storage relative to each location’s 2004–2009 average. All years use the same scale. NASA resolves patterns about 3° across.";
    map?.setRegion(pair().code);
    setView();
    readYear();
  }
  slider.oninput = readYear;
  for (const button of document.querySelectorAll("[data-year]")) {
    button.onclick = () => { player.stop(); slider.value = button.dataset.year; readYear(); };
  }
  selector.onchange = () => { player.stop(); setComparison(); };
  node("waterView").onchange = setView;
  node("waterSensitivity").textContent = "For northwest India, two ways of fitting a line through the same " + fit.n +
    " complete seasons gave " + number(fit.slope) + " and " + number(fit.sen) +
    " cm per decade. The period comparison describes the observed seasons. Neighbouring regions can share part of the same satellite measurement.";
  setComparison();
  node("waterData").hidden = false;
  document.dispatchEvent(new Event("water-ready"));
  try {
    map = await loadMap();
    map.setRegion(pair().code);
    readYear();
  } catch {
    node("mapMessage").textContent = "Could not load the water map. Reload to try again.";
    node("indiaMap").disabled = node("worldMap").disabled = true;
  }
}
loadWater().catch(() => { document.getElementById("waterStatus").textContent = "Could not load the water observations. Reload to try again."; });
