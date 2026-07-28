# Benchmark suite

## Goal

```bash
pnpm run benchmark
```

Emit machine-readable and human-readable results for:

| Metric | Intent |
|--------|--------|
| API upload latency (p50/p95) | Ingress path |
| Search latency (p50/p95) | Retrieval path |
| Embedding throughput (texts/s) | Ollama / batching |
| Queue throughput (jobs/s) | BullMQ worker |
| Memory / CPU snapshots | Regression signal |

## Status

**Not implemented yet.** This page locks the contract so Phase 3 work has a home.

## Conventions (when added)

- Scripts under `scripts/benchmark/` or `packages/benchmark`  
- Results committed under `docs/benchmark/results/` with date + git SHA in the filename  
- Document hardware / model / `CHUNK_*` in each result header  
- Never treat lab laptop numbers as SLOs without stating the environment  

## Related

- [Performance tuning](../performance/README.md)  
- [Load testing](../performance/load-testing.md)  
