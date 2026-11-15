// Advance the existing slider so keyboard, touch and playback use the same data path.
function timelinePlayer(button, slider) {
  let timer;
  function stop() {
    clearInterval(timer);
    timer = undefined;
    button.textContent = "▶ Play";
    button.setAttribute("aria-label", "Play timeline");
  }
  function advance() {
    const next = Number(slider.value) >= Number(slider.max) ? Number(slider.min) : Number(slider.value) + 1;
    slider.value = next;
    slider.dispatchEvent(new Event("input", {bubbles: true}));
    if (next === Number(slider.max)) stop();
  }
  function start() {
    if (timer !== undefined || !slider.max) return;
    button.textContent = "Ⅱ Pause";
    button.setAttribute("aria-label", "Pause timeline");
    timer = setInterval(advance, 200);
    advance();
  }
  button.addEventListener("click", () => timer === undefined ? start() : stop());
  slider.addEventListener("pointerdown", stop);
  slider.addEventListener("keydown", stop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", stop);
  stop();
  return {start, stop};
}
