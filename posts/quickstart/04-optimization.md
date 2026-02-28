---
title: "Quickstart Guide: The dynamics of optimization"
toc_title: "The dynamics of optimization"
author: "The Learning Mechanics Team"
date: "2025-09-01"
description: "Major lines of theoretical research into the optimization dynamics of neural networks, from classical convergence theory to the edge of stability."
sequence: "quickstart"
sequence_description: "A comprehensive guide to understanding the mathematical foundations of deep learning, from optimization to generalization."
sequence_order: 4
---

Neural network training is just a process of numerical optimization: first you define a loss (i.e. cost) function you want to minimize, and then you push on all the neural network parameters to *make number go down.* You do this for a long time on a lot of data, and the loss value decreases, and the network learns.

This sounds really simple until you try it. It turns out there are lots of ways to make the number go down, and some of them work better than others, and some of them work very poorly even though they seem like bright ideas, and it's all a big mess. It would sure be nice if we could simplify the picture and shed some light on the process of optimization, and understanding that process just might give us a new lens for understanding the final trained artifact we get out at training's end.

In this chapter, we'll walk through several major lines of theoretical research into the optimization dynamics of neural networks. We'll start with the classical perspective, which was concerned mostly with the *convergence* of optimization. This turned out to not be the right question to ask of deep learning, but that line of work still unearthed a few gems that continue to be useful.

In recent times, we have learned that we should pay attention to more than just the value of the loss. "How fast does it go down?" is essentially the only question you can ask about the loss, which isn't all that interesting. We should also look at how the ***weights, hidden representations, and other high-dimensional statistics of the network*** change during training. It turns out most of the story is in these other quantities that then drive the loss dynamics.^[To make this point in analogy form: trying to understand optimization by just studying the loss is like trying to understand a country's history, culture and politics from just its GDP over time.] To that end, we'll cover a few cases where notable optimization phenomena have been understood in parameter space.

This will be another long chapter, so we'll start with a table of contents:

<div class="sequence-toc">
<h3>Quickstart Guide: The dynamics of optimization</h3>
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



### The classical picture: convex optimization

Our story begins in the latter half of the last century, when computers were just getting powerful enough to do serious numerical optimization but weren't yet powerful enough to do real deep learning.
People mostly used other learning algorithms, like linear regression, support vector machines, kernel machines, decision trees, and boosting.
In these classical approaches to machine learning, optimization and learning were usually thought of as two separate concerns, to be handled independently: the machine learner's job was to formulate a learning task as the minimization of some objective function $\L(\vtheta)$ over parameters $\vtheta$, and the optimizer's job was to find the minimum of this objective function by any means possible.
How the optimizer did this (e.g. with what optimization algorithm, and with what hyperpameters) did not concern the machine learner: it was generally assumed that the objective function would have only one minimum, and so every valid learning method would return the same parameters $\theta_*$.
This "craft a learner / optimize the learner" split was an appealing factorization of the learning problem that permitted research in machine learning and optimization to proceed semi-independently.

In the process of this research, it became clear that the most useful general property to ask of an objective function was *convexity.*
Convexity is the property that the function lies below any chord connecting two of its points: for all $\vtheta_1, \vtheta_2$ and all $t \in [0, 1]$,

$$
\L\!\left(t\,\vtheta_1 + (1-t)\,\vtheta_2\right) \leq t\,\L(\vtheta_1) + (1-t)\,\L(\vtheta_2).
$$

Convexity is so useful because it guarantees that any local minimum is a global minimum: if you can find a point where $\nabla \L = 0$, you're done.
A smooth convex function also admits a neat first-order characterization — convexity is equivalent to the condition that the function lies above every tangent hyperplane,

$$
\L(\vtheta_2) \geq \L(\vtheta_1) + \nabla \L(\vtheta_1)^\top (\vtheta_2 - \vtheta_1),
$$

which says that the gradient always points "uphill" relative to any other point.

A second useful property is the *$L$-smoothness* condition (often called the Lipschitz gradient condition) that

$$
\norm{ \nabla \L(\vtheta_1) - \nabla \L(\vtheta_2) } \leq L \cdot \norm { \vtheta_1 - \vtheta_2 }
$$

for any pair of parameter vectors $\vtheta_1, \vtheta_2$.
$L$-smoothness bounds how fast the gradient can change, which in turn limits how far a gradient step can "overshoot" a minimum.
Together, convexity and $L$-smoothness are enough to prove that gradient descent converges at a $O(1/t)$ rate, and adding *strong convexity* (a lower bound on curvature) tightens this to exponential convergence.
These are the workhorses of classical optimization theory; see [[Boyd and Vandenberghe (2004)]](https://web.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf) for the full story.








These classical approaches to machine learning generally separated concerns between optimization and learning: the machine learner's job was to formulate the learning task as the minimization of some objective function, and the optimizer's job was to find the minimum of this objective function by any means possible.
How the optimizer did this (e.g. with what optimization algorithm, and with what hyperpameters) did not concern the machine learner, as all valid methods would return the same minimum.






cvx opt textbook: [[Boyd and Vandenberghe (2004)]](https://web.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf)



- Jeremy's picture; separation of concerns
- Classical results about optimization:
    - gradient descent, gradient flow
    - Descent lemma, how beautiful
    - Quadratic loss surfaces
    - Classical/convex optimization theory
    - Hessian curvature picture; mostly concerned about stability and bounds

### SGD section?

### Overparameterization, overfitting, and the slow death of the classical perspective

- A bunch of things wrong with the classical picture:
    - E.g. the same training loss can generalize very differently
        - So clearly there's "something to" the training dynamics that's not reflected in the loss
    - Intuition that with many params you can always find a descent direction; no bad local minima

### The inductive bias of gradient descent and the NTK picture

- Inductive bias story: (S)GD "chooses" from a manifold of local minima and somehow "prefers" one
    - Solvable cases where this is true
    - Not that it's wrong, just that it's hard to really make this rigorous
    - Still is a folk belief that GD is kinda like L2-min, tho… how true? Open Q.
    - max-margin bias in logistic regression
- NTK: a solvable model of wide neural nets
    - Kinda killed the question of overparameterization
    - Already discussed in previous two sections; intersects with those stories here

### Deep linear nets: a solvable case of dynamics in weight space

- Arguably the first case people really solved dynamics of a deep model in weight space proper
    - Be sure to give citations to earlier works that do this, too, incl that Japanese guy
- Discuss what happens, the phenomenology, link to widget if/when we have it
- Greedy low-rank dynamics: discuss s2s, AGF, etc.
- Does this look like real nets? If so, how so? Jury's still out.

“Here is the rare case where we can watch representation learning happen in parameter space analytically—and it predicts a bunch of phenomena people later rediscovered in nonlinear nets.”

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

- This is basically the HP story from the previous chapter; that's the unifying lens bringing HPs into optimization land
- Discuss how it came about + what it means, how it ties into this chapter
- Cite Nikhil's recent paper here

### Why do some optimizers work better than others?

- "Adam works by being block-adaptive w its lr"
- Muon??? Kiiiinda comes from the spectral FL perspective?