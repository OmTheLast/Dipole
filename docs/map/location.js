(() => {
  const button = document.getElementById("geoCountry");
  const status = document.getElementById("geoStatus");
  const countrySelect = document.getElementById("exposureCountry");
  const localCell = document.getElementById("geoCell");
  let nearbyCell, geography;
  localCell.onclick = () => {
    if (nearbyCell === undefined || !cells) return;
    byYear = false;
    activeCase = null;
    mode = "relative";
    selected = {cell:nearbyCell};
    render(true);
    setZoom(4);
    const row = Math.floor(nearbyCell / cols), col = nearbyCell % cols;
    positionView((col+.5)/cols-.5/viewport.zoom,1-(row+.5)/rows-.5/viewport.zoom);
    drawMap(selectedBounds);
    $("map").focus({preventScroll:true});
    $("map").scrollIntoView({block:"center"});
  };
  let revision = 0;
  // A manual selection takes precedence over a pending location request.
  for (const id of ["exposureCountry", "mapPopulation"]) {
    document.getElementById(id).addEventListener("change", () => { revision++; localCell.hidden = true; });
  }
  function insideRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[j];
      if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
    }
    return inside;
  }
  async function locate() {
    if (button.disabled) return;
    if (!navigator.geolocation || !window.isSecureContext) {
      status.textContent = "Location is available on HTTPS or localhost. You can choose your country above.";
      return;
    }
    button.disabled = true;
    const request = revision;
    status.textContent = "Finding your country…";
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject,
        {enableHighAccuracy:false, timeout:12000, maximumAge:300000}));
      if (!geography) {
        const response = await fetch("map/country-outlines.json");
        if (!response.ok) throw Error("Boundary data unavailable");
        geography = await response.json();
      }
      const {longitude:x, latitude:y} = position.coords;
      const match = geography.find(([, [w,s,e,n], rings]) => x >= w && x <= e && y >= s && y <= n &&
        insideRing(x,y,rings[0]) && !rings.slice(1).some(ring => insideRing(x,y,ring)));
      if (request !== revision) { status.textContent = "Using the country you selected."; return; }
      if (!match) { status.textContent = "We couldn’t match this location to a country. Choose one above."; return; }
      countrySelect.value = match[0];
      countrySelect.dispatchEvent(new Event("change", {bubbles:true}));
      nearbyCell = cellAt(y,x);
      localCell.hidden = false;
      status.textContent = "Showing " + countrySelect.selectedOptions[0].textContent + " alongside the world. You can choose another country.";
    } catch (error) {
      status.textContent = error.code === 1 ? "Location access was declined. Choose a country above."
        : "Location is unavailable. Choose a country above.";
    } finally { button.disabled = false; }
  }
  button.addEventListener("click", locate);
  const offerGrantedLocation = async () => {
    if (entry.has("country") || !navigator.permissions) return;
    const before = revision;
    try {
      const permission = await navigator.permissions.query({name:"geolocation"});
      if (permission.state === "granted" && before === revision) locate();
    } catch { /* Browsers without permission queries can still use the button. */ }
  };
  if (countrySelect.options.length) offerGrantedLocation();
  else document.addEventListener("population-ready", offerGrantedLocation, {once:true});
})();
