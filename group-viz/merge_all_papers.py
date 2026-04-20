#!/usr/bin/env python3
"""
Merge papers from all sources:
- Semantic Scholar (papers_data.json)
- arXiv (papers_arxiv.json)
- Manual additions for authors with few/no papers
"""

import json
from collections import defaultdict
from typing import List, Dict

# Manually curated papers for authors not well-covered
MANUAL_PAPERS = {
    "Berkan Ottlik": [
        {
            "title": "The Effect of Model Capacity on the Emergence of In-Context Learning",
            "abstract": "Research on the emergence of in-context learning in neural networks based on model capacity.",
            "authors": [
                {"name": "Berkan Ottlik"},
                {"name": "Narutatsu Ri"},
                {"name": "Daniel Hsu"},
                {"name": "Clayton Sanford"}
            ],
            "year": "2024",
            "venue": "ICLR 2024 Workshop (ME-FoMo)",
            "citationCount": 0,
        },
        {
            "title": "Gradient Flow Dynamics of Teacher-Student Distillation with the Squared Loss",
            "abstract": "Analysis of gradient flow dynamics in knowledge distillation scenarios.",
            "authors": [
                {"name": "Berkan Ottlik"}
            ],
            "year": "2024",
            "venue": "Summer@Simons poster session",
            "citationCount": 0,
        }
    ]
}


def load_json(filename):
    """Load JSON file."""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {filename} not found")
        return {}


def normalize_title(title):
    """Normalize title for deduplication."""
    if not title:
        return ""
    return title.lower().strip().replace('\n', ' ')


def merge_papers_for_author(name, s2_papers, arxiv_papers, manual_papers):
    """Merge papers from different sources for a single author."""
    merged = []
    seen_titles = set()

    # Priority: Semantic Scholar (has citations), then arXiv, then manual
    for paper in s2_papers:
        title = normalize_title(paper.get('title', ''))
        if title and len(title) > 20:
            seen_titles.add(title)
            merged.append({**paper, 'source': 'semantic_scholar'})

    for paper in arxiv_papers:
        title = normalize_title(paper.get('title', ''))
        if title and len(title) > 20 and title not in seen_titles:
            seen_titles.add(title)
            merged.append({**paper, 'source': 'arxiv'})

    for paper in manual_papers:
        title = normalize_title(paper.get('title', ''))
        if title and len(title) > 20 and title not in seen_titles:
            seen_titles.add(title)
            merged.append({**paper, 'source': 'manual'})

    # Sort by citation count (descending), then by year (descending)
    merged.sort(
        key=lambda x: (
            x.get('citationCount', 0),
            int(x.get('year', '0') or '0')
        ),
        reverse=True
    )

    # Take top 10
    return merged[:10]


def extract_coauthor_names(paper, exclude_name):
    """Extract coauthor names from a paper, excluding the main author."""
    authors = paper.get('authors', [])
    coauthors = []

    exclude_normalized = exclude_name.lower().replace('.', '').replace('-', ' ')

    for author in authors:
        author_name = author.get('name', '')
        author_normalized = author_name.lower().replace('.', '').replace('-', ' ')

        # Skip if this is the main author
        if exclude_normalized not in author_normalized:
            coauthors.append(author_name)

    return coauthors


def main():
    print("Merging papers from all sources...")

    # Load data from different sources
    s2_data = load_json('papers_data.json')
    arxiv_data = load_json('papers_arxiv.json')

    # All authors we're tracking
    all_authors = [
        "Adityanarayanan Radhakrishnan",
        "Blake Bordelon",
        "Bruno Loureiro",
        "Berkan Ottlik",
        "Dhruva Karkada",
        "Enric Boix Adsera",
        "Eric Michaud",
        "Florentin Guth",
        "Jamie Simon",
        "Jeremy Bernstein",
        "Jeremy Cohen",
        "Joey Turnbull",
        "Jacob Zavatone Veth",
        "Daniel Kunin",
        "Nikhil Ghosh",
        "Preetum Nakkiran",
    ]

    merged_data = {}

    for author in all_authors:
        print(f"\nProcessing: {author}")

        # Get papers from each source
        s2_papers = s2_data.get(author, {}).get('papers', [])
        arxiv_papers = arxiv_data.get(author, {}).get('papers', [])
        manual_papers = MANUAL_PAPERS.get(author, [])

        # Merge
        merged_papers = merge_papers_for_author(
            author, s2_papers, arxiv_papers, manual_papers
        )

        # Extract all coauthors
        all_coauthors = set()
        for paper in merged_papers:
            coauthors = extract_coauthor_names(paper, author)
            all_coauthors.update(coauthors)

        merged_data[author] = {
            'papers': merged_papers,
            'num_papers': len(merged_papers),
            'total_citations': sum(p.get('citationCount', 0) for p in merged_papers),
            'coauthors': sorted(list(all_coauthors)),
        }

        print(f"  Final: {len(merged_papers)} papers, {len(all_coauthors)} unique coauthors")
        if merged_papers:
            sources = [p.get('source', 'unknown') for p in merged_papers]
            print(f"  Sources: S2={sources.count('semantic_scholar')}, arXiv={sources.count('arxiv')}, manual={sources.count('manual')}")

    # Save merged data
    output_file = 'papers_merged.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Merged data saved to: {output_file}")
    print(f"{'='*60}")

    # Print summary
    total_papers = sum(v['num_papers'] for v in merged_data.values())
    total_citations = sum(v['total_citations'] for v in merged_data.values())
    authors_with_papers = sum(1 for v in merged_data.values() if v['num_papers'] > 0)

    print(f"\nFinal Summary:")
    print(f"  Authors with papers: {authors_with_papers}/{len(all_authors)}")
    print(f"  Total papers: {total_papers}")
    print(f"  Total citations: {total_citations}")
    print(f"  Average papers per author: {total_papers/len(all_authors):.1f}")

    # Check for internal collaborations
    print(f"\n{'='*60}")
    print("Checking for internal collaborations...")
    print(f"{'='*60}")

    author_set = set(all_authors)
    collaborations = defaultdict(list)

    for author, data in merged_data.items():
        coauthors = data['coauthors']

        # Check if any coauthor is in our list
        for coauthor in coauthors:
            # Fuzzy matching - check if any part matches
            for other_author in author_set:
                if other_author == author:
                    continue

                # Simple check: last name matching
                author_parts = other_author.split()
                coauthor_lower = coauthor.lower()

                if any(part.lower() in coauthor_lower for part in author_parts if len(part) > 3):
                    pair = tuple(sorted([author, other_author]))
                    collaborations[pair].append(coauthor)

    if collaborations:
        print(f"\nFound {len(collaborations)} potential collaborations:")
        for (author1, author2), matches in collaborations.items():
            print(f"  • {author1} ↔ {author2}")
            print(f"    Matched via: {', '.join(set(matches))}")
    else:
        print("\nNo internal collaborations detected in the dataset.")

    # Save collaboration data
    collab_output = {
        'collaborations': [
            {
                'author1': pair[0],
                'author2': pair[1],
                'matched_names': list(set(matches))
            }
            for pair, matches in collaborations.items()
        ]
    }

    with open('collaborations.json', 'w', encoding='utf-8') as f:
        json.dump(collab_output, f, indent=2)

    print(f"\nCollaboration data saved to: collaborations.json")


if __name__ == "__main__":
    main()
