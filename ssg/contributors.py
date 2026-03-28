"""Load contributor data and generate linked author HTML."""

import json
from pathlib import Path
from ssg.config import WHITEPAPER_URL


def load_contributors():
    """Load contributors.json, returns {name: {url, affiliation}} dict."""
    contributors_file = Path('contributors.json')
    if contributors_file.exists():
        with open(contributors_file, 'r') as f:
            data = json.load(f)
        return {
            c['name']: {'url': c.get('url', ''), 'affiliation': c.get('affiliation', '')}
            for c in data.get('contributors', [])
        }
    return {}


def make_author_html(author_str, contributors):
    """Convert an author string to HTML with profile links."""
    if not author_str:
        return author_str
    if author_str.strip() == 'The Learning Mechanics Team':
        return f'<a href="{WHITEPAPER_URL}">The Learning Mechanics Team</a>'
    names = [n.strip() for n in author_str.split(',')]
    linked = []
    for name in names:
        if name in contributors:
            linked.append(f'<a href="{contributors[name]["url"]}">{name}</a>')
        else:
            linked.append(name)
    return ', '.join(linked)


def make_byline_sections(author_str, contributors):
    """Return list of (name_html, affiliation) tuples for byline rendering."""
    if not author_str:
        return []
    if author_str.strip() == 'The Learning Mechanics Team':
        return [(f'<a href="{WHITEPAPER_URL}">The Learning Mechanics Team</a>', '')]
    names = [n.strip() for n in author_str.split(',')]
    sections = []
    for name in names:
        if name in contributors:
            c = contributors[name]
            name_html = f'<a href="{c["url"]}">{name}</a>'
            affiliation = c.get('affiliation', '')
        else:
            name_html = name
            affiliation = ''
        sections.append((name_html, affiliation))
    return sections
