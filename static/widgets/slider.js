/**
 * Horizontal Slider — a skeuomorphic canvas-based slider with recessed groove
 * and 3D thumb cap. Same API shape as createKnob.
 *
 * Usage:
 *   import { createSlider } from "/static/widgets/slider.js";
 *   const { element, setValue, getValue, setLocked } = createSlider(parent, {
 *     label: "Size", min: 50, max: 500, value: 150,
 *     locked: false,          // optional; lock flag (default false)
 *     onChange: (v) => { ... },
 *   });
 *   setLocked(true);          // lock / unlock at any time
 */

function makeSvgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function makeLockIcon() {
  const svg = makeSvgEl("svg", { viewBox: "0 0 16 16", fill: "currentColor" });
  svg.appendChild(makeSvgEl("path", {
    d: "M5 7V5a3 3 0 0 1 6 0v2",
    stroke: "currentColor", "stroke-width": "1.8",
    "stroke-linecap": "round", fill: "none",
  }));
  svg.appendChild(makeSvgEl("rect", {
    x: "3", y: "7", width: "10", height: "8", rx: "2",
  }));
  svg.appendChild(makeSvgEl("circle", {
    cx: "8", cy: "11", r: "1.3", fill: "white",
  }));
  return svg;
}

export function createSlider(parent, opts = {}) {
  const {
    label = "",
    min = 0,
    max = 100,
    step = 1,
    format = (v) => String(Math.round(v)),
    renderReadout,
    onChange = () => {},
  } = opts;

  let value = opts.value ?? min;
  let locked = opts.locked ?? false;

  // --- DOM structure ---
  // [lock-icon-space] [label] [slider-canvas] [readout]
  const group = document.createElement("div");
  group.className = "widget-slider-group";

  const lockEl = document.createElement("div");
  lockEl.className = "widget-slider-lock";
  group.appendChild(lockEl);

  const labelEl = document.createElement("span");
  labelEl.className = "widget-slider-label";
  labelEl.textContent = label;
  group.appendChild(labelEl);

  const row = document.createElement("div");
  row.className = "widget-slider-row";

  const wrapper = document.createElement("div");
  wrapper.className = "widget-slider-wrapper";

  const canvas = document.createElement("canvas");
  canvas.className = "widget-slider-canvas";
  canvas.tabIndex = 0;
  wrapper.appendChild(canvas);

  const readout = document.createElement("div");
  readout.className = "widget-knob-readout";

  row.appendChild(wrapper);
  row.appendChild(readout);
  group.appendChild(row);

  parent.appendChild(group);

  // --- Read palette from CSS custom properties ---
  const _cs = getComputedStyle(document.documentElement);
  const _cv = (name) => _cs.getPropertyValue(name).trim();
  const colors = {
    get groove()      { return _cv("--widget-groove"); },
    get grooveShadow(){ return _cv("--widget-groove-shadow"); },
    get thumbHi()     { return _cv("--widget-thumb-hi"); },
    get thumbLo()     { return _cv("--widget-thumb-lo"); },
    get thumbRidge()  { return _cv("--widget-thumb-ridge"); },
  };

  // --- Canvas setup ---
  const ctx = canvas.getContext("2d");

  function sizeCanvas() {
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSlider();
  }

  // --- Value helpers ---
  function snapToStep(v) {
    const snapped = Math.round((v - min) / step) * step + min;
    return Math.max(min, Math.min(max, snapped));
  }

  function valueFraction(v) {
    return (v - min) / (max - min);
  }

  // --- Drawing ---
  const PAD_X   = 12;
  const GROOVE_H = 4;
  const THUMB_H  = 12;
  const THUMB_W  = THUMB_H * 1.5;
  const THUMB_CR = 3;
  const GROOVE_R = 1;

  function trackLeft()     { return PAD_X; }
  function trackRight(w)   { return w - PAD_X; }
  function trackWidth(w)   { return trackRight(w) - trackLeft(); }
  function thumbX(w)       { return trackLeft() + valueFraction(value) * trackWidth(w); }

  function drawSlider() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = locked ? 0.45 : 1.0;

    const tl  = trackLeft();
    const tw  = trackWidth(w);
    const grooveY = cy - GROOVE_H / 2;

    // Track groove
    roundRect(ctx, tl, grooveY, tw, GROOVE_H, GROOVE_R);
    const grooveGrad = ctx.createLinearGradient(0, grooveY, 0, grooveY + GROOVE_H);
    grooveGrad.addColorStop(0, colors.grooveShadow);
    grooveGrad.addColorStop(1, colors.groove);
    ctx.fillStyle = grooveGrad;
    ctx.fill();

    roundRect(ctx, tl, grooveY, tw, GROOVE_H / 2, Math.max(1, GROOVE_R - 1));
    ctx.fillStyle = colors.grooveShadow;
    ctx.fill();

    // Thumb
    const tx     = thumbX(w);
    const thumbX0 = tx - THUMB_W / 2;
    const thumbY0 = cy - THUMB_H / 2;

    ctx.save();
    ctx.shadowBlur    = 3;
    ctx.shadowOffsetY = 4;
    ctx.shadowColor   = "rgba(0,0,0,0.25)";

    roundRect(ctx, thumbX0, thumbY0, THUMB_W, THUMB_H, THUMB_CR);
    const thumbGrad = ctx.createLinearGradient(0, thumbY0, 0, thumbY0 + THUMB_H);
    thumbGrad.addColorStop(0, colors.thumbHi);
    thumbGrad.addColorStop(1, colors.thumbLo);
    ctx.fillStyle = thumbGrad;
    ctx.fill();
    ctx.restore();

    roundRect(ctx, thumbX0, thumbY0, THUMB_W, THUMB_H, THUMB_CR);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const gripGap = 2.5;
    ctx.strokeStyle = colors.thumbRidge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx - gripGap, cy - 4); ctx.lineTo(tx - gripGap, cy + 4);
    ctx.moveTo(tx + gripGap, cy - 4); ctx.lineTo(tx + gripGap, cy + 4);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x,     y,     x + r, y,         r);
    ctx.closePath();
  }

  // --- Readout ---
  function updateReadout() {
    if (renderReadout) {
      renderReadout(readout, value);
    } else {
      readout.textContent = format(value);
    }
  }

  // --- Lock ---
  function setLocked(val) {
    locked = val;
    lockEl.innerHTML = "";
    if (locked) lockEl.appendChild(makeLockIcon());
    canvas.style.cursor = locked ? "not-allowed" : "";
    drawSlider();
  }

  // --- Interaction ---
  let dragging  = false;
  let originX   = 0;
  let startValue = value;

  canvas.addEventListener("pointerdown", (e) => {
    if (locked) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    dragging   = true;
    originX    = e.clientX;
    startValue = value;
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging || locked) return;
    const dx  = e.clientX - originX;
    const w   = wrapper.clientWidth;
    const tw  = trackWidth(w);
    const newRaw = startValue + (dx / tw) * (max - min);
    value = snapToStep(Math.max(min, Math.min(max, newRaw)));
    drawSlider();
    updateReadout();
    onChange(value);
  });

  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointercancel", () => { dragging = false; });

  canvas.addEventListener("keydown", (e) => {
    if (locked) return;
    let handled = true;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight": value = snapToStep(Math.min(max, value + step)); break;
      case "ArrowDown":
      case "ArrowLeft":  value = snapToStep(Math.max(min, value - step)); break;
      case "Home":       value = min; break;
      case "End":        value = max; break;
      default:           handled = false;
    }
    if (handled) { e.preventDefault(); drawSlider(); updateReadout(); onChange(value); }
  });

  // --- Resize observer ---
  const ro = new ResizeObserver(() => sizeCanvas());
  ro.observe(wrapper);

  // --- Initial render ---
  requestAnimationFrame(() => { sizeCanvas(); updateReadout(); });

  // Apply initial lock state (icon + cursor)
  setLocked(locked);

  // --- Public API ---
  function setValue(v) {
    value = snapToStep(v);
    drawSlider();
    updateReadout();
  }

  function getValue() { return value; }

  return { element: group, setValue, getValue, setLocked };
}
