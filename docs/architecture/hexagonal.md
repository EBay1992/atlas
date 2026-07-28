# Hexagonal architecture in Atlas

## Ports

Defined in `packages/domain/src/ports.ts`. Examples:

| Port | Role |
|------|------|
| `ObjectStore` | put / get / delete / ping blobs |
| `JobQueue` | enqueue ingestion work |
| `EmbeddingProvider` | batch embed texts |
| `VectorStore` | upsert / search / delete points |
| `DocumentRepository` / `JobRepository` / … | persistence |

Domain and application logic depend on these interfaces only.

## Adapters

Implemented in `packages/infra`:

- `S3ObjectStore` → MinIO / S3  
- BullMQ queue adapter → Redis  
- `OllamaEmbeddingProvider` → local model  
- `QdrantVectorStore` → Qdrant  
- Prisma repositories → Postgres  

## Vertical slices

HTTP features live under `apps/api/src/routes/` (`auth`, `documents`, `jobs`, `search`, `health`) — one slice per capability, composing ports via `deps.ts`.

## Why not full Clean Architecture day one

Ceremony without aggregates burns velocity. Ports at the edges + vertical slices give swapability where it matters (embedder, vector DB, object store) without nested “use case” folders. Revisit when domain complexity warrants richer application services ([ADR 0008](../adr/0008-hexagonal-vertical-slices.md)).
