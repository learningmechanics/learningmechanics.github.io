/**
 * dln-body.js — implements dln-body.widget
 * Layout: 2×2 grid — [loss | SV] / [heatmaps | loss-surface]
 * Controls: Depth, Init Scale live on the dashboard as skeuomorphic sliders
 * Data: live gradient-descent simulation computed in JS
 */

import { createWidgetWindow, loadChartJs } from "/static/widgets/window.js";
import { createTransport }                 from "/static/widgets/transport.js";

await loadChartJs();

// ── Constants ─────────────────────────────────────────────────────────────────
const N       = 6;
const T_SVS   = [6,4,3,2,1,0.5];
const SV_COLORS = ['#0969da','#1a7f37','#d1242f','#8250df','#bc4c00','#005cc5'];
const INIT_CFGS_L1 = {
  Small:  { lr: 0.005, init_scale: 0.0001 },
  Medium: { lr: 0.02,  init_scale: 0.4  },
  Large:  { lr: 0.02,   init_scale: 1.5   },
};
const INIT_CFGS_L2 = {
  Small:  { lr: 0.005, init_scale: 0.00001 },
  Medium: { lr: 0.02,  init_scale: 0.1  },
  Large:  { lr: 0.02,   init_scale: 1.   },
};
const INIT_CFGS_L3 = {
  Small:  { lr: 0.0003, init_scale: 0.1 },
  Medium: { lr: 0.01,  init_scale: 0.3  },
  Large:  { lr: 0.01,   init_scale: 1.   },
};
const INIT_LABELS = ["Small", "Medium", "Large"];
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

function mTinto(A, out) {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) out[j*N+i] = A[i*N+j];
}
function mmAdd(A, B, out) {
  for (let i = 0; i < N; i++) {
    const rowOffset = i * N;
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let k = 0; k < N; k++) sum += A[rowOffset + k] * B[k * N + j];
      out[rowOffset + j] = sum;
    }
  }
}
function subMatrices(A, B, out) {
  for (let i = 0; i < A.length; i++) out[i] = A[i] - B[i];
}

// ── Jacobi SVD for N×N ───────────────────────────────────────────────────────
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
async function runSim(depth, { lr, init_scale }, onProgress) {
  const initWs = Array.from({length: depth}, () => {
    const W = new Float64Array(N * N);
    for (let i = 0; i < N * N; i++) {
      let u, v, r;
      do { u = Math.random()*2-1; v = Math.random()*2-1; r = u*u+v*v; } while (r >= 1 || !r);
      W[i] = init_scale * 1e-1 * u * Math.sqrt(-2 * Math.log(r) / r);
    }
    for (let i = 0; i < N; i++) W[i * N + i] += init_scale;
    return W;
  });

  const CHUNK_SIZE = 50000;
  const PRE_PASS_MAX = 2000000;

  const MAX_DEPTH = 4;
  const lpBufs = Array.from({length: MAX_DEPTH}, () => new Float64Array(N * N));
  const buf_E   = new Float64Array(N * N);
  const buf_rp  = Array.from({length: MAX_DEPTH}, () => new Float64Array(N * N));
  const buf_mT  = new Float64Array(N * N);
  const buf_mT2 = new Float64Array(N * N);
  const buf_G   = new Float64Array(N * N);
  const buf_G2  = new Float64Array(N * N);

  function gradStepBuf(Ws, Lp) {
    if (depth >= 2) {
      for (let l = depth - 3; l >= 0; l--) {
        const rpNext = (l + 1 === depth - 2) ? Ws[depth - 1] : buf_rp[l + 1];
        mmAdd(rpNext, Ws[l + 1], buf_rp[l]);
      }
    }
    for (let l = 0; l < depth; l++) {
      const hasRp = l < depth - 1;
      if (hasRp) {
        const rpL = (l === depth - 2) ? Ws[depth - 1] : buf_rp[l];
        mTinto(rpL, buf_mT);
        mmAdd(buf_mT, buf_E, buf_G);
      } else {
        buf_G.set(buf_E);
      }
      if (l > 0) {
        mTinto(Lp[l - 1], buf_mT2);
        mmAdd(buf_G, buf_mT2, buf_G2);
        for (let i = 0; i < N * N; i++) Ws[l][i] -= 2 * lr * buf_G2[i];
      } else {
        for (let i = 0; i < N * N; i++) Ws[l][i] -= 2 * lr * buf_G[i];
      }
    }
  }

  // Pre-pass: find approximate convergence time
  let T = null;
  const preWs = initWs.map(W => W.slice());

  for (let iter = 0; iter <= PRE_PASS_MAX; iter++) {
    if (iter % CHUNK_SIZE === 0) {
      if (onProgress) onProgress(`Pre-computing... step ${iter}`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const Lp = [preWs[0]];
    for (let l = 1; l < depth; l++) {
      mmAdd(preWs[l], Lp[l - 1], lpBufs[l - 1]);
      Lp.push(lpBufs[l - 1]);
    }
    subMatrices(Lp[depth - 1], T_MAT, buf_E);

    if (iter % 100 === 0 && frobSq(buf_E) < 0.1) {
      T = iter;
      break;
    }
    gradStepBuf(preWs, Lp);
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
    for (let l = 1; l < depth; l++) {
      mmAdd(Ws[l], Lp[l - 1], lpBufs[l - 1]);
      Lp.push(lpBufs[l - 1]);
    }
    subMatrices(Lp[depth - 1], T_MAT, buf_E);

    if (iSet.has(iter)) {
      const { S: svs } = svdN(Lp[depth - 1]);
      const wSVDs = Ws.map(W => svdN(W));
      const mats  = [];
      // mats[0] = U_T^T U_L ; mats[L] = V_1^T V_T ; mats[1..L-1] = V_{l+1}^T U_l
      mats.push(alignMat(U_T, wSVDs[depth-1].U));
      for (let l = depth-1; l >= 1; l--)
        mats.push(alignMat(wSVDs[l].V, wSVDs[l-1].U));
      mats.push(alignMat(wSVDs[0].V, V_T));

      const s1 = svs[0];
      const s2 = svs[1] !== undefined ? svs[1] : 0;
      snaps.push({ iter, loss: frobSq(buf_E), svs: Array.from(svs), mats, traj: {s1, s2} });
    }

    if (iter === maxIter) break;
    gradStepBuf(Ws, Lp);
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
      const f = v => 2 * depth * lr * Math.pow(Math.max(v, 1e-15), exp) * (tgt - v);
      const k1 = f(s[j]), k2 = f(s[j]+.5*k1), k3 = f(s[j]+.5*k2), k4 = f(s[j]+k3);
      s[j] = Math.max(0, s[j] + (k1 + 2*k2 + 2*k3 + k4) / 6);
    }
  }
  return out;
}

// ── KaTeX helper ──────────────────────────────────────────────────────────────
function katexHTML(tex) {
  return window.katex
    ? window.katex.renderToString(tex, { throwOnError: false, output: "html" })
    : tex;
}

// ── Widget window ─────────────────────────────────────────────────────────────
const { content, dashboard } = createWidgetWindow("#dln-body", {
  windowHeight: 0.9,
  depth: 0,
});

Object.assign(content.style, {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gridTemplateRows: "0.66fr 1fr",
  gap: "16px",
  width: "100%", height: "100%",
  boxSizing: "border-box", padding: "18px 24px 14px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: "12px", overflow: "hidden",
  position: "relative",
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

let currentDepth = 1, currentInitIdx = 0;
let simData = null;

// ── Shared panel cell factory (all 4 cells use this) ────────────────────────
function makePanelCell(title) {
  const cell = document.createElement("div");
  Object.assign(cell.style, {
    display: "flex", flexDirection: "column",
    minWidth: "0", minHeight: "0", position: "relative",
  });
  content.appendChild(cell);
  if (title) {
    const titleDiv = document.createElement("div");
    titleDiv.textContent = title;
    Object.assign(titleDiv.style, {
      fontSize: "15px", color: "#6c7479", fontWeight: "500",
      textAlign: "center", flexShrink: "0", marginBottom: "4px",
    });
    cell.appendChild(titleDiv);
  }
  return cell;
}

// ── Helper: make a qwem-style chart   cell with vertical y-label and x-label ────
function makeChartCell(title) {
  const cell = makePanelCell(title);

  const chartRow = document.createElement("div");
  Object.assign(chartRow.style, {
    display: "flex", flex: "1", minHeight: "0", alignItems: "stretch", position: "relative",
  });
  cell.appendChild(chartRow);

  const yLabelWrap = document.createElement("div");
  Object.assign(yLabelWrap.style, { width: "22px", flexShrink: "0", position: "relative" });
  const yInner = document.createElement("div");
  Object.assign(yInner.style, {
    position: "absolute", top: "0", bottom: "0", left: "0", right: "0",
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  const yText = document.createElement("div");
  Object.assign(yText.style, {
    transform: "rotate(-90deg)", whiteSpace: "nowrap", fontSize: "13px", color: "#777",
  });
  yInner.appendChild(yText);
  yLabelWrap.appendChild(yInner);
  chartRow.appendChild(yLabelWrap);

  const canvasWrap = document.createElement("div");
  Object.assign(canvasWrap.style, { flex: "1", position: "relative", minWidth: "0" });
  chartRow.appendChild(canvasWrap);

  const canvas = document.createElement("canvas");
  canvasWrap.appendChild(canvas);

  const xLabel = document.createElement("div");
  Object.assign(xLabel.style, {
    textAlign: "center", fontSize: "13px", color: "#777",
    paddingTop: "2px", flexShrink: "0",
  });
  xLabel.innerHTML = katexHTML("\\text{training time } t");
  cell.appendChild(xLabel);

  return { cell, canvas, canvasWrap, yText };
}

// ── Loss plot cell (top-left) ────────────────────────────────────────────────
const lossParts = makeChartCell("Loss curve");
const lossCanvas = lossParts.canvas;
lossParts.yText.innerHTML = katexHTML("\\mathcal{L}(t)");

// ── SV plot cell (top-right) — has inline empirical/theory legend ────────────
const svParts = makeChartCell("End-to-end singular values");
const svCanvas = svParts.canvas;

function updateSvYLabel() {
  const sup = currentDepth === 1 ? "" : `^{${currentDepth}}`;
  svParts.yText.innerHTML = katexHTML(
    `s_\\mu${sup}(t)`
  );
}
updateSvYLabel();

// SV inline legend (inside canvas wrap, top-left)
const svLegend = document.createElement("div");
Object.assign(svLegend.style, {
  position: "absolute", top: "4px", left: "24px",
  display: "flex", flexDirection: "column", gap: "0px",
  fontSize: "10px", color: "#666",
  background: "rgba(253,254,255,0.8)", padding: "2px 6px",
  borderRadius: "3px", pointerEvents: "none", zIndex: 2,
});
[
  { label: "empirical", dash: false },
  { label: "theory",    dash: true  },
].forEach(({ label, dash }) => {
  const item = document.createElement("div");
  Object.assign(item.style, { display: "flex", alignItems: "center", gap: "4px" });
  const line = document.createElement("div");
  Object.assign(line.style, {
    width: "18px", height: "2px", background: "#777",
    ...(dash ? { background: "none", borderTop: "1.5px dashed #777" } : {}),
  });
  item.append(line, document.createTextNode(label));
  svLegend.appendChild(item);
});
svParts.canvasWrap.appendChild(svLegend);


const logXScale = (maxIter) => ({
  type: "logarithmic", min: 1, max: maxIter,
  border: { color: "#999", width: 1 },
  grid:   { color: "rgba(0,0,0,0.05)" },
  ticks:  { color: "#777", maxTicksLimit: 6,
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
    type: "line", plugins: [],
    data: {
      labels: xs,
      datasets: [{ data: lossData, borderColor: "#b71546", borderWidth: 1.5,
        pointRadius: 0, fill: false }],
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false, spanGaps: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false }, vertLine: { x: null } },
      scales: {
        x: logXScale(maxX),
        y: { type: "linear", min: 0, max: maxL,
          border: { color: "#999", width: 1 }, grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { color: "#777", maxTicksLimit: 6 } },
      },
    },
  });

  if (svChart) svChart.destroy();
  const svDatasets = [];
  for (let i = 0; i < N; i++) svDatasets.push({
    data: svEmpData[i], borderColor: SV_COLORS[i], borderWidth: 2,
    pointRadius: 0, fill: false, label: `singular value ${i+1}`,
  });
  for (let i = 0; i < N; i++) svDatasets.push({
    data: svThData[i], borderColor: SV_COLORS[i], borderWidth: 1.2,
    borderDash: [5,4], pointRadius: 0, fill: false, label: `singular value ${i+1} (theory)`,
  });
  svChart = new window.Chart(svCanvas, {
    type: "line", plugins: [],
    data: { labels: xs, datasets: svDatasets },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false, spanGaps: false,
      interaction: { mode: "nearest", axis: "xy", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title(items) {
              const i = items[0].datasetIndex % N;
              const kind = items[0].datasetIndex < N ? "empirical" : "theory";
              return `singular value ${i + 1} (${kind})`;
            },
            label(item) {
              const y = item.parsed.y;
              return y == null ? "" : `value: ${y.toFixed(3)}`;
            },
          },
        },
        vertLine: { x: null },
      },
      scales: {
        x: logXScale(maxX),
        y: { type: "linear", min: 0, max: maxSV,
          border: { color: "#999", width: 1 }, grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { color: "#777", maxTicksLimit: 6 } },
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

// ── Heatmap cell (bottom-left) ───────────────────────────────────────────────
const heatCell = makePanelCell("Weight alignment");
Object.assign(heatCell.style, {
  alignItems: "center", justifyContent: "flex-start", paddingTop: "24px",
});
const heatContent = document.createElement("div");
Object.assign(heatContent.style, {
  display: "flex", flexDirection: "column", alignItems: "center",
  gap: "6px", flex: "1",
});
heatCell.appendChild(heatContent);

const HMAP = 75;

// Maps a value to [-1,1] using symlog scaling with linthresh=0.01.
// Linear in [-0.01, 0.01]; log outside, reaching ±1 at ±1.
function symlogScale(v, linthresh = 0.1) {
  const logMax = Math.log10(1 / linthresh);  // 2 for linthresh=0.01
  const norm = logMax + 1;
  const absv = Math.abs(v);
  const t = absv < linthresh
    ? (v / linthresh) / norm
    : Math.sign(v) * (Math.log10(absv / linthresh) + 1) / norm;
  return Math.max(-1, Math.min(1, t));
}

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
      ctx.fillStyle = rdbu(symlogScale(flipped[r][c]));
      ctx.fillRect(Math.round(c*(cw+gap)), Math.round(r*(ch+gap)), Math.ceil(cw), Math.ceil(ch));
    }
}

let heatCanvases = [];
function targetRowLabels(depth) {
  return [ `U^{\\star\\top} U_${depth}`, `V_1^\\top V^\\star` ];
}
function adjRowLabels(depth) {
  const out = [];
  for (let l = depth - 1; l >= 1; l--) out.push(`V_${l+1}^\\top U_${l}`);
  return out;
}

function makeHeatmapItem(latex) {
  const col = document.createElement("div");
  Object.assign(col.style, {
    display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
  });
  const lbl = document.createElement("div");
  Object.assign(lbl.style, {
    fontSize: "14px", color: "#6c6c6c", fontWeight: "600",
  });
  lbl.innerHTML = katexHTML(latex);
  col.appendChild(lbl);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = HMAP;
  Object.assign(canvas.style, {
    width: HMAP + "px", height: HMAP + "px", display: "block",
    border: "1px solid rgba(0,0,0,0.08)",
  });
  col.appendChild(canvas);
  return { col, canvas };
}

// Side label for heatmap rows.
// Strategy: rotate a fixed-width text div so its pre-rotation width becomes
// the visual label height. Width = HMAP-10 ≈ 80px → wraps "weight-target"
// onto one line and "alignment" onto the next, fitting cleanly within the row.
function makeSideLabel(text) {
  const LABEL_H = HMAP;   // visual height after rotation (≈ row height)
  const LABEL_W = 48;          // visual width  after rotation (2 text lines)

  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "relative",
    width: LABEL_W + "px", flexShrink: "0",
    alignSelf: "stretch", marginRight: "24px",
    overflow: "hidden",
  });

  const textEl = document.createElement("div");
  Object.assign(textEl.style, {
    position: "absolute", left: "50%", top: "50%",
    transform: "translate(-50%, 0%) rotate(-90deg)",
    width: LABEL_H + "px",        // pre-rotation width → visual height
    fontSize: "11px", lineHeight: "1.4",
    color: "#a2a6ab", fontWeight: "500",
    textAlign: "center", whiteSpace: "normal",
  });
  textEl.textContent = text;
  wrap.appendChild(textEl);
  return wrap;
}

function buildHeatSection(depth) {
  heatContent.innerHTML = "";
  heatCanvases = [];

  // Rows container — stretch so both row outers have equal width for centering
  const rowsWrap = document.createElement("div");
  Object.assign(rowsWrap.style, {
    display: "flex", flexDirection: "column", alignItems: "stretch", gap: "8px",
  });
  heatContent.appendChild(rowsWrap);

  // Row 1: target overlaps  (mats[0], mats[depth]) with side label
  const row1Outer = document.createElement("div");
  Object.assign(row1Outer.style, { display: "flex", alignItems: "center" });
  rowsWrap.appendChild(row1Outer);
  row1Outer.appendChild(makeSideLabel("weight-target\nalignment"));

  const row1 = document.createElement("div");
  Object.assign(row1.style, { display: "flex", flex: "1", gap: "12px", alignItems: "flex-end", justifyContent: "center" });
  row1Outer.appendChild(row1);

  const tgtLabels = targetRowLabels(depth);
  const tgtIdxs = [0, depth];
  tgtLabels.forEach((latex, k) => {
    const { col, canvas } = makeHeatmapItem(latex);
    row1.appendChild(col);
    heatCanvases[tgtIdxs[k]] = canvas;
  });

  // Row 2: adjacent overlaps (mats[1 .. depth-1]) with side label
  const adjLabels = adjRowLabels(depth);
  if (adjLabels.length) {
    const row2Outer = document.createElement("div");
    Object.assign(row2Outer.style, { display: "flex", alignItems: "center" });
    rowsWrap.appendChild(row2Outer);
    row2Outer.appendChild(makeSideLabel("weight-weight\nalignment"));

    const row2 = document.createElement("div");
    Object.assign(row2.style, { display: "flex", flex: "1", gap: "12px", alignItems: "flex-end", justifyContent: "center" });
    row2Outer.appendChild(row2);
    adjLabels.forEach((latex, k) => {
      const { col, canvas } = makeHeatmapItem(latex);
      row2.appendChild(col);
      heatCanvases[1 + k] = canvas;
    });
  }

  // Colorbar legend below both rows
  const barWrap = document.createElement("div");
  Object.assign(barWrap.style, {
    display: "flex", alignItems: "center", gap: "6px", marginTop: "4px",
    paddingLeft: "20px",  // align with heatmaps (side label width + margin)
  });

  const lblMinus = document.createElement("span");
  lblMinus.textContent = "−1";
  Object.assign(lblMinus.style, { fontSize: "9px", color: "#8c959f" });

  const barCanvas = document.createElement("canvas");
  barCanvas.width = 100; barCanvas.height = 8;
  Object.assign(barCanvas.style, { width: "100px", height: "8px", display: "block" });
  const bctx = barCanvas.getContext("2d");
  for (let x = 0; x < 100; x++) {
    const t = -1 + (x / 99) * 2;
    bctx.fillStyle = rdbu(t); bctx.fillRect(x, 0, 1, 8);
  }

  const lblPlus = document.createElement("span");
  lblPlus.textContent = "+1";
  Object.assign(lblPlus.style, { fontSize: "9px", color: "#8c959f" });

  barWrap.append(lblMinus, barCanvas, lblPlus);
  heatContent.appendChild(barWrap);
}

// ── Loss surface cell (bottom-right) ─────────────────────────────────────────
const p4Outer = makePanelCell("Loss landscape");
Object.assign(p4Outer.style, {paddingTop: "24px"});

const p4Panel = document.createElement("div");
Object.assign(p4Panel.style, { flex: "1", position: "relative", overflow: "hidden"});
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
let isSnapping4 = false;
let preDragRotM4 = null;

function lerpMat(A, B, t) {
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i=0; i<3; i++) for (let j=0; j<3; j++) C[i][j] = A[i][j] * (1 - t) + B[i][j] * t;
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

// Surface built in NORMALIZED coords centred at SURF_UCENTER; z normalized to [0,1].
// Domain in rangeMax units: [SURF_UMIN, SURF_UMAX].  Stored as u - SURF_UCENTER so
// the projection origin is at the domain centre.
const GRID = 80;
const Z_SCALE = 1.0;
const TRAJ_LIFT = 0.04;
const SURF_UMIN    = -1.15;
const SURF_UMAX    =  1.15;
const SURF_UCENTER = (SURF_UMIN + SURF_UMAX) / 2;   // 0.6
let surfPts   = null;
let surfZNorm = null;
let surfZMax  = null;
let surfRangeMax = null;

function buildSurface() {
  const t1 = T_SVS[0];
  const t2 = T_SVS[1];
  const wTarget1 = Math.pow(t1, 1 / currentDepth);
  const rangeMax = wTarget1 * 1.2;
  surfRangeMax = rangeMax;

  surfPts = [];

  for (let i = 0; i <= GRID; i++) {
    surfPts.push([]);
    for (let j = 0; j <= GRID; j++) {
      const uRaw = SURF_UMIN + (i / GRID) * (SURF_UMAX - SURF_UMIN);
      const vRaw = SURF_UMIN + (j / GRID) * (SURF_UMAX - SURF_UMIN);
      const w1 = uRaw * rangeMax;
      const w2 = vRaw * rangeMax;
      const z = (Math.pow(w1, currentDepth) - t1)**2
              + (Math.pow(w2, currentDepth) - t2)**2;
      // Store centred coords so projection origin ≈ domain centre
      surfPts[i].push([uRaw - SURF_UCENTER, vRaw - SURF_UCENTER, z]);
    }
  }
  // Normalize by z at origin (w1=0, w2=0): z_origin = t1² + t2²
  surfZMax = t1 * t1 + t2 * t2;

  // No clamping — values above origin height can go above 1.0 visually
  surfZNorm = surfPts.map(row => row.map(([,, z]) => z / surfZMax));

  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      surfPts[i][j][2] = surfZNorm[i][j] * Z_SCALE;
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

function renderPanel4(snapIdx) {
  const W = p4Canvas.offsetWidth, H = p4Canvas.offsetHeight;
  const dpr = devicePixelRatio || 1;
  if (p4Canvas.width !== W*dpr || p4Canvas.height !== H*dpr) {
    p4Canvas.width = W*dpr; p4Canvas.height = H*dpr;
    ctx4.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx4.clearRect(0,0,W,H);
  if (!W || !H || !simData) return;

  // Depth-invariant projection scale: depends only on canvas size.
  const scale = Math.min(W, H) * 0.32;
  const cx = W / 2, cy = H * 0.58;

  // 1) Render the surface (painter's-sorted among itself)
  const surfItems = [];
  const proj = surfPts.map(row => row.map(pt => {
    const [rx, ry, rz] = mat3Vec(rotM, pt);
    return { sx: cx + rx*scale, sy: cy - ry*scale, rz };
  }));

  const SURF_CLIP = 1.35;  // hard cutoff — tiles above this are skipped entirely
  const FADE_START = 0.9;  // tiles below this are fully opaque; above, alpha fades out
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const avgNorm = (surfZNorm[i][j] + surfZNorm[i+1][j] + surfZNorm[i+1][j+1] + surfZNorm[i][j+1]) / 4;
      if (avgNorm > SURF_CLIP) continue;
      const pts = [proj[i][j], proj[i+1][j], proj[i+1][j+1], proj[i][j+1]];
      const avgZ = (pts[0].rz + pts[1].rz + pts[2].rz + pts[3].rz) / 4;
      surfItems.push({ pts, avgZ, avgNorm });
    }
  }
  surfItems.sort((a, b) => a.avgZ - b.avgZ);

  for (const item of surfItems) {
    ctx4.beginPath();
    ctx4.moveTo(item.pts[0].sx, item.pts[0].sy);
    for (let k = 1; k < 4; k++) ctx4.lineTo(item.pts[k].sx, item.pts[k].sy);
    ctx4.closePath();
    const colorT = 1 - Math.min(item.avgNorm / SURF_CLIP, 1);
    const ft = Math.max(0, Math.min(1, (item.avgNorm - FADE_START) / (SURF_CLIP - FADE_START)));
    const fadeAlpha = 1 - ft * ft * (3 - 2 * ft);  // smoothstep
    ctx4.fillStyle   = bluesColor(0.15 + colorT * 0.55, 0.85 * fadeAlpha);
    ctx4.strokeStyle = bluesColor(0.15 + colorT * 0.55, 0.4  * fadeAlpha);
    ctx4.lineWidth   = 0.3;
    ctx4.fill(); ctx4.stroke();
  }

  // 2) Axis frame (on top of surface for clarity)
  ctx4.save();
  ctx4.font = "11px system-ui, sans-serif";
  ctx4.fillStyle = "#666"; ctx4.textBaseline = "middle";
  const axisLo = SURF_UMIN - SURF_UCENTER;   // -0.9
  const axisHi = SURF_UMAX - SURF_UCENTER;   //  0.9
  const axisOrig = -SURF_UCENTER;             // stored coord of w=0
  [
    { pos: [axisHi, axisOrig, 0], neg: [axisLo, axisOrig, 0], label: "s\u2081" },
    { pos: [axisOrig, axisHi, 0], neg: [axisOrig, axisLo, 0], label: "s\u2082" },
  ].forEach(({ pos, neg, label }) => {
    const [px, py] = mat3Vec(rotM, pos);
    const [nx, ny] = mat3Vec(rotM, neg);
    ctx4.strokeStyle = "rgba(0,0,0,0.18)"; ctx4.lineWidth = 1;
    ctx4.beginPath();
    ctx4.moveTo(cx + nx*scale, cy - ny*scale);
    ctx4.lineTo(cx + px*scale, cy - py*scale);
    ctx4.stroke();
    ctx4.fillText(label, cx + px*scale + 4, cy - py*scale);
  });
  ctx4.restore();

  // 3) Trajectory + ball — ALWAYS rendered on top of the surface.
  if (snapshots.length > 0 && snapIdx >= 0) {
    const t1 = T_SVS[0], t2 = T_SVS[1];
    const trajProj = [];
    for (let k = 0; k <= snapIdx; k++) {
      const { s1, s2 } = snapshots[k].traj;
      const w1 = Math.pow(Math.max(s1, 0), 1 / currentDepth);
      const w2 = Math.pow(Math.max(s2, 0), 1 / currentDepth);
      const u = w1 / surfRangeMax - SURF_UCENTER;
      const v = w2 / surfRangeMax - SURF_UCENTER;
      const zLoss = (Math.pow(w1, currentDepth) - t1)**2
                  + (Math.pow(w2, currentDepth) - t2)**2;
      const zn = (zLoss / (surfZMax + 1e-12)) * Z_SCALE + TRAJ_LIFT;
      const [rx, ry] = mat3Vec(rotM, [u, v, zn]);
      trajProj.push({ sx: cx + rx*scale, sy: cy - ry*scale });
    }

    ctx4.strokeStyle = "#d1242f";
    ctx4.lineWidth = 3.0;
    ctx4.lineJoin = "round";
    ctx4.lineCap = "round";
    ctx4.beginPath();
    for (let k = 0; k < trajProj.length; k++) {
      const p = trajProj[k];
      if (k === 0) ctx4.moveTo(p.sx, p.sy);
      else ctx4.lineTo(p.sx, p.sy);
    }
    if (trajProj.length > 1) ctx4.stroke();

    if (trajProj.length > 0) {
      const last = trajProj[trajProj.length - 1];
      ctx4.beginPath();
      ctx4.arc(last.sx, last.sy, 5.0, 0, Math.PI * 2);
      ctx4.fillStyle = "#d1242f"; ctx4.fill();
      ctx4.strokeStyle = "rgba(0,0,0,0.2)"; ctx4.lineWidth = 0.8; ctx4.stroke();
    }
  }
}

let dragging4 = false, drag4x = 0, drag4y = 0;

p4Canvas.addEventListener("pointerdown", e => {
  if (snapAnimFrame) { cancelAnimationFrame(snapAnimFrame); snapAnimFrame = null; isSnapping4 = false; }
  dragging4 = true; drag4x = e.clientX; drag4y = e.clientY;
  preDragRotM4 = rotM.map(row => row.slice());
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
  isSnapping4 = true;

  const startRotM = rotM.map(row => row.slice());
  const targetRotM = preDragRotM4;
  const startTime = performance.now();
  const DURATION_MS = 600;

  function animateSnap(time) {
    if (dragging4) { isSnapping4 = false; return; }

    const elapsedT = time - startTime;
    let t = elapsedT / DURATION_MS;

    if (t >= 1) {
      rotM = targetRotM.map(row => row.slice());
      isSnapping4 = false;
      renderPanel4(visIdx);
      return;
    }

    const easeT = 1 - Math.pow(1 - t, 3);
    const lerped = lerpMat(startRotM, targetRotM, easeT);
    rotM = orthoMat(lerped);

    renderPanel4(visIdx);
    snapAnimFrame = requestAnimationFrame(animateSnap);
  }

  snapAnimFrame = requestAnimationFrame(animateSnap);
});

// ── Auto-rotation (loss surface) ─────────────────────────────────────────────
const AUTO_ROTATE_SPEED = 0.00012; // radians per ms
let autoRotateLastTs4 = null;

function autoRotateLoop4(ts) {
  if (!dragging4 && !isSnapping4) {
    if (autoRotateLastTs4 !== null) {
      const dt = ts - autoRotateLastTs4;
      rotM = mat3Mul(rotM, axisRot(0, 0, 1, dt * AUTO_ROTATE_SPEED));
      if (simData) renderPanel4(visIdx);
    }
    autoRotateLastTs4 = ts;
  } else {
    autoRotateLastTs4 = ts;
  }
  requestAnimationFrame(autoRotateLoop4);
}

// ── Transport + dashboard controls (button groups) ───────────────────────────
const ANIM_MS = 10000;
let isPlaying = false, elapsed = 0, lastTs = null, progress = 0;
let currentAnimId = 0;
let hasSeenViewport = false;

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

function startPlay() {
  if (progress >= 1.0) { progress = 0; setVisIdx(0); applyFrame(0); }
  isPlaying = true;
  lastTs = null;
  if (setPlayingState) setPlayingState(true);
  const animId = ++currentAnimId;
  requestAnimationFrame((ts) => tick(ts, animId));
}

const { setProgress, setPlayingState, controlsRow } = createTransport(dashboard, {
  autostart: false,
  onPlay()  { startPlay(); },
  onPause() { isPlaying = false; ++currentAnimId; },
  onReset() {
    isPlaying = false;
    ++currentAnimId;
    elapsed = 0; progress = 0; lastTs = null;
    rotM = DEFAULT_ROT_M.map(row => row.slice());
    if (setPlayingState) setPlayingState(false);
    setProgress(0);
    runAndSetup(false);
  },
  onSeek(t) {
    progress = t; elapsed = t * ANIM_MS; lastTs = null;
    applyFrame(t);
  },
});

Object.assign(controlsRow.style, { justifyContent: "center", alignItems: "flex-start", gap: "2.5em" });

// Segmented button group with label above — matches slider label styling
function makeButtonGroup(parent, labelText, options, initialIdx, onSelect) {
  const grp = document.createElement("div");
  Object.assign(grp.style, {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px",
  });

  const lbl = document.createElement("span");
  lbl.className = "widget-slider-label";
  lbl.textContent = labelText;
  grp.appendChild(lbl);

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, { display: "flex" });

  let activeBtn = null;

  const activate = (btn) => {
    if (activeBtn) Object.assign(activeBtn.style, {
      background: "#f6f8fa", color: "#24292f", fontWeight: "normal",
      borderColor: "#d0d7de", position: "", zIndex: "",
    });
    Object.assign(btn.style, {
      background: "#0969da", color: "#fff", fontWeight: "600",
      borderColor: "#0969da", position: "relative", zIndex: "1",
    });
    activeBtn = btn;
  };

  options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.textContent = String(opt);
    const isFirst = idx === 0, isLast = idx === options.length - 1;
    Object.assign(btn.style, {
      padding: "4px 12px", cursor: "pointer",
      border: "1px solid #d0d7de", background: "#f6f8fa",
      fontSize: "12px", fontFamily: "inherit", color: "#24292f",
      lineHeight: "1.5",
      borderRadius: isFirst ? "5px 0 0 5px" : isLast ? "0 5px 5px 0" : "0",
      marginLeft: isFirst ? "0" : "-1px",
    });
    btn.addEventListener("click", () => { activate(btn); onSelect(opt, idx); });
    btnRow.appendChild(btn);
    if (idx === initialIdx) setTimeout(() => activate(btn), 0);
  });

  grp.appendChild(btnRow);
  parent.appendChild(grp);
  return grp;
}

makeButtonGroup(controlsRow, "Depth", ["1", "2", "3"], 0, (_opt, idx) => {
  const d = idx + 1;
  if (d !== currentDepth) {
    currentDepth = d;
    updateSvYLabel();
    if (simData !== null) runAndSetup(true);
  }
});

makeButtonGroup(controlsRow, "Init Scale", ["Small", "Medium", "Large"], 0, (_opt, idx) => {
  if (idx !== currentInitIdx) {
    currentInitIdx = idx;
    if (simData !== null) runAndSetup(true);
  }
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

async function runAndSetup(autoplay = true) {
  if (isSimulating) return;
  isSimulating = true;

  isPlaying = false;
  ++currentAnimId;
  if (setPlayingState) setPlayingState(false);

  loadingOverlay.style.display = "flex";
  loadingText.textContent = "Initializing...";

  const cfgsByDepth = [INIT_CFGS_L1, INIT_CFGS_L2, INIT_CFGS_L3];
  const cfg = cfgsByDepth[currentDepth - 1][INIT_LABELS[currentInitIdx]];

  simData = await runSim(currentDepth, cfg, (msg) => {
    loadingText.textContent = msg;
  });

  buildCharts(simData.snaps, simData.theory);
  buildHeatSection(currentDepth);
  buildSurface();

  loadingOverlay.style.display = "none";

  visIdx = -1; elapsed = 0; progress = 0; lastTs = null;
  applyFrame(0);
  setProgress(0);

  if (setPlayingState) setPlayingState(false);

  isSimulating = false;
}

setTimeout(() => runAndSetup(false), 0);

const _bodyObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    hasSeenViewport = true;
    _bodyObserver.disconnect();
    // autoplay removed — user starts manually
  }
}, { threshold: 0.4 });
_bodyObserver.observe(content);

new ResizeObserver(() => {
  if (simData) renderPanel4(visIdx);
}).observe(p4Panel);

requestAnimationFrame(autoRotateLoop4);
