# Coding standards

Atlas code should read like a platform other seniors would steal patterns from.

## Principles

1. Prefer composition over inheritance.  
2. Reduce boilerplate; extract cross-cutting concerns once.  
3. Keep Domain independent from Infrastructure.  
4. Abstractions must earn their keep — no framework for its own sake.  
5. Strong TypeScript; no `any`.  
6. Do not change public behavior in refactors unless the PR says so.  

## Cross-cutting (Phase 2 direction)

Audit and centralize: tracing, metrics, structured logging, error mapping, retries, correlation propagation.

Preferred shapes: higher-order functions, middleware, factories — e.g. `observe(...)`, `createWorker({ name, handler })`.

## Style

- Match existing file conventions (ESM `.js` import suffixes, Vitest, Zod env).  
- Small, reviewable PRs — one logical concern per change.  
- Update or add an ADR when a trade-off is non-obvious.  

## What not to do

- Import Aspire into domain/infra.  
- Accept `tenantId` from request bodies.  
- Put document bytes in Postgres.  
- Vendor APM SDKs in app code (use OTLP).  
