"""Main build orchestration: two-pass markdown → HTML pipeline."""

from pathlib import Path

from ssg.metadata import extract_metadata, load_sequence_metadata
from ssg.post import build_post
from ssg.index import generate_index
from ssg.questions import generate_open_questions
from ssg.rss import generate_rss
from ssg.static import copy_static_files


def main():
    print("Building site...\n")

    posts_dir = Path('posts')
    output_dir = Path('build')
    output_dir.mkdir(exist_ok=True)

    markdown_files = list(posts_dir.rglob('*.md'))
    if not markdown_files:
        print("No markdown files found in posts/")
        return

    sequence_metadata = load_sequence_metadata()

    # --- First pass: extract metadata, calculate URL paths ---
    posts_metadata = []
    file_to_metadata = {}

    for md_file in markdown_files:
        metadata = extract_metadata(md_file)
        if not metadata:
            continue

        sequence_key = metadata.get('sequence', '')
        if sequence_key and sequence_key in sequence_metadata:
            seq_meta = sequence_metadata[sequence_key]
            metadata['sequence_title']       = seq_meta.get('title', '')
            metadata['sequence_description'] = seq_meta.get('description', '')
            metadata['sequence_color']       = seq_meta.get('sequence_color', None)
            metadata['sequence_color_dark']  = seq_meta.get('sequence_color_dark', None)

        if sequence_key and sequence_key != f"standalone-{metadata['slug']}":
            metadata['url_path']    = f"{sequence_key}/{metadata['slug']}.html"
            metadata['path_prefix'] = "../"
        else:
            metadata['url_path']    = f"{metadata['slug']}.html"
            metadata['path_prefix'] = ""

        posts_metadata.append(metadata)
        file_to_metadata[str(md_file)] = metadata

    # --- Group by sequence for navigation ---
    sequences = {}
    for metadata in posts_metadata:
        key = metadata.get('sequence', f"standalone-{metadata['slug']}")
        sequences.setdefault(key, []).append(metadata)
    for seq in sequences.values():
        seq.sort(key=lambda p: p.get('sequence_order', 1))

    # --- Second pass: build each post with navigation context ---
    posts = []
    for md_file in markdown_files:
        metadata = file_to_metadata.get(str(md_file))
        if not metadata:
            continue

        sequence_key = metadata.get('sequence', f"standalone-{metadata['slug']}")
        sequence_nav = None

        if sequence_key in sequences and len(sequences[sequence_key]) > 1:
            sequence_posts = sequences[sequence_key]
            current_index = next(
                i for i, p in enumerate(sequence_posts) if p['slug'] == metadata['slug']
            )

            prev_url = sequence_posts[current_index - 1]['url_path'] if current_index > 0 else ''
            next_url = (
                sequence_posts[current_index + 1]['url_path']
                if current_index < len(sequence_posts) - 1 else ''
            )

            sequence_nav = {
                'sequence_title':    metadata.get('sequence_title', ''),
                'sequence_part':     current_index + 1,
                'sequence_total':    len(sequence_posts),
                'sequence_first_url':sequence_posts[0]['url_path'],
                'sequence_order_1':  current_index == 0,
                'prev_title': sequence_posts[current_index - 1]['title'] if current_index > 0 else '',
                'prev_slug':  sequence_posts[current_index - 1]['slug']  if current_index > 0 else '',
                'prev_url':   prev_url,
                'prev_part':  current_index if current_index > 0 else '',
                'next_title': sequence_posts[current_index + 1]['title'] if current_index < len(sequence_posts) - 1 else '',
                'next_slug':  sequence_posts[current_index + 1]['slug']  if current_index < len(sequence_posts) - 1 else '',
                'next_url':   next_url,
                'next_part':  current_index + 2 if current_index < len(sequence_posts) - 1 else '',
                'toc_posts':      sequence_posts,
                'current_slug':   metadata['slug'],
            }

        built = build_post(md_file, output_dir, metadata, sequence_nav)
        if built:
            posts.append(built)

    if posts:
        generate_index(posts, output_dir)
        generate_open_questions(posts, output_dir)
        generate_rss(posts, output_dir)

    copy_static_files(output_dir)

    print(f"\n✓ Build complete! Generated {len(posts)} posts.")
    print(f"  Output in: {output_dir.absolute()}")
    print(f"  Ready for GitHub Pages deployment from build/ directory")
