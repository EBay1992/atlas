# Architecture Decision Records

ADRs document significant technical choices: context, decision, alternatives, and consequences.

Template fields: **Status** · **Context** · **Decision** · **Alternatives** · **Consequences** · **Revisit when**

## Topic map

| Topic | ADR |
|-------|-----|
| Why we record ADRs | [0001](./0001-record-architecture-decisions.md) |
| Why Aspire is control plane only | [0002](./0002-aspire-as-control-plane-not-framework.md) |
| Why OpenTelemetry | [0003](./0003-opentelemetry-w3c-over-vendor-sdks.md) |
| Why Docker Compose remains | [0004](./0004-compose-remains-fallback.md) |
| Why Fastify | [0005](./0005-fastify-over-nestjs.md) |
| Why BullMQ | [0006](./0006-bullmq-over-rabbitmq.md) |
| Why object storage | [0007](./0007-minio-object-storage.md) |
| Why hexagonal / ports & adapters | [0008](./0008-hexagonal-vertical-slices.md) |
| Why async ingestion + polling | [0009](./0009-async-upload-polling.md) |
| Why Qdrant | [0010](./0010-why-qdrant.md) |
| Why monorepo | [0011](./0011-why-monorepo.md) |
| Why streaming uploads | [0012](./0012-streaming-object-upload.md) |

## Chronological index

| # | Title | Status |
|---|-------|--------|
| 0001 | Record architecture decisions | accepted |
| 0002 | Aspire as control plane, not framework | accepted |
| 0003 | OpenTelemetry + W3C over vendor SDKs | accepted |
| 0004 | Compose remains fallback | accepted |
| 0005 | Fastify over NestJS | accepted |
| 0006 | BullMQ over RabbitMQ | accepted |
| 0007 | MinIO object storage | accepted |
| 0008 | Hexagonal ports + vertical slices | accepted |
| 0009 | Async upload + polling | accepted |
| 0010 | Qdrant as vector store | accepted |
| 0011 | pnpm monorepo | accepted |
| 0012 | Streaming object upload | accepted |

## Writing a new ADR

1. Follow the structure of an existing accepted ADR.  
2. Number sequentially (`0013-…`).  
3. Link it from this index when it answers a recurring design question.  
4. State revisit conditions explicitly.  
