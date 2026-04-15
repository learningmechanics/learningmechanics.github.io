/**
 * Transport controls: reset button, play/pause button, LED progress bar.
 *
 * Usage:
 *   import { createTransport } from "/static/widgets/transport.js";
 *   const { setProgress, controlsRow } = createTransport(dashboard, {
 *     autostart: false,
 *     onPlay()  { ... },
 *     onPause() { ... },
 *     onReset() { ... },   // called after internal reset (progress zeroed, paused)
 *     onSeek(t) { ... },   // called when user clicks the LED bar to seek (0..1); play state unchanged
 *     ledCount: 24,        // number of LED segments
 *   });
 *   // Add knobs/sliders to controlsRow, not to dashboard directly
 *   setProgress(0..1);     // call from your animation loop
 */

function makeSvgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function makeIcon(name) {
  const svg = makeSvgEl("svg", { viewBox: "0 0 16 16", fill: "none" });

  if (name === "reset") {
    svg.appendChild(makeSvgEl("path", {
      d: "M2.5 6 A5.5 5.5 0 1 1 5.5 13.2",
      fill: "none",
      stroke: "currentColor", "stroke-width": "2.5",
      "stroke-linecap": "round",
    }));
    svg.appendChild(makeSvgEl("polyline", {
      points: "2.5,11 3.5,14 5.5,11 2.5,11",
      stroke: "currentColor", "stroke-width": "3",
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
  } else if (name === "play") {
    svg.appendChild(makeSvgEl("polyline", {
      points: "3,2 14,8 3,14 3,2", fill: "currentColor",
      stroke: "currentColor", "stroke-width": "1.8",
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
  } else if (name === "pause") {
    svg.appendChild(makeSvgEl("rect", {
      x: "2", y: "2", width: "4", height: "12", rx: "1", fill: "currentColor",
    }));
    svg.appendChild(makeSvgEl("rect", {
      x: "10", y: "2", width: "4", height: "12", rx: "1", fill: "currentColor",
    }));
  }

  return svg;
}

function makeButton() {
  const btn = document.createElement("button");
  btn.className = "widget-transport-btn";
  btn.type = "button";
  return btn;
}

export function createTransport(dashboard, opts = {}) {
  const autostart = opts.autostart ?? false;
  const onPlay   = opts.onPlay   ?? (() => {});
  const onPause  = opts.onPause  ?? (() => {});
  const onReset  = opts.onReset  ?? (() => {});
  const onSeek   = opts.onSeek   ?? (() => {});
  const ledCount = opts.ledCount ?? 24;

  // --- Transport bar (top row) ---
  const bar = document.createElement("div");
  bar.className = "widget-transport";
  dashboard.appendChild(bar);

  // --- Controls row (below, for knobs/sliders) ---
  const controlsRow = document.createElement("div");
  controlsRow.className = "widget-controls-row";
  dashboard.appendChild(controlsRow);

  // --- Reset button ---
  const resetBtn = makeButton();
  resetBtn.appendChild(makeIcon("reset"));
  bar.appendChild(resetBtn);

  // --- Play/Pause button ---
  let playing = autostart;
  const playBtn = makeButton();
  if (playing) playBtn.classList.add("widget-transport-btn--active");
  playBtn.appendChild(makeIcon(playing ? "pause" : "play"));
  bar.appendChild(playBtn);

  // --- LED progress track ---
  const track = document.createElement("div");
  track.className = "widget-transport-track";
  bar.appendChild(track);

  const leds = Array.from({ length: ledCount }, () => {
    const led = document.createElement("div");
    led.className = "widget-transport-led";
    track.appendChild(led);
    return led;
  });

  // Clicking anywhere on the track (including gaps) seeks to that position
  track.style.cursor = "pointer";
  function seekFromEvent(e) {
    const rect = track.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setProgress(t);
    onSeek(t);
  }
  // Drag-to-scrub: mousedown handles single click too (avoids double-fire with click event)
  track.addEventListener("mousedown", e => {
    seekFromEvent(e);
    function onMove(e) { if (e.buttons & 1) seekFromEvent(e); }
    function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
  // Touch scrub
  track.addEventListener("touchstart", e => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = track.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    setProgress(t); onSeek(t);
  }, { passive: false });
  track.addEventListener("touchmove", e => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = track.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    setProgress(t); onSeek(t);
  }, { passive: false });

  // --- Helpers ---
  function setProgress(t) {
    const litCount = Math.round(t * ledCount);
    leds.forEach((led, i) => led.classList.toggle("widget-transport-led--lit", i < litCount));
  }

  function setPlayingState(val) {
    playing = val;
    playBtn.classList.toggle("widget-transport-btn--active", playing);
    playBtn.innerHTML = "";
    playBtn.appendChild(makeIcon(playing ? "pause" : "play"));
  }

  // --- Reset: momentary press ---
  resetBtn.addEventListener("mousedown", () => resetBtn.classList.add("widget-transport-btn--pressed"));
  resetBtn.addEventListener("mouseup", () => {
    resetBtn.classList.remove("widget-transport-btn--pressed");
    setPlayingState(false);
    setProgress(0);
    onReset();
  });
  resetBtn.addEventListener("mouseleave", () => resetBtn.classList.remove("widget-transport-btn--pressed"));

  // --- Play/Pause: latching toggle ---
  playBtn.addEventListener("mousedown", () => {
    // preview press visually only if currently up
    if (!playing) playBtn.classList.add("widget-transport-btn--pressed");
  });
  playBtn.addEventListener("mouseup", () => {
    playBtn.classList.remove("widget-transport-btn--pressed");
    const next = !playing;
    setPlayingState(next);
    if (next) onPlay(); else onPause();
  });
  playBtn.addEventListener("mouseleave", () => {
    if (!playing) playBtn.classList.remove("widget-transport-btn--pressed");
  });
  if (autostart) onPlay();

  // --- Touch support ---
  function addTouch(btn, onDown, onUp) {
    btn.addEventListener("touchstart", e => { e.preventDefault(); onDown(); }, { passive: false });
    btn.addEventListener("touchend",   e => { e.preventDefault(); onUp();   }, { passive: false });
  }
  addTouch(resetBtn,
    () => resetBtn.classList.add("widget-transport-btn--pressed"),
    () => { resetBtn.classList.remove("widget-transport-btn--pressed"); setPlayingState(false); setProgress(0); onReset(); }
  );
  addTouch(playBtn,
    () => { if (!playing) playBtn.classList.add("widget-transport-btn--pressed"); },
    () => { playBtn.classList.remove("widget-transport-btn--pressed"); const next = !playing; setPlayingState(next); if (next) onPlay(); else onPause(); }
  );

  return { setProgress, setPlayingState, controlsRow };
}
