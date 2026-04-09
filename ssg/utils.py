"""Shared utilities used across the SSG."""

import re
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from ssg.config import QUESTIONS_FILE


def format_date(date_str):
    """Format a YYYY-MM-DD date string as 'Mon D, YYYY'."""
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        return dt.strftime('%b %-d, %Y')
    except Exception:
        return date_str


_QUESTIONS_CACHE = None

def load_questions_data():
    """Load questions from centralized JSON file (cached)."""
    import json
    global _QUESTIONS_CACHE
    if _QUESTIONS_CACHE is None:
        questions_file = Path(QUESTIONS_FILE)
        if questions_file.exists():
            with open(questions_file, 'r') as f:
                _QUESTIONS_CACHE = json.load(f)
        else:
            _QUESTIONS_CACHE = []
    return _QUESTIONS_CACHE


def _process_sidenotes(md_text):
    """Convert [>text<] to a floating <aside class="sidenote"> prepended to its paragraph.

    The aside is moved to just before the paragraph it appears in, so the float
    anchors at the top of that paragraph's vertical space.
    """
    aside_re = re.compile(r'\[>(.*?)<\]', re.DOTALL)

    # Split into paragraphs (blank-line separated blocks)
    blocks = re.split(r'(\n{2,})', md_text)
    out = []
    for block in blocks:
        asides = []
        def collect(m):
            asides.append(f'<aside class="sidenote"><p>{m.group(1).strip()}</p></aside>')
            return ''
        cleaned = aside_re.sub(collect, block).strip()
        if asides:
            out.append('\n'.join(asides) + '\n' + cleaned)
        else:
            out.append(block)
    return ''.join(out)


def markdown_to_html(md_text):
    """Convert a markdown string to an HTML fragment via pandoc."""
    md_text = _process_sidenotes(md_text)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(md_text)
        tmp_path = f.name
    try:
        result = subprocess.run(
            ['pandoc', tmp_path, '--from=markdown', '--to=html'],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    finally:
        Path(tmp_path).unlink(missing_ok=True)
