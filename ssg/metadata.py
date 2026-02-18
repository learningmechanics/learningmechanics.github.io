"""Extract YAML frontmatter from markdown files and load sequence metadata."""

import re
import yaml
from datetime import datetime
from pathlib import Path


def extract_metadata(filepath):
    """Extract YAML frontmatter from a markdown file.

    Falls back to deriving metadata from filename and first H1 heading.
    """
    with open(filepath, 'r') as f:
        content = f.read()

    if content.startswith('---\n'):
        end = content.find('\n---\n', 4)
        if end != -1:
            frontmatter = content[4:end]
            metadata = {}
            for line in frontmatter.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    metadata[key.strip()] = value.strip().strip('"\'')

            if 'slug' not in metadata:
                filename = Path(filepath).stem
                date_match = re.match(r'(\d{4}-\d{2}-\d{2})-(.+)', filename)
                if date_match:
                    metadata['slug'] = date_match.group(2)
                else:
                    number_match = re.match(r'(\d+)-(.+)', filename)
                    if number_match:
                        metadata['slug'] = number_match.group(2)
                    else:
                        metadata['slug'] = filename

            if 'sequence_order' not in metadata:
                metadata['sequence_order'] = 1
            else:
                metadata['sequence_order'] = int(metadata['sequence_order'])

            return metadata

    # Fallback: derive from filename and first H1
    filename = Path(filepath).stem
    date_match = re.match(r'(\d{4}-\d{2}-\d{2})-(.+)', filename)

    metadata = {}
    if date_match:
        metadata['date'] = date_match.group(1)
        metadata['slug'] = date_match.group(2)
    else:
        metadata['date'] = datetime.now().strftime('%Y-%m-%d')
        metadata['slug'] = filename

    h1_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if h1_match:
        metadata['title'] = h1_match.group(1)
    else:
        metadata['title'] = metadata['slug'].replace('-', ' ').title()

    metadata['sequence_order'] = 1
    return metadata


def load_sequence_metadata():
    """Load all sequence-metadata.yaml files from posts/ subdirectories.

    Returns {sequence_id: metadata_dict}.
    """
    posts_dir = Path('posts')
    sequence_metadata = {}

    if posts_dir.exists():
        for metadata_file in posts_dir.rglob('sequence-metadata.yaml'):
            try:
                with open(metadata_file, 'r') as f:
                    metadata = yaml.safe_load(f)
                sequence_id = metadata.get('sequence_id')
                if sequence_id:
                    sequence_metadata[sequence_id] = metadata
            except Exception as e:
                print(f"Warning: Could not load sequence metadata from {metadata_file}: {e}")

    return sequence_metadata
