---
title: "Towards an atlas of deep learning"
toc_title: "Towards an atlas of deep learning"
author: "Dhruva Karkada"
date: "2026-04-15"
description: ""
sequence: "perspectives"
sequence_order: 3
---

In the earliest stages of my research training, I felt somewhat overwhelmed by the diversity of scientific approaches to understanding deep learning. For example, some theorists value rigorously proven theorems about worst-case behavior above all else, some prefer insightful calculations in reduced variables, and others prefer "glassy" high-dimensional toy models. Meanwhile, empirical approaches often prioritize collecting empirical laws and robust rules-of-thumb. Unlike in physics, where scientific paradigms have been established, the science of deep learning has evidently not converged on a canonical approach.

This left me with many practical questions. What tools should I learn, and what literature should I prioritize reading? Which approaches to deep learning science are most effective in providing scientific scaffolding? Which ones produce the most reliable results? Which ones provide the broadest and most useful intuitions?

Sadly, I've found no oracle to answer these meta-scientific questions. Nonetheless, I've found it easier to reason about them by analogy, understanding the project to understand deep learning as scientific cartography. In particular, scientists aim to explore and chart a vast landscape of mysterious learning systems that often exhibit underlying regularities. Scientific insights are the compressed representations (i.e., maps) of these terrains, and they enable both counterfactual and predictive reasoning. We produce these maps at varying breadths and resolutions, including predictive laws, effective theories, qualitative heuristics, rigorous proofs, and careful empirics.{fn: Here we focus on deep learning, but the metaphor really describes science in general. Cartographers map a terrain with geological and ecological structure, while scientists map natural phenomena which have predictable and sometimes mathematical structure. Charts and surveys inform infrastructure planning and urban development, while scientific theories serve as foundations from which mature technologies can be extrapolated. Cartographers use detailed small-scale maps, coarse navigational charts, descriptive field guides, etc., while scientists develop empirical laws, useful heuristics, conceptual frameworks, and mathematical theorems.}

In this blog post, I'll share how I now think about the science of deep learning. Ultimately, this conceptual framework&mdash;science as mapmaking&mdash;helps me contextualize my own research efforts, and it gives me optimism that different modes of research can operate in harmony to make the most progress towards a full scientific theory of deep learning.

## The science of deep learning as mapmaking

Just as geographic regions are specified by their latitudes and longitudes, the coordinates of deep learning phenomena are fully specified by the task structure, model architecture, optimizer design, and hyperparameter choices. For each such system, there are a number of possible observables we might be interested in characterizing. For example, what is its sample complexity? What are the final estimators like? How robust are they to adversarial perturbation? How transferable are the learned features to different tasks? The list goes on. And there are probably entire categories of questions that we haven’t even realized are useful to ask.

<!-- Clearly, the scientific wilderness of deep learning is vast. Here's a 2D cartoon of my mental image of it:

[Cartoon]

Admittedly, this is a limited view of deep learning phenomena -- it reflects my own narrow personal experience. Other researchers would draw it differently, including territories I've never explored myself. And there are likely entire continents of learning phenomena out there that *nobody* has stepped foot on yet, much less charted. -->

In the normal course of science, we build an understanding of this terrain by organizing research expeditions and producing scientific results. The most primitive scientific results are not much more than field guides: rather disconnected lists of coarse observations and heuristics describing a particular learning system. A mature scientific theory, on the other hand, is a *map*: it synthesizes these results into a predictive, intuitive, first-principles description that distills the underlying mechanisms of learning.

It's true that field guides are useful as a first step in navigating the vast landscape of deep learning phenomena. However, a map can do more. Maps provide an intuitive understanding of the terrain that we can extrapolate from and often suggest where to explore next. The mission of learning mechanics is to turn our field guides into maps.

## Recommendations for scientists

Clearly, doing good science requires thinking deeply about scientific maps. However, doing *effective* science requires thinking deeply *about mapmaking*. Great artisans don’t focus exclusively on the mechanical habit of craft; they frequently reflect on their own craftsmanship. In this spirit, let’s reflect on the various types of scientific maps. This a meta-scientific exercise in organizing all the methods we might use to understand the landscape of deep learning phenomena.

A scientific map can be _any_ useful way of describing the terrain. For example, it might be a provable statement like “learning algorithm $\texttt A$ is equivalent to learning algorithm $\texttt A '$ in regime $R$.” It may be a derivable calculational framework like “equations $\texttt{E1-E9}$ predict the learning curves for learning algorithm $\texttt A$ under any natural data distribution.” It may be an empirical law like “all models in class $\mathcal C$ when trained on task $T$ are measured to have property $P$.” It may be a qualitative descriptor like “model $M$ trained on data $\mathcal{D}$ learns human-interpretable internal representations: $\{r_1, r_2, r_3, \dots\}$.”

These scientific maps are diverse in power{fn:If we have a good map of a given deep learning system, then we can often find ways to extrapolate quantitative insights about neighboring systems. This is what it means for a theory to have predictive power. Even without such extrapolations, the map itself is a compressed representation of the learning phenomena in that region. Although [the map is not the territory](https://en.wikipedia.org/wiki/Map–territory_relation), it’s often a good summary, and the theory has explanatory power.} and in character. I see four distinct qualities that are most important to keep in mind:

1. **Trueness of the map.** How correct is the theory? This is obviously the theory's most important attribute. In a perfect world, every theory in deep learning would be provably correct.
2. **Precision of the map.** Is the theory precise (in the [scientific sense](https://en.wikipedia.org/wiki/Accuracy_and_precision#ISO_definition_(ISO_5725))) enough to recover important details about the system? Better, is it precise enough to make average-case predictions? _Even better_, is it both correct and precise enough to reliably inform engineering? Both precision and trueness are necessary for a theory to be useful for downstream applications.
3. **Extent of the map.** How many distinct learning phenomena (or classes of phenomena) does the theory describe? Note that the accuracy and/or precision of the map may vary over these regions (i.e., the theory might be provably correct in a narrow regime, but approximately correct in a much larger regime.)
4. **Parsimony of the map.** How well does the theory compress the phenomena we want to describe? If the theory is a closed-form mathematical equation, we typically get enormous compression and the theory is considered succinct and beautiful. On the other hand, a long list of facts is hardly a satisfying theory at all, even if the facts are all true.{fn:This is a particular manifestation of Occam’s razor; we want theories that require inputs from as few variables as possible. [Roberts (2021)](https://arxiv.org/abs/2104.00008) uses the term "sparsity" to describe a similar idea.} The reason parsimony is important is that it enables scientists to intuitively reason about how different ideas fit together, allowing us to build unified theories by induction.

The holy grail, of course, is a _grand unified theory_: a map that is correct, precise, extensive, and parsimonious. Although it’s unclear whether such a theory is possible, it is the gold standard in quantitative sciences. In any case, the dominant strategy is to simply assume that such a theory exists and work towards it. Even if we're wrong, we still obtain a partial theory consisting of a patchwork mosaic of local maps. Though disconnected, each island of understanding remains useful as a reliable anchorage from which we can reason about a deep learning system.

What stands in the way of a grand unified theory? There's no known principle that says that these four scientific criteria aren't mutually satisfiable in deep learning. In practice though, researchers often find that the criteria _do_ come into conflict. The result of this tension is that distinct scientific communities emerge, each with cultural preferences for satisfying some criteria over others. Theorists from a pure math background aim to prove theorems, i.e., draw maps that are fully _correct_ but often sacrifice _precision_ or _extent_ (c.f. many results in classical learning theory, where constant prefactors are often left unresolved). Scientists trained in physics tend to prefer insightful calculations involving a reduced set of variables, resulting in maps that are _parsimonious_ and _precise_ but may sacrifice some provable _correctness_ (i.e., rigor). Practicitioners often prioritize collecting empirical laws and robust rules-of-thumb; though the resulting field guides and maps are often _extensive_, there may exist hidden counterexamples that are hard to characterize, leaving the _correctness_ of the map in question.

It's important to be self-aware about these implicit tradeoffs when we organize research expeditions. The goal of a research expedition is to collect new and reliable information about unmapped or partially-mapped terrain; setting off to explore with only one type of map in hand leaves expeditioners vulnerable to blind spots. To defend against these blind spots, expedition teams can be tempted to stay in shallow waters, treading familiar paths where their maps are reliable and their tools are effective. This the [streetlight fallacy](https://en.wikipedia.org/wiki/Streetlight_effect) in action, and although it may be the safe choice for any given expedition, it reduces the efficacy of the scientific enterprise as a whole. Obtaining high-quality maps is a treacherous endeavor, and it requires bravery.

In the face of these practical challenges, I suggest the following maxims:

1. Aim to produce different types of maps.
2. Source mapmaking expertise from diverse backgrounds.
3. Plan research expeditions with long-term goals in mind.

#### 1. Aim to produce different types of maps.

Every type of map has shortcomings.

For example, rigorous proofs of rather loose bounds (such as those sometimes obtained by classical learning theory) are very coarse maps: fully true but imprecise. Sometimes, one can trade extent for precision, e.g., by proving tighter bounds that require stronger assumptions, but the brittleness remains. Although such maps do eliminate possibilities and reduce the search space, their narrow scope makes them insufficient as the sole ingredients of a unified scientific theory. Deep learning theorists began to realize this in the 2010s, accelerating the adoption of physics-inspired approaches (e.g., replica calculations, mean field regimes, etc).

Conversely, predictions derived in simplified settings are typically very precise, but they typically fall short of accurately describing the real system of interest. For example, consider applying the theory of generalization in the neural tangent kernel (NTK) regime to practical deep networks. Though the predictions are very sharp, they are ultimately inaccurate since NTK theory does not account for feature learning. Clearly, it is important to tread carefully when relying on rigorous results for intuition beyond their strict regime of applicability.

As a third example, consider the scaling hypothesis. The observation that model error decreases as a power-law with respect to computational scale is the primary force driving the LLM boom. It's an empirical law: extensive and seemingly precise up to measurable prefactors, but not provably correct (as far as we know). It may be sufficiently reliable to motivate investors, but we don't scientifically understand the fundamental mechanisms that produce this behavior, and so we don't know how far it might extend before breaking.

<!-- [cartoon showing three types of maps] -->

Although each type of map is useful in its own way, none of them are sufficient on their own. We should embrace the inherent trade-offs and work towards ever-more-complete theories by producing layered maps of different scale and resolution. This is already loosely true at the collective level: the maps produced by different subfields of deep learning science jointly constitute a dappled mosaic of scientific understanding. Ideally, each *individual* research expedition should aim to produce a layered map with some mix of provable theorems, non-rigorous first-principles calculations, and experiments that check practical regimes outside the simplified theoretical setting. Together, these pillars provide stable support for a new scientific insight.


#### 2. Source mapmaking expertise from diverse backgrounds.

In practice, it's a strong demand to ask individual research expeditions to produce layered maps. It requires expeditioners to share notes frequently.

All deep learning scientists can gain a lot from talking to formal theoreticians. Rigorous theorems are maximally incisive, giving strong guarantees about where one can find certain learning phenomena and where one can't. In particular, many areas of rich scientific development are often nucleated by a clean theorem that establishes sufficient conditions for a class of learning behaviors. A relevant modern example is the study of learning *multi-index models*, e.g., $f^\star(\mathbf x)=g(\mathbf{Ux})$, where  $\mathbf U$ is a low-rank projection matrix and $g$ is a polynomial "link function." Under overly-restrictive assumptions on the distribution of $\mathbf{x}$, one can prove that neural networks *efficiently* approximate $f^\star$ by first learning task-relevant features. If we imagine the class of feature-learning neural networks trained on natural data as a lush valley surrounded by impenetrable mountains, then these results are like detailed maps of converging animal trails near a hidden mountain pass: though their regime of validity does not intersect the setting we ultimately care about, they suggest that an angle of attack is nearby, and expeditioners should explore the surrounding areas.{fn:In fact, by exploring the vicinity of multi-index models, we *have* gotten closer to this mountain pass: we now know that deep neural networks efficiently learn compositional "staircase functions," which are more realistic models of natural targets.}

Ideally, theorists should collaborate closely with experimentalists to demarcate the practical boundaries of various aspects of a mathematical theory. Consider the shortcomings of NTK theory mentioned earlier: we don't expect its precise predictions to be accurate in the interesting feature-learning regime. Despite this, NTK theory *does* qualitatively capture some aspects of inductive bias in general deep learning, and experimental scientists should organize expeditions to check how large its effective region of validity is.

Conversely, deep learning theorists can often obtain useful signal from careful empirics. For example, the aforementioned theory of learning staircase functions was partly inspired by experiments indicating that real neural networks outperform NTKs. This is a common phenomenon in quantitative sciences: unexplained empirical regularities often serve as reliable starting points for theoretical development and motivate problem selection. I'd argue that there is more to juice to squeeze by maintaining an even tighter loop with experimentalists. For example, alternating between theory and experiments can accelerate hypothesis generation, and in some cases experiments can even suggest proof ideas by isolating relevant variables.

#### 3. Plan expeditions with long-term goals in mind.

Richard Hamming famously asked, "What is the most important problem in your field, and why aren't you working on it?" The utility of the Hamming question is in forcing you to examining how your concrete research expeditions, each with their own short-term goals, might connect with the broader cartographic project. The terrain of deep learning is too expansive and perilous to explore by random walk, and a little bit of forethought can go a long way.

Clearly, it's important to plan for the long game. After identifying the tallest mountains and densest bogs that sit between well-mapped areas and the big remaining mysteries, one should determine the tools and insights needed to either traverse or circumvent them. This is a reliable guide for short-term problem selection. Without going through this exercise, expeditioners risk getting stuck, or worse, studying the same well-trodden areas, adding only small details to mostly-complete maps.

One example is the study of grokking: the phenomenon in which test set performance significantly lags behind training set performance until very late in the learning process. What makes grokking interesting is that it violates the intuition that a model which has memorized its training data has already settled into its final solution. In this sense, grokking is like a tall outcropping, giving a unique vantage point that reveals a new generalization puzzle. Forward-thinking expeditioners follow the trails this vantage point reveals, showing mechanistically how the dynamics of learning produce generalizing features. However, expeditions that wander in circles near the outcropping, simply documenting new isolated instances of grokking, risk missing the point completely.

## A collective enterprise

Understanding deep learning is ultimately a collective enterprise, and my analogy to cartography aims to provide a framework for solving the inherent coordination problem. I hope that by thinking in terms of scientific maps, we can organize independent research expeditions into a coherent survey of the landscape of deep learning.

---

## Citation

{{CITATION}}
