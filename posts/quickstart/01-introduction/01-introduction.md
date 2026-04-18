---
title: "The Learning Mechanic's Quick and Dirty Guidebook: Introduction"
toc_title: "Introduction"
author: "Jamie Simon"
date: "2025-09-01"
sequence: "guidebook"
sequence_description: "A quick and dirty guide to the essential ideas in deep learning theory."
sequence_order: 1
---

The fundamental mathematical science of deep learning has had many successes over the past decade in the quest to bring principle to practical neural networks.
It has also had many failures.
There is now so much literature that it is difficult for newcomers to know where to start.
This needn’t be the case: our successes are notable but few, experts are converging on useful ideas and methodologies, and we should summarize in plain language the things that have definitively worked so we can better build on them.

Most of these successes are of a dynamical or mechanical sort, and the emerging picture is more and more akin to those areas of physics where simple pictures arise from consideration of microscopic dynamics: Newtonian mechanics, fluid mechanics, statistical mechanics, and quantum mechanics.
For this reason, we find the name *learning mechanics* the right one for the fundamental science now being pieced together.
This book is a summary of what we see as the “essentials of learning mechanics” as of 2026: the parts of the story so far that seem to us inevitable, indispensable, and part of the final picture.

**For newcomers:** welcome to the science of deep learning!
It is our belief that neural networks have a great deal of mathematical principle behind them.
We're confident that we as a field know some of it, but we haven't found most of it yet.
The field is currently conducting a scientific search for these principles, and if you want to contribute, we can use your help.
Our hope is that this series can serve as a quick and dirty guide to the field, summarizing the ideas we’re quite confident will stick around, so you can get up to speed and become conversant with minimal fuss.
We’ll focus on important *ideas* more than important *papers,* and we’ll tell you what you should get out of reading the papers we do share.
As the name suggests, we won't go into much technical detail here: our aim is to point you to the important ideas, but for the most part, you'll have to do the work of learning them yourself.
In the future, we hope to write a more comprehensive, deeply pedagogical guide.

Throughout this book, we’ll assume familiarity with basic deep learning and basic math including linear algebra, calculus, and statistics.
If you find something unduly confusing (especially if you have the motivation to fix it yourself), do let us know.
We'll highlight what we see as important open questions as we go.
Please adopt them as your own and share what you find.

**For experts in deep learning theory:** in any scientific enterprise, it’s useful every once in a while to stop, look backwards, and assess our progress.
Fields tend to sprawl as they advance, and so it's periodically valuable to reflect and notice that the important results are rather simpler than the path by which we got there.
(You will recognize many such cases in this guide.)
It's useful to look backwards and simplify, to smooth over the path, and to find the simple stories we will one day canonize in printed textbooks.
This helps veterans as much as newcomers: when we agree on our history and goals, we can better work together.

It’s the job of all experienced scientists to help teach and train the generations below.
It’s easy to forget with time and experience how hard it is to learn.
We’d greatly appreciate your sharing this with your younger students and collaborators.
It is meant for them.
If you have ideas for how to make this a better resource, we would like to hear them.

We have done our best to give proper attribution for all the ideas presented in this book.
If you feel we have made any attribution errors, do inform us.

**Relationship to our whitepaper.**
We're publishing this guidebook at the same time as our whitepaper, [There Will Be a Scientific Theory of Deep Learning]({{WHITEPAPER_URL}}).
We wrote the paper to articulate the emerging discipline of learning mechanics and argue persuasively that there will indeed be a comprehensive theory worthy of the name.
That paper should get you excited to build the fundamental theory of deep learning.
This guidebook is a complementary resource intended to help you get started.
It is written in a style that is more casual, more pedagogical and expository, and (we hope) easier to read and learn from.
We also include more discussion of the historical development of ideas (though experts will still notice many omissions).
While the paper is meant to be read in one go, this guide is meant to be browsed one chapter at a time, mulled over, and returned to.
(But of course, if you want to read it straight through, don't let us discourage you.)

## Widening pockets of understanding

Deep learning is complicated.
Training a neural network involves choosing an architecture, choosing a dataset, selecting numerous hyperparameters, and running a long iterated training procedure until, eventually, the loss goes down acceptably and learning has occurred.
We believe there will one day be a unified theory touching all of these variables, but that day has not yet arrived.
At the present moment, the scientific theory we have is limited to several pockets of understanding which are mostly disjoint from each other.
As we make progress, the field will continue to widen these pockets of understanding and strengthening crosslinks between them, linking them together into a more unified science.
For now, though, there is no avoiding telling a handful of parallel stories.
These will comprise the chapters of this book.

A good way to go about research in this or any field is to narrow in on a specific enough question that it might actually be answered.
"Understanding deep learning" in the abstract (or "solving" it, and so on) is so big and vague a goal that if you reach for it all at once, you are very likely to come back empty-handed.
In our years in deep learning theory (long by AI standards, but short by academic standards), we have already seen many attempts at grand unified theories founder on the rocks, especially those overly espoused to one mathematical idea or aspect of the deep learning system.
For beginners to this field, we strongly advocate the more modest approach of choosing one existing pocket of understanding and pushing to widen it or connect it with others.
Of course, this approach still allows for ambitious and revolutionary work: it just increases your odds that you are building on solid foundations, in a way connected to the rest of the edifice.

Without further ado, let's begin.
The chapters follow the rough ordering of earlier chapters discussing better-understood topics.
Topics discussed in earlier chapters also turn out to be more important for later chapters than vice versa.

---

## Citation

{{CITATION}}