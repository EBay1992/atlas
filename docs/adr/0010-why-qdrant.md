# ADR 0010: Qdrant as the vector store

- **Status:** accepted
- **Date:** 2026-07-28

## Context

Atlas needs approximate nearest-neighbor search over embedding vectors with:

- Per-tenant isolation at query time  
- Payload metadata (`documentId`, `chunkId`, …) for citation hydration  
- Strong local DX (Docker image, HTTP API, dashboard)  
- A clean `VectorStore` port so the engine can be replaced later  

## Decision

Use **Qdrant** behind the `VectorStore` port (`QdrantVectorStore` in `packages/infra`).

- Cosine distance aligned with normalized embedding practice for the chosen model  
- Every search **must** filter on `tenantId` from the JWT  
- Collection dimensions come from `EMBEDDING_DIMENSIONS` (must match the embedding model)  

## Alternatives

| Option | Why not (now) |
|--------|----------------|
| **pgvector** | Fewer moving parts, but couples ANN lifecycle to Postgres ops and migration story; harder to show a dedicated vector plane in a reference platform |
| **Redis Vector / RediSearch** | Already depend on Redis for BullMQ; mixing job broker + ANN increases blast radius |
| **Pinecone / Weaviate Cloud** | Excellent managed DX; couples the reference stack to a vendor and complicates fully local demos |
| **Faiss in-process** | Great for notebooks; weak multi-process worker story and tenancy ops |

## Consequences

- Compose / Aspire must run Qdrant; readiness checks include it  
- Dual persistence: vectors in Qdrant, chunk text in Postgres for citations  
- Reindex deletes prior points for a document before upsert (idempotent worker)  
- Operators learn a real vector DB, not an embedded toy index  

## Revisit when

- A single-node Postgres+pgvector deployment is mandated by the host platform  
- Hybrid BM25 + vector requires a search engine that already owns lexical indexes (e.g. Elasticsearch / OpenSearch) and consolidation wins over specialization  
