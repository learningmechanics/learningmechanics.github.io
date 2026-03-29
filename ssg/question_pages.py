"""Generate individual discussion pages for each open question."""

from pathlib import Path

from ssg.templates import ga_script, font_awesome_include, katex_includes, theme_script, nav_html
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
    base_template = base_template.replace('<!-- GA_SCRIPT -->', ga_script())
    base_template = base_template.replace('<!-- FONT_AWESOME -->', font_awesome_include())
    base_template = base_template.replace('<!-- KATEX -->', katex_includes())
    base_template = base_template.replace('<!-- THEME_SCRIPT -->', theme_script())
    base_template = base_template.replace('<!-- NAV -->', nav_html())

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

        html = base_template
        html = html.replace('{{TITLE}}', q['title'])
        html = html.replace('{{NUMBER}}', label)
        html = html.replace('{{TEXT}}', text_html)
        html = html.replace('{{ID}}', q['id'])
        html = html.replace('{{CONTEXT_POST}}', context_post)
        if context_post:
            context_link = f'<p class="oq-see-all"><a href="/{context_post}#{q["id"]}">See question in context</a></p>'
        else:
            context_link = ''
        html = html.replace('{{CONTEXT_LINK}}', context_link)

        with open(questions_dir / f"{q['slug']}.html", 'w') as f:
            f.write(html)

    print(f"✓ Generated {len(questions)} question discussion pages")
