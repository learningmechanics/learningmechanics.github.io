# Learning Mechanics

Static site generator for [learningmechanics.pub](https://learningmechanics.pub).

## Prerequisites

- Python 3.6+
- [pandoc](https://pandoc.org/installing.html)

## Usage

### Writing Posts

Create markdown files in `posts/` with this frontmatter:

```markdown
---
title: "Your Post Title"
author: "Your Name"
date: "2026-01-21"
description: "Brief description for index/RSS"
tag: "Article"
---
```

Posts can also be organized into **sequences** (ordered series): create a subdirectory under `posts/` with numbered markdown files and a `sequence-metadata.yaml`.

### Development

**Auto-reload server (recommended):**
```bash
python dev-server.py
```
Rebuilds and reloads on every markdown change.

**Simple file watcher:**
```bash
python watch-simple.py
```
Rebuilds on changes; requires manual browser refresh.

**Manual build:**
```bash
python build.py
```
Output goes to `build/`.

### Deployment

```bash
# Build the site
python build.py

# Commit your changes
git add posts/your-new-post.md build/
git commit -m "Add: new post"
git push origin master
```

Or use the deploy script (builds and commits `build/` automatically):
```bash
./deploy.sh
git push
```

## Features

- **Math rendering**: KaTeX for LaTeX equations
- **Sequences**: ordered multi-part post series
- **Open questions**: curated from `data/openquestions.json`
- **Contributors**: team listing from `contributors.json`
- **Comments**: GitHub Discussions via Giscus
- **RSS feed**: auto-generated at `build/feed.xml`
- **Sitemap**: auto-generated at `build/sitemap.xml`
- **llms.txt**: auto-generated LLM-readable index
- **Analytics**: Google Analytics

## File Structure

```
├── posts/             # Markdown files and sequence subdirectories
├── data/              # openquestions.json
├── contributors.json  # Team/editor listing
├── templates/         # HTML templates
├── static/            # CSS, JS, images
├── ssg/               # Static site generator package
├── build/             # Generated site (committed for GitHub Pages)
├── build.py           # Build entry point
├── dev-server.py      # Development server with auto-reload
├── watch-simple.py    # Simple file watcher (manual refresh)
└── deploy.sh          # Build + git commit helper
```

## Configuration

Site-wide settings (URL, title, analytics IDs, Giscus config) are in `ssg/config.py`.
