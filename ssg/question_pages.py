"""Generate individual discussion pages for each open question."""

import json
import subprocess
import tempfile
from pathlib import Path


def load_questions_data():
    """Load questions from centralized JSON file."""
    questions_file = Path('data/openquestions.json')
    if questions_file.exists():
        with open(questions_file, 'r') as f:
            return json.load(f)
    return []


def markdown_to_html(markdown_text):
    """Convert markdown text to HTML using pandoc."""
    try:
        # Create a temporary file for the markdown
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as tmp:
            tmp.write(markdown_text)
            tmp_path = tmp.name

        # Run pandoc to convert markdown to HTML
        result = subprocess.run(
            ['pandoc', tmp_path, '--to', 'html', '--mathjax'],
            capture_output=True,
            text=True,
            check=True
        )

        # Clean up temp file
        Path(tmp_path).unlink()

        # Return the HTML, stripping outer <p> tags if present
        html = result.stdout.strip()
        if html.startswith('<p>') and html.endswith('</p>'):
            html = html[3:-4]
        return html

    except Exception as e:
        print(f"Warning: Failed to convert markdown: {e}")
        return markdown_text  # Fallback to plain text


def generate_question_pages(output_dir):
    """Generate an individual discussion page for each open question."""
    questions = load_questions_data()

    if not questions:
        print("⚠ No questions found in data/openquestions.json")
        return

    # Create openquestions subdirectory
    questions_dir = output_dir / 'openquestions'
    questions_dir.mkdir(exist_ok=True)

    # Load template
    template_path = Path('templates/question_discussion.html')
    with open(template_path, 'r') as f:
        template = f.read()

    # Generate a page for each question
    for q in questions:
        q_id = q['id']
        slug = q['slug']
        title = q['title']
        text_md = q['text']
        text_html = markdown_to_html(text_md)
        number = f"{q['sequence_order']}.{q['question_number']}"
        context_post = q['context_post']

        # Replace placeholders in template
        html = template
        html = html.replace('{{TITLE}}', title)
        html = html.replace('{{NUMBER}}', number)
        html = html.replace('{{TEXT}}', text_html)
        html = html.replace('{{ID}}', q_id)
        html = html.replace('{{CONTEXT_POST}}', context_post)

        # Write to file
        output_file = questions_dir / f"{slug}.html"
        with open(output_file, 'w') as f:
            f.write(html)

    print(f"✓ Generated {len(questions)} question discussion pages")
