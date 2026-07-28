# Security overview

Atlas demonstrates **tenant isolation and secret hygiene** appropriate for a local-first reference platform. It is not a turnkey hardened SaaS.

## Core rules

1. **`tenantId` comes only from the JWT** — never from bodies or query params that clients control for authorization.  
2. **Qdrant searches always filter by `tenantId`.**  
3. **Bytes live in object storage**; Postgres holds metadata and citations.  
4. **Production boot refuses weak `JWT_SECRET` values.**  
5. Seed users and Compose passwords are **lab-only**.  

## Policy & reporting

Full policy and hardening checklist: [SECURITY.md](../../SECURITY.md).

## Threat model (abbreviated)

| Asset | Risk | Mitigation today |
|-------|------|------------------|
| Document bytes | Cross-tenant read | Storage keys prefixed by tenant; API authz by JWT |
| Vectors | Cross-tenant ANN | Payload filter on every search |
| Credentials | Leak via git / images | `.env` gitignored; `.dockerignore`; bcrypt passwords |
| Telemetry | PII in spans | Prefer ids (`documentId`) over raw text in attributes |

## Out of scope (default stack)

WAF, advanced rate limits, OIDC/SSO, public internet exposure of Compose ports.

## Roadmap

OIDC/SSO, rate limiting, circuit breakers, formal threat-model doc expansion.
