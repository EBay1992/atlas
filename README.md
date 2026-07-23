# Atlas

Miniature enterprise knowledge platform — one evolving architecture inspired by platforms like Mayia / Glean.

Week 1 delivers ingestion foundations: authenticated upload API, Postgres metadata, MinIO object storage, BullMQ workers with fake processing, job status APIs, OpenAPI, structured logging, metrics, and health probes.

## Architecture

**Hexagonal ports at infrastructure edges + vertical slices for features.**

```
Upload API → ObjectStore (MinIO) + Document/Job repos (Postgres) → JobQueue (BullMQ/Redis) → Worker (fake processing) → Job Status API
```

Ports stay stable for Week 2 (extraction/embeddings) and Week 3 (connectors / workflow engine).

| Package / App | Role |
|---------------|------|
| `apps/api` | Fastify REST + OpenAPI |
| `apps/worker` | BullMQ consumer (simulated pipeline) |
| `packages/domain` | Entities, state machine, port interfaces |
| `packages/infra` | Prisma, MinIO, BullMQ, JWT/bcrypt adapters |
| `packages/config` | Zod-validated environment |
| `packages/observability` | Pino, Prometheus metrics, optional OTel |

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker / Docker Compose

## Quick start (local apps + Compose infra)

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis minio minio-init
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm --filter @atlas/config build && pnpm --filter @atlas/domain build && pnpm --filter @atlas/observability build && pnpm --filter @atlas/infra build
pnpm dev:api    # terminal 1
pnpm dev:worker # terminal 2
```

Seeded credentials:

- email: `admin@acme.local`
- password: `atlas-dev-password`

## Try the flow

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@acme.local","password":"atlas-dev-password"}' | jq -r .accessToken)

# Upload
curl -s -X POST http://localhost:3000/v1/documents \
  -H "authorization: Bearer $TOKEN" \
  -H "idempotency-key: demo-1" \
  -F file=@README.md | jq

# Poll job (use jobId from upload response)
curl -s http://localhost:3000/v1/jobs/<jobId> -H "authorization: Bearer $TOKEN" | jq
```

OpenAPI UI: http://localhost:3000/docs  
Liveness: http://localhost:3000/health/live  
Readiness: http://localhost:3000/health/ready  
Metrics: http://localhost:3000/metrics  

## Tests

```bash
pnpm --filter @atlas/domain test
# With API + worker running against Compose infra:
pnpm --filter @atlas/api exec vitest run src/ingestion.integration.test.ts
```

## Design notes (interview talking points)

### Dual-write (DB + MinIO + queue)

Order: **object bytes → metadata → enqueue**. If DB fails after MinIO write, we best-effort delete the object. If enqueue fails after DB write, we mark job/document `failed`. At scale you move toward transactional outbox or workflow engines (Temporal) — Week 3 path.

### Idempotency

`Idempotency-Key` is unique per tenant. Retries return the same `documentId` / `jobId` without double-upload.

### Tenancy

`tenantId` is taken from JWT claims only — never from the request body. Every domain row is tenant-scoped from day one.

### Job state machine

`queued → processing → completed|failed` with optimistic updates (`UPDATE … WHERE status = from`). Illegal transitions are rejected in domain code.

### Why Fastify

Schema-first validation that feeds OpenAPI, low overhead, plugin isolation that maps cleanly to vertical slices.

### Why MinIO from day one

Connectors later emit the same `storageKey` contract. No blob-in-Postgres corner.

### Scale narrative

| Users / volume | Change |
|----------------|--------|
| 100 | Single API + worker |
| 1k | Horizontal workers, pool tuning, per-tenant rate limits |
| 100k | Queue priority, Redis HA, job-status read models |
| Millions of docs | Sharding / step graph / Temporal, connector backpressure, DLQ runbooks |

## Week 1 non-goals

No PDF/OCR/embeddings/vector DB, no SharePoint/Gmail connectors, no React UI, no Temporal — intentionally. The ports are ready for those extensions without rewriting Week 1.
