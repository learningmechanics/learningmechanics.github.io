/**
 * dln-body.js — implements dln-body.widget
 * Panels: loss chart, SV chart + theory, alignment heatmaps, 3D loss landscape
 * Controls: Depth [1–4], Init Scale [Small / Medium / Large]
 * Data: live gradient-descent simulation computed in JS
 */

import { createWidgetWindow, loadChartJs } from "/static/widgets/window.js";
import { createTransport }                 from "/static/widgets/transport.js";

await loadChartJs();

// ── Constants ─────────────────────────────────────────────────────────────────
const N       = 6;
const T_SVS   = [3.0, 2.4, 1.8, 1.2, 0.7, 0.3];
const SV_COLORS = ['#0969da','#1a7f37','#d1242f','#8250df','#bc4c00','#005cc5'];
const INIT_CFGS = {
  Small:  { lr: 0.005, init_scale: 0.01 },
  Medium: { lr: 0.05,  init_scale: 0.1  },
  Large:  { lr: 0.1,   init_scale: 0.2   },
};
const N_SNAP  = 200;

// ── Target matrix: T = diag(T_SVS) ───────────────────────────────────────────
const T_MAT = (() => {
  const T = new Float64Array(N * N);
  for (let i = 0; i < N; i++) T[i * N + i] = T_SVS[i];
  return T;
})();

// ── Matrix helpers (N×N row-major Float64Array) ───────────────────────────────
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

// ── Jacobi SVD for N×N ───────────────────────────────────────────────────────
function svdN(A) {
  const D  = mm(mT(A), A);           // A^T A  (symmetric PSD)
  const Vm = new Float64Array(N*N);  // accumulate Givens rotations
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

// Alignment matrix M[i][j] = (col i of U) · (col j of V)
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

// ── Log-spaced iteration indices ──────────────────────────────────────────────
function logIters(maxIter, n) {
  const s = new Set([0, maxIter]);
  for (let k = 0; k < n; k++) {
    const frac = k / (n - 1);
    s.add(Math.max(0, Math.min(maxIter, Math.round(Math.pow(maxIter + 1, frac)) - 1)));
  }
  return Array.from(s).sort((a,b) => a-b);
}

// Target SVD (fixed — T is diagonal so U_T = V_T = I)
const { U: U_T, V: V_T } = svdN(T_MAT);

// ── Simulation ────────────────────────────────────────────────────────────────
async function runSim(depth, { lr, init_scale, aligned_init }, onProgress) {
  let initWs;
  if (aligned_init === "On") {
    // Aligned (orthogonal) initialization
    const Rs = [V_T]; 
    for (let l = 0; l < depth - 1; l++) Rs.push(svdN(randn(1.0)).U); 
    Rs.push(U_T); 
    
    const D = new Float64Array(N * N);
    for (let i = 0; i < N; i++) {
      // FIX 1: Add a tiny, strictly decreasing perturbation to break degeneracy.
      // This forces the Jacobi SVD algorithm to perfectly sort the modes at iteration 0
      // rendering the heatmaps as perfect +1/-1 diagonals instead of random noise.
      D[i * N + i] = init_scale * (1 + (N - i) * 1e-4);
    }
    initWs = Array.from({length: depth}, (_, l) => mm(mm(Rs[l + 1], D), mT(Rs[l])));
  } else {
    initWs = Array.from({length: depth}, () => randn(init_scale));
  }

  // Helper: one gradient step in-place
  function gradStep(Ws, Lp, E) {
    const Rp = new Array(depth).fill(null);
    if (depth >= 2) {
      Rp[depth-2] = Ws[depth-1];
      for (let l = depth-3; l >= 0; l--) Rp[l] = mm(Rp[l+1], Ws[l+1]);
    }
    for (let l = 0; l < depth; l++) {
      let G = (Rp[l] !== null) ? mm(mT(Rp[l]), E) : E.slice();
      if (l > 0) G = mm(G, mT(Lp[l-1]));
      const sc = 2 * lr;
      for (let i = 0; i < N*N; i++) Ws[l][i] -= sc * G[i];
    }
  }

  const CHUNK_SIZE = 5000;

  // Pre-pass: find T = first iter where loss < 0.1
  const PRE_PASS_MAX = 2000000;
  let T = null;
  {
    const Ws = initWs.map(W => W.slice());
    for (let iter = 0; iter <= PRE_PASS_MAX; iter++) {
      if (iter % CHUNK_SIZE === 0) {
        if (onProgress) onProgress(`Pre-computing... step ${iter}`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const Lp = [Ws[0]];
      for (let l = 1; l < depth; l++) Lp.push(mm(Ws[l], Lp[l-1]));
      const P = Lp[depth-1];
      const E = P.map((v,i) => v - T_MAT[i]);
      if (frobSq(E) < 0.1) { T = iter; break; }
      if (iter === PRE_PASS_MAX) break;
      gradStep(Ws, Lp, E);
    }
  }

  const maxIter = T !== null ? Math.max(4 * T, 500) : PRE_PASS_MAX;
  const Ws  = initWs.map(W => W.slice());
  const iters = logIters(maxIter, N_SNAP);
  const iSet  = new Set(iters);
  const snaps = [];

  for (let iter = 0; iter <= maxIter; iter++) {
    if (iter % CHUNK_SIZE === 0) {
      if (onProgress) onProgress(`Simulating... step ${iter} / ${maxIter}`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const Lp = [Ws[0]];
    for (let l = 1; l < depth; l++) Lp.push(mm(Ws[l], Lp[l-1]));
    const P = Lp[depth-1];
    const E = P.map((v,i) => v - T_MAT[i]);

    if (iSet.has(iter)) {
      const { S: svs } = svdN(P);
      const wSVDs = Ws.map(W => svdN(W));
      const mats  = [];
      mats.push(alignMat(U_T, wSVDs[depth-1].U));
      for (let l = depth-1; l >= 1; l--)
        mats.push(alignMat(wSVDs[l].V, wSVDs[l-1].U));
      mats.push(alignMat(wSVDs[0].V, V_T));

      const s1 = svs[0];
      const s2 = svs[1] !== undefined ? svs[1] : 0;
      snaps.push({ iter, loss: frobSq(E), svs: Array.from(svs), mats, traj: {s1, s2} });
    }

    if (iter === maxIter) break;
    gradStep(Ws, Lp, E);
  }

  const theory = buildTheory(depth, lr, snaps[0].svs, snaps);
  return { snaps, theory };
}

// ds/d(step) = 2 * depth * lr * s^(2-2/depth) * (s_target - s)
function buildTheory(depth, lr, s0, snaps) {
  const exp     = 2 - 2 / depth;
  const s       = s0.slice();
  const snapMap = new Map(snaps.map((sn,i) => [sn.iter, i]));
  const maxI    = snaps[snaps.length-1].iter;
  const out     = Array.from({length:N}, () => new Array(snaps.length).fill(0));

  for (let iter = 0; iter <= maxI; iter++) {
    const si = snapMap.get(iter);
    if (si !== undefined) for (let j = 0; j < N; j++) out[j][si] = Math.max(s[j], 0);
    if (iter === maxI) break;
    for (let j = 0; j < N; j++) {
      const tgt = T_SVS[j];
      
      // FIX 2: Added the missing "2 *" multiplier. 
      // Because gradStep scales the gradient by 2*lr, the theory ODE must as well.
      // Without this, the theory curves run at exactly half the speed of the empirical simulation.
      const f = v => 2 * depth * lr * Math.pow(Math.max(v, 1e-15), exp) * (tgt - v);
      
      const k1 = f(s[j]), k2 = f(s[j]+.5*k1), k3 = f(s[j]+.5*k2), k4 = f(s[j]+k3);
      s[j] = Math.max(0, s[j] + (k1 + 2*k2 + 2*k3 + k4) / 6);
    }
  }
  return out;
}

// ── Widget window ─────────────────────────────────────────────────────────────
const { content, dashboard } = createWidgetWindow("#dln-body", {
  windowHeight: 1.05,
  depth: 0,
});

Object.assign(content.style, {
  display: "flex", flexDirection: "column",
  width: "100%", height: "100%",
  boxSizing: "border-box", padding: "10px 14px 8px",
  gap: "7px", fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: "12px", overflow: "hidden",
});

// Ensure content is positioned relatively so the absolute overlay covers it
content.style.position = "relative";

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

// ── Controls row ──────────────────────────────────────────────────────────────
const ctrlRow = document.createElement("div");
Object.assign(ctrlRow.style, {
  display: "flex", gap: "18px", justifyContent: "center",
  alignItems: "center", flexShrink: "0",
});
content.appendChild(ctrlRow);

let currentDepth = 1, currentInitLabel = "Small", currentAlignedInit = "Off";
let simData = null;

function makeButtonGroup(labelText, options, onSelect) {
  const grp = document.createElement("div");
  Object.assign(grp.style, { display: "flex", gap: "0", alignItems: "center" });
  const lbl = document.createElement("span");
  lbl.textContent = labelText + ":";
  Object.assign(lbl.style, { color: "#8c959f", marginRight: "6px", fontSize: "11px" });
  grp.appendChild(lbl);
  let activeBtnEl = null;
  options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.textContent = String(opt);
    const isFirst  = idx === 0, isLast = idx === options.length - 1;
    Object.assign(btn.style, {
      padding: "2px 8px", cursor: "pointer",
      border: "1px solid #d0d7de", background: "#f6f8fa",
      fontSize: "11px", fontFamily: "inherit", color: "#24292f",
      borderRadius: isFirst ? "4px 0 0 4px" : isLast ? "0 4px 4px 0" : "0",
      marginLeft: isFirst ? "0" : "-1px",
    });
    btn.addEventListener("click", () => {
      if (activeBtnEl) Object.assign(activeBtnEl.style, {
        background: "#f6f8fa", color: "#24292f", fontWeight: "normal",
      });
      Object.assign(btn.style, {
        background: "#0969da", color: "#fff", fontWeight: "600",
        border: "1px solid #0969da", zIndex: "1", position: "relative",
      });
      activeBtnEl = btn;
      onSelect(opt);
    });
    grp.appendChild(btn);
    if (idx === 0) setTimeout(() => btn.click(), 0);
  });
  return grp;
}

// ── Charts row ────────────────────────────────────────────────────────────────
const chartsRow = document.createElement("div");
Object.assign(chartsRow.style, { display: "flex", gap: "10px", height: "145px", flexShrink: "0" });
content.appendChild(chartsRow);

function makeChartPanel(titleText) {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { flex: "1", display: "flex", flexDirection: "column", minWidth: "0" });
  const lbl = document.createElement("div");
  lbl.textContent = titleText;
  Object.assign(lbl.style, { fontSize: "10px", color: "#8c959f", marginBottom: "2px", flexShrink: "0" });
  wrap.appendChild(lbl);
  const cw = document.createElement("div");
  Object.assign(cw.style, { flex: "1", position: "relative", minHeight: "0" });
  wrap.appendChild(cw);
  chartsRow.appendChild(wrap);
  const canvas = document.createElement("canvas");
  cw.appendChild(canvas);
  return canvas;
}
const lossCanvas = makeChartPanel("loss");
const svCanvas   = makeChartPanel("singular values");

// SV legend row
const svLegendRow = document.createElement("div");
Object.assign(svLegendRow.style, {
  display: "flex", gap: "12px", justifyContent: "center",
  fontSize: "10px", color: "#8c959f", flexShrink: "0",
});
[
  { label: "empirical", dash: false },
  { label: "theory",    dash: true  },
].forEach(({ label, dash }) => {
  const item = document.createElement("div");
  Object.assign(item.style, { display: "flex", alignItems: "center", gap: "4px" });
  const line = document.createElement("div");
  Object.assign(line.style, {
    width: "20px", height: "2px", background: "#8c959f",
    ...(dash ? { background: "none", borderTop: "1.5px dashed #8c959f" } : {}),
  });
  item.append(line, document.createTextNode(label));
  svLegendRow.appendChild(item);
});
content.appendChild(svLegendRow);

// ── Vertical indicator plugin for Chart.js ────────────────────────────────────
const vertLinePlugin = {
  id: "vertLine",
  afterDraw(chart) {
    const x = chart.options.plugins.vertLine?.x;
    if (x == null || x < 1) return;
    const px = chart.scales.x.getPixelForValue(x);
    if (px < chart.chartArea.left || px > chart.chartArea.right) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, chart.chartArea.top); ctx.lineTo(px, chart.chartArea.bottom);
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.setLineDash([4,3]); ctx.lineWidth = 1;
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  },
};

const logXScale = (maxIter) => ({
  type: "logarithmic", min: 1, max: maxIter,
  border: { color: "#cccccc", width: 1 },
  grid:   { color: "rgba(0,0,0,0.05)" },
  ticks:  { color: "#8c959f", maxTicksLimit: 6,
    callback(v) { return v >= 1000 ? `${Math.round(v/1000)}k` : String(v); } },
});

let lossChart = null, svChart = null;
let lossData = [], svEmpData = [], svThData = [];
let snapshots = [];

function buildCharts(snaps, theory) {
  snapshots = snaps;
  const xs    = snaps.map(s => Math.max(s.iter, 1));
  const maxX  = xs[xs.length-1];
  const maxL  = Math.max(...snaps.map(s => s.loss)) * 1.1;
  const maxSV = Math.max(...T_SVS) * 1.15;

  lossData   = snaps.map(() => null);
  svEmpData  = Array.from({length:N}, () => snaps.map(() => null));
  svThData   = Array.from({length:N}, (_, j) => theory[j].slice());

  if (lossChart) lossChart.destroy();
  lossChart = new window.Chart(lossCanvas, {
    type: "line", plugins: [vertLinePlugin],
    data: {
      labels: xs,
      datasets: [{ data: lossData, borderColor: "#0969da", borderWidth: 1.5,
        pointRadius: 0, fill: true, backgroundColor: "rgba(9,105,218,0.05)" }],
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false, spanGaps: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false }, vertLine: { x: null } },
      scales: {
        x: logXScale(maxX),
        y: { type: "linear", min: 0, max: maxL,
          border: { color: "#cccccc", width: 1 }, grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { color: "#8c959f", maxTicksLimit: 6 } },
      },
    },
  });

  if (svChart) svChart.destroy();
  const svDatasets = [];
  for (let i = 0; i < N; i++) svDatasets.push({
    data: svEmpData[i], borderColor: SV_COLORS[i], borderWidth: 2,
    pointRadius: 0, fill: false,
  });
  for (let i = 0; i < N; i++) svDatasets.push({
    data: svThData[i], borderColor: SV_COLORS[i], borderWidth: 1.2,
    borderDash: [5,4], pointRadius: 0, fill: false,
  });
  svChart = new window.Chart(svCanvas, {
    type: "line", plugins: [vertLinePlugin],
    data: { labels: xs, datasets: svDatasets },
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

let visIdx = -1;
function setVisIdx(newIdx) {
  newIdx = Math.max(0, Math.min(snapshots.length-1, newIdx));
  if (newIdx > visIdx) {
    for (let i = visIdx+1; i <= newIdx; i++) {
      lossData[i] = snapshots[i].loss;
      for (let j = 0; j < N; j++) svEmpData[j][i] = snapshots[i].svs[j];
    }
  } else if (newIdx < visIdx) {
    for (let i = newIdx+1; i <= visIdx; i++) {
      lossData[i] = null;
      for (let j = 0; j < N; j++) svEmpData[j][i] = null;
    }
  }
  visIdx = newIdx;
}

// ── Panel 3 — alignment heatmaps ─────────────────────────────────────────────
const heatOuter = document.createElement("div");
Object.assign(heatOuter.style, {
  display: "flex", flexDirection: "column", flexShrink: "0",
  alignItems: "center", gap: "4px",
});
content.appendChild(heatOuter);

const HMAP = 62;   

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
  ctx.clearRect(0,0,W,H);
  const gap = 1;
  const cw = (W - (cols-1)*gap) / cols, ch = (H - (rows-1)*gap) / rows;
  const flipped = [...mat].reverse();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = rdbu(flipped[r][c]);
      ctx.fillRect(Math.round(c*(cw+gap)), Math.round(r*(ch+gap)), Math.ceil(cw), Math.ceil(ch));
    }
}

let heatCanvases = [];
let heatRow = null;
let heatMatLabels = [];

const ALIGN_KATEX_BY_DEPTH = [
  ["U_T^\\top U_1", "V_1^\\top V_T"],
  ["U_T^\\top U_2", "V_2^\\top U_1", "V_1^\\top V_T"],
  ["U_T^\\top U_3", "V_3^\\top U_2", "V_2^\\top U_1", "V_1^\\top V_T"],
  ["U_T^\\top U_4", "V_4^\\top U_3", "V_3^\\top U_2", "V_2^\\top U_1", "V_1^\\top V_T"],
];

function buildHeatSection(depth) {
  heatOuter.innerHTML = "";

  const titleDiv = document.createElement("div");
  titleDiv.textContent = "weight alignment";
  Object.assign(titleDiv.style, { fontSize: "10px", color: "#8c959f" });
  heatOuter.appendChild(titleDiv);

  const row = document.createElement("div");
  Object.assign(row.style, { display: "flex", gap: "6px", alignItems: "flex-end" });
  heatOuter.appendChild(row);

  const labels = ALIGN_KATEX_BY_DEPTH[depth-1];
  heatCanvases = labels.map(latex => {
    const col = document.createElement("div");
    Object.assign(col.style, { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" });
    const lbl = document.createElement("div");
    lbl.style.fontSize = "9px"; lbl.style.color = "#8c959f";
    lbl.innerHTML = window.katex
      ? window.katex.renderToString(latex, { throwOnError: false, output: "html" })
      : latex;
    col.appendChild(lbl);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = HMAP;
    Object.assign(canvas.style, { width: HMAP+"px", height: HMAP+"px", display: "block" });
    col.appendChild(canvas);
    row.appendChild(col);
    return canvas;
  });

  const barCol = document.createElement("div");
  Object.assign(barCol.style, {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "2px", marginLeft: "2px",
  });
  row.appendChild(barCol);

  const barCanvas = document.createElement("canvas");
  barCanvas.width = 12; barCanvas.height = HMAP;
  Object.assign(barCanvas.style, { width: "12px", height: HMAP+"px", display: "block" });
  const bctx = barCanvas.getContext("2d");
  for (let y = 0; y < HMAP; y++) {
    const t = 1 - (y / (HMAP-1)) * 2;
    bctx.fillStyle = rdbu(t); bctx.fillRect(0, y, 12, 1);
  }
  bctx.strokeStyle = "rgba(0,0,0,0.2)"; bctx.lineWidth = 1;
  [0, (HMAP-1)/2, HMAP-1].forEach(y => {
    bctx.beginPath(); bctx.moveTo(8, y+.5); bctx.lineTo(12, y+.5); bctx.stroke();
  });

  const tickCol = document.createElement("div");
  Object.assign(tickCol.style, {
    display: "flex", flexDirection: "column", justifyContent: "space-between",
    height: HMAP+"px", fontSize: "9px", color: "#8c959f",
  });
  ["+1","0","−1"].forEach(t => { const s = document.createElement("span"); s.textContent = t; tickCol.appendChild(s); });

  const barRow = document.createElement("div");
  Object.assign(barRow.style, { display: "flex", gap: "2px", alignItems: "stretch" });
  barRow.append(barCanvas, tickCol);

  const barWrap = document.createElement("div");
  Object.assign(barWrap.style, { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" });
  const barLbl = document.createElement("div");
  barLbl.textContent = "align";
  Object.assign(barLbl.style, { fontSize: "9px", color: "#8c959f" });
  barWrap.append(barLbl, barRow);
  row.appendChild(barWrap);
}

// ── Panel 4 — 3D loss landscape (canvas) ─────────────────────────────────────
const p4Outer = document.createElement("div");
Object.assign(p4Outer.style, {
  flex: "1", display: "flex", flexDirection: "column", minHeight: "120px", position: "relative",
});
content.appendChild(p4Outer);

const p4Label = document.createElement("div");
p4Label.textContent = "loss landscape";
Object.assign(p4Label.style, { fontSize: "10px", color: "#8c959f", flexShrink: "0", marginBottom: "2px",textAlign: "center"});
p4Outer.appendChild(p4Label);

const p4Panel = document.createElement("div");
Object.assign(p4Panel.style, { flex: "1", position: "relative", overflow: "hidden" });
p4Outer.appendChild(p4Panel);

const p4Canvas = document.createElement("canvas");
Object.assign(p4Canvas.style, { width: "100%", height: "100%", display: "block", cursor: "grab" });
p4Panel.appendChild(p4Canvas);
const ctx4 = p4Canvas.getContext("2d");

const DEFAULT_ROT_M = [
  [ 0.75,   0.66,   0.00 ],
  [-0.33,   0.37,   0.86 ],
  [ 0.57,  -0.65,   0.50 ]
];
let rotM = DEFAULT_ROT_M.map(row => row.slice());
let snapAnimFrame = null;

function lerpMat(A, B, t) {
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i=0; i<3; i++) {
    for (let j=0; j<3; j++) {
      C[i][j] = A[i][j] * (1 - t) + B[i][j] * t;
    }
  }
  return C;
}

function orthoMat(M) {
  const len = v => Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  const norm = v => { const l = len(v); return [v[0]/l, v[1]/l, v[2]/l]; };
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const mul = (v, s) => [v[0]*s, v[1]*s, v[2]*s];

  const r0 = norm(M[0]);
  const r1 = norm(sub(M[1], mul(r0, dot(M[1], r0))));
  const r2 = norm(sub(sub(M[2], mul(r0, dot(M[2], r0))), mul(r1, dot(M[2], r1))));
  return [r0, r1, r2];
}

function mat3Vec(M, [x,y,z]) {
  return [
    M[0][0]*x + M[0][1]*y + M[0][2]*z,
    M[1][0]*x + M[1][1]*y + M[1][2]*z,
    M[2][0]*x + M[2][1]*y + M[2][2]*z,
  ];
}
function mat3Mul(A, B) {
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) for (let k=0;k<3;k++) C[i][j]+=A[i][k]*B[k][j];
  return C;
}
function axisRot(ax, ay, az, ang) {
  const c=Math.cos(ang), s=Math.sin(ang), t=1-c;
  return [
    [t*ax*ax+c,    t*ax*ay-s*az, t*ax*az+s*ay],
    [t*ay*ax+s*az, t*ay*ay+c,    t*ay*az-s*ax],
    [t*az*ax-s*ay, t*az*ay+s*ax, t*az*az+c   ],
  ];
}

const GRID = 28;
let surfPts   = null;  
let surfZNorm = null;  
let surfZMax  = 1;     

function buildSurface() {
  const t1 = T_SVS[0];
  const t2 = T_SVS[1];
  const wTarget1 = Math.pow(t1, 1 / currentDepth);
  const range = wTarget1 * 1.2;

  const zScale = 1.4;
  surfPts = [];
  
  // Start with the loss at the origin as a baseline
  let maxZ = t1**2 + t2**2; 

  for (let i = 0; i <= GRID; i++) {
    surfPts.push([]);
    for (let j = 0; j <= GRID; j++) {
      const w1 = (i/GRID) * range;
      const w2 = (j/GRID) * range;
      const z = (Math.pow(w1, currentDepth) - t1)**2 + (Math.pow(w2, currentDepth) - t2)**2;
      
      surfPts[i].push([w1, w2, z]);
      
      // Track the true highest point on the grid
      if (z > maxZ) {
        maxZ = z;
      }
    }
  }

  // Set the surface maximum to the true maximum so nothing is clamped
  surfZMax = maxZ;

  surfZNorm = surfPts.map(row => row.map(([,, z]) => Math.min(z / surfZMax, 1)));
  
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      surfPts[i][j][2] = surfZNorm[i][j] * zScale;
    }
  }
}
buildSurface();

function bluesColor(t, alpha=1) {
  const rs = [247, 222, 198, 158, 107, 66, 33, 8,  8  ];
  const gs = [251, 235, 219, 202, 174, 146, 113, 81, 48 ];
  const bs = [255, 247, 239, 225, 214, 198, 181, 156, 107];
  const x  = t * (rs.length - 1);
  const lo = Math.floor(x), hi = Math.min(lo+1, rs.length-1);
  const f  = x - lo;
  const r  = Math.round(rs[lo]*(1-f) + rs[hi]*f);
  const g  = Math.round(gs[lo]*(1-f) + gs[hi]*f);
  const b  = Math.round(bs[lo]*(1-f) + bs[hi]*f);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

let p4TrajPoints = []; 

function renderPanel4(snapIdx) {
  const W = p4Canvas.offsetWidth, H = p4Canvas.offsetHeight;
  const dpr = devicePixelRatio || 1;
  if (p4Canvas.width !== W*dpr || p4Canvas.height !== H*dpr) {
    p4Canvas.width = W*dpr; p4Canvas.height = H*dpr;
    ctx4.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx4.clearRect(0,0,W,H);
  if (!W || !H || !simData) return;

  const t1 = T_SVS[0], t2 = T_SVS[1];
  
  // FIX: calculate range/offset based on layer-wise singular values
  const wTarget1 = Math.pow(t1, 1 / currentDepth);
  const range = wTarget1 * 1.2;
  const offset = range / 2; 
  const zScale = 1.4;

  // Divide by a larger number (e.g., 8.0 instead of 6.0) to shrink the geometry
  const scale = (Math.min(W,H) / 8.0) * (2.6 / offset);
  
  // Shift the center point slightly further down (e.g., 0.65 instead of 0.55) 
  // to prevent the high edges of the bowl from clipping at the top
  const cx = W/2, cy = H*0.65;

  const renderItems = [];

  const proj = surfPts.map(row => row.map(pt => {
    const [rx, ry, rz] = mat3Vec(rotM, [pt[0] - offset, pt[1] - offset, pt[2]]);
    return { sx: cx + rx*scale, sy: cy - ry*scale, rz };
  }));

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const pts = [proj[i][j], proj[i+1][j], proj[i+1][j+1], proj[i][j+1]];
      const avgZ = (pts[0].rz + pts[1].rz + pts[2].rz + pts[3].rz) / 4;
      const avgNorm = (surfZNorm[i][j] + surfZNorm[i+1][j] + surfZNorm[i+1][j+1] + surfZNorm[i][j+1]) / 4;
      renderItems.push({ type: "quad", pts, avgZ, avgNorm });
    }
  }

  if (snapshots.length > 0 && snapIdx >= 0) {
    const trajProj = [];

    for (let k = 0; k <= snapIdx; k++) {
      const { s1, s2 } = snapshots[k].traj;
      const zLoss = (s1 - t1)**2 + (s2 - t2)**2;
      const zNorm = Math.min(zLoss / (surfZMax + 1e-8), 1);

      // FIX: Map end-to-end SVs to layer-wise SVs for plotting
      const w1 = Math.pow(Math.max(s1, 0), 1 / currentDepth);
      const w2 = Math.pow(Math.max(s2, 0), 1 / currentDepth);

      const [rx, ry, rz] = mat3Vec(rotM, [w1 - offset, w2 - offset, zNorm * zScale]);
      trajProj.push({ sx: cx + rx*scale, sy: cy - ry*scale, rz });
    }

    for (let k = 0; k < trajProj.length - 1; k++) {
      const p1 = trajProj[k];
      const p2 = trajProj[k+1];
      const avgZ = (p1.rz + p2.rz) / 2;
      renderItems.push({ type: "line", p1, p2, avgZ });
    }

    if (trajProj.length > 0) {
      const lastP = trajProj[trajProj.length - 1];
      renderItems.push({ type: "dot", p: lastP, avgZ: lastP.rz + 0.001 });
    }
  }

  renderItems.sort((a, b) => a.avgZ - b.avgZ);

  for (const item of renderItems) {
    if (item.type === "quad") {
      ctx4.beginPath();
      ctx4.moveTo(item.pts[0].sx, item.pts[0].sy);
      for (let k = 1; k < 4; k++) ctx4.lineTo(item.pts[k].sx, item.pts[k].sy);
      ctx4.closePath();
      ctx4.fillStyle   = bluesColor(0.15 + item.avgNorm * 0.55, 0.85);
      ctx4.strokeStyle = bluesColor(0.15 + item.avgNorm * 0.55, 0.4);
      ctx4.lineWidth   = 0.3;
      ctx4.fill(); ctx4.stroke();
    } else if (item.type === "line") {
      ctx4.beginPath();
      ctx4.moveTo(item.p1.sx, item.p1.sy); ctx4.lineTo(item.p2.sx, item.p2.sy);
      ctx4.strokeStyle = "#d1242f"; ctx4.lineWidth = 3.5; ctx4.lineJoin = "round";
      ctx4.stroke();
    } else if (item.type === "dot") {
      ctx4.fillStyle = "#d1242f"; ctx4.beginPath();
      ctx4.arc(item.p.sx, item.p.sy, 5.0, 0, Math.PI * 2);
      ctx4.fill();
    }
  }

  ctx4.save();
  ctx4.font = "11px system-ui, sans-serif";
  ctx4.fillStyle = "#666"; ctx4.textBaseline = "middle";
  [
    // FIX: Update axis labels to reflect per-layer weights
    { v: [range, 0, 0], label: "w₁" },
    { v: [0, range, 0], label: "w₂" },
  ].forEach(({ v, label }) => {
    const [px, py] = mat3Vec(rotM, [v[0] - offset, v[1] - offset, 0]);
    const [nx, ny] = mat3Vec(rotM, [-offset, -offset, 0]);
    ctx4.strokeStyle = "rgba(0,0,0,0.15)"; ctx4.lineWidth = 1;
    ctx4.beginPath();
    ctx4.moveTo(cx + nx*scale, cy - ny*scale);
    ctx4.lineTo(cx + px*scale, cy - py*scale);
    ctx4.stroke();
    ctx4.fillText(label, cx + px*scale + 4, cy - py*scale);
  });
  ctx4.restore();
}

let dragging4 = false, drag4x = 0, drag4y = 0;

p4Canvas.addEventListener("pointerdown", e => {
  if (snapAnimFrame) cancelAnimationFrame(snapAnimFrame); 
  dragging4 = true; drag4x = e.clientX; drag4y = e.clientY;
  p4Canvas.setPointerCapture(e.pointerId); p4Canvas.style.cursor = "grabbing";
});

p4Canvas.addEventListener("pointermove", e => {
  if (!dragging4) return;
  const dx = e.clientX - drag4x, dy = e.clientY - drag4y;
  drag4x = e.clientX; drag4y = e.clientY;
  const len = Math.sqrt(dx*dx+dy*dy);
  if (len > 0.1) {
    rotM = mat3Mul(axisRot(-dy/len, dx/len, 0, len*0.009), rotM);
    renderPanel4(visIdx);
  }
});

p4Canvas.addEventListener("pointerup", e => {
  dragging4 = false;
  p4Canvas.releasePointerCapture(e.pointerId);
  p4Canvas.style.cursor = "grab";

  const startRotM = rotM.map(row => row.slice());
  const startTime = performance.now();
  const DURATION_MS = 600;

  function animateSnap(time) {
    if (dragging4) return; 

    const elapsed = time - startTime;
    let t = elapsed / DURATION_MS;

    if (t >= 1) {
      rotM = DEFAULT_ROT_M.map(row => row.slice());
      renderPanel4(visIdx);
      return;
    }

    const easeT = 1 - Math.pow(1 - t, 3);
    const lerped = lerpMat(startRotM, DEFAULT_ROT_M, easeT);
    rotM = orthoMat(lerped); 

    renderPanel4(visIdx);
    snapAnimFrame = requestAnimationFrame(animateSnap);
  }

  snapAnimFrame = requestAnimationFrame(animateSnap);
});

// ── Transport ─────────────────────────────────────────────────────────────────
const ANIM_MS = 10000;
let isPlaying = false, elapsed = 0, lastTs = null, progress = 1.0;
let currentAnimId = 0; 

function progressToSnapIdx(p) {
  if (!snapshots || !snapshots.length) return 0;
  return Math.round(p * (snapshots.length - 1));
}

function applyFrame(p) {
  progress = Math.max(0, Math.min(1, p));
  const idx = progressToSnapIdx(progress);
  setVisIdx(idx);
  
  if (!snapshots || !snapshots[idx]) return;
  const snap = snapshots[idx];

  lossChart.options.plugins.vertLine.x = Math.max(snap.iter, 1);
  svChart.options.plugins.vertLine.x   = Math.max(snap.iter, 1);
  lossChart.update("none");
  svChart.update("none");

  snap.mats.forEach((mat, i) => { if (heatCanvases[i]) drawHeatmap(heatCanvases[i], mat); });

  renderPanel4(idx);
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
    elapsed = 0; 
    progress = 0; 
    lastTs = null;
    applyFrame(0); 
    setProgress(0);
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
    isPlaying = false; 
    progress = 1; 
    if (setPlayingState) setPlayingState(false); 
  }
}

// ── Main: run simulation and set up panels ─────────────────────────────────────
let isSimulating = false; 

async function runAndSetup() {
  if (isSimulating) return; 
  isSimulating = true;

  isPlaying = false;
  ++currentAnimId;
  if (setPlayingState) setPlayingState(false); 

  loadingOverlay.style.display = "flex";
  loadingText.textContent = "Initializing...";

  const cfg = { ...INIT_CFGS[currentInitLabel], aligned_init: currentAlignedInit };

  simData = await runSim(currentDepth, cfg, (msg) => {
    loadingText.textContent = msg;
  });

  buildCharts(simData.snaps, simData.theory);
  buildHeatSection(currentDepth);
  buildSurface();

  loadingOverlay.style.display = "none";

  visIdx = -1; elapsed = 0; progress = 0; lastTs = null;
  applyFrame(0); setProgress(0);
  
  isPlaying = true;
  if (setPlayingState) setPlayingState(true); 
  
  const animId = ++currentAnimId;
  requestAnimationFrame((ts) => tick(ts, animId));

  isSimulating = false; 
}

ctrlRow.appendChild(makeButtonGroup("Depth", [1, 2, 3], d => {
  currentDepth = d; if (simData !== null) runAndSetup();
}));
ctrlRow.appendChild(makeButtonGroup("Init Scale", ["Small","Medium","Large"], lbl => {
  currentInitLabel = lbl; if (simData !== null) runAndSetup();
}));
ctrlRow.appendChild(makeButtonGroup("Aligned Init", ["Off", "On"], v => {
  currentAlignedInit = v; if (simData !== null) runAndSetup();
}));

setTimeout(runAndSetup, 0);

new ResizeObserver(() => {
  if (simData) renderPanel4(visIdx);
}).observe(p4Panel);