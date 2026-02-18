#!/usr/bin/env python3
"""
Entry point for the Learning Mechanics static site generator.

Build logic lives in the ssg/ package:
  ssg/config.py       — site-wide constants
  ssg/contributors.py — contributor loading and author HTML
  ssg/metadata.py     — frontmatter extraction and sequence metadata
  ssg/post.py         — pandoc invocation and post-processing
  ssg/index.py        — homepage generator
  ssg/questions.py    — open-questions page generator
  ssg/rss.py          — RSS feed generator
  ssg/static.py       — static file copying and CSS concatenation
  ssg/main.py         — two-pass build orchestration
"""

from ssg.main import main

if __name__ == '__main__':
    main()
