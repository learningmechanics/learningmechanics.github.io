#!/usr/bin/env python3
"""
Add Alex Atanasov and fix duplicate counting issues.
"""

import json
import os
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

EMBEDDING_MODEL = "text-embedding-3-small"


def clean_text(text):
    """Clean text for embedding."""
    if not text:
        return ""
    import re
    text = " ".join(text.split())
    text = re.sub(r'\$[^\$]+\$', '', text)
    text = re.sub(r'\$\$[^\$]+\$\$', '', text)
    return text.strip()


def concatenate_papers(papers):
    """Concatenate all paper titles and abstracts."""
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


# Search for Alex on Semantic Scholar
import requests
import time

S2_API_BASE = "https://api.semanticscholar.org/graph/v1"

def search_author(query):
    """Search Semantic Scholar for author."""
    url = f"{S2_API_BASE}/author/search"
    params = {"query": query, "limit": 5}
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])
    except Exception as e:
        print(f"Error: {e}")
        return []


def get_author_papers(author_id, limit=50):
    """Get papers for an author."""
    url = f"{S2_API_BASE}/author/{author_id}/papers"
    params = {
        "fields": "title,abstract,authors,year,citationCount,venue,publicationDate",
        "limit": limit
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        papers = data.get("data", [])

        papers_with_abstract = [
            p for p in papers
            if p.get("abstract") and len(p.get("abstract", "")) > 50
        ]

        papers_with_abstract.sort(
            key=lambda x: x.get("citationCount", 0),
            reverse=True
        )

        return papers_with_abstract[:10]
    except Exception as e:
        print(f"Error: {e}")
        return []


print("Using known Semantic Scholar ID for Alex Atanasov...")
# Use known Semantic Scholar ID
author_id = "27755610"  # From Semantic Scholar
candidates = [{"authorId": author_id, "name": "Alexander Atanasov"}]

if candidates:
    author_id = candidates[0]["authorId"]
    print(f"\nUsing: {candidates[0].get('name')} (ID: {author_id})")

    print("Fetching papers...")
    time.sleep(0.5)
    papers = get_author_papers(author_id)

    print(f"Found {len(papers)} papers with abstracts")
    if papers:
        print(f"Top paper: {papers[0].get('title')}")
        print(f"Citations: {papers[0].get('citationCount', 0)}")

    # Generate embedding
    concatenated_text = concatenate_papers(papers)
    print(f"\nText length: {len(concatenated_text)} characters")
    print("Calling OpenAI API...")
    embedding = get_embedding(concatenated_text)
    print(f"✓ Received embedding (dim={len(embedding)})")

    # Load existing embeddings
    with open('author_embeddings.json', 'r') as f:
        author_embeddings = json.load(f)

    # Add Alex
    alex_data = {
        'name': 'Alex Atanasov',
        'num_papers': len(papers),
        'total_citations': sum(p.get('citationCount', 0) for p in papers),
        'embedding': embedding,
        'color': '#95a5a6',  # Gray color
        'coauthors': list(set([a['name'] for p in papers for a in p.get('authors', []) if a['name'] != 'Alexander Atanasov'])),
        'sample_titles': [p.get('title', '') for p in papers[:3]]
    }

    author_embeddings.append(alex_data)

    # Save updated embeddings
    with open('author_embeddings.json', 'w') as f:
        json.dump(author_embeddings, f, indent=2)

    # Also update papers_merged.json
    with open('papers_merged.json', 'r') as f:
        papers_merged = json.load(f)

    papers_merged['Alex Atanasov'] = {
        'papers': papers,
        'num_papers': len(papers),
        'total_citations': sum(p.get('citationCount', 0) for p in papers),
        'coauthors': alex_data['coauthors']
    }

    with open('papers_merged.json', 'w') as f:
        json.dump(papers_merged, f, indent=2)

    print(f"\n✓ Added Alex Atanasov to datasets!")
    print(f"  Papers: {len(papers)}")
    print(f"  Citations: {alex_data['total_citations']}")

print("\nNow fixing coauthorship counting...")
# This will be done in a separate script
