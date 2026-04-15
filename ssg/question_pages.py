"""Generate individual discussion pages for each open question."""

import re
from pathlib import Path

from ssg.config import WHITEPAPER_URL
from ssg.templates import apply_fragments
from ssg.config import GISCUS_CATEGORY_OQ
from ssg.utils import load_questions_data, markdown_to_html


def generate_question_pages(output_dir):
    """Generate an individual discussion page for each open question."""
    questions = load_questions_data()

    if not questions:
        print("⚠ No questions found in data/openquestions.json")
        return

    questions_dir = output_dir / 'openquestions'
    questions_dir.mkdir(exist_ok=True)

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

        details_md = q.get('details', '').replace('{{WHITEPAPER_URL}}', WHITEPAPER_URL)
        details_html = markdown_to_html(details_md) if details_md else ''

        html = base_template
        html = html.replace('{{TITLE}}', q['title'])
        html = html.replace('{{NUMBER}}', label)
        html = html.replace('{{TEXT}}', text_html)
        html = html.replace('{{DETAILS}}', details_html)
        html = html.replace('{{ID}}', q['id'])
        html = html.replace('{{CONTEXT_POST}}', context_post)
        if context_post:
            context_link = f'<p class="oq-see-all"><a href="/{context_post}#{q["id"]}">See question in context</a></p>'
        else:
            context_link = ''
        html = html.replace('{{CONTEXT_LINK}}', context_link)

        slug_dir = questions_dir / q['slug']
        slug_dir.mkdir(exist_ok=True)
        with open(slug_dir / 'index.html', 'w') as f:
            f.write(html)

    print(f"✓ Generated {len(questions)} question discussion pages")
