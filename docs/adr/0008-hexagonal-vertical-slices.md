# ADR 0008: Hexagonal ports + vertical slices

- **Status:** accepted

## Context

Need extensibility for embeddings, vectors, connectors without Clean Architecture ceremony on day one.

## Decision

- **Ports** at infrastructure edges (`ObjectStore`, `JobQueue`, `EmbeddingProvider`, `VectorStore`, …)
- **Vertical slices** for features (upload, search, health)

## Alternatives

- Full Clean Architecture layers: too much ceremony for Week 1
- Framework MVC only: paints into corners when swapping infra

## Consequences

`packages/domain` never imports `packages/infra`.

## Revisit when

Domain complexity warrants richer application services / aggregates.
