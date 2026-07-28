# ADR 0005: Fastify instead of NestJS / Express

- **Status:** accepted

## Context

Need a TypeScript HTTP API with OpenAPI, low ceremony, and clear plugin boundaries for vertical slices.

## Decision

Use **Fastify** with schema-first validation feeding OpenAPI.

## Alternatives

- **NestJS:** heavier DI/framework lock-in for a hexagonal demo
- **Express:** weaker first-class schema/OpenAPI story

## Consequences

Schema typing can be strict; multipart needs careful OpenAPI annotations.

## Revisit when

Team already standardizes on Nest and productivity outweighs independence.
