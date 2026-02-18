"""Load contributor data and generate linked author HTML."""

import json
from pathlib import Path
from ssg.config import WHITEPAPER_URL


def load_contributors():
    """Load contributors.json, returns {name: url} dict."""
    contributors_file = Path('contributors.json')
    if contributors_file.exists():
        with open(contributors_file, 'r') as f:
            data = json.load(f)
        return {c['name']: c['url'] for c in data.get('contributors', [])}
    return {}


def make_author_html(author_str, contributors):
    """Convert an author string to HTML with profile links.

    'The Learning Mechanics Team' links to the whitepaper URL.
    Other names are looked up in the contributors dict.
    """
    if not author_str:
        return author_str
    if author_str.strip() == 'The Learning Mechanics Team':
        return f'<a href="{WHITEPAPER_URL}">The Learning Mechanics Team</a>'
    names = [n.strip() for n in author_str.split(',')]
    linked = []
    for name in names:
        if name in contributors:
            linked.append(f'<a href="{contributors[name]}">{name}</a>')
        else:
            linked.append(name)
    return ', '.join(linked)
