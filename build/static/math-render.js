// Initialize KaTeX auto-render when the page loads
document.addEventListener("DOMContentLoaded", function() {
  renderMathInElement(document.body, {
    delimiters: [
      {left: "\\[", right: "\\]", display: true},
      {left: "\\(", right: "\\)", display: false},
      {left: "$$", right: "$$", display: true},
      {left: "$", right: "$", display: false}
    ],
    throwOnError: false,
    macros: {
      // Bold vectors (latin)
      "\\va": "\\mathbf{a}",
      "\\vb": "\\mathbf{b}",
      "\\vc": "\\mathbf{c}",
      "\\vd": "\\mathbf{d}",
      "\\ve": "\\mathbf{e}",
      "\\vf": "\\mathbf{f}",
      "\\vg": "\\mathbf{g}",
      "\\vh": "\\mathbf{h}",
      "\\vi": "\\mathbf{i}",
      "\\vj": "\\mathbf{j}",
      "\\vk": "\\mathbf{k}",
      "\\vl": "\\mathbf{l}",
      "\\vm": "\\mathbf{m}",
      "\\vn": "\\mathbf{n}",
      "\\vo": "\\mathbf{o}",
      "\\vp": "\\mathbf{p}",
      "\\vq": "\\mathbf{q}",
      "\\vr": "\\mathbf{r}",
      "\\vs": "\\mathbf{s}",
      "\\vt": "\\mathbf{t}",
      "\\vu": "\\mathbf{u}",
      "\\vv": "\\mathbf{v}",
      "\\vw": "\\mathbf{w}",
      "\\vx": "\\mathbf{x}",
      "\\vy": "\\mathbf{y}",
      "\\vz": "\\mathbf{z}",
      // Bold vectors (greek)
      "\\valpha":   "\\boldsymbol{\\alpha}",
      "\\vbeta":    "\\boldsymbol{\\beta}",
      "\\vgamma":   "\\boldsymbol{\\gamma}",
      "\\vdelta":   "\\boldsymbol{\\delta}",
      "\\vepsilon": "\\boldsymbol{\\epsilon}",
      "\\vzeta":    "\\boldsymbol{\\zeta}",
      "\\veta":     "\\boldsymbol{\\eta}",
      "\\vtheta":   "\\boldsymbol{\\theta}",
      "\\viota":    "\\boldsymbol{\\iota}",
      "\\vkappa":   "\\boldsymbol{\\kappa}",
      "\\vlambda":  "\\boldsymbol{\\lambda}",
      "\\vmu":      "\\boldsymbol{\\mu}",
      "\\vnu":      "\\boldsymbol{\\nu}",
      "\\vxi":      "\\boldsymbol{\\xi}",
      "\\vpi":      "\\boldsymbol{\\pi}",
      "\\vrho":     "\\boldsymbol{\\rho}",
      "\\vsigma":   "\\boldsymbol{\\sigma}",
      "\\vtau":     "\\boldsymbol{\\tau}",
      "\\vupsilon": "\\boldsymbol{\\upsilon}",
      "\\vphi":     "\\boldsymbol{\\phi}",
      "\\vchi":     "\\boldsymbol{\\chi}",
      "\\vpsi":     "\\boldsymbol{\\psi}",
      "\\vomega":   "\\boldsymbol{\\omega}",
      // Calligraphic / script
      "\\L": "\\mathcal{L}",
      // Number sets
      "\\N": "\\mathbb{N}",
      "\\Z": "\\mathbb{Z}",
      "\\Q": "\\mathbb{Q}",
      "\\R": "\\mathbb{R}",
      // Expectation
      "\\E": "\\mathbb{E}_{#1}\\left[#2\\right]",
      // Norm
      "\\norm": "\\left|\\!\\left|#1\\right|\\!\\right|",
    }
  });
});
