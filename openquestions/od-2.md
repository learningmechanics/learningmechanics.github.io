Most works on the theory of deep learning rely on mathematically simple toy models of data.
These are scientifically very useful because they afford the experimenter full control over the task, but they are insufficient.
Ultimately, we need our theory of deep learning to apply to models trained on natural (i.e., real) data, since real data is used in essentially every application we care about.
Furthermore, convenient structure in real data is certainly part of why neural networks work so well, so we will inevitably have to identify and grapple with that structure.
How will we develop a predictive theory applicable to real datasets?

There are at least two complementary approaches to this problem.
One approach seeks to construct synthetic datasets that capture the important properties of real datasets, then study learning on these synthetic datasets and cross-check conclusions with real data.
These synthetic datasets usually have a few free hyperparameters that can be chosen to give the best match to real data.
[>For a representative example of the synthetic dataset philosophy, see the random hierarchy model of [Cagnetta et al. (2023)](https://arxiv.org/abs/2307.02129).<]

An alternate approach takes inspiration from the fact that, in many cases, models appear to derive their learning signal from a small set of sufficient statistics.
This approach seeks to identify these minimal data statistics, extract them from real datasets, and build a predictive theory around them.
[>For a representative example of the sufficient statistics philosophy, see [Karkada et al. (2025)](https://arxiv.org/abs/2510.14878), who demonstrate that kernel regression often sees datasets in terms of only their first two moments.<]

For either approach, the key questions are similar: what are these minimal properties or statistics which need capturing, and how do they enter into a predictive theory?
The answer will very possibly depend on the model and the properties we wish to predict: to predict how a more complex model learns, or to predict more sophisticated properties, we may need to incorporate more information about the data.
