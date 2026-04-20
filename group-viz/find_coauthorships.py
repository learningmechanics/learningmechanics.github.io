#!/usr/bin/env python3
"""
Find actual coauthorships from paper data.
"""

import json
from collections import defaultdict

def normalize_name(name):
    """Normalize author name for matching."""
    return name.lower().replace('.', '').replace('-', ' ').strip()

def main():
    # Load papers
    with open('papers_merged.json', 'r') as f:
        papers_data = json.load(f)

    # Author list
    authors = list(papers_data.keys())

    # Create name variations for each author
    author_variations = {
        "Jamie Simon": ["james b. simon", "james simon", "jamie simon", "james b simon"],
        "Joey Turnbull": ["joseph turnbull", "joey turnbull"],
        "Jeremy Bernstein": ["jeremy bernstein"],
        "Jeremy Cohen": ["jeremy m. cohen", "jeremy cohen", "jeremy m cohen"],
        "Eric Michaud": ["eric j. michaud", "eric michaud", "eric j michaud"],
        "Enric Boix Adsera": ["enric boix adsera", "enric boix-adsera", "enric boixadsera"],
        "Jacob Zavatone Veth": ["jacob zavatone veth", "jacob zavatone-veth", "jacob a zavatone-veth", "jacob a. zavatone-veth"],
        "Alex Atanasov": ["alexander atanasov", "alex atanasov"],
        "Arthur Jacot": ["arthur jacot"],
    }

    # Build reverse lookup
    name_to_author = {}
    for author in authors:
        normalized = normalize_name(author)
        name_to_author[normalized] = author

        # Add variations
        if author in author_variations:
            for variation in author_variations[author]:
                name_to_author[normalize_name(variation)] = author

    # Count coauthorships - track unique papers
    coauthorships = defaultdict(lambda: {"count": 0, "papers": set()})
    seen_papers = set()  # Track globally seen papers

    for author1, data1 in papers_data.items():
        for paper in data1['papers']:
            title = normalize_name(paper.get('title', ''))

            # Skip if we've already processed this paper
            if title in seen_papers:
                continue
            seen_papers.add(title)

            paper_authors = [a['name'] for a in paper.get('authors', [])]

            # Find which of our target authors are on this paper
            authors_on_paper = set()
            for paper_author in paper_authors:
                normalized_pa = normalize_name(paper_author)
                if normalized_pa in name_to_author:
                    authors_on_paper.add(name_to_author[normalized_pa])

            # Record coauthorships
            authors_list = sorted(list(authors_on_paper))
            if len(authors_list) >= 2:
                for i in range(len(authors_list)):
                    for j in range(i + 1, len(authors_list)):
                        pair = tuple(sorted([authors_list[i], authors_list[j]]))
                        coauthorships[pair]["count"] += 1
                        coauthorships[pair]["papers"].add(paper.get('title', 'Untitled'))

    # Convert to list format
    result = []
    for (author1, author2), data in coauthorships.items():
        result.append({
            "author1": author1,
            "author2": author2,
            "count": data["count"],
            "papers": list(data["papers"])[:3]  # First 3 papers (convert set to list)
        })

    # Sort by count descending
    result.sort(key=lambda x: x['count'], reverse=True)

    # Save
    with open('coauthorships.json', 'w') as f:
        json.dump(result, f, indent=2)

    print(f"Found {len(result)} coauthorship pairs:")
    for pair in result:
        print(f"  {pair['author1']} ↔ {pair['author2']}: {pair['count']} papers")
        for title in pair['papers']:
            print(f"    • {title}")

if __name__ == "__main__":
    main()
