#!/usr/bin/env python3
"""
Add Arthur Jacot
"""

import json
import os
import time
import requests
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

S2_API_BASE = "https://api.semanticscholar.org/graph/v1"
EMBEDDING_MODEL = "text-embedding-3-small"


def clean_text(text):
    if not text:
        return ""
    import re
    text = " ".join(text.split())
    text = re.sub(r'\$[^\$]+\$', '', text)
    text = re.sub(r'\$\$[^\$]+\$\$', '', text)
    return text.strip()


def concatenate_papers(papers):
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
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text
    )
    return response.data[0].embedding


def get_author_papers(author_id, limit=50):
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


print("Adding Arthur Jacot...")
# Semantic Scholar ID from search - NTK author
author_id = "51034104"  # Arthur Jacot (NTK)

print(f"Fetching papers for author ID: {author_id}")
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

# Add Arthur
arthur_data = {
    'name': 'Arthur Jacot',
    'num_papers': len(papers),
    'total_citations': sum(p.get('citationCount', 0) for p in papers),
    'embedding': embedding,
    'color': '#2c3e50',  # Dark blue-gray
    'coauthors': list(set([a['name'] for p in papers for a in p.get('authors', []) if 'Jacot' not in a['name']])),
    'sample_titles': [p.get('title', '') for p in papers[:3]]
}

author_embeddings.append(arthur_data)

# Save
with open('author_embeddings.json', 'w') as f:
    json.dump(author_embeddings, f, indent=2)

# Update papers_merged.json
with open('papers_merged.json', 'r') as f:
    papers_merged = json.load(f)

papers_merged['Arthur Jacot'] = {
    'papers': papers,
    'num_papers': len(papers),
    'total_citations': sum(p.get('citationCount', 0) for p in papers),
    'coauthors': arthur_data['coauthors']
}

with open('papers_merged.json', 'w') as f:
    json.dump(papers_merged, f, indent=2)

print(f"\n✓ Added Arthur Jacot!")
print(f"  Papers: {len(papers)}")
print(f"  Citations: {arthur_data['total_citations']}")
print(f"  Total authors now: {len(author_embeddings)}")
