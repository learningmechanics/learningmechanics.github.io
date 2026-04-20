#!/usr/bin/env python3
"""
Generate text embeddings for each author by concatenating all their paper titles + abstracts.
Uses OpenAI's text-embedding-3-small model (1536 dimensions).
"""

import json
import os
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Embedding model
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


def clean_text(text):
    """Clean text for embedding."""
    if not text:
        return ""

    # Remove excessive whitespace
    text = " ".join(text.split())

    # Remove LaTeX math
    import re
    text = re.sub(r'\$[^\$]+\$', '', text)  # inline math
    text = re.sub(r'\$\$[^\$]+\$\$', '', text)  # display math

    return text.strip()


def concatenate_papers(papers):
    """Concatenate all paper titles and abstracts into one text."""
    texts = []

    for paper in papers:
        title = clean_text(paper.get('title', ''))
        abstract = clean_text(paper.get('abstract', ''))

        if title and abstract:
            texts.append(f"{title}. {abstract}")
        elif title:
            texts.append(title)

    return " ".join(texts)


def get_embedding(text):
    """Get embedding from OpenAI API."""
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text
    )
    return response.data[0].embedding


def main():
    print("Generating author embeddings...")
    print(f"Model: {EMBEDDING_MODEL}")
    print(f"Embedding dimension: {EMBEDDING_DIM}")

    # Load merged papers
    with open('papers_merged.json', 'r', encoding='utf-8') as f:
        papers_data = json.load(f)

    author_embeddings = []

    # Define colors for each author (16 distinct colors)
    colors = [
        "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
        "#1abc9c", "#e67e22", "#95a5a6", "#34495e", "#c0392b",
        "#2980b9", "#27ae60", "#8e44ad", "#16a085", "#d35400",
        "#7f8c8d"
    ]

    for idx, (author, data) in enumerate(papers_data.items()):
        print(f"\n{'='*60}")
        print(f"Processing: {author}")
        print(f"{'='*60}")

        papers = data['papers']
        num_papers = len(papers)
        total_citations = data.get('total_citations', 0)

        print(f"  Papers: {num_papers}")
        print(f"  Citations: {total_citations}")

        # Concatenate all paper texts
        concatenated_text = concatenate_papers(papers)
        text_length = len(concatenated_text)

        print(f"  Text length: {text_length} characters")

        if text_length == 0:
            print(f"  WARNING: No text for {author}, skipping")
            continue

        # Get embedding
        print(f"  Calling OpenAI API...")
        embedding = get_embedding(concatenated_text)

        print(f"  ✓ Received embedding (dim={len(embedding)})")

        # Store data
        author_embeddings.append({
            'name': author,
            'num_papers': num_papers,
            'total_citations': total_citations,
            'embedding': embedding,
            'color': colors[idx % len(colors)],
            'coauthors': data.get('coauthors', []),
            'sample_titles': [p.get('title', '') for p in papers[:3]]  # First 3 titles
        })

    # Save embeddings
    output_file = 'author_embeddings.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(author_embeddings, f, indent=2)

    print(f"\n{'='*60}")
    print(f"✓ Embeddings saved to: {output_file}")
    print(f"{'='*60}")
    print(f"\nTotal authors: {len(author_embeddings)}")
    print(f"Embedding dimension: {EMBEDDING_DIM}")


if __name__ == "__main__":
    main()
