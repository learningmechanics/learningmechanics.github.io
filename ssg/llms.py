"""Generate llms.txt from live post data."""

from ssg.config import SITE_URL, SITE_DESCRIPTION


def generate_llms_txt(posts, sequence_metadata, output_dir):
    """Generate llms.txt listing all public content."""

    lines = [
        '# Learning Mechanics',
        '',
        f'> {SITE_DESCRIPTION}',
        '',
        'Learning Mechanics is a research education site focused on the science of deep learning — understanding *why* neural networks work the way they do. We write in-depth posts and tutorials aimed at researchers and practitioners who want to go beyond intuition and engage with the underlying mathematics.',
        '',
        '## Posts',
        '',
    ]

    for post in sorted(posts, key=lambda p: p.get('date', ''), reverse=True):
        if post.get('hidden') or post.get('slug') == 'about':
            continue
        title = post.get('title', '')
        url_path = post.get('url_path', post['slug'])
        desc = post.get('description', '')
        entry = f'- [{title}]({SITE_URL}/{url_path})'
        if desc:
            entry += f': {desc}'
        lines.append(entry)

    lines += [
        '',
        '## Other pages',
        '',
        f'- [Open Questions]({SITE_URL}/openquestions): A curated list of open research questions and broad directions in the science of deep learning.',
        f'- [About]({SITE_URL}/about): About Learning Mechanics.',
        '',
        '## About',
        '',
        'Learning Mechanics is written by researchers at UC Berkeley and collaborators. Posts are peer-reviewed and mathematically rigorous.',
        '',
    ]

    (output_dir / 'llms.txt').write_text('\n'.join(lines))
    print('✓ Generated llms.txt')
