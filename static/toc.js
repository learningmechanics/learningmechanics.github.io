/**
 * Drives active-section highlighting in the sticky TOC.
 * Uses IntersectionObserver to track which heading is currently in view
 * and applies the .toc-active class to the matching TOC link.
 *
 * Sticky positioning and alignment with the article top are handled
 * entirely by CSS + grid spacer divs (see .toc-spacer in layout.css).
 */
(function () {
  const toc = document.querySelector('nav.post-toc');
  if (!toc) return;

  const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  const linkMap = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));

  const headings = links
    .map(a => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);

  if (!headings.length) return;

  let activeId = null;

  function setActive(id) {
    if (id === activeId) return;
    if (activeId) linkMap.get(activeId)?.classList.remove('toc-active');
    activeId = id;
    if (id) linkMap.get(id)?.classList.add('toc-active');
  }

  const visible = new Set();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.add(entry.target.id);
        } else {
          visible.delete(entry.target.id);
        }
      }

      if (visible.size > 0) {
        // Pick the topmost visible heading in document order.
        const first = headings.find(h => visible.has(h.id));
        if (first) setActive(first.id);
      } else {
        // No heading is intersecting — find the last one scrolled past.
        const threshold = window.scrollY + window.innerHeight * 0.25;
        let best = null;
        for (const h of headings) {
          if (h.getBoundingClientRect().top + window.scrollY <= threshold) {
            best = h.id;
          } else {
            break;
          }
        }
        setActive(best);
      }
    },
    {
      rootMargin: '0px 0px -75% 0px',
      threshold: 0,
    }
  );

  headings.forEach(h => observer.observe(h));
})();
