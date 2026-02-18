"""Generate the homepage (index.html) with posts grouped by sequence."""

from datetime import datetime
from pathlib import Path

from ssg.config import AUTHOR
from ssg.contributors import load_contributors, make_author_html
from ssg.metadata import load_sequence_metadata


def generate_index(posts, output_dir):
    """Generate index.html with all posts grouped into sequence boxes."""
    article_posts = [p for p in posts if p['slug'] != 'about']
    sequence_metadata = load_sequence_metadata()

    # --- Group posts by sequence ---
    sequences = {}
    for post in article_posts:
        sequence_key = post.get('sequence', f"standalone-{post['slug']}")
        if sequence_key not in sequences:
            if sequence_key in sequence_metadata:
                meta = sequence_metadata[sequence_key]
                sequences[sequence_key] = {
                    'title':              meta.get('title', post.get('sequence_title', post['title'])),
                    'description':        meta.get('description', post.get('sequence_description', post.get('description', ''))),
                    'authors':            meta.get('authors', []),
                    'date':               meta.get('date', ''),
                    'sequence_color':     meta.get('sequence_color', None),
                    'sequence_color_dark':meta.get('sequence_color_dark', None),
                    'sequence_emoji':     meta.get('sequence_emoji', None),
                    'posts':              [],
                }
            else:
                sequences[sequence_key] = {
                    'title':              post.get('sequence_title', post['title']),
                    'description':        post.get('sequence_description', post.get('description', '')),
                    'authors':            [],
                    'date':               '',
                    'sequence_color':     None,
                    'sequence_color_dark':None,
                    'sequence_emoji':     post.get('emoji', None),
                    'posts':              [],
                }
        sequences[sequence_key]['posts'].append(post)

    # Sort posts within each sequence
    for sequence in sequences.values():
        sequence['posts'].sort(key=lambda p: p.get('sequence_order', 1))

    # Resolve author/date and sort sequences newest-first
    sequence_list = []
    for seq_data in sequences.values():
        first_post = seq_data['posts'][0]
        if not seq_data['date']:
            seq_data['date'] = first_post.get('date', '')
        if not seq_data['authors']:
            seq_data['author'] = first_post.get('author', '')
        else:
            seq_data['author'] = ', '.join(seq_data['authors'])
        sequence_list.append(seq_data)
    sequence_list.sort(key=lambda s: s.get('date', ''), reverse=True)

    # --- Build HTML ---
    contributors = load_contributors()
    post_html = []
    sequence_css_rules = []

    for sequence in sequence_list:
        first_post = sequence['posts'][0]
        seq_key = first_post.get('sequence', f"standalone-{first_post['slug']}")
        first_post_url = first_post.get('url_path', f"{first_post['slug']}")

        try:
            dt = datetime.strptime(sequence['date'], '%Y-%m-%d')
            date_str = dt.strftime('%B %d, %Y')
        except Exception:
            date_str = sequence.get('date', '')

        # CSS class for optional per-sequence background colour
        sequence_color = sequence.get('sequence_color')
        sequence_color_dark = sequence.get('sequence_color_dark')
        if sequence_color and isinstance(sequence_color, list) and len(sequence_color) == 3:
            css_class = f'sequence-box-{seq_key}'
            light_color = f'rgb({sequence_color[0]}, {sequence_color[1]}, {sequence_color[2]})'
            if sequence_color_dark and isinstance(sequence_color_dark, list) and len(sequence_color_dark) == 3:
                dark_color = f'rgb({sequence_color_dark[0]}, {sequence_color_dark[1]}, {sequence_color_dark[2]})'
            else:
                dark_color = light_color
            sequence_css_rules.append(
                f'\n.{css_class} {{ background-color: {light_color}; }}'
                f'\n[data-theme="dark"] .{css_class} {{ background-color: {dark_color}; }}'
            )
            css_class_attr = f'sequence-box {css_class}'
        else:
            css_class_attr = 'sequence-box'

        # Emoji / icon
        emoji_html = ''
        if sequence.get('sequence_emoji'):
            emoji = sequence['sequence_emoji']
            if emoji.startswith('fa-'):
                emoji_html = f'<span class="sequence-emoji"><i class="fas {emoji}"></i></span>'
            else:
                emoji_html = f'<span class="sequence-emoji">{emoji}</span>'

        html = (
            f'      <div class="{css_class_attr}" onclick="location.href=\'{first_post_url}\'">\n'
            f'        <div class="sequence-title">{sequence["title"]}{emoji_html}</div>\n'
        )

        author_html = make_author_html(sequence['author'], contributors)
        if sequence['author'] and sequence['author'] != AUTHOR:
            html += f'        <div class="sequence-author">{author_html}</div>\n'
        html += f'        <div class="sequence-date"><em>{date_str}</em></div>\n'

        if len(sequence['posts']) > 1:
            html += '        <div class="sequence-posts">\n'
            for i, post in enumerate(sequence['posts'], 1):
                display_title = post.get('toc_title', post['title'])
                post_url = post.get('url_path', f"{post['slug']}")
                html += (
                    f'          <a href="{post_url}" class="post-link" '
                    f'onclick="event.stopPropagation()">{i}. {display_title}</a>\n'
                )
            html += '        </div>\n'

        html += '      </div>'
        post_html.append(html)

    with open('templates/index.html', 'r') as f:
        template = f.read()

    sequence_css = ''
    if sequence_css_rules:
        sequence_css = f'<style>{"".join(sequence_css_rules)}</style>'

    output = template.replace('<!-- POSTS_PLACEHOLDER -->', '\n'.join(post_html))
    if sequence_css:
        output = output.replace('</head>', f'  {sequence_css}\n</head>')

    with open(output_dir / 'index.html', 'w') as f:
        f.write(output)

    print("✓ Generated index.html")
