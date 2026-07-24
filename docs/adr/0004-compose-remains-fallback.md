# ADR 0004: Docker Compose remains the fallback

- **Status:** accepted
- **Date:** 2026-07-24

## Context

Aspire improves local DX, but CI, Windows without Aspire CLI, and “remove the control plane” demos need a zero-Aspire path.

## Decision

Keep `docker-compose.yml` as the supported fallback for Postgres, Redis, MinIO, Qdrant, and optional `aspire-dashboard` (observability profile).

Apps always boot via `pnpm dev:api` / `pnpm dev:worker` reading `@atlas/config` env vars.

## Alternatives

| Option | Why not |
|--------|---------|
| Aspire-only | Blocks contributors without Aspire CLI |
| Delete Compose after AppHost | Fails the remove-Aspire architectural test |

## Consequences

- Dual docs in README
- Env contract must stay portable (full URLs **or** host/port parts)

## Revisit when

All environments standardize on Aspire publish manifests exclusively.
