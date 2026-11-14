"use strict";
async function loadWater() {
  const node = id => document.getElementById(id);
  const response = await fetch("series.json");
  if (!response.ok) throw Error("Missing regional series");
  const {seasons, fit, months, start, end} = await response.json();
  const number = v => v === null ? "Missing" : v.toFixed(1).replace("-", "−");
  for (const season of seasons) {
    node("waterYear").add(new Option(season.year, season.year));
    const row = node("waterRows").insertRow();
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = season.year;
    row.append(heading);
    for (const value of [season.october, season.november, season.mean]) row.insertCell().textContent = number(value);
  }
  function readYear() {
    const s = seasons.find(season => season.year === Number(node("waterYear").value));
    const result = s.mean === null ? "Incomplete season" : number(s.mean) + " cm relative to the reference average";
    const reading = v => v === null ? "missing" : number(v) + " cm";
    node("waterReading").textContent = s.year + " · " + result + ". October: " + reading(s.october) + ". November: " + reading(s.november) + ".";
  }
  function setView() {
    const monthly = node("waterView").value === "monthly";
    node("waterChart").src = monthly ? "monthly.svg" : "post-monsoon.svg";
    node("waterChart").alt = monthly ? "Monthly regional water storage with October and November highlighted. Values in the CSV below." : "October–November means and their fitted trend. Values in the table below.";
    node("waterLegend").textContent = monthly ? "Teal line: observed months. Dark blue dots: October and November. Gaps mark missing observations." : "Teal dots: October–November means. Dashed line: fitted post-monsoon trend. Gaps mark incomplete seasons.";
  }
  const latest = seasons.filter(s => s.mean !== null).at(-1);
  node("waterYear").value = latest.year;
  node("waterYear").onchange = readYear;
  node("waterView").onchange = setView;
  readYear();
  setView();
  node("waterStatus").textContent = months + " monthly observations · " + start + " to " + end;
  const interpretation = fit.low <= 0 && fit.high >= 0 ? "The interval includes zero, so these data leave the long-term rate uncertain." :
    "The interval supports a " + (fit.high < 0 ? "decline" : "rise") + " over this period.";
  node("waterTrend").textContent = "Across " + fit.n + " complete seasons (" + fit.first + "–" + fit.last + "), the fitted rate is " + number(fit.slope) + " cm per decade. Approximate 95% interval: " + number(fit.low) + " to " + number(fit.high) + " cm per decade. " + interpretation;
  node("waterSensitivity").textContent = "For comparison, ordinary least squares gives " + number(fit.ols) + " cm per decade and the median pairwise slope gives " + number(fit.sen) + ". The fitted year-to-year correlation is " + fit.rho.toFixed(2) + ". With only " + fit.n + " seasons, the slope and interval are sensitive to that assumption.";
  node("waterData").hidden = false;
}
loadWater().catch(() => { document.getElementById("waterStatus").textContent = "Could not load the water observations. Reload to try again."; });
