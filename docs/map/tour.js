(() => {
  const water = Boolean(document.getElementById("waterYear"));
  const steps = [
    ["Why compare two places?", "A global average can hide large regional differences. Follow one temperature record from individual years to a long-term trend, then explore people and water.", "Watch the years", ".hero"],
    ["Watch one year at a time", "The year slider moves the map and the chart together. Red means warmer than that place’s 1951–1980 average. Pause or drag to explore a particular year.", "Compare warming rates", "#scrubber"],
    ["How quickly did the Arctic warm?", "Trend view combines many years into a rate per decade. Since 1980 the Arctic warmed about 3.3 times as fast as the world. The map compares each place with the global rate. Select a square to read its result.", "Explore population", ".controls"],
    ["Who lived in faster-warming places?", "Choose a country to compare its 2020 residents with the world. Change the country or use your location to see how the share changes.", "Explore water", "#exposureData"],
    ["What stayed after the monsoon?", "Compare 2021 and 2025 in northwest India. Both years use the same colour scale. A negative reading means less stored water than the region’s 2004–2009 average.", "Finish tour", ".seasonControls"]
  ];
  const key = "dipole-tour-v1";
  let current = -1, version = 0, target, ready = false;
  const card = document.createElement("aside");
  card.className = "guide";
  card.setAttribute("aria-label", "Guided tour");
  card.hidden = true;
  card.innerHTML = '<small></small><h2 tabindex="-1"></h2><p class="guideText"></p><div class="guideActions"><button type="button" class="secondary" data-back>Back</button><button type="button" data-next></button><button type="button" class="secondary" data-skip>Skip tour</button></div>';
  const heading = card.querySelector("h2"), next = card.querySelector("[data-next]");
  function seen() { try { return localStorage.getItem(key) === "1"; } catch { return false; } }
  function remember() { try { localStorage.setItem(key,"1"); } catch { /* Private browsing. */ } }
  function close() {
    version++;
    target?.classList.remove("guideTarget");
    card.hidden = true;
    current = -1;
    if (!water) document.getElementById("restartTour").hidden = false;
    if (!water) yearPlayer.stop();
    remember();
    document.querySelector(water ? "#waterYear" : "#restartTour")?.focus({preventScroll:true});
  }
  async function visit(i, scroll = true) {
    const token = ++version;
    target?.classList.remove("guideTarget");
    if (!water) yearPlayer.stop();
    if (i === 4 && !water) { location.assign("water/?tour=water"); return; }
    if (i === 1 && water) { location.assign("../?tour=years"); return; }
    if (i === 3 && water) { location.assign("../?tour=people"); return; }
    if (i < 0 || i >= steps.length) { close(); return; }
    current = i;
    if (!water) document.getElementById("restartTour").hidden = true;
    if (i === 1 || i === 2) {
      byYear = i === 1;
      mode = "relative";
      activeCase = i === 2 ? "arctic" : null;
      selected = {region:"Arctic"};
      if (i === 1) selectedYear = 1980;
      await selectPeriod(1980);
      if (token !== version) return;
      if (i === 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) yearPlayer.start();
    } else if (i === 3 && firstYear !== 1980) {
      await selectPeriod(1980);
      if (token !== version) return;
    }
    const [title, text, action, selector] = steps[i];
    target = document.querySelector(selector);
    if (target.hidden) target = document.getElementById("population");
    target.classList.add("guideTarget");
    if (i === 0) target.after(card);
    else target.before(card);
    card.querySelector("small").textContent = "Dipole tour · " + (i + 1) + " of " + steps.length;
    heading.textContent = title;
    card.querySelector("p").textContent = text;
    next.textContent = action;
    next.disabled = !ready;
    card.querySelector("[data-back]").hidden = i === 0;
    card.querySelector("[data-skip]").hidden = i === 4;
    card.hidden = false;
    if (scroll) { heading.focus({preventScroll:true}); card.scrollIntoView({block:"start"}); }
    remember();
  }
  card.querySelector("[data-back]").onclick = () => visit(current - 1);
  next.onclick = () => visit(current + 1);
  card.querySelector("[data-skip]").onclick = close;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && current >= 0) close(); });
  const requested = new URLSearchParams(location.search).get("tour");
  if (water) {
    const waterReady = () => {
      ready = true;
      if (requested === "water") {
        history.replaceState(null,"",location.pathname + location.hash);
        visit(4);
      } else if (!seen() && !location.hash) visit(0,false);
    };
    if (!document.getElementById("waterData").hidden) waterReady();
    else document.addEventListener("water-ready", waterReady, {once:true});
  } else {
    const replay = document.getElementById("restartTour");
    replay.onclick = () => visit(0);
    if (requested === "start" || (!seen() && !requested && !location.hash)) visit(0,false);
    const explorerReady = () => {
      ready = true;
      next.disabled = false;
      if (requested === "people" || requested === "years") {
        history.replaceState(null,"",location.pathname);
        visit(requested === "people" ? 3 : 1);
      }
    };
    if (document.body.dataset.explorerReady) explorerReady();
    else document.addEventListener("explorer-ready", explorerReady, {once:true});
  }
})();
