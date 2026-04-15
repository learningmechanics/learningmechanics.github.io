import { createWidgetWindow } from "/static/widgets/window.js";
import { createKnob } from "/static/widgets/knob.js";
import { createSlider } from "/static/widgets/slider.js";
import { createTransport } from "/static/widgets/transport.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const { content, bg, dashboard } = createWidgetWindow("#square-widget", {
  windowHeight: 0.4,
  windowReveal: 0.01,
  depth: 0.15,
});

// --- SVG setup ---
const viewSize = 500;
const svg = d3.select(content)
  .append("svg")
  .attr("viewBox", `0 0 ${viewSize} ${viewSize}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "100%")
  .style("display", "block")
  .style("background", bg);

// --- Square state ---
let squareSize = 150;
let squareHue = 0;

const square = svg.append("rect")
  .attr("width", squareSize)
  .attr("height", squareSize)
  .attr("x", (viewSize - squareSize) / 2)
  .attr("y", (viewSize - squareSize) / 2)
  .attr("fill", `hsl(${squareHue}, 100%, 50%)`);

function updateSquare() {
  square
    .attr("width", squareSize)
    .attr("height", squareSize)
    .attr("x", (viewSize - squareSize) / 2)
    .attr("y", (viewSize - squareSize) / 2)
    .attr("fill", `hsl(${squareHue}, 100%, 50%)`);
}

function setAngle(t) {
  square.attr("transform", `rotate(${t * 360}, ${viewSize / 2}, ${viewSize / 2})`);
}

// --- Animation state ---
const periodMs = 5000;
const autostart = true;
let isPlaying = autostart;
let elapsed = 0;
let lastTimestamp = null;

// --- Transport ---
const { setProgress, controlsRow } = createTransport(dashboard, {
  autostart,
  onPlay()  { isPlaying = true;  lastTimestamp = null; requestAnimationFrame(tick); },
  onPause() { isPlaying = false; },
  onReset() { elapsed = 0; lastTimestamp = null; setAngle(0); isPlaying = false; },
  onSeek(t) {
    elapsed = t * periodMs;
    lastTimestamp = null;
    setAngle(t);
    setProgress(t);
  },
});

function tick(timestamp) {
  if (!isPlaying) { lastTimestamp = null; return; }
  if (lastTimestamp !== null) elapsed += timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  const t = (elapsed % periodMs) / periodMs;
  setAngle(t);
  setProgress(t);
  requestAnimationFrame(tick);
}

// --- Dashboard controls ---
createSlider(controlsRow, {
  label: "Size",
  min: 50,
  max: 500,
  value: 150,
  onChange: (v) => { squareSize = v; updateSquare(); },
});

createKnob(controlsRow, {
  label: "Color",
  min: 0,
  max: 360,
  value: 0,
  continuous: true,
  renderReadout: (el, v) => {
    el.textContent = "";
    el.style.background = `hsl(${v}, 100%, 50%)`;
  },
  onChange: (v) => { squareHue = v; updateSquare(); },
});
