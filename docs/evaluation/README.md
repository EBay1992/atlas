# Evaluation

## Goal

```bash
pnpm run evaluate
```

Produce retrieval quality metrics:

| Metric | Meaning |
|--------|---------|
| Precision@k | Relevant among top-k |
| Recall@k | Relevant recovered |
| MRR | Mean reciprocal rank |
| Hit Rate | ≥1 relevant in top-k |
| Hallucination Rate | Reserved for generative RAG (Phase 4+) |

## Today

Manual **polysemy** corpus: [`fixtures/seed-docs`](../../fixtures/seed-docs).

```bash
pnpm -w run seed:docs
```

Ambiguous terms (Apple, Java, bank, …) should rank the matching sense first for sense-rich queries. See the fixtures README for suggested queries.

Live qualitative example (committed capture):

![Search hit](../architecture/assets/search-hit.png)

## Tomorrow

- Golden query → document/chunk labels  
- CI-friendly evaluator reading search API  
- Optional eval dashboard (prompt, chunks, scores, answer) in Phase 4  

Commit numeric reports under `docs/evaluation/results/` when the harness lands.
