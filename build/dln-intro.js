/**
 * dln-intro.js — implements dln-intro.widget
 * Panel 1: training loss vs. iteration (Chart.js, log x, fixed axes)
 * Panel 2: 6 singular values of W₃W₂W₁, empirical only
 * Panel 3: four 6×6 alignment heatmaps (canvas, RdBu)
 * Controls: createTransport (play/pause/reset only, no time slider)
 * Data: live gradient-descent simulation computed in JS
 */

import { createWidgetWindow, loadChartJs } from "/static/widgets/window.js";
import { createTransport }                 from "/static/widgets/transport.js";

// ─── Load Chart.js ────────────────────────────────────────────────────────────
await loadChartJs();

// ─── Constants & Hyperparameters ──────────────────────────────────────────────
const N = 6;
const DEPTH = 3;
const LR = 0.005;
const INIT_SCALE = 0.01;
const T_SVS = [6/7, 5/7, 4/7, 3/7, 2/7, 1/7]; // Target singular values
const SV_COLORS = ["#0969da","#1a7f37","#d1242f","#8250df","#bc4c00","#005cc5"];
const N_SNAP = 400;

const T_MAT = (() => {
  const T = new Float64Array(N * N);
  for (let i = 0; i < N; i++) T[i * N + i] = T_SVS[i];
  return T;
})();

// ─── Matrix Helpers (N×N row-major Float64Array) ──────────────────────────────
function mm(A, B) {
  const C = new Float64Array(N * N);
  for (let i = 0; i < N; i++)
    for (let k = 0; k < N; k++) {
      const a = A[i*N+k]; if (!a) continue;
      for (let j = 0; j < N; j++) C[i*N+j] += a * B[k*N+j];
    }
  return C;
}
function mT(A) {
  const B = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) B[j*N+i] = A[i*N+j];
  return B;
}
function frobSq(A) { let s = 0; for (const v of A) s += v*v; return s; }

function randn(scale) {
  const A = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    let u, v, r;
    do { u = Math.random()*2-1; v = Math.random()*2-1; r = u*u+v*v; } while (r >= 1 || !r);
    A[i] = u * Math.sqrt(-2 * Math.log(r) / r) * scale;
  }
  return A;
}

// ─── Jacobi SVD for N×N ───────────────────────────────────────────────────────
function svdN(A) {
  const D  = mm(mT(A), A);           
  const Vm = new Float64Array(N*N);  
  for (let i = 0; i < N; i++) Vm[i*N+i] = 1;

  for (let sw = 0; sw < 40; sw++) {
    let off = 0;
    for (let p = 0; p < N-1; p++) for (let q = p+1; q < N; q++) off += D[p*N+q]**2;
    if (off < 1e-28) break;
    for (let p = 0; p < N-1; p++) {
      for (let q = p+1; q < N; q++) {
        const dpq = D[p*N+q]; if (Math.abs(dpq) < 1e-16) continue;
        const dpp = D[p*N+p], dqq = D[q*N+q];
        const th = (dqq - dpp) / (2 * dpq);
        const t  = Math.sign(th) / (Math.abs(th) + Math.sqrt(1 + th*th));
        const c  = 1 / Math.sqrt(1 + t*t), s = t * c;
        for (let r = 0; r < N; r++) if (r !== p && r !== q) {
          const drp = D[r*N+p], drq = D[r*N+q];
          D[r*N+p] = D[p*N+r] = c*drp - s*drq;
          D[r*N+q] = D[q*N+r] = s*drp + c*drq;
        }
        D[p*N+p] = c*c*dpp - 2*s*c*dpq + s*s*dqq;
        D[q*N+q] = s*s*dpp + 2*s*c*dpq + c*c*dqq;
        D[p*N+q] = D[q*N+p] = 0;
        for (let r = 0; r < N; r++) {
          const vrp = Vm[r*N+p], vrq = Vm[r*N+q];
          Vm[r*N+p] = c*vrp - s*vrq; Vm[r*N+q] = s*vrp + c*vrq;
        }
      }
    }
  }

  const ev  = Array.from({length:N}, (_,i) => Math.max(D[i*N+i], 0));
  const ord = Array.from({length:N}, (_,i) => i).sort((a,b) => ev[b]-ev[a]);
  const S = new Float64Array(N), V = new Float64Array(N*N);
  for (let j = 0; j < N; j++) {
    S[j] = Math.sqrt(ev[ord[j]]);
    for (let r = 0; r < N; r++) V[r*N+j] = Vm[r*N+ord[j]];
  }
  const U = new Float64Array(N*N);
  for (let j = 0; j < N; j++) {
    if (S[j] < 1e-10) continue;
    for (let r = 0; r < N; r++) {
      let sum = 0; for (let k = 0; k < N; k++) sum += A[r*N+k] * V[k*N+j];
      U[r*N+j] = sum / S[j];
    }
  }
  return { U, S, V };
}

function alignMat(U, V) {
  const M = [];
  for (let i = 0; i < N; i++) {
    M.push([]);
    for (let j = 0; j < N; j++) {
      let d = 0; for (let k = 0; k < N; k++) d += U[k*N+i] * V[k*N+j];
      M[i].push(d);
    }
  }
  return M;
}

function logIters(maxIter, n) {
  const s = new Set([0, maxIter]);
  for (let k = 0; k < n; k++) {
    const frac = k / (n - 1);
    s.add(Math.max(0, Math.min(maxIter, Math.round(Math.pow(maxIter + 1, frac)) - 1)));
  }
  return Array.from(s).sort((a,b) => a-b);
}

const { U: U_T, V: V_T } = svdN(T_MAT);

// ─── Real-Time Simulation Runner ──────────────────────────────────────────────
async function runSim(onProgress) {
  const initWs = Array.from({length: DEPTH}, () => randn(INIT_SCALE));

  function gradStep(Ws, Lp, E) {
    const Rp = new Array(DEPTH).fill(null);
    Rp[1] = Ws[2]; // W_3
    Rp[0] = mm(Rp[1], Ws[1]); // W_3 * W_2
    
    for (let l = 0; l < DEPTH; l++) {
      let G = (Rp[l] !== null) ? mm(mT(Rp[l]), E) : E.slice();
      if (l > 0) G = mm(G, mT(Lp[l-1]));
      const sc = 2 * LR;
      for (let i = 0; i < N*N; i++) Ws[l][i] -= sc * G[i];
    }
  }

  const CHUNK_SIZE = 5000;
  const PRE_PASS_MAX = 2000000;
  let T_conv = null;
  
  // Pre-pass to find convergence limit
  {
    const Ws = initWs.map(W => W.slice());
    for (let iter = 0; iter <= PRE_PASS_MAX; iter++) {
      if (iter % CHUNK_SIZE === 0) {
        if (onProgress) onProgress(`Pre-computing... step ${iter}`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const Lp = [Ws[0]];
      Lp.push(mm(Ws[1], Lp[0]));
      Lp.push(mm(Ws[2], Lp[1]));
      const P = Lp[2];
      const E = P.map((v,i) => v - T_MAT[i]);
      if (frobSq(E) < 0.1) { T_conv = iter; break; }
      if (iter === PRE_PASS_MAX) break;
      gradStep(Ws, Lp, E);
    }
  }

  const maxIter = T_conv !== null ? Math.max(4 * T_conv, 500) : PRE_PASS_MAX;
  const Ws = initWs.map(W => W.slice());
  const iters = logIters(maxIter, N_SNAP);
  const iSet = new Set(iters);
  const snaps = [];

  // Main simulation tracking
  for (let iter = 0; iter <= maxIter; iter++) {
    if (iter % CHUNK_SIZE === 0) {
      if (onProgress) onProgress(`Simulating... step ${iter} / ${maxIter}`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const Lp = [Ws[0]];
    Lp.push(mm(Ws[1], Lp[0]));
    Lp.push(mm(Ws[2], Lp[1]));
    const P = Lp[2];
    const E = P.map((v,i) => v - T_MAT[i]);

    if (iSet.has(iter)) {
      const { S: svs } = svdN(P);
      const wSVDs = Ws.map(W => svdN(W));
      const mats = [];
      mats.push(alignMat(U_T, wSVDs[2].U));         // U_T^T U_3
      mats.push(alignMat(wSVDs[2].V, wSVDs[1].U));  // V_3^T U_2
      mats.push(alignMat(wSVDs[1].V, wSVDs[0].U));  // V_2^T U_1
      mats.push(alignMat(wSVDs[0].V, V_T));         // V_1^T V_T

      snaps.push({ iter, loss: frobSq(E), svs: Array.from(svs), mats });
    }

    if (iter === maxIter) break;
    gradStep(Ws, Lp, E);
  }

  return snaps;
}

// ─── Widget Window Setup ──────────────────────────────────────────────────────
const { content, dashboard } = createWidgetWindow("#dln-intro", {
  windowHeight: 0.55,
  depth: 0.07,
});

Object.assign(content.style, {
  display: "flex", flexDirection: "column", justifyContent: "center",
  width: "100%", height: "100%",
  boxSizing: "border-box", padding: "14px 16px 12px", gap: "10px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  position: "relative", overflow: "hidden",
});

const loadingOverlay = document.createElement("div");
Object.assign(loadingOverlay.style, {
  position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(255,255,255,0.85)", zIndex: 100,
  display: "none", flexDirection: "column", justifyContent: "center", alignItems: "center",
  fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#333", backdropFilter: "blur(2px)"
});
const loadingText = document.createElement("div");
loadingOverlay.appendChild(loadingText);
content.appendChild(loadingOverlay);

// ── Charts Row ────────────────────────────────────────────────────────────────
const chartsRow = document.createElement("div");
Object.assign(chartsRow.style, { display: "flex", gap: "14px", height: "165px", flexShrink: "0" });
content.appendChild(chartsRow);

function makeChartPanel(title) {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { flex: "1", display: "flex", flexDirection: "column", minWidth: "0" });
  const lbl = document.createElement("div");
  lbl.innerHTML = title;
  Object.assign(lbl.style, { fontSize: "10px", color: "#8c959f", marginBottom: "3px" });
  wrap.appendChild(lbl);
  const cw = document.createElement("div");
  Object.assign(cw.style, { flex: "1", position: "relative" });
  wrap.appendChild(cw);
  chartsRow.appendChild(wrap);
  const canvas = document.createElement("canvas");
  cw.appendChild(canvas);
  return canvas;
}

const lossCanvas = makeChartPanel("loss");
const svCanvas   = makeChartPanel(
  window.katex
    ? window.katex.renderToString("\\text{singular values of }W_3W_2W_1",
        { throwOnError: false, output: "html" })
    : "singular values of W₃W₂W₁"
);

// ── Heatmap Section ───────────────────────────────────────────────────────────
const HMAP = 72;  // Reduced from 96 to fit 4 heatmaps horizontally
const MAT_LATEX  = ["U_T^\\top U_3", "V_3^\\top U_2", "V_2^\\top U_1", "V_1^\\top V_T"];
const MAT_LABELS = MAT_LATEX.map(s =>
  window.katex
    ? window.katex.renderToString(s, { throwOnError: false, output: "html" })
    : s
);

const heatSection = document.createElement("div");
Object.assign(heatSection.style, {
  display: "flex", flexShrink: "0", gap: "18px", 
  justifyContent: "center", alignItems: "flex-start",
});
content.appendChild(heatSection);

// Generate heatmap columns dynamically based on MAT_LABELS
const heatCanvases = MAT_LABELS.map(label => {
  const col = document.createElement("div");
  Object.assign(col.style, { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" });
  const lbl = document.createElement("div");
  lbl.innerHTML = label;
  Object.assign(lbl.style, { fontSize: "10px", color: "#8c959f" });
  col.appendChild(lbl);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = HMAP;
  Object.assign(canvas.style, { width: HMAP + "px", height: HMAP + "px", display: "block" });
  col.appendChild(canvas);
  heatSection.appendChild(col);
  return canvas;
});

// Color key: labeled colorbar
const keyCol = document.createElement("div");
Object.assign(keyCol.style, {
  display: "flex", flexDirection: "column", justifyContent: "center",
  gap: "3px", alignSelf: "center", marginLeft: "4px",
});
heatSection.appendChild(keyCol);

const keyTitle = document.createElement("div");
keyTitle.textContent = "alignment";
Object.assign(keyTitle.style, { fontSize: "9px", color: "#8c959f", textAlign: "center" });
keyCol.appendChild(keyTitle);

const keyCanvas = document.createElement("canvas");
keyCanvas.width = 14; keyCanvas.height = HMAP;
Object.assign(keyCanvas.style, { width: "14px", height: HMAP + "px", display: "block", margin: "0 auto" });
keyCol.appendChild(keyCanvas);

const tickRow = document.createElement("div");
Object.assign(tickRow.style, {
  display: "flex", flexDirection: "column", justifyContent: "space-between",
  height: HMAP + "px", fontSize: "9px", color: "#8c959f", lineHeight: "1",
});
["+1", "0", "−1"].forEach(t => {
  const s = document.createElement("span"); s.textContent = t;
  tickRow.appendChild(s);
});

const barTickRow = document.createElement("div");
Object.assign(barTickRow.style, { display: "flex", gap: "3px", alignItems: "stretch" });
keyCol.replaceChild(barTickRow, keyCanvas);
barTickRow.append(keyCanvas, tickRow);

// Draw gradient bar on keyCanvas (top=+1 blue → bottom=−1 red)
(function drawKeyBar() {
  const ctx = keyCanvas.getContext("2d");
  const W = keyCanvas.width, H = keyCanvas.height;
  for (let y = 0; y < H; y++) {
    const t = 1 - (y / (H - 1)) * 2; 
    if (t >= 0) {
      ctx.fillStyle = `rgb(${Math.round(247+t*(69-247))},${Math.round(247+t*(117-247))},${Math.round(247+t*(180-247))})`;
    } else {
      const f = -t;
      ctx.fillStyle = `rgb(${Math.round(247+f*(215-247))},${Math.round(247+f*(48-247))},${Math.round(247+f*(39-247))})`;
    }
    ctx.fillRect(0, y, W, 1);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
  [0, (H-1)/2, H-1].forEach(y => {
    ctx.beginPath(); ctx.moveTo(W-4, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
  });
})();

// ─── Canvas Heatmap Renderer ──────────────────────────────────────────────────
function rdbu(v) {
  const t = Math.max(-1, Math.min(1, v));
  if (t >= 0) return `rgb(${Math.round(247+t*(69-247))},${Math.round(247+t*(117-247))},${Math.round(247+t*(180-247))})`;
  const f = -t;
  return `rgb(${Math.round(247+f*(215-247))},${Math.round(247+f*(48-247))},${Math.round(247+f*(39-247))})`;
}

function drawHeatmap(canvas, mat) {
  const rows = mat.length, cols = mat[0].length;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const gap = 1;
  const cw = (W - (cols-1)*gap) / cols;
  const ch = (H - (rows-1)*gap) / rows;
  const flipped = [...mat].reverse();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = rdbu(flipped[r][c]);
      ctx.fillRect(Math.round(c*(cw+gap)), Math.round(r*(ch+gap)), Math.ceil(cw), Math.ceil(ch));
    }
}

// ─── Chart.js Configuration ───────────────────────────────────────────────────
const vertLinePlugin = {
  id: "vertLine",
  afterDraw(chart) {
    const x = chart.options.plugins.vertLine?.x;
    if (!x) return;
    const px = chart.scales.x.getPixelForValue(x);
    if (px < chart.chartArea.left || px > chart.chartArea.right) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, chart.chartArea.top); ctx.lineTo(px, chart.chartArea.bottom);
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.setLineDash([4,3]); ctx.lineWidth = 1;
    ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
  },
};

const logXScale = (maxX) => ({
  type: "logarithmic", min: 1, max: maxX,
  border: { color: "#cccccc", width: 1 },
  grid:   { color: "rgba(0,0,0,0.05)" },
  ticks:  { color: "#8c959f", maxTicksLimit: 6,
    callback(v) { return v >= 1000 ? `${Math.round(v/1000)}k` : String(v); } },
});

let lossChart = null, svChart = null;
let plotSnaps = [], plotXs = [], lossArr = [], svArrs = [];

function buildCharts(snaps) {
  plotSnaps = snaps;
  plotXs = snaps.map(s => Math.max(s.iter, 1));
  const maxX = plotXs[plotXs.length - 1];
  const maxLoss = snaps[0].loss * 1.1;
  const maxSV = Math.max(...T_SVS) * 1.1;

  lossArr = snaps.map(() => null);
  svArrs = Array.from({ length: N }, () => snaps.map(() => null));

  if (lossChart) lossChart.destroy();
  lossChart = new Chart(lossCanvas, {
    type: "line",
    plugins: [vertLinePlugin],
    data: {
      labels: plotXs,
      datasets: [{
        data: lossArr,
        borderColor: "#0969da", borderWidth: 1.5,
        pointRadius: 0, fill: true,
        backgroundColor: "rgba(9,105,218,0.05)",
      }],
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false, spanGaps: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false }, vertLine: { x: null } },
      scales: {
        x: logXScale(maxX),
        y: { type: "linear", min: 0, max: maxLoss,
          border: { color: "#cccccc", width: 1 }, grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { color: "#8c959f", maxTicksLimit: 6 } },
      },
    },
  });

  if (svChart) svChart.destroy();
  const svDatasets = [];
  for (let i = 0; i < N; i++) svDatasets.push({
    data: svArrs[i], borderColor: SV_COLORS[i], borderWidth: 2,
    pointRadius: 0, fill: false,
  });

  svChart = new Chart(svCanvas, {
    type: "line", plugins: [vertLinePlugin],
    data: { labels: plotXs, datasets: svDatasets },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false, spanGaps: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false }, vertLine: { x: null } },
      scales: {
        x: logXScale(maxX),
        y: { type: "linear", min: 0, max: maxSV,
          border: { color: "#cccccc", width: 1 }, grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { color: "#8c959f", maxTicksLimit: 6 } },
      },
    },
  });
}

// ─── Transport & Animation State ──────────────────────────────────────────────
const ANIM_MS = 10000;
let isPlaying = false, elapsed = 0, lastTs = null, progress = 1.0;
let currentAnimId = 0, visIdx = -1;

function progressToSnapIdx(p) {
  if (!plotSnaps || !plotSnaps.length) return 0;
  return Math.round(p * (plotSnaps.length - 1));
}

function setVisIdx(newIdx) {
  newIdx = Math.max(0, Math.min(plotSnaps.length - 1, newIdx));
  if (newIdx > visIdx) {
    for (let i = visIdx + 1; i <= newIdx; i++) {
      lossArr[i] = plotSnaps[i].loss;
      for (let j = 0; j < N; j++) svArrs[j][i] = plotSnaps[i].svs[j];
    }
  } else if (newIdx < visIdx) {
    for (let i = newIdx + 1; i <= visIdx; i++) {
      lossArr[i] = null;
      for (let j = 0; j < N; j++) svArrs[j][i] = null;
    }
  }
  visIdx = newIdx;
}

function applySnap(idx) {
  const snap = plotSnaps[idx];
  if (!snap) return;
  const x = Math.max(snap.iter, 1);
  lossChart.options.plugins.vertLine.x = x;
  svChart.options.plugins.vertLine.x   = x;
  lossChart.update("none");
  svChart.update("none");
  
  snap.mats.forEach((mat, i) => {
    if (heatCanvases[i]) drawHeatmap(heatCanvases[i], mat);
  });
}

function applyFrame(p) {
  progress = Math.max(0, Math.min(1, p));
  const idx = progressToSnapIdx(progress);
  setVisIdx(idx);
  applySnap(idx);
}

const { setProgress, setPlayingState } = createTransport(dashboard, {
  autostart: false,
  onPlay() {
    if (progress >= 1.0) { progress = 0; setVisIdx(0); applyFrame(0); }
    isPlaying = true; 
    lastTs = null;
    const animId = ++currentAnimId;
    requestAnimationFrame((ts) => tick(ts, animId));
  },
  onPause() { 
    isPlaying = false; 
    ++currentAnimId; 
  },
  onReset() {
    isPlaying = false; 
    ++currentAnimId; 
    elapsed = 0; progress = 0; lastTs = null;
    applyFrame(0); setProgress(0);
    if (setPlayingState) setPlayingState(false);
  },
  onSeek(t) {
    progress = t; elapsed = t * ANIM_MS; lastTs = null;
    applyFrame(t);
  },
});

function tick(ts, animId) {
  if (!isPlaying || animId !== currentAnimId) { lastTs = null; return; }
  if (lastTs !== null) elapsed += ts - lastTs;
  lastTs = ts;
  
  const p = Math.min(elapsed / ANIM_MS, 1);
  applyFrame(p); 
  setProgress(p);
  
  if (p < 1) {
    requestAnimationFrame((newTs) => tick(newTs, animId));
  } else { 
    isPlaying = false; progress = 1; 
    if (setPlayingState) setPlayingState(false); 
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────
async function runAndSetup() {
  loadingOverlay.style.display = "flex";
  loadingText.textContent = "Initializing...";
  
  const snaps = await runSim((msg) => {
    loadingText.textContent = msg;
  });
  
  buildCharts(snaps);
  loadingOverlay.style.display = "none";
  
  // Set initial widget state to fully converged (progress = 1.0)
  visIdx = -1; elapsed = ANIM_MS; progress = 1.0; lastTs = null;
  applyFrame(1.0);
  setProgress(1.0);
}

setTimeout(runAndSetup, 0);