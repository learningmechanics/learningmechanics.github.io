"""Generate shared HTML fragments for templates, from config."""

from ssg.config import (
    GA_ID, GA_DOMAINS, FONT_AWESOME_URL,
    KATEX_CSS_URL, KATEX_JS_URL, KATEX_RENDER_URL,
    SITE_TITLE
)


def ga_script():
    """Google Analytics script block."""
    domains = ' || \n        '.join(
        f"window.location.hostname === '{d}'" for d in GA_DOMAINS
    )
    return f'''\
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
  <script>
    if ({domains}) {{
      window.dataLayer = window.dataLayer || [];
      function gtag(){{dataLayer.push(arguments);}}
      gtag('js', new Date());
      gtag('config', '{GA_ID}');
    }}
  </script>'''


def katex_includes():
    """KaTeX CSS and JS include tags."""
    return f'''\
  <link rel="stylesheet" href="{KATEX_CSS_URL}">
  <script defer src="{KATEX_JS_URL}"></script>
  <script defer src="{KATEX_RENDER_URL}"></script>'''


def font_awesome_include():
    """Font Awesome CSS include tag."""
    return f'  <link rel="stylesheet" href="{FONT_AWESOME_URL}">'


def theme_script():
    """Theme toggle and persistence script."""
    return '''\
  <script>
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      var icon = document.querySelector('.nav-theme-toggle i');
      if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    document.addEventListener('DOMContentLoaded', function() {
      var saved = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
      var icon = document.querySelector('.nav-theme-toggle i');
      if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
  </script>'''


def post_theme_script():
    """Theme toggle script for post pages, including giscus sync."""
    return '''\
  <script>
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);

      var icon = document.querySelector('.nav-theme-toggle i');
      icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

      var giscus = document.querySelector('iframe.giscus-frame');
      if (giscus) {
        giscus.contentWindow.postMessage(
          { giscus: { setConfig: { theme: next } } },
          'https://giscus.app'
        );
      }
    }

    document.addEventListener('DOMContentLoaded', function() {
      var saved = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
      var icon = document.querySelector('.nav-theme-toggle i');
      if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
  </script>'''


def nav_html(path_prefix=''):
    """Site navigation bar HTML."""
    return f'''\
  <nav class="site-nav">
    <div class="nav-content">
      <a href="/" class="nav-logo">
        <img src="{path_prefix}static/lm_favicon.png" alt="LM logo">
        Learning Mechanics
      </a>
      <div class="nav-links">
        <a href="/openquestions">Open Questions</a>
        <a href="/about">About</a>
      </div>
    </div>
  </nav>'''
