/**
 * qwem.js — implements qwem.widget
 * 3D embedding visualization (panel 1) + singular value curves (panel 2)
 * Data: embeddings.json  { words, singular_vectors (V×d), singular_values (d,) }
 */
import { createWidgetWindow, loadChartJs } from "/static/widgets/window.js";
import { createSlider }                    from "/static/widgets/slider.js";
import { createTransport }                 from "/static/widgets/transport.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

await loadChartJs();

// ─── Data ─────────────────────────────────────────────────────────────────────
const { words, singular_vectors: Psi, singular_values: Sstar } =
  await fetch("embeddings.json").then(r => r.json());
const D = Sstar.length; // 20
const V = Psi.length;   // vocabulary size 5k

// Fixed axis range for 3D panel: ±3*Sstar[0]/sqrt(V)
const fixedMaxR = 3 * Sstar[0] / Math.sqrt(V);

// ─── Widget window ────────────────────────────────────────────────────────────
const { container, content, dashboard } = createWidgetWindow("#qwem-widget", {
  windowHeight: 0.5,
  depth: 0.07,
});

Object.assign(content.style, { display: "flex", width: "100%", height: "100%" });

// Helper: create a flex-panel inside content
function makePanel(styles) {
  const el = document.createElement("div");
  Object.assign(el.style, styles);
  content.appendChild(el);
  return el;
}

// outerP1 is wider
const outerP1 = makePanel({ flex: "1.4", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" });
const outerP2 = makePanel({ flex: "1", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" });

// panel1 fills outerP1 completely (no visible edge/border around the 3D panel)
const panel1 = document.createElement("div");
Object.assign(panel1.style, { width: "100%", height: "100%", position: "relative", overflow: "hidden" });
outerP1.appendChild(panel1);

// panel2: 70% wide, 35% tall (half the previous height)
const panel2 = document.createElement("div");
Object.assign(panel2.style, { width: "100%", height: "50%", overflow: "hidden", marginRight: "10px" });
outerP2.appendChild(panel2);

// ─── State ────────────────────────────────────────────────────────────────────
let pcaX = 1, pcaY = 2, pcaZ = 3, initScale = 1e-4, currentT = 0;
let rotM = [
    [1.0, 0.5, 0],
    [0.07, -0.16, 1.0],
    [0.5, -0.8, -0.16]
];

function matVec(M, [x,y,z]) {
  return [
    M[0][0]*x + M[0][1]*y + M[0][2]*z,
    M[1][0]*x + M[1][1]*y + M[1][2]*z,
    M[2][0]*x + M[2][1]*y + M[2][2]*z,
  ];
}
function matMul(A, B) {
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) for (let k=0;k<3;k++) C[i][j]+=A[i][k]*B[k][j];
  return C;
}
function axisRot(ax, ay, az, angle) {
  const c=Math.cos(angle), s=Math.sin(angle), t=1-c;
  return [
    [t*ax*ax+c,    t*ax*ay-s*az, t*ax*az+s*ay],
    [t*ay*ax+s*az, t*ay*ay+c,    t*ay*az-s*ax],
    [t*az*ax-s*ay, t*az*ay+s*ax, t*az*az+c   ],
  ];
}

// s_i(t) = sqrt(S*_i² / (1 + (S*_i²/σ²_init − 1)·exp(−S*_i²·t)))
function sv(i, t) {
  const ss = Sstar[i] ** 2;
  return Math.sqrt(ss / Math.max(1 + (ss/initScale - 1) * Math.exp(-ss * t), 1e-15));
}

// tau_i = ln(S*_i²/σ²_init) / S*_i²
function computeTau(i) {
  const ss = Sstar[i] ** 2;
  return Math.max(Math.log(Math.max(ss / initScale, 1.001)) / ss, 0.001);
}

// xlim = tau_20, animation ends at tau_20
function computeTMax() {
  return computeTau(D - 1);
}

// tau_1 for x-axis tick units
function computeTau1() {
  return computeTau(0);
}

// ─── Panel 1 — 3D scatter (canvas) ───────────────────────────────────────────
const canvas1 = document.createElement("canvas");
Object.assign(canvas1.style, { width:"100%", height:"100%", display:"block", cursor:"grab" });
panel1.appendChild(canvas1);
const ctx1 = canvas1.getContext("2d");

const ttip = document.createElement("div");
Object.assign(ttip.style, {
  position:"absolute", pointerEvents:"none", zIndex:"10", display:"none",
  background:"rgba(0,0,0,0.72)", color:"#fff",
  padding:"2px 7px", borderRadius:"3px", fontSize:"11px", whiteSpace:"nowrap",
});
panel1.appendChild(ttip);

let renderedPts = [], hoveredWord = null;

function renderPanel1() {
  const W = canvas1.offsetWidth, H = canvas1.offsetHeight;
  const dpr = devicePixelRatio || 1;
  if (canvas1.width !== W*dpr || canvas1.height !== H*dpr) {
    canvas1.width = W*dpr; canvas1.height = H*dpr;
    ctx1.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx1.clearRect(0, 0, W, H);
  if (!W || !H) return;

  const sX = sv(pcaX-1, currentT), sY = sv(pcaY-1, currentT), sZ = sv(pcaZ-1, currentT);

  const pts = Psi.map((row, wi) => {
    const [rx, ry, rz] = matVec(rotM, [row[pcaX-1]*sX, row[pcaY-1]*sY, row[pcaZ-1]*sZ]);
    return { rx, ry, rz, word: words[wi] };
  });

  const margin = 20;
  const scale = (Math.min(W, H) / 2 - margin) / (fixedMaxR * 1.3);
  const cx = W/2, cy = H/2;

  // Axes
  const aLen = fixedMaxR * 1.18;
  ctx1.lineWidth = 1;
  ctx1.font = "10px system-ui, sans-serif";
  ctx1.textBaseline = "middle";
  [
    { v: [aLen,0,0], label: `PC ${pcaX}` },
    { v: [0,aLen,0], label: `PC ${pcaY}` },
    { v: [0,0,aLen], label: `PC ${pcaZ}` },
  ].forEach(({ v, label }) => {
    const [px, py] = matVec(rotM, v);
    const [nx, ny] = matVec(rotM, v.map(c => -c));
    ctx1.strokeStyle = "#cccccc";
    ctx1.beginPath();
    ctx1.moveTo(cx + nx*scale, cy - ny*scale);
    ctx1.lineTo(cx + px*scale, cy - py*scale);
    ctx1.stroke();
    ctx1.fillStyle = "#aaa";
    ctx1.fillText(label, cx + px*scale + 4, cy - py*scale);
  });

  // Points back→front
  pts.sort((a, b) => a.rz - b.rz);
  renderedPts = [];
  let hoveredPos = null;

  ctx1.fillStyle = "rgba(153,199,255,0.3)";
  pts.forEach(({ rx, ry, rz, word }) => {
    const sx = cx + rx*scale, sy = cy - ry*scale;
    ctx1.beginPath();
    ctx1.arc(sx, sy, 2, 0, Math.PI*2);
    ctx1.fill();
    renderedPts.push({ sx, sy, word });
    if (word === hoveredWord) hoveredPos = { sx, sy };
  });

  if (hoveredPos) {
    ctx1.beginPath();
    ctx1.arc(hoveredPos.sx, hoveredPos.sy, 5, 0, Math.PI*2);
    ctx1.fillStyle = "#196fd8";
    ctx1.fill();
    ctx1.strokeStyle = "#000"; ctx1.lineWidth = 1;
    ctx1.stroke();
  }
}

// Drag to rotate
let dragging = false, dragX = 0, dragY = 0;
canvas1.addEventListener("pointerdown", e => {
  dragging = true; dragX = e.clientX; dragY = e.clientY;
  canvas1.setPointerCapture(e.pointerId);
  canvas1.style.cursor = "grabbing";
});
canvas1.addEventListener("pointermove", e => {
  if (dragging) {
    const dx = e.clientX - dragX, dy = e.clientY - dragY;
    dragX = e.clientX; dragY = e.clientY;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len > 0.1) {
      rotM = matMul(axisRot(-dy/len, dx/len, 0, len * 0.008), rotM);
      console.log("rotM", rotM);
      renderPanel1();
    }
    return;
  }
  // Hover
  const rect = canvas1.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let best = null, bestD = Infinity;
  for (const p of renderedPts) {
    const d = (p.sx-mx)**2 + (p.sy-my)**2;
    if (d < bestD) { bestD = d; best = p; }
  }
  const prev = hoveredWord;
  if (best && bestD < 100) {
    hoveredWord = best.word;
    ttip.style.display = "block";
    ttip.style.left = (best.sx + 8) + "px";
    ttip.style.top  = (best.sy - 16) + "px";
    ttip.textContent = best.word;
  } else {
    hoveredWord = null;
    ttip.style.display = "none";
  }
  if (hoveredWord !== prev) renderPanel1();
});
canvas1.addEventListener("pointerup", e => {
  dragging = false; canvas1.releasePointerCapture(e.pointerId); canvas1.style.cursor = "grab";
});
canvas1.addEventListener("pointerleave", () => { hoveredWord = null; ttip.style.display = "none"; });

// ─── Panel 2 — Singular value curves (Chart.js) ──────────────────────────────
const yMaxSv = Math.max(...Sstar) * 1.1;

// Layout: flex column — [y-label + chart row] then [x-label]
Object.assign(panel2.style, { display: "flex", flexDirection: "column", overflow: "hidden" });

const p2ChartRow = document.createElement("div");
Object.assign(p2ChartRow.style, { display: "flex", flex: "1", minHeight: "0", alignItems: "stretch" });
panel2.appendChild(p2ChartRow);

// Y-axis label (rotated)
const p2YLabelWrap = document.createElement("div");
Object.assign(p2YLabelWrap.style, { width: "22px", flexShrink: "0", position: "relative" });
{
  const inner = document.createElement("div");
  Object.assign(inner.style, {
    position: "absolute", top: "0", bottom: "0", left: "0", right: "0",
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  const txt = document.createElement("div");
  Object.assign(txt.style, { transform: "rotate(-90deg)", whiteSpace: "nowrap", fontSize: "12px", color: "#999" });
  txt.innerHTML = window.katex
    ? window.katex.renderToString("\\text{singular values } s_i(t)", { throwOnError: false, output: "html" })
    : "singular values sᵢ(t)";
  inner.appendChild(txt);
  p2YLabelWrap.appendChild(inner);
}
p2ChartRow.appendChild(p2YLabelWrap);

// Canvas wrapper
const p2CanvasWrap = document.createElement("div");
Object.assign(p2CanvasWrap.style, { flex: "1", position: "relative", minWidth: "0" });
p2ChartRow.appendChild(p2CanvasWrap);

const canvas2 = document.createElement("canvas");
p2CanvasWrap.appendChild(canvas2);

// X-axis label
const p2XLabel = document.createElement("div");
Object.assign(p2XLabel.style, { textAlign: "center", fontSize: "12px", color: "#999", paddingBottom: "2px", flexShrink: "0" });
p2XLabel.innerHTML = window.katex
  ? window.katex.renderToString("\\text{optimization time } t", { throwOnError: false, output: "html" })
  : "optimization time t";
panel2.appendChild(p2XLabel);

// Build chart
const svColors = Array.from({ length: D }, (_, i) =>
  d3.interpolateBlues(0.2 + 0.8 * (1 - i / (D - 1)))
);

const chart2 = new window.Chart(canvas2, {
  type: "line",
  data: {
    datasets: Array.from({ length: D }, (_, i) => ({
      data: [],
      borderColor: svColors[i],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      label: `singular value ${i + 1}`,
    })),
  },
  options: {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    interaction: { mode: "nearest", axis: "xy", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title(items) { return `singular value ${items[0].datasetIndex + 1}`; },
          label()       { return ""; },
        },
      },
    },
    scales: {
      x: {
        type: "linear", min: 0, max: computeTMax(),
        border: { color: "#aaa", width: 1 },
        grid:   { color: "rgba(0,0,0,0.05)" },
        ticks: {
          color: "#999", maxTicksLimit: 5,
          callback(v) {
            const ratio = v / computeTau1();
            return ratio < 0.005 ? "0" : ratio.toFixed(1);
          },
        },
      },
      y: {
        type: "linear", min: 0, max: yMaxSv,
        border: { color: "#aaa", width: 1 },
        grid:   { color: "rgba(0,0,0,0.05)" },
        ticks: { color: "#999", maxTicksLimit: 4 },
      },
    },
  },
});

function initPanel2() {
  chart2.options.scales.x.max = computeTMax();
  chart2.update("none");
}

function renderPanel2() {
  const tEnd = Math.min(currentT, computeTMax());
  // ~40 evaluation points per second of animation time → 800 at end of 20s
  const N = Math.max(2, Math.round(elapsed / 25));
  for (let i = 0; i < D; i++) {
    chart2.data.datasets[i].data = Array.from(
      { length: N + 1 },
      (_, k) => ({ x: tEnd * k / N, y: sv(i, tEnd * k / N) })
    );
  }
  chart2.update("none");
}

// ─── Transport & animation ────────────────────────────────────────────────────
const ANIM_MS = 20000;
let isPlaying = false, elapsed = 0, lastTs = null;
let setInitScaleLocked = () => {};

const { setProgress, controlsRow } = createTransport(dashboard, {
  autostart: false,
  onPlay()  { isPlaying = true;  lastTs = null; setInitScaleLocked(true);  requestAnimationFrame(tick); },
  onPause() { isPlaying = false; },
  onReset() { isPlaying = false; elapsed = 0; currentT = 0; setInitScaleLocked(false); renderPanel1(); renderPanel2(); },
  onSeek(t) {
    elapsed = t * ANIM_MS;
    lastTs = null;
    currentT = t * computeTMax();
    setProgress(t);
    renderPanel1();
    renderPanel2();
  },
});

function tick(ts) {
  if (!isPlaying) { lastTs = null; return; }
  if (lastTs !== null) elapsed += ts - lastTs;
  lastTs = ts;
  const progress = Math.min(elapsed / ANIM_MS, 1);
  currentT = progress * computeTMax();   // animation ends at tau_20
  setProgress(progress);
  renderPanel1();
  renderPanel2();
  if (elapsed < ANIM_MS) requestAnimationFrame(tick);
  else isPlaying = false;
}

// ─── Dashboard layout: init scale left | PC column right ─────────────────────
Object.assign(controlsRow.style, { justifyContent: "center", alignItems: "center", gap: "2em" });

// Init scale slider (left group)
{
  const { element, setLocked } = createSlider(controlsRow, {
    label: "σ² init",
    min: -24, max: -1, step: 0.05, value: Math.log10(initScale),
    format: v => {
      const val = 10**v, e = Math.floor(Math.log10(Math.abs(val)));
      return `${Math.round(val / 10**e)}e${e}`;
    },
    onChange: v => {
      initScale = 10**v;
      initPanel2();
      if (!isPlaying) { renderPanel1(); renderPanel2(); }
    },
  });
  setInitScaleLocked = setLocked;

  // Wider readout (4 chars)
  const readout = element.querySelector(".widget-knob-readout");
  if (readout) readout.style.width = "62px";

  // Larger KaTeX label
  const lbl = element.querySelector(".widget-slider-label");
  if (lbl) {
    lbl.style.fontSize = "1rem";
    if (window.katex) {
      lbl.style.textTransform = "none";
      lbl.innerHTML = window.katex.renderToString(
        "\\sigma^2_{\\mathrm{init}}", { throwOnError: false, output: "html" }
      );
    }
  }
}

// PC sliders — stacked column on the right
const pcCol = document.createElement("div");
Object.assign(pcCol.style, { display: "flex", flexDirection: "column", gap: "0.25em" });
controlsRow.appendChild(pcCol);

createSlider(pcCol, {
  label: "x-axis PC", min: 1, max: 20, step: 1, value: pcaX,
  format: v => String(Math.round(v)),
  onChange: v => { pcaX = Math.round(v); renderPanel1(); },
});
createSlider(pcCol, {
  label: "y-axis PC", min: 1, max: 20, step: 1, value: pcaY,
  format: v => String(Math.round(v)),
  onChange: v => { pcaY = Math.round(v); renderPanel1(); },
});
createSlider(pcCol, {
  label: "z-axis PC", min: 1, max: 20, step: 1, value: pcaZ,
  format: v => String(Math.round(v)),
  onChange: v => { pcaZ = Math.round(v); renderPanel1(); },
});

// ─── Resize & initial render ──────────────────────────────────────────────────
new ResizeObserver(() => { renderPanel1(); renderPanel2(); }).observe(content);
requestAnimationFrame(() => { renderPanel1(); renderPanel2(); });
