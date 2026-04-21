"""Generate landing pages for sequences (e.g. /science-of-dl)."""

from pathlib import Path

from ssg.contributors import load_contributors, make_author_html
from ssg.templates import font_awesome_include, nav_html, theme_script
from ssg.utils import format_date


def generate_sequence_page(seq_key, seq_meta, seq_posts, output_dir):
    """Generate a landing page at /seq_key/index.html."""
    contributors = load_contributors()

    title = seq_meta.get('title', seq_key)
    description = seq_meta.get('description', '')
    numbered = seq_meta.get('numbered', True)
    date_str = format_date(seq_meta.get('date', ''))

    # Build post list using same classes as homepage subposts
    links = []
    for i, post in enumerate(seq_posts, 1):
        url = f"../{post['url_path']}/"
        display = post.get('toc_title', post['title'])
        author = post.get('author', '')
        author_line = f'<span class="post-link-author">{author}</span>' if author else ''
        links.append(
            f'<a href="{url}" class="post-link">'
            f'<span class="post-link-title">{display}</span>'
            f'{author_line}'
            f'</a>'
        )
    posts_html = '<div class="seq-landing-posts">' + ''.join(links) + '</div>'

    desc_html = f'<p class="post-description">{description}</p>' if description else ''
    date_html = f'<div class="post-date seq-landing-date">{date_str}</div>' if date_str else ''

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="../static/lm_favicon.png" type="image/png">
  <title>{title} — Learning Mechanics</title>
{font_awesome_include()}
  <link rel="stylesheet" href="../static/style.css">
</head>
<body>
{nav_html('../')}
  <div class="site-page">
    <main>
      <div class="seq-landing">
        <h1 class="seq-landing-title">{title}</h1>
        {date_html}
        {desc_html}
        {posts_html}
      </div>
    </main>
  </div>
{theme_script()}
</body>
</html>
'''

    seq_dir = output_dir / seq_key
    seq_dir.mkdir(parents=True, exist_ok=True)
    (seq_dir / 'index.html').write_text(html)
    print(f"✓ Generated sequence page: {seq_key}")
