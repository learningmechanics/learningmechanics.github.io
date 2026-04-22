"""Generate sitemap.xml for the site."""

from datetime import datetime

from ssg.config import SITE_URL


def generate_sitemap(posts, output_dir):
    """Generate sitemap.xml listing all public pages."""
    today = datetime.today().strftime('%Y-%m-%d')

    urls = []

    # Homepage
    urls.append({'loc': f'{SITE_URL}/', 'lastmod': today, 'priority': '1.0'})

    # Open questions index
    urls.append({'loc': f'{SITE_URL}/openquestions', 'lastmod': today, 'priority': '0.8'})

    # About page
    urls.append({'loc': f'{SITE_URL}/about', 'lastmod': today, 'priority': '0.5'})

    # Posts (skip hidden)
    seen_sequences = set()
    for post in sorted(posts, key=lambda p: p.get('date', ''), reverse=True):
        if post.get('hidden') or post.get('coming_soon') or post.get('slug') == 'about':
            continue

        url_path = post.get('url_path', post['slug'])
        loc = f'{SITE_URL}/{url_path}'
        date = post.get('date', today)
        urls.append({'loc': loc, 'lastmod': date, 'priority': '0.7'})

        # Sequence landing page (once per sequence)
        seq_key = post.get('sequence', '')
        if seq_key and not seq_key.startswith('standalone-') and seq_key not in seen_sequences:
            seen_sequences.add(seq_key)
            urls.append({'loc': f'{SITE_URL}/{seq_key}', 'lastmod': date, 'priority': '0.6'})

    # Build XML
    entries = []
    for u in urls:
        entries.append(
            f'  <url>\n'
            f'    <loc>{u["loc"]}</loc>\n'
            f'    <lastmod>{u["lastmod"]}</lastmod>\n'
            f'    <priority>{u["priority"]}</priority>\n'
            f'  </url>'
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + '\n'.join(entries)
        + '\n</urlset>\n'
    )

    (output_dir / 'sitemap.xml').write_text(xml)
    print(f"✓ Generated sitemap.xml ({len(urls)} URLs)")
