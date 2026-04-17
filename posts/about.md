---
title: "About"
author: "The Learning Mechanics Team"
date: "2026-03-27"
description: "About Learning Mechanics"
no_comments: true
no_byline: true
no_title: true
toc: false
wide_body: true
---

<div style="display:flex;gap:2em;margin-bottom:1.5em;font-size:0.85em;color:#888;align-items:center">
<label>Link color: <input id="pick-link" type="color" value="#004276"></label>
<label>Navbar color: <input id="pick-nav" type="color" value="#0d2a36"></label>
</div>
<script>
document.getElementById('pick-link').addEventListener('input', function() {
  document.documentElement.style.setProperty('--link-color', this.value);
});
document.getElementById('pick-nav').addEventListener('input', function() {
  document.documentElement.style.setProperty('--nav-bg', this.value);
});
</script>

# A scientific theory of deep learning is emerging, slowly but surely.

Understanding deep learning will be *the* intellectual challenge of the early 21st century, much like understanding quantum mechanics in the early 20th.
Progress is being made: pieces of a scientific theory of deep learning are starting to be uncovered and fit together.
It's a slow process, and one aided by coordination among different groups, so we've made this website as a hub to organize and share progress.

Why a science of deep learning?
As it matures, this emerging science will become practically impactful in the training and usage of large models, and also (we anticipate) a central tool for AI safety and alignment.
Plus it's really fascinating: it has deep connections to our own learning.
See [the learning mechanics perspective paper]({{WHITEPAPER_URL}}) for a fuller argument and a description of the emerging science.

If you want to write an article for Learning Mechanics, please reach out to the editors.

---

<!--PEOPLE_SECTION-->

<!--ABOUT_FOOTER-->
