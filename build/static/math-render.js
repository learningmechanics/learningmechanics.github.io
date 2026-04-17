// Initialize KaTeX auto-render when the page loads
document.addEventListener("DOMContentLoaded", function() {
  // Built-in macros (site-wide defaults). User macros live in static/macros.js.
  const katexMacros = {};

  // Merge: built-ins < global macros.js < per-post frontmatter macros
  const postMacrosEl = document.getElementById("post-macros");
  const postMacros = postMacrosEl ? JSON.parse(postMacrosEl.textContent) : {};
  const allMacros = Object.assign({}, katexMacros, window.LATEX_MACROS || {}, postMacros);

  renderMathInElement(document.body, {
    delimiters: [
      {left: "\\[", right: "\\]", display: true},
      {left: "\\(", right: "\\)", display: false},
      {left: "$$", right: "$$", display: true},
      {left: "$", right: "$", display: false}
    ],
    throwOnError: false,
    macros: allMacros,
  });

  // ── Math equation tooltips ─────────────────────────────────────────────────
  // Build tooltip DOM from the data-tip attribute (raw LaTeX string).
  // Lines are separated by literal \n in the source; each line is parsed as
  // "$LaTeX$: description" or plain text.
  // Split tip string on literal \n, but only outside $...$ math spans.
  function splitTipLines(tipRaw) {
    const lines = [];
    let current = "";
    let inMath = false;
    for (let i = 0; i < tipRaw.length; i++) {
      if (tipRaw[i] === '$') {
        inMath = !inMath;
        current += '$';
      } else if (!inMath && tipRaw[i] === '\\' && i + 1 < tipRaw.length && tipRaw[i + 1] === 'n') {
        lines.push(current);
        current = "";
        i++;
      } else {
        current += tipRaw[i];
      }
    }
    lines.push(current);
    return lines;
  }

  function buildTooltip(tipRaw) {
    const div = document.createElement("div");
    div.className = "eq-tip-tooltip";
    splitTipLines(tipRaw).forEach(function(line) {
      line = line.trim();
      if (!line) return;
      const entry = document.createElement("div");
      entry.className = "eq-tip-entry";
      // Match leading $...$  (non-greedy, allows nested \$ via \\.)
      const m = line.match(/^\$((?:[^$\\]|\\.)*)\$([\s\S]*)$/);
      if (m) {
        const mathSpan = document.createElement("span");
        mathSpan.className = "eq-tip-math";
        try {
          mathSpan.innerHTML = katex.renderToString(m[1], {
            throwOnError: false, macros: allMacros, displayMode: false,
          });
        } catch(_) {
          mathSpan.textContent = "$" + m[1] + "$";
        }
        entry.appendChild(mathSpan);
        const rest = m[2].replace(/^:\s*/, "").trim();
        if (rest) {
          const descSpan = document.createElement("span");
          descSpan.className = "eq-tip-desc";
          descSpan.textContent = rest;
          renderMathInElement(descSpan, {
            delimiters: [
              {left: "\\(", right: "\\)", display: false},
              {left: "$", right: "$", display: false},
            ],
            throwOnError: false,
            macros: allMacros,
          });
          entry.appendChild(descSpan);
        }
      } else {
        const fullSpan = document.createElement("span");
        fullSpan.style.gridColumn = "1 / -1";
        fullSpan.textContent = line;
        entry.appendChild(fullSpan);
      }
      div.appendChild(entry);
    });
    return div;
  }

  document.querySelectorAll("span.eq-tip").forEach(function(span) {
    span.setAttribute("tabindex", "0");
    // Render the equation LaTeX stored in data-eq (avoids pandoc processing issues)
    const eqLatex = span.getAttribute("data-eq") || "";
    const isDisplay = span.classList.contains("eq-tip--display");
    const eqContainer = document.createElement("span");
    eqContainer.className = "eq-tip-math";
    try {
      eqContainer.innerHTML = katex.renderToString(eqLatex, {
        throwOnError: false, macros: allMacros, displayMode: isDisplay,
      });
    } catch(_) {
      eqContainer.textContent = (isDisplay ? "$$" : "$") + eqLatex + (isDisplay ? "$$" : "$");
    }
    span.appendChild(eqContainer);
    span.appendChild(buildTooltip(span.getAttribute("data-tip") || ""));
    // For display equations, shrink the hover area to the rendered math width
    // (preserving centering) unless the equation has a \tag (which needs full width).
    if (isDisplay && !eqLatex.includes("\\tag")) {
      span.style.width = "fit-content";
      span.style.margin = "0 auto";
    }
    span.addEventListener("click", function(e) {
      e.stopPropagation();
      const open = span.classList.toggle("eq-tip--open");
      if (open) {
        document.querySelectorAll("span.eq-tip.eq-tip--open").forEach(function(other) {
          if (other !== span) other.classList.remove("eq-tip--open");
        });
      }
    });
  });
  document.addEventListener("click", function() {
    document.querySelectorAll("span.eq-tip.eq-tip--open").forEach(function(s) {
      s.classList.remove("eq-tip--open");
    });
  });

  // ── Collapsible section auto-expand on anchor navigation ──────────────────
  // When navigating to an anchor (#id) that lives inside a <details>, open it.
  function expandToAnchor(hash) {
    if (!hash) return;
    const target = document.getElementById(hash.replace(/^#/, ""));
    if (!target) return;
    let el = target.parentElement;
    while (el) {
      if (el.tagName === "DETAILS") el.open = true;
      el = el.parentElement;
    }
  }
  expandToAnchor(location.hash);
  window.addEventListener("hashchange", function() { expandToAnchor(location.hash); });
});
