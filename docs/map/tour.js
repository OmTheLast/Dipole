(() => {
  const $el = selector => document.querySelector(selector);
  const water = Boolean($el("#waterYear"));
  const steps = [
    ["#year", "Watch one year at a time", "Drag the slider or press Play. Each colour compares that year with the same place’s 1951–1980 average. Blue means cooler than usual there."],
    ["#views [data-view=trend]", "Switch from years to a trend", "Select Trend to compare warming rates instead of individual years. Look at the Arctic: since 1980 it warmed about 3.3 times as fast as the world."],
    ["[data-start='1900']", "Start with the longer record", "We’ve selected the North Atlantic and 1900–2025. The ocean south of Greenland barely warmed over this period, while the world warmed about 0.10 °C per decade."],
    ["[data-start='1980']", "Keep the place. Change the years.", "Now 1980–2025 is selected. The same patch warmed about 0.24 °C per decade; the world warmed about 0.21. The gap is too small to distinguish here. Try both period buttons."],
    ["#modes", "What does blue mean on this map?", "Try Local warming rate to see whether a place warmed or cooled. Then try Compared with the world: blue can also mean a place warmed, just more slowly than the world."],
    ["#exposureCountry", "Who lived in faster-warming places?", "Choose a country. The bars and table show how many of its 2020 residents lived in places warming faster than the world. Compare its share with the World row."],
    ["#waterIntro .teaserlink", "Take the same question to water", "The temperature map compares places with the world. Open the highlighted link to see whether two regions held more or less water than usual after the same rains."],
    [".quickYears", "Compare two monsoons", "Select 2021, then 2025. Read both regions for the same year. A negative reading means less stored water than that region’s 2004–2009 average."],
    ["#waterComparison", "Hold the year steady", "Switch between Madhya Pradesh and Uttar Pradesh. Northwest India stays on the chart, so you can see how each neighbour compares over the same months."],
    ["#waterTrend", "Was it just one dry year?", "Compare how each region changed between two groups of observed seasons. Missing seasons limit what we know about when those changes happened."]
  ];
  const linkStep = 6, firstWater = 7;
  const key = "dipole-tour-v1";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let entrance;
  const card = document.createElement("aside");
  card.className = "guide";
  card.hidden = true;
  card.setAttribute("aria-labelledby","guideTitle");
  card.innerHTML = '<small></small><h2 id="guideTitle" tabindex="-1"></h2><p id="guideText"></p><div class="guideActions"><button type="button" class="secondary" data-back>Back</button><button type="button" data-next>Next</button><button type="button" class="secondary" data-skip>Skip tour</button></div><button type="button" class="secondary guideReturn" hidden>Show highlighted control</button>';
  document.body.append(card);
  const el = selector => card.querySelector(selector);
  const clampTo = (n,lo,hi) => Math.max(lo,Math.min(n,hi));
  let current = -1, version = 0, target, secondary, frame, ready = false, originalHref, description;
  function seen() { try { return localStorage.getItem(key) === "1"; } catch { return false; } }
  function remember() { try { localStorage.setItem(key,"1"); } catch { /* Private browsing. */ } }
  function position() {
    if (!target || card.hidden) return;
    const r = target.getBoundingClientRect(), w = document.documentElement.clientWidth, h = window.innerHeight;
    const mid = (r.left + r.right)/2, gap = 15, pad = 8;
    const away = r.bottom <= pad || r.top >= h - pad || !r.height;
    el(".guideReturn").hidden = !away;
    const height = card.offsetHeight, width = card.offsetWidth;
    const above = r.top >= height + gap + pad || (h - r.bottom < height + gap + pad && r.top > h-r.bottom);
    const left = clampTo(mid-width/2, pad, w-width-pad);
    card.dataset.side = away ? "away" : above ? "above" : "below";
    card.style.left = left + "px";
    card.style.top = (away ? h-height-pad : clampTo(above ? r.top-height-gap : r.bottom+gap, pad, h-height-pad)) + "px";
    card.style.setProperty("--arrow-x", clampTo(mid-left, 14, width-14) + "px");
  }
  function schedulePosition() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  }
  function reveal() {
    if (!target) return;
    if (!target.getClientRects().length) { visit(current); return; }
    el(".guideReturn").hidden = true;
    const r = target.getBoundingClientRect();
    // Leave room for the note above the control and the result below it.
    const top = Math.min(card.offsetHeight + 25, (window.innerHeight-r.height)/2);
    const distance = r.top - top;
    // Ease nearby steps. A long pan through unrelated sections distracts from the next control.
    const nearby = Math.abs(distance) <= window.innerHeight / 2;
    window.scrollBy({top:distance, behavior:nearby && !reducedMotion.matches ? "smooth" : "instant"});
    position();
  }
  const observer = new ResizeObserver(schedulePosition);
  observer.observe(card);
  window.addEventListener("scroll",schedulePosition,{passive:true});
  window.addEventListener("resize",schedulePosition);
  function clearTarget() {
    entrance?.cancel();
    if (!target) return;
    observer.unobserve(target);
    target.classList.remove("guideTarget");
    secondary?.classList.remove("guideCompanion");
    if (description === null) target.removeAttribute("aria-describedby");
    else target.setAttribute("aria-describedby",description);
    if (originalHref) target.setAttribute("href",originalHref);
    target = secondary = originalHref = null;
  }
  function close() {
    ++version; clearTarget();
    window.scrollTo({top:window.scrollY, behavior:"instant"});
    card.hidden = true; current = -1; remember();
    if (!water) yearPlayer.stop();
    $el(water ? "#waterYear" : "#restartTour").focus({preventScroll:true});
  }
  async function visit(i) {
    if (!ready) return;
    if (water && i === linkStep) { location.assign("../?tour=water-link"); return; }
    if (i < 0 || i >= steps.length) { close(); return; }
    const token = ++version;
    clearTarget(); current = i; card.hidden = true;
    if (!water) {
      yearPlayer.stop();
      if (i <= 4) {
        byYear = i < 2;
        mode = "relative";
        selected = {region:i < 2 ? "Arctic" : "North Atlantic"};
        activeCase = null;
        if (i === 0) selectedYear = 1980;
        await selectPeriod(i === 2 ? 1900 : 1980);
        if (token !== version) return;
      }
    } else if (i === firstWater) {
      $el("[data-year='2021']").click();
    }
    const [selector,title,text] = steps[i];
    target = $el(selector);
    if (!target.getClientRects().length) {
      // Optional population or temperature data may not have loaded.
      if (i === 5) { visit(linkStep); return; }
      close(); return;
    }
    target.classList.add("guideTarget");
    description = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", [description,"guideText"].filter(Boolean).join(" "));
    if (i === 0) { secondary = $el("#playYears"); secondary.classList.add("guideCompanion"); }
    if (i === linkStep) { originalHref = target.getAttribute("href"); target.href = originalHref + "?tour=water"; }
    el("small").textContent = "Dipole tour · " + (i+1) + " of " + steps.length;
    el("h2").textContent = title; el("p").textContent = text;
    el("[data-next]").textContent = i === steps.length-1 ? "Finish tour" : "Next";
    el("[data-next]").hidden = i === linkStep;
    el("[data-back]").hidden = i === 0;
    el(".guideReturn").hidden = true; card.hidden = false;
    observer.observe(target);
    reveal(); remember();
    if (!reducedMotion.matches) {
      const offset = card.dataset.side === "above" ? 4 : -4;
      entrance = card.animate([
        {opacity:0.45, transform:"translateY(" + offset + "px)"},
        {opacity:1, transform:"translateY(0)"}
      ], {duration:170, easing:"ease-out"});
    }
    // Read the step, then let Tab take the visitor straight to what it explains.
    el("h2").focus({preventScroll:true});
  }
  el("[data-back]").onclick = () => visit(current === linkStep && !$el("#exposureCountry").getClientRects().length ? 4 : current-1);
  el("[data-next]").onclick = () => visit(current+1);
  el("[data-skip]").onclick = close;
  el(".guideReturn").onclick = reveal;
  document.addEventListener("keydown", e => {
    if (current < 0) return;
    if (e.key === "Escape") close();
    if (e.key === "Tab" && !e.shiftKey && document.activeElement === el("h2")) {
      const control = target?.matches("button,input,select,a") ? target : target?.querySelector("button");
      if (control) { e.preventDefault(); control.focus({preventScroll:true}); }
    } else if (e.key === "Tab" && !e.shiftKey && target) {
      const controls = target.querySelectorAll("button");
      if (document.activeElement === target || document.activeElement === controls[controls.length-1]) {
        e.preventDefault(); el(current === linkStep ? "[data-back]" : "[data-next]").focus({preventScroll:true});
      }
    }
  });
  const requested = new URLSearchParams(location.search).get("tour");
  const onReady = () => {
    ready = true;
    if (water && (requested === "water" || (!seen() && !location.hash))) visit(firstWater);
    if (!water && (requested === "start" || requested === "years" || (!seen() && !requested && !location.hash))) visit(0);
    if (!water && requested === "water-link") visit(linkStep);
    if (!water && requested === "people") visit(5);
  };
  if (!water) $el("#restartTour").onclick = () => visit(0);
  if (water ? !$el("#waterData").hidden : document.body.dataset.explorerReady) onReady();
  else document.addEventListener(water ? "water-ready" : "explorer-ready",onReady,{once:true});
})();
