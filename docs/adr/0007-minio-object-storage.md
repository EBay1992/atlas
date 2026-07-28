# ADR 0007: MinIO (S3 API) instead of local disk or DB BLOBs

- **Status:** accepted

## Context

Connectors and multi-instance workers need a stable `storageKey` / object URI.

## Decision

Store bytes in **MinIO** (S3-compatible); metadata in Postgres.

## Alternatives

- Local disk: breaks multi-node and Docker portability
- Postgres BYTEA: database bloat; poor for large PDFs

## Consequences

Dual-write failure modes (orphan objects); compensating deletes on metadata failure.

## Revisit when

Deploying to a managed object store (S3/GCS/Azure Blob) — swap the `ObjectStore` adapter only.
