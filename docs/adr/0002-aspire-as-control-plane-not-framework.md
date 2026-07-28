# ADR 0002: Aspire as control plane, not application framework

- **Status:** accepted
- **Date:** 2026-07-24

## Context

We need local orchestration, a resource graph, and a first-class OpenTelemetry dashboard while keeping Atlas portable to Compose / Kubernetes / cloud runtimes.

Aspire (TypeScript AppHost) is now a polyglot control plane, not .NET-only.

## Decision

Use Aspire **only** under `apphost/` for:

- Resource orchestration
- Startup ordering / wait-for
- Env / secret injection into Atlas’s **existing** env contract
- Dashboard + OTLP collection

Atlas `apps/*` and `packages/domain|infra` must never import Aspire SDKs.

## Alternatives

| Option | Why not |
|--------|---------|
| Full .NET Aspire AppHost | Extra language for a TS monorepo |
| Aspire APIs inside Fastify/worker | Vendor lock-in; fails remove-Aspire test |
| Compose only | Fine for CI; weaker local resource graph + dashboard UX |

## Consequences

- Two run modes: `aspire run` (preferred local) and Compose + `pnpm dev:*` (fallback/CI)
- Observability uses standard `OTEL_*` env vars Aspire already injects
- Deleting `apphost/` must leave the product runnable

## Revisit when

Aspire AppHost cannot express a required dependency, or the team standardizes on a different control plane (e.g. Tilt, DevSpace, pure Compose).
