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
    """Font Awesome CSS include tag (async/non-render-blocking)."""
    return (
        f'  <link rel="stylesheet" href="{FONT_AWESOME_URL}"'
        f' media="print" onload="this.media=\'all\'">\n'
        f'  <noscript><link rel="stylesheet" href="{FONT_AWESOME_URL}"></noscript>'
    )


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
    """Theme toggle script for post pages, including giscus sync and footnote click."""
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

      // Footnote click-to-toggle on touch/mobile
      document.querySelectorAll('span.fn').forEach(function(fn) {
        fn.addEventListener('click', function(e) {
          e.stopPropagation();
          var open = fn.classList.toggle('fn--open');
          // Close all others
          if (open) {
            document.querySelectorAll('span.fn.fn--open').forEach(function(other) {
              if (other !== fn) other.classList.remove('fn--open');
            });
          }
        });
      });
      document.addEventListener('click', function() {
        document.querySelectorAll('span.fn.fn--open').forEach(function(fn) {
          fn.classList.remove('fn--open');
        });
      });

      // TOC scroll-spy
      (function() {
        var tocLinks = document.querySelectorAll('nav.post-toc a');
        if (!tocLinks.length) return;
        var headingIds = Array.from(tocLinks).map(function(a) {
          return a.getAttribute('href').slice(1);
        });
        var headings = headingIds.map(function(id) {
          return document.getElementById(id);
        }).filter(Boolean);

        function onScroll() {
          var scrollY = window.scrollY || window.pageYOffset;
          var active = null;
          for (var i = 0; i < headings.length; i++) {
            if (headings[i].getBoundingClientRect().top <= 120) {
              active = headingIds[i];
            }
          }
          tocLinks.forEach(function(a) {
            var isActive = a.getAttribute('href') === '#' + active;
            a.classList.toggle('toc-active', isActive);
          });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      })();
    });
  </script>'''


def mailerlite_includes():
    """MailerLite CSS (goes in <head>)."""
    return '  <link rel="stylesheet" href="/static/css/mailerlite.css">'


def footer_html():
    """Sitewide footer with newsletter signup and RSS link."""
    return '''\
  <footer class="site-footer">
    <div class="site-footer-inner">

      <div id="mlb2-39697901" class="ml-form-embedContainer ml-subscribe-form ml-subscribe-form-39697901">
        <div class="ml-form-embedWrapper embedForm">
          <div class="ml-form-embedBody ml-form-embedBodyDefault row-form">
            <form class="ml-block-form footer-subscribe-row" action="https://assets.mailerlite.com/jsonp/2258033/forms/184317804357355303/subscribe" data-code="" method="post" target="_blank">
              <div class="ml-form-fieldRow ml-last-item">
                <span class="footer-subscribe-label">Get new articles by email:</span>
                <div class="ml-field-group ml-field-email ml-validate-email ml-validate-required">
                  <input aria-label="email" aria-required="true" type="email" class="form-control" data-inputmask="" name="fields[email]" placeholder="you@email.com" autocomplete="email">
                </div>
                <div class="ml-form-embedSubmit">
                  <button type="submit" class="primary">Subscribe</button>
                  <button disabled="disabled" style="display:none;" type="button" class="loading">
                    <div class="ml-form-embedSubmitLoad"></div>
                  </button>
                </div>
              </div>
              <input type="hidden" name="ml-submit" value="1">
              <input type="hidden" name="anticsrf" value="true">
            </form>
          </div>
          <div class="ml-form-successBody row-success" style="display:none;">
            <p class="footer-subscribe-success">Thanks — you\'re subscribed.</p>
          </div>
        </div>
      </div>

      <div class="footer-links">
        <a href="/openquestions">Open Questions</a>
        <a href="/about">About</a>
        <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Discord</a>
        <a href="/feed.xml">RSS</a>
      </div>

    </div>
  </footer>
  <script>
    (function(w,d,e,u,f,l,n){w[f]=w[f]||function(){(w[f].q=w[f].q||[])
    .push(arguments);},l=d.createElement(e),l.async=1,l.src=u,
    n=d.getElementsByTagName(e)[0],n.parentNode.insertBefore(l,n);})
    (window,document,\'script\',\'https://assets.mailerlite.com/js/universal.js\',\'ml\');
    ml(\'account\', \'2258033\');
  </script>'''


def nav_html(path_prefix=''):
    """Site navigation bar HTML."""
    return f'''\
  <nav class="site-nav">
    <div class="nav-content">
      <a href="/" class="nav-logo">
        <img src="/static/lm_favicon.png" alt="LM logo">
        Learning Mechanics
      </a>
      <div class="nav-links">
        <a href="/openquestions">Open Questions</a>
        <a href="/about">About</a>
        <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Discord</a>
      </div>
    </div>
  </nav>'''
