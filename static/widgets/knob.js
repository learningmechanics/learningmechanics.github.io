/**
 * Rotary Knob — a skeuomorphic rotary control with grooves and readout pane.
 *
 * Usage:
 *   import { createKnob } from "/static/widgets/knob.js";
 *   const { element, setValue, getValue } = createKnob(parent, {
 *     label: "Size", min: 50, max: 500, value: 150,
 *     onChange: (v) => { ... },
 *   });
 */

export function createKnob(parent, opts = {}) {
  const {
    label = "",
    min = 0,
    max = 100,
    step = 1,
    continuous = false,
    format = (v) => String(Math.round(v)),
    renderReadout,
    onChange = () => {},
  } = opts;

  let value = opts.value ?? min;

  // --- Angle constants ---
  // Bounded: 240° arc from 8 o'clock to 4 o'clock
  const START_ANGLE = 0.75 * Math.PI; // 8 o'clock (150° from right)
  const ARC_SPAN = (3 / 2) * Math.PI;   // 240° sweep
  // Dead zone is 120° from 4 o'clock back to 8 o'clock (bottom)

  // --- DOM structure ---
  const group = document.createElement("div");
  group.className = "widget-knob-group";

  const row = document.createElement("div");
  row.className = "widget-knob-row";

  const wrapper = document.createElement("div");
  wrapper.className = "widget-knob-wrapper";

  const canvas = document.createElement("canvas");
  canvas.className = "widget-knob-canvas";
  canvas.tabIndex = 0;
  wrapper.appendChild(canvas);

  const readout = document.createElement("div");
  readout.className = "widget-knob-readout";

  row.appendChild(wrapper);
  row.appendChild(readout);
  group.appendChild(row);

  const labelEl = document.createElement("span");
  labelEl.className = "widget-knob-label";
  labelEl.textContent = label;
  group.appendChild(labelEl);

  parent.appendChild(group);

  // --- Read palette from CSS custom properties ---
  const _cs = getComputedStyle(document.documentElement);
  const _cv = (name) => _cs.getPropertyValue(name).trim();
  const colors = {
    get rim() { return _cv("--widget-knob-rim"); },
    get rimShadow() { return _cv("--widget-knob-rim-shadow"); },
    get ridge() { return _cv("--widget-knob-ridge"); },
    get faceHi() { return _cv("--widget-knob-hi"); },
    get faceLo() { return _cv("--widget-knob-lo"); },
    get faceBorder() { return _cv("--widget-knob-face-border"); },
    get indicatorHi() { return _cv("--widget-knob-indicator-hi"); },
    get indicatorLo() { return _cv("--widget-knob-indicator-lo"); },
  };

  // --- Canvas setup ---
  const ctx = canvas.getContext("2d");

  function sizeCanvas() {
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawKnob();
  }

  // --- Value ↔ angle mapping ---
  function valueToAngle(v) {
    const t = (v - min) / (max - min);
    if (continuous) {
      return -Math.PI / 2 + t * 2 * Math.PI;
    }
    return START_ANGLE + t * ARC_SPAN;
  }

  function snapToStep(v) {
    const snapped = Math.round((v - min) / step) * step + min;
    return Math.max(min, Math.min(max, snapped));
  }

  // --- Drawing ---
  function drawKnob() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    const bodyR = Math.min(cx, cy) * 0.8;

    // Fixed-pixel 3D offset
    const rimOffX = 2.5;
    const rimOffY = 2.0;
    const rimCx = cx + rimOffX;
    const rimCy = cy + rimOffY;

    const ridgeCount = 24;
    const ridgeOuter = bodyR+1;
    const angle = valueToAngle(value);

    ctx.clearRect(0, 0, w, h);

    // 1. Rim circle (offset, drawn first) with drop shadow
    ctx.save();
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.shadowColor = colors.rimShadow;
    ctx.fillStyle = colors.rim;
    ctx.beginPath();
    ctx.arc(rimCx, rimCy, bodyR+1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // 2. Ridges on the rim — rotate with knob value
    ctx.strokeStyle = colors.ridge;
    ctx.lineWidth = 2;
    for (let i = 0; i < ridgeCount; i++) {
      const a = angle + (i / ridgeCount) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(rimCx + Math.cos(a) * ridgeOuter, rimCy + Math.sin(a) * ridgeOuter);
      ctx.stroke();
    }

    // 3. Top face circle (covers left/top rim ridges)
    const topGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bodyR);
    topGrad.addColorStop(0, colors.faceHi);
    topGrad.addColorStop(1, colors.faceLo);
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, bodyR, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = colors.faceBorder;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // 4. Indicator dot
    const dotDist = bodyR * 0.68;
    const dotR = 2;
    const dotX = cx + Math.cos(angle) * dotDist;
    const dotY = cy + Math.sin(angle) * dotDist;
    const indicatorGrad = ctx.createRadialGradient(dotX+1, dotY+1, 0, dotX+1, dotY+1, dotR);
    indicatorGrad.addColorStop(0, colors.indicatorHi);
    indicatorGrad.addColorStop(1, colors.indicatorLo);
    ctx.fillStyle = indicatorGrad;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR, 0, 2 * Math.PI);
    ctx.fill();
  }

  // --- Readout update ---
  function updateReadout() {
    if (renderReadout) {
      renderReadout(readout, value);
    } else {
      readout.textContent = format(value);
    }
  }

  // --- Interaction: y = −x line drag model ---
  let dragging = false;
  let originX = 0;
  let originY = 0;
  let startValue = value;
  const SQRT2 = Math.SQRT2;
  const sensitivity = 200; // px of perpendicular travel for full range

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    dragging = true;
    originX = e.clientX;
    originY = e.clientY;
    startValue = value;
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - originX;
    const dy = e.clientY - originY;
    // Signed perpendicular distance from the line y = −x through origin
    // Down-right (+dx, +dy) → positive → increase value
    const dist = (dx - dy) / SQRT2;
    const range = max - min;
    const newRaw = startValue + (dist / sensitivity) * range;

    if (continuous) {
      // Wrap around
      value = snapToStep(((newRaw - min) % range + range) % range + min);
    } else {
      value = snapToStep(Math.max(min, Math.min(max, newRaw)));
    }

    drawKnob();
    updateReadout();
    onChange(value);
  });

  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });

  // --- Keyboard support ---
  canvas.addEventListener("keydown", (e) => {
    let handled = true;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        value = snapToStep(Math.min(max, value + step));
        break;
      case "ArrowDown":
      case "ArrowLeft":
        value = snapToStep(Math.max(min, value - step));
        break;
      case "Home":
        value = min;
        break;
      case "End":
        value = max;
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      accumValue = value;
      drawKnob();
      updateReadout();
      onChange(value);
    }
  });

  // --- Resize observer ---
  const ro = new ResizeObserver(() => sizeCanvas());
  ro.observe(wrapper);

  // --- Initial render ---
  // Defer to next frame so layout is settled
  requestAnimationFrame(() => {
    sizeCanvas();
    updateReadout();
  });

  // --- Public API ---
  function setValue(v) {
    value = snapToStep(v);
    drawKnob();
    updateReadout();
  }

  function getValue() {
    return value;
  }

  return { element: group, setValue, getValue };
}
