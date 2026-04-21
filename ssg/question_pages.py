"""Generate individual discussion pages for each open question."""

import re
import shutil
from pathlib import Path

from ssg.config import WHITEPAPER_URL, OPEN_QUESTIONS_DIR
from ssg.templates import apply_fragments
from ssg.config import GISCUS_CATEGORY_OQ
from ssg.utils import load_questions_data, markdown_to_html


def _load_details(question_id):
    """Load details markdown for a question from openquestions/{id}.md, if it exists."""
    md_path = Path(OPEN_QUESTIONS_DIR) / f"{question_id}.md"
    if not md_path.exists():
        return ''
    text = md_path.read_text()
    return text.replace('{{WHITEPAPER_URL}}', WHITEPAPER_URL)


def _copy_assets(details_md, slug_dir):
    """Copy local files referenced in details_md from openquestions/ to slug_dir."""
    oq_dir = Path(OPEN_QUESTIONS_DIR)
    referenced = set(re.findall(r'src=["\']([^/\'"]+\.[a-zA-Z0-9]+)["\']', details_md))
    referenced |= set(re.findall(r'!\[[^\]]*\]\(([^/\'"]+\.[a-zA-Z0-9]+)\)', details_md))
    for filename in referenced:
        src = oq_dir / filename
        if src.exists():
            shutil.copy2(src, slug_dir / filename)


def generate_question_pages(output_dir, posts=None):
    """Generate an individual discussion page for each open question."""
    questions = load_questions_data()

    if not questions:
        print("⚠ No questions found in data/openquestions.json")
        return

    # Build url_path → title lookup from posts list
    post_title_lookup = {}
    if posts:
        for p in posts:
            url_path = p.get('url_path', p.get('slug', ''))
            post_title_lookup[url_path] = p.get('title', '')

    questions_dir = output_dir / 'openquestions'
    questions_dir.mkdir(parents=True, exist_ok=True)

    with open('templates/question_discussion.html', 'r') as f:
        base_template = f.read()

    # Inject shared fragments once
    base_template = apply_fragments(base_template, katex=True, giscus_category=GISCUS_CATEGORY_OQ)

    for q in questions:
        text_html = markdown_to_html(q['text'])
        is_broad = q.get('sequence') == 'broad-directions'

        if is_broad:
            emoji = q.get('emoji', '')
            number = f"{emoji} {q['question_number']}"
            label = f'{emoji} Open Direction {q["question_number"]}'
        else:
            number = f"{q['sequence_order']}.{q['question_number']}"
            label = f'Open Question {number}'

        context_post = q.get('context_post') or ''

        details_md = _load_details(q['id'])
        details_html = markdown_to_html(details_md) if details_md else ''

        # Build source link for broad-directions questions that live in an essay
        source_link = ''
        if is_broad and context_post:
            source_post = next((p for p in (posts or []) if p.get('url_path') == context_post or p.get('slug') == context_post.split('/')[-1]), None)
            if source_post:
                display_title = source_post.get('short_title') or source_post.get('title', '')
                source_link = f'<span>Question from: <a href="/{context_post}#{q["id"]}"><em>{display_title}</em></a></span>'

        html = base_template
        html = html.replace('{{TITLE}}', q['title'])
        html = html.replace('{{NUMBER}}', label)
        html = html.replace('{{TEXT}}', text_html)
        html = html.replace('{{DETAILS}}', details_html)
        html = html.replace('{{ID}}', q['id'])
        html = html.replace('{{CONTEXT_POST}}', context_post)
        html = html.replace('{{SOURCE_LINK}}', source_link)
        html = html.replace('{{CONTEXT_LINK}}', '')

        slug_dir = questions_dir / q['slug']
        slug_dir.mkdir(parents=True, exist_ok=True)
        with open(slug_dir / 'index.html', 'w') as f:
            f.write(html)
        if details_md:
            _copy_assets(details_md, slug_dir)

    print(f"✓ Generated {len(questions)} question discussion pages")
