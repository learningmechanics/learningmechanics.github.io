#!/usr/bin/env python3
"""
Fetch papers from arXiv for specific author names.
Complements the Semantic Scholar data.
"""

import urllib.request
import urllib.parse
import time
import xml.etree.ElementTree as ET
import json
from typing import List, Dict

# arXiv API base URL
ARXIV_API_BASE = "http://export.arxiv.org/api/query"

# Authors to search for (with name variations)
AUTHORS_TO_SEARCH = [
    {"name": "Jamie Simon", "search_names": ["James B. Simon", "James Simon", "Jamie Simon"]},
    {"name": "Eric Michaud", "search_names": ["Eric J. Michaud", "Eric Michaud"]},
    {"name": "Jeremy Bernstein", "search_names": ["Jeremy Bernstein"]},
    {"name": "Nikhil Ghosh", "search_names": ["Nikhil Ghosh"]},
    {"name": "Jeremy Cohen", "search_names": ["Jeremy M. Cohen", "Jeremy Cohen"]},
    {"name": "Joey Turnbull", "search_names": ["Joseph Turnbull", "Joey Turnbull"]},
    {"name": "Berkan Ottlik", "search_names": ["Berkan Ottlik"]},
]


def search_arxiv_author(author_name: str, max_results: int = 20) -> List[Dict]:
    """Search arXiv for papers by an author."""
    query = f'au:"{author_name}"'
    params = {
        'search_query': query,
        'start': 0,
        'max_results': max_results,
        'sortBy': 'relevance',
        'sortOrder': 'descending'
    }

    url = f"{ARXIV_API_BASE}?{urllib.parse.urlencode(params)}"

    try:
        with urllib.request.urlopen(url) as response:
            data = response.read().decode('utf-8')

        # Parse XML
        root = ET.fromstring(data)

        # Namespace for arXiv API
        ns = {
            'atom': 'http://www.w3.org/2005/Atom',
            'arxiv': 'http://arxiv.org/schemas/atom'
        }

        papers = []
        for entry in root.findall('atom:entry', ns):
            title_elem = entry.find('atom:title', ns)
            summary_elem = entry.find('atom:summary', ns)
            published_elem = entry.find('atom:published', ns)
            link_elem = entry.find('atom:id', ns)

            # Get authors
            authors = []
            for author in entry.findall('atom:author', ns):
                author_name = author.find('atom:name', ns)
                if author_name is not None:
                    authors.append(author_name.text)

            # Extract arXiv ID from link
            arxiv_id = None
            if link_elem is not None:
                arxiv_id = link_elem.text.split('/abs/')[-1]

            paper = {
                'title': title_elem.text.strip() if title_elem is not None else None,
                'abstract': summary_elem.text.strip() if summary_elem is not None else None,
                'authors': [{'name': a} for a in authors],
                'year': published_elem.text[:4] if published_elem is not None else None,
                'arxiv_id': arxiv_id,
                'venue': 'arXiv',
                'citationCount': 0,  # arXiv doesn't provide citations
                'publicationDate': published_elem.text if published_elem is not None else None,
            }

            papers.append(paper)

        return papers

    except Exception as e:
        print(f"Error fetching from arXiv for {author_name}: {e}")
        return []


def fetch_all_arxiv_papers():
    """Fetch papers from arXiv for all authors."""
    all_data = {}

    for author_info in AUTHORS_TO_SEARCH:
        primary_name = author_info["name"]
        search_names = author_info["search_names"]

        print(f"\n{'='*60}")
        print(f"Fetching arXiv papers for: {primary_name}")
        print(f"{'='*60}")

        all_papers = []
        seen_titles = set()

        for search_name in search_names:
            print(f"  Searching: {search_name}...")
            papers = search_arxiv_author(search_name, max_results=15)

            # Deduplicate by title
            for paper in papers:
                title = paper.get('title', '').lower().strip()
                if title and title not in seen_titles and len(title) > 20:
                    seen_titles.add(title)
                    all_papers.append(paper)

            time.sleep(3)  # Be nice to arXiv API

        print(f"  Found {len(all_papers)} unique papers")

        # Show top papers
        if all_papers:
            print(f"  Sample papers:")
            for i, paper in enumerate(all_papers[:3], 1):
                print(f"    {i}. {paper.get('title', 'N/A')[:80]}...")

        all_data[primary_name] = {
            "author_id": None,
            "papers": all_papers,
            "source": "arXiv"
        }

    return all_data


def main():
    print("Fetching papers from arXiv for authors missing from Semantic Scholar...")

    data = fetch_all_arxiv_papers()

    # Save to JSON
    output_file = "papers_arxiv.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Data saved to: {output_file}")
    print(f"{'='*60}")

    # Print summary
    total_papers = sum(len(v["papers"]) for v in data.values())
    authors_found = sum(1 for v in data.values() if len(v["papers"]) > 0)

    print(f"\nSummary:")
    print(f"  Authors with papers found: {authors_found}/{len(AUTHORS_TO_SEARCH)}")
    print(f"  Total papers collected: {total_papers}")


if __name__ == "__main__":
    main()
