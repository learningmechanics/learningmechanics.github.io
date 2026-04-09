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
            c['name']: {'url': c.get('url', ''), 'affiliation': c.get('affiliation', ''), 'photo': c.get('photo', '')}
            for c in data.get('contributors', [])
        }
    return {}


def load_contributors_data():
    """Load full contributors.json including editors/team lists."""
    contributors_file = Path('contributors.json')
    if contributors_file.exists():
        with open(contributors_file, 'r') as f:
            return json.load(f)
    return {}


def make_people_html(names, contributors, path_prefix=''):
    """Return a .people-group div with distill-style person cards."""
    cards = []
    for name in names:
        c = contributors.get(name, {})
        url = c.get('url', '')
        affiliation = c.get('affiliation', '')
        raw_photo = c.get('photo', '')
        photo = f'{path_prefix}{raw_photo}' if raw_photo else f'{path_prefix}static/lm_favicon.png'

        mug = (
            f'<a href="{url}" class="mug" target="_blank" rel="noopener">'
            f'<img src="{photo}" alt="{name}">'
            f'</a>'
        ) if url else (
            f'<span class="mug"><img src="{photo}" alt="{name}"></span>'
        )

        name_tag = (
            f'<a href="{url}" class="name" target="_blank" rel="noopener">{name}</a>'
        ) if url else f'<span class="name">{name}</span>'

        aff_tag = f'<span class="affiliation">{affiliation}</span>' if affiliation else ''

        cards.append(
            f'<div class="person">{mug}<div class="person-info">{name_tag}{aff_tag}</div></div>'
        )
    return '\n'.join(cards)


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
