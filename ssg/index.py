"""Generate the homepage (index.html) with posts grouped by sequence."""

from pathlib import Path

from ssg.config import AUTHOR
from ssg.contributors import load_contributors, make_author_html
from ssg.metadata import load_sequence_metadata
from ssg.templates import apply_fragments
from ssg.utils import format_date


def generate_index(posts, output_dir):
    """Generate index.html with all posts grouped into sequence rows."""
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
                    'title':             meta.get('title', post.get('sequence_title', post['title'])),
                    'description':       meta.get('description', post.get('sequence_description', post.get('description', ''))),
                    'authors':           meta.get('authors', []),
                    'date':              meta.get('date', ''),
                    'tag':               meta.get('tag', ''),
                    'thumbnail':         meta.get('thumbnail', ''),
                    'thumbnail_video':   meta.get('thumbnail_video', ''),
                    'numbered':          meta.get('numbered', True),
                    'hidden':            meta.get('hidden', False),
                    'expand_on_homepage': meta.get('expand_on_homepage', False),
                    'priority':          meta.get('priority', 0),
                    'posts':             [],
                }
            else:
                sequences[sequence_key] = {
                    'title':             post.get('sequence_title', post['title']),
                    'description':       post.get('sequence_description', post.get('description', '')),
                    'authors':           [],
                    'date':              '',
                    'tag':               post.get('tag', ''),
                    'thumbnail':         post.get('thumbnail', ''),
                    'thumbnail_video':   post.get('thumbnail_video', ''),
                    'numbered':          True,
                    'hidden':            post.get('hidden', False),
                    'expand_on_homepage': False,
                    'priority':          post.get('priority', 0),
                    'posts':             [],
                }
        sequences[sequence_key]['posts'].append(post)

    # Sort posts within each sequence
    for sequence in sequences.values():
        sequence['posts'].sort(key=lambda p: p.get('sequence_order', 1))

    # Resolve author/date, filter hidden, sort newest-first
    sequence_list = []
    for seq_data in sequences.values():
        if seq_data.get('hidden'):
            continue
        # Also skip if all posts in a standalone sequence are hidden
        if all(p.get('hidden') for p in seq_data['posts']):
            continue
        first_post = seq_data['posts'][0]
        if not seq_data['date']:
            seq_data['date'] = first_post.get('date', '')
        if not seq_data['authors']:
            seq_data['author'] = first_post.get('author', '')
        else:
            seq_data['author'] = ', '.join(seq_data['authors'])
        sequence_list.append(seq_data)
    sequence_list.sort(key=lambda s: (s.get('date', ''), s.get('priority', 0)), reverse=True)

    # --- Build HTML ---
    contributors = load_contributors()
    post_html = []

    for sequence in sequence_list:
        first_post = sequence['posts'][0]
        seq_key = first_post.get('sequence', f"standalone-{first_post['slug']}")
        is_sequence = not seq_key.startswith('standalone-')
        # Multi-post sequences link to landing page; standalones link directly to the post
        if is_sequence and len(sequence['posts']) > 1:
            click_url = seq_key + '/'
        else:
            click_url = first_post.get('url_path', first_post['slug']) + '/'
        first_post_url = first_post.get('url_path', first_post['slug']) + '/'

        date_str = format_date(sequence.get('date', ''))

        # Meta column: date only
        meta_html = (
            f'<div class="post-meta">'
            f'<div class="post-date">{date_str}</div>'
            f'</div>'
        )

        # Description
        desc = sequence.get('description', '')
        desc_html = f'<p class="post-description">{desc}</p>' if desc else ''

        # Sub-posts list (for multi-post sequences, or sequences flagged expand_on_homepage)
        subposts_html = ''
        numbered = sequence.get('numbered', True)
        visible_posts = [p for p in sequence['posts'] if not p.get('hidden')]

        # Author line: only for single posts, not multi-post sequences
        authors_html = ''
        if len(visible_posts) <= 1 and not sequence.get('expand_on_homepage'):
            author_str = sequence.get('author', '')
            if author_str:
                authors_html = f'<p class="post-authors">{author_str}</p>'
        if len(visible_posts) > 1 or sequence.get('expand_on_homepage'):
            links = []
            for i, post in enumerate(visible_posts, 1):
                display = post.get('toc_title', post['title'])
                url = post.get('url_path', post['slug']) + '/'
                prefix = f'{i}. ' if numbered else ''
                author = post.get('author', '')
                author_line = f'<span class="post-link-author">{author}</span>' if author else ''
                links.append(
                    f'<a href="{url}" class="post-link" onclick="event.stopPropagation()">'
                    f'<span class="post-link-title">{prefix}{display}</span>'
                    f'{author_line}'
                    f'</a>'
                )
            subposts_html = (
                '<div class="post-subposts">'
                + ''.join(links)
                + '</div>'
            )

        # Body column
        body_html = (
            f'<div class="post-body-col">'
            f'<h2 class="post-title"><a href="{click_url}" tabindex="-1">{sequence["title"]}</a></h2>'
            f'{authors_html}'
            f'{desc_html}'
            f'{subposts_html}'
            f'</div>'
        )

        # Thumbnail column
        thumbnail_video = sequence.get('thumbnail_video', '')
        thumbnail = sequence.get('thumbnail', '')
        if thumbnail_video:
            thumb_html = (
                f'<div class="post-thumbnail">'
                f'<video src="/{thumbnail_video}" autoplay loop muted playsinline></video>'
                f'</div>'
            )
        elif thumbnail:
            thumb_html = (
                f'<div class="post-thumbnail">'
                f'<img src="{thumbnail}" alt="{sequence["title"]}">'
                f'</div>'
            )
        else:
            thumb_html = '<div class="post-thumbnail post-thumbnail--placeholder"></div>'

        row_html = (
            f'<div class="post-preview" onclick="location.href=\'{click_url}\'">'
            f'{meta_html}'
            f'{body_html}'
            f'{thumb_html}'
            f'</div>'
        )
        post_html.append(row_html)

    with open('templates/index.html', 'r') as f:
        template = f.read()

    output = apply_fragments(
        template,
        **{'<!-- POSTS_PLACEHOLDER -->': '\n'.join(post_html)},
    )

    with open(output_dir / 'index.html', 'w') as f:
        f.write(output)

    print("✓ Generated index.html")
