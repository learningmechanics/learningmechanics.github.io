"""Build individual posts: markdown → HTML via pandoc, with post-processing."""

import html as html_module
import re
import subprocess
from pathlib import Path

from ssg.config import AUTHOR, WHITEPAPER_URL, SITE_URL, WEB_FONT_URL
from ssg.contributors import load_contributors, load_contributors_data, make_author_html, make_byline_sections, make_people_html
from ssg.templates import ga_script, mailerlite_includes, footer_html, nav_html, post_theme_script, giscus_script
from ssg.config import GISCUS_REPO, GISCUS_REPO_ID, GISCUS_CATEGORY_ID, GISCUS_CATEGORY_POSTS
from ssg.utils import format_date, load_questions_data


# ---------------------------------------------------------------------------
# Footnote processing — custom {fn: text} syntax
# ---------------------------------------------------------------------------

def process_custom_footnotes(md_content):
    """Convert {fn: tooltip text} markers in markdown to raw HTML span elements.

    Syntax:  {fn: This is the footnote text.}
    Output:  <span class="fn" tabindex="0"><sup><a href="#fn-N" id="fnref-N">N</a></sup><span class="fn-tooltip">text</span></span>

    Footnotes are auto-numbered in document order.
    The raw HTML is written directly so pandoc passes it through unchanged.
    Handles nested braces (e.g. LaTeX like $\\Sigma_{xx}$) correctly.

    Returns (processed_content, footnotes_list) where footnotes_list contains
    the raw markdown text of each footnote in order.
    """
    counter = [0]
    footnotes = []
    result = []
    i = 0
    n = len(md_content)
    prefix = '{fn:'

    while i < n:
        idx = md_content.find(prefix, i)
        if idx == -1:
            result.append(md_content[i:])
            break
        result.append(md_content[i:idx])
        j = idx + len(prefix)
        depth = 1
        while j < n and depth > 0:
            if md_content[j] == '{':
                depth += 1
            elif md_content[j] == '}':
                depth -= 1
            j += 1
        text = md_content[idx + len(prefix):j - 1].strip()
        counter[0] += 1
        footnotes.append(text)
        result.append(
            f'<span class="fn" tabindex="0">'
            f'<sup><a href="#fn-{counter[0]}" id="fnref-{counter[0]}">{counter[0]}</a></sup>'
            f'<span class="fn-tooltip">{text}</span>'
            f'</span>'
        )
        i = j

    return ''.join(result), footnotes


# ---------------------------------------------------------------------------
# Math tooltip processing — custom $eq${tip: ...} syntax
# ---------------------------------------------------------------------------

def process_math_tips(md_content):
    """Convert $equation${tip: ...} markers to tooltip-wrapped HTML spans.

    Inline:  $eq${tip: content}   → <span class="eq-tip" data-eq="eq" data-tip="content"></span>
    Block:   $$eq$${tip: content} → <span class="eq-tip eq-tip--display" ...></span>

    Tip content may contain nested LaTeX braces. Separate tooltip lines with
    literal \\n in the markdown source. Each line is typically "$LaTeX$: description".
    """
    result = []
    i = 0
    n = len(md_content)

    while i < n:
        if md_content[i] != '$':
            result.append(md_content[i])
            i += 1
            continue

        display = md_content[i:i+2] == '$$'
        delim_len = 2 if display else 1
        end_delim = '$$' if display else '$'

        j = i + delim_len
        close = md_content.find(end_delim, j)
        if close == -1:
            result.append(md_content[i])
            i += 1
            continue

        eq = md_content[j:close]
        after = close + delim_len

        if (after + 5 <= n
                and md_content[after] == '{'
                and md_content[after+1:after+5] == 'tip:'):
            depth = 1
            k = after + 1
            while k < n and depth > 0:
                if md_content[k] == '{':
                    depth += 1
                elif md_content[k] == '}':
                    depth -= 1
                k += 1
            tip_raw = md_content[after+5:k-1].strip()
            tip_enc = html_module.escape(tip_raw, quote=True)
            eq_enc  = html_module.escape(eq, quote=True)
            if display:
                result.append(
                    f'<span class="eq-tip eq-tip--display"'
                    f' data-eq="{eq_enc}" data-tip="{tip_enc}"></span>'
                )
            else:
                result.append(
                    f'<span class="eq-tip"'
                    f' data-eq="{eq_enc}" data-tip="{tip_enc}"></span>'
                )
            i = k
        else:
            result.append(md_content[i:after])
            i = after

    return ''.join(result)


# ---------------------------------------------------------------------------
# Collapsible section processing — custom ##> / <## syntax
# ---------------------------------------------------------------------------

def _collapsible_slug(text, used_ids):
    """Generate a URL-safe id slug from a heading title, avoiding duplicates."""
    slug = re.sub(r'[^a-z0-9]+', '-', text.lower().strip()).strip('-')
    if not slug:
        slug = 'section'
    base, num = slug, 1
    while slug in used_ids:
        slug = f'{base}-{num}'
        num += 1
    used_ids.add(slug)
    return slug


def process_collapsible_sections(md_content):
    """Convert ##> Title / <## delimiters to HTML5 details/summary elements.

    Opening:  ##> Section title   (2–6 # signs)
    Closing:  <##

    The number of # signs determines the heading level of the summary element.
    """
    used_ids = set()
    lines = md_content.split('\n')
    out = []
    for line in lines:
        open_m = re.match(r'^(#{2,6})\s*>\s*(.+)$', line)
        close_m = re.match(r'^<\s*(#{2,6})\s*$', line)
        if open_m:
            level = len(open_m.group(1))
            title = open_m.group(2).strip()
            slug = _collapsible_slug(title, used_ids)
            out.append(
                f'<details class="collapsible">'
                f'<summary class="collapsible-h{level}" id="{slug}">{title}</summary>'
            )
        elif close_m:
            out.append('</details>')
        else:
            out.append(line)
    return '\n'.join(out)


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

    # Strip any inline HTML from heading text and collapse whitespace
    def strip_tags(s):
        s = re.sub(r'<[^>]+>', '', s)
        return re.sub(r'\s+', ' ', s).strip()

    SKIP_HEADINGS = {'citation', 'references', 'acknowledgements', 'acknowledgments', 'appendix'}

    # Collect regular headings and collapsible summaries in document order.
    heading_pat     = r'<h([234])[^>]*\bid="([^"]+)"[^>]*>(.*?)</h\1>'
    collapsible_pat = r'<summary[^>]*\bcollapsible-h([2-6])\b[^>]*\bid="([^"]+)"[^>]*>(.*?)</summary>'
    combined_pat    = f'(?:{heading_pat})|(?:{collapsible_pat})'

    items = []
    for m in re.finditer(combined_pat, content_for_scan, re.DOTALL):
        if m.group(1) is not None:
            level, anchor_id, raw_text = int(m.group(1)), m.group(2), m.group(3)
        else:
            level, anchor_id, raw_text = int(m.group(4)), m.group(5), m.group(6)
        if level > toc_depth:
            continue
        text = strip_tags(raw_text)
        if not text or text.lower() in SKIP_HEADINGS:
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
# Open Direction embed processing — {od: slug} syntax
# ---------------------------------------------------------------------------

def process_od_embeds(md_content, post_url_path='', path_prefix=''):
    """Replace {od: slug} markers with a rendered question-box + oq-links HTML.

    Looks up the question by slug in openquestions.json and renders the same
    question-box div used on the Open Questions page, with an oq-links row
    whose right side links to the question's discussion page.
    """
    all_questions = load_questions_data()
    by_slug = {q['slug']: q for q in all_questions}
    by_id   = {q['id']:   q for q in all_questions}

    def replace_od(m):
        slug = m.group(1).strip()
        q = by_slug.get(slug) or by_id.get(slug)
        if not q:
            return f'<!-- od: {slug} not found -->'

        q_id    = q['id']
        q_num   = q['question_number']
        emoji   = q.get('emoji', '')
        title   = q.get('title', '')
        text_md = q.get('text', '')

        # Render question text through pandoc inline
        from ssg.utils import markdown_to_html
        text_html = markdown_to_html(text_md)
        # Strip outer <p> tags pandoc adds to a single paragraph
        text_html = re.sub(r'^<p>(.*)</p>$', r'\1', text_html.strip(), flags=re.DOTALL)

        q_slug = q['slug']
        label = f'{emoji} Open Direction {q_num}: '
        title_link = f'<a class="oq-title-link" href="{path_prefix}openquestions/{q_slug}">{label}{title}</a>'

        box_html  = f'<div class="question-box" id="{q_id}">'
        box_html += f'<p><strong>{title_link}</strong> {text_html}</p>'
        box_html += '</div>'

        discussion_url = f'{path_prefix}openquestions/{q_slug}'
        links_html  = '<div class="oq-links">'
        links_html += f'<div class="oq-see-all"><a href="{path_prefix}openquestions#{q_id}">See all open questions</a></div>'
        links_html += f'<div class="oq-discussion"><a href="{discussion_url}">Details and discussion</a></div>'
        links_html += '</div>'

        return box_html + '\n' + links_html

    return re.sub(r'\{od:\s*([^}]+)\}', replace_od, md_content)


# ---------------------------------------------------------------------------
# Question data helpers
# ---------------------------------------------------------------------------

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

def generate_citation(metadata):
    """Generate a BibTeX citation block from post metadata."""
    title = metadata.get('title', '')
    author_str = metadata.get('author', AUTHOR)
    date = metadata.get('date', '')
    year = date[:4] if date else ''
    url_path = metadata.get('url_path', metadata.get('slug', ''))
    url = f"{SITE_URL}/{url_path}"

    # Build BibTeX key: "lastname-year-slug"
    first_author = author_str.split(',')[0].strip()
    lastname = first_author.split()[-1].lower() if first_author else 'unknown'
    slug = metadata.get('slug', '')
    key = f"{lastname}-{year}-{slug}"

    # Format authors as "Last, First and Last, First"
    authors = [a.strip() for a in author_str.split(',')]
    def fmt_author(name):
        parts = name.strip().split()
        if len(parts) >= 2:
            return f"{parts[-1]}, {' '.join(parts[:-1])}"
        return name
    author_bibtex = ' and '.join(fmt_author(a) for a in authors)

    return f"""```bibtex
@article{{{key},
  title   = {{{title}}},
  author  = {{{author_bibtex}}},
  journal = {{Learning Mechanics}},
  url     = {{{url}}},
  year    = {{{year}}}
}}
```"""


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
    placeholders = {
        '{{WHITEPAPER_URL}}': WHITEPAPER_URL,
        '{{CITATION}}': generate_citation(metadata),
    }
    with open(markdown_file, 'r') as f:
        md_content = f.read()
    for placeholder, value in placeholders.items():
        md_content = md_content.replace(placeholder, value)
    # Convert custom {fn: text} footnotes to inline HTML spans
    md_content, footnotes = process_custom_footnotes(md_content)
    # Convert $eq${tip: ...} math tooltips to inline HTML spans
    md_content = process_math_tips(md_content)
    # Convert ##> Title / <## collapsible section delimiters to HTML details/summary
    md_content = process_collapsible_sections(md_content)
    # Expand {od: slug} open direction embeds
    md_content = process_od_embeds(md_content, post_url_path=metadata.get('url_path', metadata.get('slug', '')), path_prefix=path_prefix)
    from ssg.utils import _process_sidenotes
    md_content = _process_sidenotes(md_content)
    tmp_file = markdown_file.parent / f"_tmp_{markdown_file.name}"
    with open(tmp_file, 'w') as f:
        f.write(md_content)

    # Collect widget JS files for this post:
    #   1. Primary companion: {stem}.js (same stem as the markdown file)
    #   2. Any other .js in the directory whose stem is NOT the stem of another .md
    widget_js_files = []
    companion_js = markdown_file.with_suffix('.js')
    if companion_js.exists():
        widget_js_files.append(companion_js)

    other_md_stems = {p.stem for p in markdown_file.parent.glob('*.md')}
    for js_path in sorted(markdown_file.parent.glob('*.js')):
        if js_path.stem not in other_md_stems and js_path not in widget_js_files:
            widget_js_files.append(js_path)

    widget_script_tag = ''
    if widget_js_files:
        widget_script_tag = '\n'.join(
            f'<script type="module" src="{js_path.name}"></script>'
            for js_path in widget_js_files
        )

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
        '--variable', f"mailerlite_includes={mailerlite_includes()}",
    ]
    if widget_script_tag:
        cmd.extend(['--variable', f"widget_script={widget_script_tag}"])
    cmd.extend([
        '--variable', f"web_font_include=<link rel=\"stylesheet\" href=\"{WEB_FONT_URL}\">",
        '--variable', f"footer_html={footer_html()}",
        '--variable', f"giscus_repo={GISCUS_REPO}",
        '--variable', f"giscus_repo_id={GISCUS_REPO_ID}",
        '--variable', f"giscus_category={GISCUS_CATEGORY_POSTS}",
        '--variable', f"giscus_category_id={GISCUS_CATEGORY_ID}",
    ])
    if metadata.get('no_comments'):
        cmd.extend(['--metadata', 'no_comments=true'])
    if metadata.get('no_byline'):
        cmd.extend(['--metadata', 'no_byline=true'])
    if metadata.get('wide_body'):
        cmd.extend(['--metadata', 'wide_body=true'])
    if metadata.get('no_title'):
        cmd.extend(['--metadata', 'no_title=true'])

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

        # Inject about footer
        if '<!--ABOUT_FOOTER-->' in html_content:
            about_footer = (
                '<hr class="about-footer-rule">'
                '<p class="about-footer">Learning Mechanics is generously supported by '
                '<a href="https://imbue.com">Imbue</a>. '
                'Style files for this site are adapted from the '
                '<a href="https://github.com/distillpub/template">Distill repo</a>.</p>'
            )
            html_content = html_content.replace('<!--ABOUT_FOOTER-->', about_footer)

        # Inject people section (about page)
        if '<!--PEOPLE_SECTION-->' in html_content:
            contributors_data = load_contributors_data()
            editors_cards = make_people_html(contributors_data.get('editors', []), contributors, path_prefix)
            team_cards    = make_people_html(contributors_data.get('team', []),    contributors, path_prefix)
            editors_block = f'<div class="people-group"><h3 class="people-group-label">Editors</h3><div class="people">{editors_cards}</div></div>'
            team_block    = f'<div class="people-group"><h3 class="people-group-label">Team</h3><div class="people">{team_cards}</div></div>'
            people_section = f'<div class="people-section">{editors_block}{team_block}</div>'
            html_content = html_content.replace('<!--PEOPLE_SECTION-->', people_section)

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

        # Inject footnotes section at end of article
        if footnotes:
            from ssg.utils import markdown_to_html
            fn_items = []
            for idx, fn_text in enumerate(footnotes, 1):
                fn_html = markdown_to_html(fn_text)
                fn_items.append(
                    f'<li id="fn-{idx}">{fn_html} '
                    f'<a href="#fnref-{idx}" class="fn-backref" title="Back to text">\u21a9</a></li>'
                )
            fn_section = (
                '<section class="footnotes-section">'
                '<hr>'
                '<h2>Footnotes</h2>'
                '<ol class="footnotes-list">'
                + '\n'.join(fn_items)
                + '</ol></section>'
            )
            html_content = html_content.replace('</article>', fn_section + '\n</article>')

        with open(output_file, 'w') as f:
            f.write(html_content)

        # Copy post assets (JS, images, JSON, etc.) to output directory.
        # Only applies when the post lives in its own subdirectory (not a flat .md
        # alongside other posts), to avoid copying sibling posts' files.
        import shutil
        skip_suffixes = {'.md', '.yaml', '.yml'}
        post_dir = markdown_file.parent
        if post_dir.name == markdown_file.stem:
            for asset in post_dir.iterdir():
                if (asset.is_file()
                        and not asset.name.startswith('_tmp_')
                        and asset.suffix.lower() not in skip_suffixes):
                    shutil.copy2(asset, output_file.parent / asset.name)

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
        post_url = post.get('url_path', f"{post['slug']}") + '/'
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
