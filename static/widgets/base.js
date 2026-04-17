/**
 * Learning Mechanics — shared widget utilities.
 *
 * Usage from a per-post companion script:
 *
 *   import { d3, createResponsiveSVG, COLORS, addSlider } from "/static/widgets/base.js";
 */

// Re-export D3 so every companion script gets it for free.
import d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
export { d3 };

// ---------------------------------------------------------------------------
// Color palette (mirrors CSS custom properties for consistency)
// ---------------------------------------------------------------------------

const root = getComputedStyle(document.documentElement);
const css = (prop) => root.getPropertyValue(prop).trim();

export const COLORS = {
  text:    css("--text-color")    || "rgba(0,0,0,0.8)",
  heading: css("--heading-color") || "rgba(0,0,0,0.9)",
  link:    css("--link-color")    || "#004276",
  accent:  css("--accent-color")  || "#009688",
  meta:    css("--meta-color")    || "rgba(0,0,0,0.5)",
  border:  css("--border-color")  || "rgba(0,0,0,0.1)",
  bg:      css("--bg-color")      || "#fff",
};

// ---------------------------------------------------------------------------
// createResponsiveSVG — standard D3 margin-convention helper
// ---------------------------------------------------------------------------

/**
 * Append a responsive SVG with a translated <g> group to the given container.
 *
 * @param {string} selector  CSS selector for the container element.
 * @param {object} opts
 * @param {number} opts.width   Viewbox width  (default 640).
 * @param {number} opts.height  Viewbox height (default 400).
 * @param {object} opts.margin  {top, right, bottom, left} (defaults provided).
 * @returns {{ svg, g, width, height }}  The outer SVG, inner <g>, and usable dimensions.
 */
export function createResponsiveSVG(selector, {
  width  = 640,
  height = 400,
  margin = { top: 20, right: 20, bottom: 40, left: 50 },
} = {}) {
  const innerWidth  = width  - margin.left - margin.right;
  const innerHeight = height - margin.top  - margin.bottom;

  const svg = d3.select(selector)
    .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .classed("widget-svg", true);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  return { svg, g, width: innerWidth, height: innerHeight, margin };
}

// ---------------------------------------------------------------------------
// addSlider — reusable slider input
// ---------------------------------------------------------------------------

/**
 * Append a labeled range slider to the given container.
 *
 * @param {string|Element} container  CSS selector or DOM element.
 * @param {object} opts
 * @param {number}   opts.min       Minimum value.
 * @param {number}   opts.max       Maximum value.
 * @param {number}   opts.step      Step increment (default 1).
 * @param {number}   opts.value     Initial value (default min).
 * @param {string}   opts.label     Label text.
 * @param {function} opts.format    Format function for display value (default identity).
 * @param {function} opts.onChange  Callback receiving the new numeric value.
 * @returns {HTMLInputElement} The <input type="range"> element.
 */
export function addSlider(container, {
  min,
  max,
  step     = 1,
  value    = min,
  label    = "",
  format   = (v) => v,
  onChange = () => {},
} = {}) {
  const wrapper = d3.select(
    typeof container === "string" ? document.querySelector(container) : container
  );

  const row = wrapper.append("div").attr("class", "widget-slider");

  if (label) {
    row.append("label").attr("class", "widget-slider-label").text(label);
  }

  const input = row.append("input")
    .attr("type", "range")
    .attr("min", min)
    .attr("max", max)
    .attr("step", step)
    .property("value", value);

  const readout = row.append("span")
    .attr("class", "widget-slider-value")
    .text(format(value));

  input.on("input", function () {
    const v = +this.value;
    readout.text(format(v));
    onChange(v);
  });

  return input.node();
}
