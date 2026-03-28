"""Generate the open-questions page from question-box divs across all posts."""

import re

from ssg.metadata import load_sequence_metadata
from ssg.templates import ga_script, font_awesome_include, katex_includes, theme_script
from ssg.utils import load_questions_data, markdown_to_html


def generate_open_questions(posts, output_dir):
    """Build openquestions.html grouped by sequence, using centralized question data."""
    sequence_metadata = load_sequence_metadata()
    all_questions = load_questions_data()

    # Group questions by sequence
    sequence_groups = {}
    sequence_first_urls = {}

    # Get first post URL for each sequence from posts
    sorted_posts = sorted(posts, key=lambda p: (p.get('sequence', ''), p.get('sequence_order', 999)))
    for post in sorted_posts:
        seq_key = post.get('sequence', f"standalone-{post['slug']}")
        if seq_key not in sequence_first_urls:
            sequence_first_urls[seq_key] = post.get('url_path', f"{post['slug']}")

    # Build post URL lookup by context_post
    post_url_lookup = {}
    for post in posts:
        seq = post.get('sequence', '')
        slug = post.get('slug', '')
        if seq:
            context_post = f"{seq}/{slug}"
            post_url_lookup[context_post] = post.get('url_path', f"{seq}/{slug}")

    # Group questions from JSON
    for q in all_questions:
        seq_key = q.get('sequence', '')
        if not seq_key:
            continue

        if seq_key not in sequence_groups:
            seq_meta = sequence_metadata.get(seq_key, {})
            sequence_groups[seq_key] = {
                'title': seq_meta.get('title', seq_key.title()),
                'entries': [],
            }

        # Get post URL for this question
        context_post = q.get('context_post', '')
        post_url = post_url_lookup.get(context_post, '#')

        sequence_groups[seq_key]['entries'].append({
            'post_url': post_url,
            'question': q
        })

    if not sequence_groups:
        return

    groups_html = ''
    quickstart_url = '#'

    for seq_key, group in sequence_groups.items():
        seq_title = group['title']
        seq_url_path = sequence_first_urls.get(seq_key, '#')
        seq_url = f'/{seq_url_path}' if seq_url_path != '#' else '#'
        if seq_key == 'quickstart':
            quickstart_url = seq_url

        groups_html += f'\n    <div class="oq-group" id="{seq_key}-questions">'
        groups_html += (
            f'\n      <h2 class="oq-group-title">'
            f'From <a href="{seq_url}"><em>{seq_title}</em></a>'
            f'</h2>'
        )

        for entry in group['entries']:
            q = entry['question']
            post_url = entry['post_url']
            q_id = q['id']
            q_slug = q['slug']
            number = f"{q['sequence_order']}.{q['question_number']}"

            question_title = q.get('title', '')
            question_text_html = markdown_to_html(q.get('text', ''))

            groups_html += f'\n      <div class="question-box" id="{q_id}">'
            groups_html += f'\n        <p><strong>Open Question {number}: {question_title}</strong> {question_text_html}</p>'
            groups_html += '\n      </div>'

            groups_html += '\n      <div class="oq-links">'
            groups_html += f'\n        <div class="oq-see-all"><a href="/{post_url}#{q_id}">See question in context</a></div>'
            groups_html += f'\n        <div class="oq-discussion"><a href="/openquestions/{q_slug}">Question-specific discussion page</a></div>'
            groups_html += '\n      </div>'

        groups_html += '\n    </div>'

    with open('templates/openquestions.html', 'r') as f:
        template = f.read()

    from ssg.templates import nav_html
    html = template.replace('<!-- QUESTIONS_PLACEHOLDER -->', groups_html)
    html = html.replace('<!-- GA_SCRIPT -->', ga_script())
    html = html.replace('<!-- FONT_AWESOME -->', font_awesome_include())
    html = html.replace('<!-- KATEX -->', katex_includes())
    html = html.replace('<!-- THEME_SCRIPT -->', theme_script())
    html = html.replace('<!-- NAV -->', nav_html())

    with open(output_dir / 'openquestions.html', 'w') as f:
        f.write(html)

    # Also write to openquestions/index.html for directory-style URLs
    questions_dir = output_dir / 'openquestions'
    questions_dir.mkdir(exist_ok=True)
    with open(questions_dir / 'index.html', 'w') as f:
        f.write(html)

    total = sum(len(g['entries']) for g in sequence_groups.values())
    print(f"✓ Generated openquestions.html ({total} questions)")
