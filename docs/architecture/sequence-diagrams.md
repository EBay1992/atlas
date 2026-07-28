# Sequence diagrams

## Document upload (async accept)

```mermaid
sequenceDiagram
  actor Client
  participant API as Atlas API
  participant S3 as MinIO/S3
  participant DB as Postgres
  participant Q as Redis/BullMQ

  Client->>API: POST /v1/documents (Bearer JWT)
  API->>API: tenantId from JWT
  API->>S3: putObject (stream)
  API->>DB: create Document + Job (queued)
  API->>Q: enqueue(payload + traceparent)
  API-->>Client: 202 { documentId, jobId }
```

## Ingestion worker

```mermaid
sequenceDiagram
  participant Q as BullMQ
  participant W as Worker
  participant S3 as MinIO/S3
  participant Emb as Ollama
  participant V as Qdrant
  participant DB as Postgres

  Q->>W: ingestion job
  W->>W: continue/extract OTel context
  W->>DB: status → processing
  W->>S3: getObject
  W->>W: extract → normalize → chunk
  W->>V: delete prior points
  W->>DB: delete prior chunks
  W->>Emb: embed batches
  W->>V: upsert vectors
  W->>DB: insert chunks + completed
```

## Semantic search

```mermaid
sequenceDiagram
  actor Client
  participant API as Atlas API
  participant Emb as Ollama
  participant V as Qdrant
  participant DB as Postgres

  Client->>API: POST /v1/search { query, limit? }
  API->>Emb: embed(query)
  API->>V: search(vector, filter tenantId)
  API->>DB: hydrate chunk text + filename
  API-->>Client: scored hits with citations
```

## Manual job retry (linked trace)

```mermaid
sequenceDiagram
  actor Client
  participant API as Atlas API
  participant DB as Postgres
  participant Q as BullMQ

  Client->>API: POST /v1/jobs/:id/retry
  API->>DB: failed → queued + store linkedTraceparent
  API->>Q: enqueue (new root span + link)
  Note over API,Q: New Trace ID; correlationId stays documentId
```

See [ADR 0003](../adr/0003-opentelemetry-w3c-over-vendor-sdks.md) and [ADR 0009](../adr/0009-async-upload-polling.md).
