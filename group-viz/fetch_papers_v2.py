#!/usr/bin/env python3
"""
Fetch papers for a list of authors from Semantic Scholar API.
Uses manually verified author IDs where available.
"""

import requests
import json
import time
from typing import List, Dict, Optional

# Semantic Scholar API base URL
S2_API_BASE = "https://api.semanticscholar.org/graph/v1"

# List of authors with verified/corrected information
AUTHORS = [
    {
        "name": "Adityanarayanan Radhakrishnan",
        "search_query": "Adityanarayanan Radhakrishnan machine learning",
        "author_id": "12228138"  # Verified from previous run
    },
    {
        "name": "Blake Bordelon",
        "search_query": "Blake Bordelon neural networks",
        "author_id": "77327149"  # Verified from previous run
    },
    {
        "name": "Bruno Loureiro",
        "search_query": "Bruno Loureiro statistical physics machine learning",
        "author_id": "143616600"  # Verified from web search
    },
    {
        "name": "Berkan Ottlik",
        "search_query": "Berkan Ottlik machine learning",
        "author_id": None  # To be searched
    },
    {
        "name": "Dhruva Karkada",
        "search_query": "Dhruva Karkada neural networks",
        "author_id": "2187687089"  # Verified from previous run
    },
    {
        "name": "Enric Boix Adsera",
        "search_query": "Enric Boix-Adsera",
        "author_id": None  # To be searched
    },
    {
        "name": "Eric Michaud",
        "search_query": "Eric J. Michaud MIT interpretability",
        "author_id": None  # To be searched
    },
    {
        "name": "Florentin Guth",
        "search_query": "Florentin Guth diffusion",
        "author_id": "51136427"  # Verified from previous run
    },
    {
        "name": "Jamie Simon",
        "search_query": "James B. Simon Berkeley physics",
        "author_id": None  # To be searched
    },
    {
        "name": "Jeremy Bernstein",
        "search_query": "Jeremy Bernstein Caltech optimization",
        "author_id": None  # To be searched
    },
    {
        "name": "Jeremy Cohen",
        "search_query": "Jeremy Cohen machine learning",
        "author_id": None  # To be searched
    },
    {
        "name": "Joey Turnbull",
        "search_query": "Joseph Turnbull machine learning",
        "author_id": None  # To be searched
    },
    {
        "name": "Jacob Zavatone Veth",
        "search_query": "Jacob Zavatone-Veth",
        "author_id": "1390180424"  # Verified from previous run
    },
    {
        "name": "Daniel Kunin",
        "search_query": "Daniel Kunin",
        "author_id": "145616412"  # Verified from previous run
    },
    {
        "name": "Nikhil Ghosh",
        "search_query": "Nikhil Ghosh Berkeley statistics",
        "author_id": None  # To be searched
    },
    {
        "name": "Preetum Nakkiran",
        "search_query": "Preetum Nakkiran",
        "author_id": "2181918"  # Verified from previous run
    },
]


def search_author(search_query: str, limit: int = 10) -> List[Dict]:
    """Search for an author and return candidate matches."""
    url = f"{S2_API_BASE}/author/search"
    params = {"query": search_query, "limit": limit}

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])
    except Exception as e:
        print(f"Error searching for {search_query}: {e}")
        return []


def get_author_papers(author_id: str, limit: int = 50) -> List[Dict]:
    """Get papers for an author, sorted by citation count."""
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

        # Filter papers with abstracts and sort by citation count
        papers_with_abstract = [
            p for p in papers
            if p.get("abstract") and len(p.get("abstract", "")) > 50
        ]

        # Sort by citation count (descending)
        papers_with_abstract.sort(
            key=lambda x: x.get("citationCount", 0),
            reverse=True
        )

        return papers_with_abstract[:10]  # Top 10 most cited

    except Exception as e:
        print(f"Error fetching papers for author {author_id}: {e}")
        return []


def fetch_all_papers():
    """Fetch papers for all authors."""
    all_data = {}

    for author_info in AUTHORS:
        name = author_info["name"]
        search_query = author_info["search_query"]
        known_id = author_info.get("author_id")

        print(f"\n{'='*60}")
        print(f"Fetching papers for: {name}")
        print(f"{'='*60}")

        # If we have a known ID, use it
        if known_id:
            author_id = known_id
            print(f"  Using known author ID: {author_id}")
        else:
            # Search for the author
            print(f"  Searching: {search_query}...")
            candidates = search_author(search_query)

            if not candidates:
                print(f"  ✗ Could not find author")
                all_data[name] = {
                    "author_id": None,
                    "papers": [],
                    "candidates": []
                }
                continue

            # Show top candidates for manual verification
            print(f"  Found {len(candidates)} candidates:")
            for i, cand in enumerate(candidates[:3], 1):
                print(f"    {i}. {cand.get('name', 'N/A')} (ID: {cand.get('authorId', 'N/A')})")

            # Use the first candidate (most relevant)
            author_id = candidates[0]["authorId"]
            print(f"  → Using: {candidates[0].get('name')} (ID: {author_id})")

            # Store candidates for later review
            all_data[name] = {
                "candidates": candidates[:5]
            }

            time.sleep(0.5)  # Rate limiting

        # Fetch papers
        time.sleep(0.5)  # Rate limiting
        papers = get_author_papers(author_id)

        print(f"  Found {len(papers)} papers with abstracts")

        # Store data
        if name not in all_data:
            all_data[name] = {}

        all_data[name]["author_id"] = author_id
        all_data[name]["papers"] = papers

        # Show a sample
        if papers:
            top_paper = papers[0]
            print(f"  Top paper: {top_paper.get('title', 'N/A')}")
            print(f"  Citations: {top_paper.get('citationCount', 0)}")
            # Show first author to help verify
            if top_paper.get('authors'):
                first_author = top_paper['authors'][0].get('name', 'N/A')
                print(f"  First author: {first_author}")

    return all_data


def main():
    print("Starting paper collection (v2 - improved matching)...")
    print(f"Total authors: {len(AUTHORS)}")

    data = fetch_all_papers()

    # Save to JSON
    output_file = "papers_data.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Data saved to: {output_file}")
    print(f"{'='*60}")

    # Print summary
    total_papers = sum(len(v.get("papers", [])) for v in data.values())
    authors_found = sum(1 for v in data.values() if v.get("author_id") is not None)

    print(f"\nSummary:")
    print(f"  Authors found: {authors_found}/{len(AUTHORS)}")
    print(f"  Total papers collected: {total_papers}")
    print(f"  Average papers per author: {total_papers/len(AUTHORS):.1f}")

    # List authors with no/few papers
    print(f"\nAuthors with <5 papers:")
    for name, info in data.items():
        if len(info.get("papers", [])) < 5:
            print(f"  - {name}: {len(info.get('papers', []))} papers")


if __name__ == "__main__":
    main()
