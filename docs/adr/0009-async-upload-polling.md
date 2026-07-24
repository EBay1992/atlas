# ADR 0009: Asynchronous upload with job status polling

- **Status:** accepted

## Context

Extraction/embedding can take seconds to minutes; HTTP must not block.

## Decision

`POST /v1/documents` returns **202** with `documentId` + `jobId`; clients poll `GET /v1/jobs/:id`.

## Alternatives

- Synchronous processing: timeouts under load
- WebSockets / SSE: better UX later; more moving parts for Week 1

## Consequences

Eventual consistency by design; clients need polling or future push.

## Revisit when

Adding a real-time Review UI that justifies SSE/WebSockets.
