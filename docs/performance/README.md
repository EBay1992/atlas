# Performance

## Known hotspots

| Area | Notes |
|------|--------|
| Embedding batches | Dominated by Ollama model + `EMBEDDING_DIMENSIONS` (4096) |
| PDF extract | CPU-bound; large PDFs lengthen worker spans |
| Qdrant upsert | Batch size vs payload size trade-off |
| Upload | Streaming to S3 avoids buffering whole files in API memory |

## Knobs

| Variable | Effect |
|----------|--------|
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | More chunks → more embeds → higher cost/latency |
| Worker concurrency | BullMQ worker settings (tune carefully vs Ollama) |
| Ollama hardware | GPU vs CPU changes embed throughput dramatically |

## Guidance

Measure before micro-optimizing. Prefer Phase 3 `pnpm benchmark` and [load testing](./load-testing.md) so changes leave numbers in `docs/benchmark/results/`.
