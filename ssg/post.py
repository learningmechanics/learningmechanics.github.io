"""Build individual posts: markdown → HTML via pandoc, with post-processing."""

import json
import re
import subprocess
from pathlib import Path

from ssg.config import AUTHOR, WHITEPAPER_URL
from ssg.contributors import load_contributors, make_author_html, make_byline_sections
from ssg.templates import ga_script, nav_html, post_theme_script
from ssg.utils import format_date


# ---------------------------------------------------------------------------
# Footnote processing — custom {fn: text} syntax
# ---------------------------------------------------------------------------

def process_custom_footnotes(md_content):
    """Convert {fn: tooltip text} markers in markdown to raw HTML span elements.

    Syntax:  {fn: This is the footnote text.}
    Output:  <span class="fn" tabindex="0"><sup>N</sup><span class="fn-tooltip">text</span></span>

    Footnotes are auto-numbered in document order.
    The raw HTML is written directly so pandoc passes it through unchanged.
    Nested braces are not supported; keep footnote text on one line.
    """
    counter = [0]

    def replace_fn(m):
        counter[0] += 1
        text = m.group(1).strip()
        n = counter[0]
        return (
            f'<span class="fn" tabindex="0">'
            f'<sup>{n}</sup>'
            f'<span class="fn-tooltip">{text}</span>'
            f'</span>'
        )

    return re.sub(r'\{fn:\s*(.*?)\}', replace_fn, md_content)


# ---------------------------------------------------------------------------
# Table of contents generation
# ---------------------------------------------------------------------------

def build_toc_nav(html_content, toc_depth=3):
    """Auto-generate a <nav class="post-toc"> from h2/h3 headings in html_content.

    Returns the nav HTML string, or '' if fewer than 2 headings are found.
    Skips headings inside .post-appendix (Citation block etc.).
    """
    # Strip appendix / citation block before scanning for headings.
    # Posts end with "---" (→ <hr>) followed by a Citation h2 + bibtex block;
    # we stop scanning at the last <hr> in the article body.
    article_match = re.search(r'<article[^>]*>(.*?)</article>', html_content, re.DOTALL)
    if article_match:
        article_body = article_match.group(1)
        # Drop everything from the last <hr> onwards (citation / appendix)
        last_hr = article_body.rfind('<hr')
        content_for_scan = article_body[:last_hr] if last_hr != -1 else article_body
    else:
        content_for_scan = html_content

    pattern = r'<h([234])[^>]*\bid="([^"]+)"[^>]*>(.*?)</h\1>'
    headings = re.findall(pattern, content_for_scan, re.DOTALL)

    # Strip any inline HTML from heading text and collapse whitespace
    def strip_tags(s):
        s = re.sub(r'<[^>]+>', '', s)
        return re.sub(r'\s+', ' ', s).strip()

    SKIP_HEADINGS = {'citation', 'references', 'acknowledgements', 'acknowledgments', 'appendix'}

    items = []
    for level, anchor_id, raw_text in headings:
        level = int(level)
        if level > toc_depth:
            continue
        text = strip_tags(raw_text)
        if not text:
            continue
        if text.lower() in SKIP_HEADINGS:
            continue
        items.append((level, anchor_id, text))

    if len(items) < 2:
        return ''

    lines = ['<nav class="post-toc">', '<h3>Contents</h3>']
    for level, anchor_id, text in items:
        css_class = f'toc-h{level}'
        lines.append(
            f'<a href="#{anchor_id}" class="{css_class}">{text}</a>'
        )
    lines.append('</nav>')
    return '\n'.join(lines)


def inject_toc(html_content, metadata):
    """Inject auto-generated TOC into the post-grid, before the post-header.

    Respects:
      toc: false  — suppress entirely
      toc_depth: N — only include headings up to level N (default 3)

    If a <nav class="post-toc"> already exists in the content, skips auto-gen.
    """
    if metadata.get('toc') is False or str(metadata.get('toc', '')).lower() == 'false':
        return html_content

    # Don't double-inject if author placed one manually
    if 'class="post-toc"' in html_content:
        return html_content

    toc_depth = int(metadata.get('toc_depth', 4))
    toc_html = build_toc_nav(html_content, toc_depth)
    if not toc_html:
        return html_content

    # Insert just before <article class="post-body"> so the TOC
    # occupies the kicker column alongside the article, not the header.
    return html_content.replace(
        '<article class="post-body">',
        toc_html + '\n\n  <article class="post-body">',
        1
    )


# ---------------------------------------------------------------------------
# Question data loading
# ---------------------------------------------------------------------------

_QUESTIONS_CACHE = None

def load_questions_data():
    """Load questions from centralized JSON file."""
    global _QUESTIONS_CACHE
    if _QUESTIONS_CACHE is None:
        questions_file = Path('data/openquestions.json')
        if questions_file.exists():
            with open(questions_file, 'r') as f:
                _QUESTIONS_CACHE = json.load(f)
        else:
            _QUESTIONS_CACHE = []
    return _QUESTIONS_CACHE


def get_questions_for_post(sequence_order):
    """Get all questions for a given sequence_order, indexed by question_number."""
    all_questions = load_questions_data()
    questions_by_number = {}
    for q in all_questions:
        if q['sequence_order'] == sequence_order:
            questions_by_number[q['question_number']] = q
    return questions_by_number


# ---------------------------------------------------------------------------
# Question box processing
# ---------------------------------------------------------------------------

def process_question_boxes(html_content, seq_order, path_prefix=''):
    """Inject anchor IDs, numbered labels, and discussion links into question-box divs.

    Now reads question metadata from centralized JSON to ensure consistent IDs and slugs.

    Returns (modified_html, questions_list).
    """
    questions_data = get_questions_for_post(seq_order)
    questions = []
    count = 0

    def replace_qbox(m):
        nonlocal count
        count += 1

        # Get question data from JSON
        q_data = questions_data.get(count)
        if q_data:
            anchor_id = q_data['id']
            slug = q_data['slug']
        else:
            # Fallback if not in JSON
            anchor_id = f"oq-{seq_order}-{count}"
            slug = None

        number = f"{seq_order}.{count}"
        original_content = m.group(1)

        modified = re.sub(
            r'<strong>[Oo]pen [Qq]uestion:(.*?)</strong>',
            lambda m2: f'<strong>Open Question {number}:{m2.group(1)}</strong>',
            original_content,
            count=1,
            flags=re.DOTALL,
        )

        questions.append({
            'id': anchor_id,
            'number': number,
            'html': original_content.strip(),
            'slug': slug,
        })

        # Create links div with see all link on left, discussion page on right
        see_all_link = f'<a href="{path_prefix}openquestions#{anchor_id}">See all open questions</a>'
        discussion_link = f'<a href="{path_prefix}openquestions/{slug}">Question-specific discussion page</a>' if slug else ''

        links_html = '<div class="oq-links">'
        links_html += f'<div class="oq-see-all">{see_all_link}</div>'
        if discussion_link:
            links_html += f'<div class="oq-discussion">{discussion_link}</div>'
        links_html += '</div>'

        return f'<div class="question-box" id="{anchor_id}">{modified}</div>{links_html}'

    html_content = re.sub(
        r'<div class="question-box">(.*?)</div>',
        replace_qbox,
        html_content,
        flags=re.DOTALL,
    )
    return html_content, questions


# ---------------------------------------------------------------------------
# Post builder
# ---------------------------------------------------------------------------

def build_post(markdown_file, output_dir, metadata, sequence_nav=None):
    """Convert a markdown file to HTML using pandoc.

    Handles:
    - Placeholder substitution in markdown ({{WHITEPAPER_URL}} etc.)
    - Pandoc invocation with sequence navigation metadata
    - Post-processing: sequence TOC injection, question box processing

    Returns updated metadata dict, or None on failure.
    """
    sequence_key = metadata.get('sequence', '')
    if sequence_key and sequence_key != f"standalone-{metadata['slug']}":
        slug_dir = output_dir / sequence_key / metadata['slug']
        slug_dir.mkdir(parents=True, exist_ok=True)
        output_file = slug_dir / 'index.html'
    else:
        slug_dir = output_dir / metadata['slug']
        slug_dir.mkdir(exist_ok=True)
        output_file = slug_dir / 'index.html'

    # Author / byline
    contributors = load_contributors()
    author_str = metadata.get('author', AUTHOR)
    author_html = make_author_html(author_str, contributors)
    path_prefix = metadata.get('path_prefix', '')
    date_display = format_date(metadata.get('date', ''))

    # Build distill-style byline HTML (name + affiliation columns)
    byline_sections = make_byline_sections(author_str, contributors)
    plural = len(byline_sections) > 1
    author_label = 'Authors' if plural else 'Author'
    affiliation_label = 'Affiliations' if plural else 'Affiliation'

    # All names go in one column, all affiliations in one column
    names_html = ''.join(
        f'<span class="byline-value">{name_html}</span>'
        for name_html, _ in byline_sections
    )
    affiliations = [aff for _, aff in byline_sections]
    any_affiliation = any(affiliations)

    byline_html = (
        f'<div class="byline-section">'
        f'<span class="byline-label">{author_label}</span>'
        f'{names_html}'
        f'</div>'
    )
    if any_affiliation:
        affiliation_values = ''.join(
            f'<span class="byline-value">{aff if aff else "—"}</span>'
            for aff in affiliations
        )
        byline_html += (
            f'<div class="byline-section">'
            f'<span class="byline-label">{affiliation_label}</span>'
            f'{affiliation_values}'
            f'</div>'
        )

    # Substitute placeholders in markdown before passing to pandoc
    placeholders = {'{{WHITEPAPER_URL}}': WHITEPAPER_URL}
    with open(markdown_file, 'r') as f:
        md_content = f.read()
    for placeholder, value in placeholders.items():
        md_content = md_content.replace(placeholder, value)
    # Convert custom {fn: text} footnotes to inline HTML spans
    md_content = process_custom_footnotes(md_content)
    tmp_file = markdown_file.parent / f"_tmp_{markdown_file.name}"
    with open(tmp_file, 'w') as f:
        f.write(md_content)

    cmd = [
        'pandoc',
        str(tmp_file),
        '-o', str(output_file),
        '--template=templates/post.html',
        '--mathjax',
        '--highlight-style=kate',
        '--metadata', f"title={metadata.get('title', 'Untitled')}",
        '--metadata', f"date={metadata.get('date', '')}",
        '--metadata', f"author={author_str}",
        '--metadata', f"path_prefix={path_prefix}",
        '--variable', f"author_html={author_html}",
        '--variable', f"byline_html={byline_html}",
        '--variable', f"date_display={date_display}",
        '--variable', f"nav_html={nav_html(path_prefix)}",
        '--variable', f"ga_script={ga_script()}",
        '--variable', f"theme_script={post_theme_script()}",
    ]
    if metadata.get('no_comments'):
        cmd.extend(['--metadata', 'no_comments=true'])
    if metadata.get('no_byline'):
        cmd.extend(['--metadata', 'no_byline=true'])
    if metadata.get('hero_text'):
        cmd.extend(['--variable', f"hero_text={metadata['hero_text']}"])

    if sequence_nav:
        seq_key = metadata.get('sequence', '')
        sequence_landing_url = seq_key  # e.g. "science-of-dl" → links to landing page
        cmd.extend([
            '--metadata', f"sequence_title={sequence_nav.get('sequence_title', '')}",
            '--metadata', f"sequence_part={sequence_nav.get('sequence_part', '')}",
            '--metadata', f"sequence_total={sequence_nav.get('sequence_total', '')}",
            '--metadata', f"sequence_landing_url={sequence_landing_url}",
            '--metadata', f"sequence_order={sequence_nav.get('sequence_part', '')}",
            '--metadata', f"sequence_order_1={sequence_nav.get('sequence_order_1', '')}",
            '--metadata', f"prev_url={sequence_nav.get('prev_url', '')}",
            '--metadata', f"next_url={sequence_nav.get('next_url', '')}",
        ])

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)

        with open(output_file, 'r') as f:
            html_content = f.read()

        # Inject sequence TOC if available
        if sequence_nav and 'toc_posts' in sequence_nav:
            toc_html = _build_toc_html(sequence_nav, metadata)
            html_content = html_content.replace('<!-- SEQUENCE_TOC_PLACEHOLDER -->', toc_html)

        # Inject floating TOC
        html_content = inject_toc(html_content, metadata)

        # Process question boxes
        seq_order = metadata.get('sequence_order', 0)
        path_prefix = metadata.get('path_prefix', '')
        html_content, questions = process_question_boxes(html_content, seq_order, path_prefix)
        metadata['questions'] = questions

        with open(output_file, 'w') as f:
            f.write(html_content)

        tmp_file.unlink(missing_ok=True)
        print(f"✓ Built: {metadata['slug']}")
        return metadata

    except subprocess.CalledProcessError as e:
        tmp_file.unlink(missing_ok=True)
        print(f"✗ Failed to build {markdown_file}: {e.stderr}")
        return None


def _build_toc_html(sequence_nav, metadata):
    """Build the sequence TOC HTML block inserted at the end of each post."""
    toc_items = []
    for post in sequence_nav['toc_posts']:
        display_title = post.get('toc_title', post['title'])
        post_url = post.get('url_path', f"{post['slug']}")
        if post['slug'] == sequence_nav['current_slug']:
            toc_items.append(f'<strong>{display_title}</strong>')
        else:
            toc_items.append(
                f'<a href="{metadata.get("path_prefix", "")}{post_url}">{display_title}</a>'
            )

    sequence_color = metadata.get('sequence_color')
    sequence_color_dark = metadata.get('sequence_color_dark')
    sequence_key = metadata.get('sequence', '')

    if sequence_color and isinstance(sequence_color, list) and len(sequence_color) == 3:
        css_class = f'sequence-toc-{sequence_key}'
        light_color = f'rgb({sequence_color[0]}, {sequence_color[1]}, {sequence_color[2]})'
        if sequence_color_dark and isinstance(sequence_color_dark, list) and len(sequence_color_dark) == 3:
            dark_color = f'rgb({sequence_color_dark[0]}, {sequence_color_dark[1]}, {sequence_color_dark[2]})'
        else:
            dark_color = light_color
        sequence_css = (
            f'<style>'
            f'.{css_class} {{ background-color: {light_color}; }}'
            f'[data-theme="dark"] .{css_class} {{ background-color: {dark_color}; }}'
            f'</style>'
        )
        css_class_attr = f' class="sequence-toc {css_class}"'
    else:
        sequence_css = ''
        css_class_attr = ' class="sequence-toc"'

    items_html = ''.join(f'<li>{item}</li>' for item in toc_items)
    seq_title = metadata.get('sequence_title', '')
    return (
        f'<hr>{sequence_css}'
        f'<div{css_class_attr}>'
        f'<h3>{seq_title}</h3>'
        f'<ol>{items_html}</ol>'
        f'</div>'
        f'<div class="back-to-top"><a href="#top"><i class="fas fa-arrow-circle-up"></i></a></div>'
    )
