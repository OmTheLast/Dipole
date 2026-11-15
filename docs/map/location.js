(() => {
  const button = document.getElementById("geoCountry");
  const status = document.getElementById("geoStatus");
  const countrySelect = document.getElementById("exposureCountry");
  const mapButton = document.getElementById("geoMap");
  const areaStatus = document.getElementById("areaStatus");
  let geography, revision = 0;
  function report(message) {
    status.textContent = message;
    areaStatus.textContent = message;
  }
  function selectCell(lat, lon, reveal) {
    const cell = cellAt(lat, lon);
    privateLocationCell = cell;
    show({cell}, false);
    setZoom(4);
    const row = Math.floor(cell / cols), col = cell % cols;
    positionView((col + 0.5) / cols - 0.5 / viewport.zoom, 1 - (row + 0.5) / rows - 0.5 / viewport.zoom);
    drawMap(selectedBounds);
    if (reveal) {
      $("map").focus({preventScroll:true});
      $("map").scrollIntoView({block:"center"});
    }
  }
  // A later manual selection wins if the browser or boundaries are slow.
  document.addEventListener("click", event => {
    if (event.target.closest("#map, [data-region], #cases button, .guide button")) revision++;
  });
  $("coords").addEventListener("submit", () => revision++);
  for (const id of ["city", "exposureCountry", "mapPopulation"]) {
    $(id).addEventListener("change", () => revision++);
  }
  function insideRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[j];
      if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
    }
    return inside;
  }
  async function locate(explicit) {
    if (button.disabled) return;
    if (!navigator.geolocation || !window.isSecureContext) {
      report("Location is available on HTTPS or localhost. You can choose a place manually.");
      return;
    }
    const request = revision;
    button.disabled = mapButton.disabled = true;
    report("Finding your area…");
    try {
      const {coords} = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject,
        {enableHighAccuracy:false, timeout:12000, maximumAge:explicit ? 0 : 300000}));
      if (request !== revision) { report("Using your manual selection."); return; }
      const {longitude:x, latitude:y} = coords;
      const moveMap = cells && (explicit || (!document.querySelector(".guideTarget") && !location.hash && !entry.size));
      if (moveMap) selectCell(y, x, explicit);
      const mapNote = moveMap ? "Selected the 2° temperature grid square near you. " : "";
      try {
        if (!geography) {
          const response = await fetch("map/country-outlines.json");
          if (!response.ok) throw Error("Boundary data unavailable");
          geography = await response.json();
        }
        if (request !== revision) { report("Using your manual selection."); return; }
        const match = geography.find(([, [w,s,e,n], rings]) => x >= w && x <= e && y >= s && y <= n &&
          insideRing(x,y,rings[0]) && !rings.slice(1).some(ring => insideRing(x,y,ring)));
        if (!match || !Array.from(countrySelect.options).some(option => option.value === match[0])) {
          report(mapNote + "No matching population country was found. Choose one in the population panel.");
          return;
        }
        countrySelect.value = match[0];
        countrySelect.dispatchEvent(new Event("change", {bubbles:true}));
        // Switching a country overlay normally recentres on its most populated cell.
        if (moveMap && selected.cell !== cellAt(y, x)) selectCell(y, x, false);
        report(mapNote + "Population comparison: " + countrySelect.selectedOptions[0].textContent + " and the world.");
      } catch {
        report(mapNote + "Country boundaries are unavailable. Choose a country in the population panel.");
      }
    } catch (error) {
      report(error.code === 1 ? "Location access was declined. Choose a place manually."
        : "Location is unavailable. Choose a place manually.");
    } finally { button.disabled = mapButton.disabled = false; }
  }
  button.onclick = mapButton.onclick = () => locate(true);
  const offerGrantedLocation = async () => {
    if (entry.has("country") || !navigator.permissions) return;
    const before = revision;
    try {
      const permission = await navigator.permissions.query({name:"geolocation"});
      if (permission.state === "granted" && before === revision) locate(false);
    } catch { /* Browsers without permission queries can still use the button. */ }
  };
  function enableLocation() {
    button.disabled = mapButton.disabled = !cells;
    if (cells && countrySelect.options.length) offerGrantedLocation();
  }
  if (document.body.dataset.explorerReady) enableLocation();
  else document.addEventListener("explorer-ready", enableLocation, {once:true});
})();
