---
title: "The Learning Mechanic's Quick and Dirty Guidebook: The dynamics of optimization"
toc_title: "The dynamics of optimization"
author: "Jamie Simon"
date: "2025-09-01"
description: "Major lines of theoretical research into the optimization dynamics of neural networks, from classical convergence theory to the edge of stability."
sequence: "guidebook"
sequence_description: "A quick and dirty guide to the essential ideas in deep learning theory."
sequence_order: 4
---

Training a neural network is a process of numerical optimization: you start by packing everything you want the neural network to do into one scalar (i.e. real-valued) function (variously called the *loss, cost, penalty, objective,* or *utility function*), and then you optimize all the neural network parameters to push this function in the desired direction --- by convention, usually down.
It is this process of optimization that we refer to as *training,* by analogy to a human undergoing training and gradually acquiring a skill.

Let's first briefly discuss the formulation of the loss function.
It is remarkable and far from obvious that complex processes like the generation of text and images can be boiled down to a single scalar objective!
When you write or draw, you probably find yourself tracking and balancing various goals: for example, brevity, completeness, and style in writing.
When we have competing desires for a machine learning model, it is customary to combine them into one scalar with a weighted sum.
As a silly example, we might balance the above three goals in writing by minimizing:

$$
\mathcal{L}_{\text{total}} = \underbrace{\alpha \cdot \mathcal{L}_{\text{brev}}}_{\text{brevity penalty}} + \underbrace{\beta \cdot \mathcal{L}_{\text{com}}}_{\text{completeness penalty}} + \underbrace{\gamma \cdot \mathcal{L}_{\text{sty}}}_{\text{style penalty}},
$$

where $\alpha, \beta, \gamma > 0$ are coefficients which set the relative importance of the three terms.
Having one scalar loss to optimize instead of many makes the process of optimization conceptually much simpler.

When pretraining a huge foundation model, the most important term is a reconstruction loss which essentially penalizes the difference between the network output and the ground truth (i.e. the next token for text and the denoised image for images).
During finetuning, it's common to add additional terms that encourage the model to be helpful, truthful, PG-13, and so on.

While the choice of terms in the loss function is important in making modern AI systems, it won't be our main focus here.
The Learning Mechanic usually has more to say about the other half of the process: once the loss function is defined, how is it driven down via optimization?
To help get curious about this question, here are some practical questions that practitioners would love to know the answers to:

* There are many choices for the optimization algorithm, and some generally work better than others. Can we understand what makes a good optimizer? Can we use that knowledge to design a better one?
* Most optimizers involve lots of [hyperparameters](hyperparameter-selection), like the learning rate, momentum, and batch size. How should we set these, and how does our choice affect the final model?
* During the process of optimization, all sorts of counterintuitive things can happen. For example, even though we're trying to drive the loss down, sometimes it unexpectedly goes up or even diverges. Why?

The place to start in answering all of these questions is with a *fundamental theory of optimization in deep learning.*
Try as you might (and many have!), you cannot answer any of these questions without first having a basic picture of the dynamics of gradient-based optimization in deep learning in which to root your answers.
Fortunately, a fundamental picture of this sort is emerging.

In this chapter, we'll walk through some major lines of theoretical research into the optimization dynamics of neural networks.
We'll start with the **classical perspective,** which was concerned mostly with the *convergence* of optimization.
This turned out to not be the right question to ask of deep learning, but that line of work still unearthed a few gems about stability that continue to be useful.

We'll then ask: **what were the signs of crisis with the classical perspective?**
What questions couldn't it answer?
We'll touch on handful of topics --- overparameterization, overfitting, and inductive bias --- marking the transition from the classical to the modern perspective.

The rest of the chapter will be devoted to facets of the **modern perspective**, which can be characterized by two tenets.

1. We should study not just the **value** of the loss, but also how the **weights, hidden representations, and other statistics of the network** change during training. It turns out most of the story is in these other quantities which in turn drive the loss dynamics.^[To make this point in analogy form: trying to understand optimization by just studying the loss is like trying to understand a country's history, culture and politics from just its GDP over time.] To that end, we'll cover a few cases where notable optimization phenomena have been understood in parameter space.
2. We should make **quantitative predictions verifiable by simple experiments** rather than proving bounds.

We'll tell two stories in the modern flavor: the stories of (a) deep linear networks and stepwise learning, and (b) progressive sharpening and the edge of stability.
We'll end by returning to our first question: what makes a good optimizer for deep learning?

Let's begin!

<div class="sequence-toc">
<h3>Quickstart Guide: The dynamics of optimization</h3>
<ol>
<li><a href="#the-classical-picture-optimization-as-distinct-from-generalization">The classical picture: optimization as distinct from generalization</a></li>
<li><a href="#overparameterization-overfitting-and-the-slow-death-of-the-classical-perspective">Overparameterization, overfitting, and the slow death of the classical perspective</a></li>
<li><a href="#the-inductive-bias-of-gradient-descent-and-the-ntk-picture">The inductive bias of gradient descent and the NTK picture</a></li>
<li><a href="#deep-linear-nets-a-solvable-case-of-dynamics-in-weight-space">Deep linear nets: a solvable case of dynamics in weight space</a></li>
<li><a href="#progressive-sharpening-and-the-edge-of-stability">Progressive sharpening and the edge of stability</a></li>
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

### Why do some optimizers work better than others?

- "Adam works by being block-adaptive w its lr"
- Muon??? Kiiiinda comes from the spectral FL perspective?

---

## Citation

```bibtex
@article{simon-2025-guidebook,
  title        = {The Learning Mechanic's Quick and Dirty Guidebook},
  author       = {Simon, Jamie},
  journal = {Learning Mechanics},
  url          = {https://learningmechanics.org/guidebook},
  year         = {2025}
}
```