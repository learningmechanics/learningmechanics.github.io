---
title: "Quickstart Guide: The dynamics of training"
toc_title: "The dynamics of training"
author: "The Learning Mechanics Team"
date: "2025-09-01"
description: "Major lines of theoretical research into the optimization dynamics of neural networks, from classical convergence theory to the edge of stability."
sequence: "quickstart"
sequence_description: "A comprehensive guide to understanding the mathematical foundations of deep learning, from optimization to generalization."
sequence_order: 4
---

Neural network training is a process of numerical optimization: first we define a loss (i.e. cost) function we want to minimize, and then we push on all the neural network parameters to essentially *make number go down.* This sounds really simple until you try it. It turns out there are lots of ways to make the number go down, and some of them work better than others, and some of them work very poorly even though they seem like bright ideas, and it's all a big mess. It would sure be nice if we could simplify the picture and shed some light on the process of optimization, and understanding that process just might give us a new lens for understanding the final trained artifact we get out at training's end.

In this chapter, we'll walk through several major lines of theoretical research into the optimization dynamics of neural networks. We'll start with the classical perspective, which was concerned mostly with the *convergence* of optimization. This turned out to not be the right question to ask of deep learning, but that line of work still unearthed a few gems that continue to be useful.

In recent times, we have learned that we should pay attention to more than just the value of the loss. "How fast does it go down?" is essentially the only question you can ask about the loss, which isn't all that interesting. We should also look at how the ***weights, hidden representations, and other high-dimensional statistics of the network*** change during training. It turns out most of the story is in these other quantities that then drive the loss dynamics.^[To make this point in analogy form: trying to understand optimization by just studying the loss is like trying to understand a country's history, culture and politics from just its GDP over time.] To that end, we'll cover a few cases where notable optimization phenomena have been understood in parameter space.

This will be another long chapter, so we'll start with a table of contents:

<div class="sequence-toc">
<h3>Quickstart Guide: The dynamics of training</h3>
<ol>
<li><a href="#the-classical-picture-optimization-as-distinct-from-generalization">The classical picture: optimization as distinct from generalization</a></li>
<li><a href="#overparameterization-overfitting-and-the-slow-death-of-the-classical-perspective">Overparameterization, overfitting, and the slow death of the classical perspective</a></li>
<li><a href="#the-inductive-bias-of-gradient-descent-and-the-ntk-picture">The inductive bias of gradient descent and the NTK picture</a></li>
<li><a href="#deep-linear-nets-a-solvable-case-of-dynamics-in-weight-space">Deep linear nets: a solvable case of dynamics in weight space</a></li>
<li><a href="#progressive-sharpening-and-the-edge-of-stability">Progressive sharpening and the edge of stability</a></li>
<li><a href="#nondimensionalization-and-scale-invariance">Nondimensionalization and scale-invariance</a></li>
<li><a href="#why-do-some-optimizers-work-better-than-others">Why do some optimizers work better than others?</a></li>
</ol>
</div>

### The classical picture: optimization as distinct from generalization

- Jeremy's picture; separation of concerns
- Classical results about optimization:
    - Descent lemma, how beautiful
    - Quadratic loss surfaces
    - Classical/convex optimization theory

### Overparameterization, overfitting, and the slow death of the classical perspective

- A bunch of things wrong with the classical picture:
    - E.g. the same training loss can generalize very differently
        - So clearly there's "something to" the training dynamics that's not reflected in the loss
    - Intuition that with many params you can always find a descent direction; no bad local minima

### The inductive bias of gradient descent and the NTK picture

- Inductive bias story: GD "chooses" from a manifold of local minima and somehow "prefers" one
    - Solvable cases where this is true
    - Not that it's wrong, just that it's hard to really make this rigorous
    - Still is a folk belief that GD is kinda like L2-min, tho… how true? Open Q.
- NTK: a solvable model of wide neural nets
    - Kinda killed the question of overparameterization
    - Already discussed in previous two sections; intersects with those stories here

### Deep linear nets: a solvable case of dynamics in weight space

- Arguably the first case people really solved dynamics of a deep model in weight space proper
    - Be sure to give citations to earlier works that do this, too, incl that Japanese guy
- Discuss what happens, the phenomenology, link to widget if/when we have it
- Greedy low-rank dynamics: discuss s2s, AGF, etc.
- Does this look like real nets? If so, how so? Jury's still out.

<div class="question-box">

**Open question: Deep linear net dynamics in real networks.** To what extent do deep linear network dynamics (e.g. greedy low-rank progression) carry over to nonlinear networks trained in practice?

</div>

### Progressive sharpening and the edge of stability

- Classical intuition: sharpness stability threshold
- Modern observation: nets actually adapt to approach that threshold
    - Bluntening: catapult effect
    - Sharpening: progressive sharpening
- And then you're at the EoS. And there's actually a great deal you can say there
    - Jeremy's papers, Alex's papers

### Nondimensionalization and scale-invariance

- This is basically the HP story from the previous chapter
- Discuss how it came about + what it means, how it ties into this chapter
- Cite Nikhil's recent paper here

### Why do some optimizers work better than others?

- "Adam works by being block-adaptive w its lr"
- Muon??? Kiiiinda comes from the spectral FL perspective?
