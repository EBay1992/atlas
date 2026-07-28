# Coding standards

Conventions for TypeScript in the Atlas monorepo.

## Principles

1. Prefer composition over inheritance.  
2. Reduce duplicated cross-cutting logic.  
3. Keep Domain independent from Infrastructure.  
4. Introduce abstractions only when they clarify call sites.  
5. Strong TypeScript; no `any`.  
6. Do not change public behavior in refactors unless the change is explicit.  

## Cross-cutting concerns

Centralize tracing, metrics, structured logging, error mapping, retries, and correlation propagation.

Preferred shapes: higher-order functions, middleware, and factories — for example `observe(...)` and `createWorker({ name, handler })`.

## Style

- Match existing file conventions (ESM `.js` import suffixes, Vitest, Zod env).  
- Keep PRs small and focused on one concern.  
- Add or update an ADR when a trade-off is non-obvious.  

## What not to do

- Import Aspire into domain/infra.  
- Accept `tenantId` from request bodies.  
- Store document bytes in Postgres.  
- Vendor APM SDKs in application code (use OTLP).  
