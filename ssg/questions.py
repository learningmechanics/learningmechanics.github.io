"""Generate the open-questions page from question-box divs across all posts."""

import re

from ssg.metadata import load_sequence_metadata


def generate_open_questions(posts, output_dir):
    """Build openquestions.html grouped by sequence."""
    sequence_metadata = load_sequence_metadata()
    sequence_groups = {}
    sequence_first_urls = {}  # first post URL per sequence (lowest sequence_order)

    sorted_posts = sorted(posts, key=lambda p: (p.get('sequence', ''), p.get('sequence_order', 999)))

    # First pass: record the first post URL for each sequence
    for post in sorted_posts:
        seq_key = post.get('sequence', f"standalone-{post['slug']}")
        if seq_key not in sequence_first_urls:
            sequence_first_urls[seq_key] = post.get('url_path', f"{post['slug']}")

    # Second pass: collect questions
    for post in sorted_posts:
        questions = post.get('questions', [])
        if not questions:
            continue
        seq_key = post.get('sequence', f"standalone-{post['slug']}")
        post_url = post.get('url_path', f"{post['slug']}")

        if seq_key not in sequence_groups:
            seq_meta = sequence_metadata.get(seq_key, {})
            sequence_groups[seq_key] = {
                'title':   seq_meta.get('title', post.get('sequence_title', post['title'])),
                'entries': [],
            }
        for q in questions:
            sequence_groups[seq_key]['entries'].append({'post_url': post_url, 'question': q})

    if not sequence_groups:
        return

    groups_html = ''
    quickstart_url = '#'

    for seq_key, group in sequence_groups.items():
        seq_title = group['title']
        seq_url = sequence_first_urls.get(seq_key, group['entries'][0]['post_url'] if group['entries'] else '#')
        if seq_key == 'quickstart':
            quickstart_url = seq_url

        groups_html += f'\n    <div class="sequence-box oq-group" id="{seq_key}-questions">'
        groups_html += (
            f'\n      <div class="sequence-title">'
            f'Open questions from <a href="{seq_url}"><em>{seq_title}</em></a>'
            f'</div>'
        )

        for entry in group['entries']:
            q = entry['question']
            post_url = entry['post_url']
            numbered_html = re.sub(
                r'<strong>[Oo]pen [Qq]uestion:(.*?)</strong>',
                lambda m, q=q: f'<strong>Open Question {q["number"]}:{m.group(1)}</strong>',
                q['html'],
                count=1,
                flags=re.DOTALL,
            )
            groups_html += f'\n      <div class="question-box">{numbered_html}</div>'
            groups_html += (
                f'\n      <div class="oq-see-all">'
                f'<a href="{post_url}#{q["id"]}">See question in context</a>'
                f'</div>'
            )

        groups_html += '\n    </div>'

    with open('templates/openquestions.html', 'r') as f:
        template = f.read()

    html = template.replace('<!-- QUESTIONS_PLACEHOLDER -->', groups_html)
    html = html.replace('{{QUICKSTART_URL}}', quickstart_url)

    with open(output_dir / 'openquestions.html', 'w') as f:
        f.write(html)

    total = sum(len(g['entries']) for g in sequence_groups.values())
    print(f"✓ Generated openquestions.html ({total} questions)")
