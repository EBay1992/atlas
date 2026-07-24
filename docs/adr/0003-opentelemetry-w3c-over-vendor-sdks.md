# ADR 0003: OpenTelemetry + W3C Trace Context over vendor SDKs

- **Status:** accepted
- **Date:** 2026-07-24
- **Updated:** 2026-07-24 (trace lifecycle + correlation)

## Context

Upload spans API → Postgres/MinIO → BullMQ → worker → extract/chunk/embed/Qdrant.
Interview and ops both need one distributed timeline for a business operation, plus a stable
identity that survives across days (reviews, manual retries).

## Decision

- Instrument with **OpenTelemetry** (`@atlas/observability`)
- Propagate **W3C** `traceparent` / `tracestate` in BullMQ job payloads
- Export OTLP to Aspire Dashboard or any collector
- Keep Prometheus `/metrics` for Compose scrapers
- **No** Datadog/New Relic/App Insights SDKs in app code

### Trace lifecycle

| Event | Trace behavior |
|-------|----------------|
| Document upload + auto BullMQ retries | **Same Trace ID** — worker extracts frozen `traceparent` and continues |
| Manual retry (`POST /v1/jobs/:id/retry`) | **New Trace ID** + **span link** to original upload (`linkedTraceparent`) |

A Trace ID represents one business action (upload, or a human-initiated retry), not merely one HTTP hop.

### Correlation

After mint, `correlationId === documentId`. It is attached to the job payload, logs, and spans
(`atlas.correlation_id`) so “everything that ever happened to document X” can be queried
independently of any single Trace ID.

## Alternatives

| Option | Why not |
|--------|---------|
| Vendor APM agent only | Couples product to one SaaS |
| Logging alone | Cannot reconstruct cross-service latency |
| Custom correlation IDs only | Weaker than W3C; breaks OTel ecosystem |
| Always one eternal upload trace for manual retries | Mixes distinct human actions; hard to retain/analyze |

## Consequences

- Worker must `extract` parent context for automatic work or traces fork
- Manual retries must use `withLinkedRootSpan` (root + link), never re-parent under a stale upload span
- Aspire is a viewer/collector, not the instrumentation library

## Revisit when

A host platform mandates a different telemetry protocol and OTLP bridging is insufficient,
or jobs routinely resume hours/days later without an explicit manual retry API.
