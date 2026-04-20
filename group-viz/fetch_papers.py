#!/usr/bin/env python3
"""
Fetch papers for a list of authors from Semantic Scholar API.
Retrieves up to 10 most prominent papers per author.
"""

import requests
import json
import time
from typing import List, Dict, Optional
from collections import defaultdict

# Semantic Scholar API base URL
S2_API_BASE = "https://api.semanticscholar.org/graph/v1"

# List of authors with name variations
AUTHORS = [
    {"name": "Adityanarayanan Radhakrishnan", "variations": []},
    {"name": "Blake Bordelon", "variations": []},
    {"name": "Bruno Loureiro", "variations": []},
    {"name": "Berkan Ottlik", "variations": []},
    {"name": "Dhruva Karkada", "variations": []},
    {"name": "Enric Boix Adsera", "variations": ["Enric Boix-Adsera"]},
    {"name": "Eric Michaud", "variations": []},
    {"name": "Florentin Guth", "variations": []},
    {"name": "Jamie Simon", "variations": ["James B. Simon", "James Simon"]},
    {"name": "Jeremy Bernstein", "variations": []},
    {"name": "Jeremy Cohen", "variations": []},
    {"name": "Joey Turnbull", "variations": ["Joseph Turnbull"]},
    {"name": "Jacob Zavatone Veth", "variations": ["Jacob Zavatone-Veth"]},
    {"name": "Daniel Kunin", "variations": []},
    {"name": "Nikhil Ghosh", "variations": []},
    {"name": "Preetum Nakkiran", "variations": []},
]


def search_author(author_name: str) -> Optional[str]:
    """Search for an author and return their Semantic Scholar ID."""
    url = f"{S2_API_BASE}/author/search"
    params = {"query": author_name, "limit": 5}

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        if data.get("data") and len(data["data"]) > 0:
            # Return the first match (usually most relevant)
            return data["data"][0]["authorId"]
        return None
    except Exception as e:
        print(f"Error searching for {author_name}: {e}")
        return None


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
        primary_name = author_info["name"]
        variations = [primary_name] + author_info["variations"]

        print(f"\n{'='*60}")
        print(f"Fetching papers for: {primary_name}")
        print(f"Variations: {variations}")
        print(f"{'='*60}")

        author_id = None
        for name_variant in variations:
            print(f"  Trying: {name_variant}...")
            author_id = search_author(name_variant)
            if author_id:
                print(f"  ✓ Found author ID: {author_id}")
                break
            time.sleep(0.5)  # Rate limiting

        if not author_id:
            print(f"  ✗ Could not find author: {primary_name}")
            all_data[primary_name] = {
                "author_id": None,
                "papers": []
            }
            continue

        # Fetch papers
        time.sleep(0.5)  # Rate limiting
        papers = get_author_papers(author_id)

        print(f"  Found {len(papers)} papers with abstracts")

        # Store data
        all_data[primary_name] = {
            "author_id": author_id,
            "papers": papers
        }

        # Show a sample
        if papers:
            top_paper = papers[0]
            print(f"  Top paper: {top_paper.get('title', 'N/A')}")
            print(f"  Citations: {top_paper.get('citationCount', 0)}")

    return all_data


def main():
    print("Starting paper collection...")
    print(f"Total authors: {len(AUTHORS)}")

    data = fetch_all_papers()

    # Save to JSON
    output_file = "papers_raw.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Data saved to: {output_file}")
    print(f"{'='*60}")

    # Print summary
    total_papers = sum(len(v["papers"]) for v in data.values())
    authors_found = sum(1 for v in data.values() if v["author_id"] is not None)

    print(f"\nSummary:")
    print(f"  Authors found: {authors_found}/{len(AUTHORS)}")
    print(f"  Total papers collected: {total_papers}")
    print(f"  Average papers per author: {total_papers/len(AUTHORS):.1f}")


if __name__ == "__main__":
    main()
