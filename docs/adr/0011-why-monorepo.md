# ADR 0011: pnpm monorepo

- **Status:** accepted
- **Date:** 2026-07-28

## Context

Atlas has multiple deployable processes (API, worker) and shared libraries (domain, infra, config, observability). We need:

- One version line for shared types and ports  
- Clear package boundaries that enforce hexagonal rules  
- Fast local installs and filtered scripts  

## Decision

Use a **pnpm workspace monorepo**:

- `apps/*` — runnable services  
- `packages/*` — libraries  
- `apphost/` — Aspire control plane **outside** the library graph so orchestration never leaks into domain/infra  

Workspace protocol dependencies (`workspace:*`) keep internal packages coherent.

## Alternatives

| Option | Why not (now) |
|--------|----------------|
| **Polyrepo** (api / worker / domain separate) | Slower iteration; version skew on ports; harder for readers to see the whole platform |
| **npm / yarn workspaces** | pnpm’s strict `node_modules` layout catches illegal dependency edges earlier |
| **Single package** | Forces infra imports into “domain” folders; destroys the teaching boundary |

## Consequences

- Contributors learn filter builds (`pnpm --filter`)  
- CI (when added) should build in dependency order  
- Publishing individual packages is optional; the monorepo is the product  

## Revisit when

- A team boundary requires separate release trains with semver for `@atlas/domain` alone  
- Package graph complexity demands Changesets or similar release tooling as a first-class concern  
