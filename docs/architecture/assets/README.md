# Architecture assets

Screenshots and demo media used in Atlas documentation.

| File | Content |
|------|---------|
| `demo.gif` | Walkthrough: OpenAPI → health → MinIO → upload trace → Qdrant |
| `openapi.png` | Swagger UI (`/docs`) |
| `health-ready.png` / `.json` | Readiness probe (all deps ok) |
| `minio-object.png` | Object browser: tenant → document → file |
| `trace-upload.png` | Upload → embed → Qdrant distributed trace |
| `trace-manual-retry.png` | Manual retry on a new Trace ID |
| `otel-structured-logs.png` | Aspire structured logs |
| `search-hit.json` | Example semantic search response |
| `qdrant-collection.png` | `atlas_chunks` (4096-dim Cosine) |

Linked from the root [README](../../../README.md), [Observability](../observability.md), [AI pipeline](../ai-pipeline.md), and [Evaluation](../../evaluation/README.md).
