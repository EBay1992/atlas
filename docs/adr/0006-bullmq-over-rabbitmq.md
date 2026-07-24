# ADR 0006: BullMQ + Redis instead of RabbitMQ / SQS

- **Status:** accepted

## Context

Week 1 needs durable async jobs, retries, backoff, and a DLQ with strong Node DX.

## Decision

**BullMQ on Redis** behind a `JobQueue` port.

## Alternatives

- **RabbitMQ:** more ops surface for this stage
- **SQS:** cloud-coupled for local Week 1
- **Postgres SKIP LOCKED:** viable later; weaker delay/priority tooling now

## Consequences

Redis is a required dependency; dual-write (DB + queue) needs compensation.

## Revisit when

Moving to Temporal / Step Functions for multi-step workflows (Week 3 path).
