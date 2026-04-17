/**
 * Widget Window — scroll-reactive viewport with depth cue and dashboard.
 *
 * Usage:
 *   import { createWidgetWindow } from "/static/widgets/window.js";
 *   const { container, content, bg, dashboard } = createWidgetWindow("#my-widget", {
 *     windowHeight: 1,      // aspect ratio: height / width (1 = square)
 *     depth: 0.1,           // content parallax depth as fraction of inner height
 *   });
 *   // Append your own content into `content`; apply `bg` to your SVG/canvas
 *   // Append knobs/controls into `dashboard` (the face div)
 */

export function createWidgetWindow(selector, opts = {}) {
  const host = document.querySelector(selector);
  if (!host) throw new Error(`Widget host not found: ${selector}`);

  // Read title and description before clearing host content
  const titleText = host.dataset.title ?? "";
  const descText  = host.textContent.trim();
  host.textContent = "";

  const windowHeight = opts.windowHeight ?? 1;
  const depth = opts.depth ?? 0;

  // --- Card wrapper ---
  const card = document.createElement("div");
  card.className = "widget-card";
  host.appendChild(card);

  if (titleText) {
    const titleEl = document.createElement("div");
    titleEl.className = "widget-card-title";
    titleEl.textContent = titleText;
    card.appendChild(titleEl);
  }

  if (descText) {
    const descEl = document.createElement("div");
    descEl.className = "widget-card-desc";
    descEl.textContent = descText;
    card.appendChild(descEl);
  }

  // --- Window DOM structure ---
  const container = document.createElement("div");
  container.className = "widget-window";
  container.style.aspectRatio = `1 / ${windowHeight}`;

  const clipper = document.createElement("div");
  clipper.className = "widget-window-clipper";

  const content = document.createElement("div");
  content.className = "widget-window-content";
  clipper.appendChild(content);
  container.appendChild(clipper);

  const border = document.createElement("div");
  border.className = "widget-window-border";
  container.appendChild(border);

  card.appendChild(container);

  // --- Dashboard DOM structure ---
  const dashWrapper = document.createElement("div");
  dashWrapper.className = "widget-dashboard-wrapper";

  const dashFace = document.createElement("div");
  dashFace.className = "widget-dashboard-face";
  dashWrapper.appendChild(dashFace);

  card.appendChild(dashWrapper);

  // --- Scroll state ---
  let prevFraction = null;
  let rafId = null;

  function scrollFraction() {
    const rect = container.getBoundingClientRect();
    const widgetCenter = rect.top + rect.height / 2;
    const vpCenter = window.innerHeight / 2;
    return Math.max(-1, Math.min(1,
      (widgetCenter - vpCenter) / (vpCenter)));
  }

  // --- Per-frame update: shadow direction + content parallax ---
  function update(fraction) {
    const W = container.clientWidth;
    const H = container.clientHeight;

    // Clipper fills the full container
    clipper.style.left   = `0px`;
    clipper.style.top    = `0px`;
    clipper.style.width  = `${W}px`;
    clipper.style.height = `${H}px`;

    // Inset shadow shifts with scroll: simulates a recessed viewport reacting to viewer angle
    const shadowY = fraction * 10;
    clipper.style.boxShadow = `inset 0px ${shadowY}px 18px 0px rgba(0,0,0,0.13)`;

    // Content parallax: content is taller than viewport, shifts with scroll
    const maxShiftD = depth * H;
    const depthShift = -fraction * maxShiftD;
    content.style.left      = `0px`;
    content.style.top       = `${-maxShiftD}px`;
    content.style.width     = `${W}px`;
    content.style.height    = `${H + 2 * maxShiftD}px`;
    content.style.transform = `translateY(${depthShift}px)`;
  }

  // --- Resize ---
  function resize() {
    prevFraction = null;
    update(scrollFraction());
  }

  // --- Scroll handler ---
  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const frac = scrollFraction();
      if (prevFraction === null || Math.abs(frac - prevFraction) > 0.002) {
        prevFraction = frac;
        update(frac);
      }
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", resize);

  // Initial layout — then re-layout after caller adds controls to dashFace
  resize();
  requestAnimationFrame(resize);

  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue("--widget-window-bg").trim();
  return { container, content, bg, dashboard: dashFace };
}

// ─── Shared Chart.js loader ───────────────────────────────────────────────────
let _chartJsPromise = null;
export function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!_chartJsPromise) {
    _chartJsPromise = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
      s.onload = () => {
        const C = window.Chart;
        // Monotone cubic interpolation by default for all line datasets
        C.defaults.datasets.line.cubicInterpolationMode = "monotone";
        // Allow enough candidate ticks that auto-stepping lands on nice values
        C.defaults.scales.linear.ticks.maxTicksLimit = 6;
        // Never force the axis min/max as ticks — only place ticks at even step positions
        C.defaults.scales.linear.ticks.includeBounds = false;
        res(C);
      };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  return _chartJsPromise;
}

