# Monorepo

Atlas is a **pnpm workspace** ([ADR 0011](../adr/0011-why-monorepo.md)).

```text
apps/*        → deployable processes (api, worker)
packages/*    → shared libraries (domain, infra, config, observability, test-utils)
apphost/      → Aspire control plane (outside workspace packages on purpose)
```

## Dependency direction

```text
apps → domain + infra + config + observability
infra → domain + config (+ observability as needed)
domain → (nothing Atlas-internal)
```

`domain` must remain free of Prisma, Fastify, BullMQ, and Aspire.

## Build order (local)

Config → domain → observability → infra → apps (as in root README quick start).

## Scripts

Root `package.json` orchestrates `build`, `typecheck`, `test`, DB tasks, and Aspire helpers. Prefer `pnpm --filter @atlas/<pkg>` for package-scoped work.
