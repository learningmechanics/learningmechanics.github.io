"""Copy static assets to the build directory; concatenate CSS partials."""

from pathlib import Path

# Ordered list of CSS partials to concatenate into style.css.
# Order matters: variables → base → controls → layout → components → questions → theme → media.
CSS_PARTIALS = [
    'variables.css',
    'base.css',
    'controls.css',
    'layout.css',
    'components.css',
    'questions.css',
    'theme.css',
    'media.css',
]


def build_css(output_dir):
    """Concatenate CSS partials from static/css/ into build/static/style.css."""
    css_dir = Path('static/css')
    output_static = output_dir / 'static'
    output_static.mkdir(exist_ok=True)

    chunks = []
    for partial in CSS_PARTIALS:
        partial_path = css_dir / partial
        if partial_path.exists():
            chunks.append(f'/* === {partial} === */\n')
            chunks.append(partial_path.read_text())
            chunks.append('\n')
        else:
            print(f"Warning: CSS partial not found: {partial_path}")

    (output_static / 'style.css').write_text(''.join(chunks))


def copy_static_files(output_dir):
    """Copy all non-CSS static files to build/static/, then build CSS."""
    static_dir = Path('static')
    output_static = output_dir / 'static'
    output_static.mkdir(exist_ok=True)

    for file in static_dir.glob('*'):
        if file.is_file() and file.name != 'style.css':
            (output_static / file.name).write_bytes(file.read_bytes())

    build_css(output_dir)

    nojekyll = Path('.nojekyll')
    if nojekyll.exists():
        (output_dir / '.nojekyll').write_bytes(nojekyll.read_bytes())

    print("✓ Copied static files")
