# Atlas

**Atlas** is an open-source enterprise knowledge platform for document ingestion,
extraction, embedding, and tenant-scoped semantic search.

Upload a document → store bytes in object storage → enqueue a job → extract &
chunk text → embed with a local model → index in a vector database → search with
citations.

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
│  Client │────▶│ Atlas API│────▶│ Postgres│     │  MinIO   │
└─────────┘     └────┬─────┘     └─────────┘     └────▲─────┘
                     │  enqueue                        │ putObject
                     ▼                                 │
                ┌─────────┐     ┌─────────┐     ┌──────┴───┐
                │  Redis  │────▶│ Worker  │────▶│  Qdrant  │
                │ BullMQ  │     │ extract │     │ vectors  │
                └─────────┘     │ chunk   │     └──────────┘
                                │ embed   │◀──── Ollama
                                └─────────┘
```

## Features

- **Authenticated upload API** with per-tenant idempotency keys
- **Async ingestion** via BullMQ (retries + dead-letter queue)
- **Object storage** (MinIO / S3-compatible) — bytes never live in Postgres
- **Text extraction** for plain text and PDF (with PDF line/page repair)
- **Word-boundary chunking** with overlap
- **Local embeddings** via Ollama (`qwen3-embedding`)
- **Vector search** via Qdrant with tenant filters
- **Chunk citations** stored in Postgres for readable search hits
- **OpenAPI**, health probes, and Prometheus metrics
- **Hexagonal ports** so storage / queue / embed / vector adapters can be swapped

## Repository layout

```
atlas/
├── apps/
│   ├── api/                 # Fastify REST + OpenAPI
│   └── worker/              # BullMQ ingestion consumer
├── packages/
│   ├── domain/              # Entities, ports, chunker, text normalize
│   ├── infra/               # Prisma, MinIO, BullMQ, Ollama, Qdrant
│   ├── config/              # Zod-validated environment
│   ├── observability/       # Pino + Prometheus (+ optional OTel)
│   └── test-utils/
├── fixtures/seed-docs/      # Polysemy evaluation documents
├── scripts/                 # happy-path + seed helpers
└── docker-compose.yml       # Postgres, Redis, MinIO, Qdrant
```

## Prerequisites

| Tool | Version | Notes |
|------|---------|--------|
| Node.js | 20+ | See `.nvmrc` |
| pnpm | 9+ | `corepack enable` |
| Docker / Compose | recent | Infra services |
| [Ollama](https://ollama.com) | latest | Host process (not in Compose) |

Pull the embedding model once:

```bash
ollama pull qwen3-embedding
```

## Quick start

```bash
git clone https://github.com/EBay1992/atlas.git
cd atlas
cp .env.example .env

pnpm install
docker compose up -d postgres redis minio minio-init qdrant

pnpm db:generate
pnpm db:migrate
pnpm db:seed

pnpm --filter @atlas/config build \
 && pnpm --filter @atlas/domain build \
 && pnpm --filter @atlas/observability build \
 && pnpm --filter @atlas/infra build

# Terminal 1
pnpm dev:api

# Terminal 2
pnpm dev:worker
```

Verify:

```bash
curl -s http://localhost:3000/health/ready | jq
open http://localhost:3000/docs
```

### Seeded local credentials

| Field | Value |
|-------|--------|
| Email | `admin@acme.local` |
| Password | `atlas-dev-password` |

These exist only for local demos. Change or remove them before any shared deploy.
See [SECURITY.md](./SECURITY.md).

## Configuration

Copy [`.env.example`](./.env.example) → `.env`. Important variables:

| Variable | Purpose | Local default |
|----------|---------|----------------|
| `JWT_SECRET` | Signs access tokens | placeholder (must change for production) |
| `DATABASE_URL` | Postgres | `postgresql://atlas:atlas@localhost:5432/atlas` |
| `REDIS_HOST` / `REDIS_PORT` | BullMQ | `localhost:6379` |
| `S3_*` | MinIO / S3 | Compose MinIO on `:9000` |
| `OLLAMA_BASE_URL` | Embeddings HTTP API | `http://localhost:11434` |
| `OLLAMA_EMBEDDING_MODEL` | Model name | `qwen3-embedding:latest` |
| `EMBEDDING_DIMENSIONS` | Must match model | `4096` |
| `QDRANT_URL` | Vector DB | `http://localhost:6333` |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | Chunker | `800` / `120` |

When API/worker run **inside** Compose, set:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
QDRANT_URL=http://qdrant:6333
DATABASE_URL=postgresql://atlas:atlas@postgres:5432/atlas?schema=public
REDIS_HOST=redis
S3_ENDPOINT=http://minio:9000
```

## End-to-end usage

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@acme.local","password":"atlas-dev-password"}' \
  | jq -r .accessToken)

# Upload (idempotent per tenant + Idempotency-Key)
curl -s -X POST http://localhost:3000/v1/documents \
  -H "authorization: Bearer $TOKEN" \
  -H "idempotency-key: example-1" \
  -F file=@fixtures/seed-docs/01-apple-orchard-cider.txt | jq

# Poll job until completed | failed
curl -s "http://localhost:3000/v1/jobs/<jobId>" \
  -H "authorization: Bearer $TOKEN" | jq

# Semantic search
curl -s -X POST http://localhost:3000/v1/search \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"query":"heirloom cider orchard","limit":5}' | jq
```

Or run the bundled script:

```bash
bash scripts/happy-path.sh
```

### Useful URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000/docs | OpenAPI UI |
| http://localhost:3000/health/live | Liveness |
| http://localhost:3000/health/ready | Readiness (Postgres, Redis, MinIO, Qdrant, Ollama) |
| http://localhost:3000/metrics | Prometheus metrics |
| http://localhost:9001 | MinIO console (`atlasminio` / `atlasminio`) |
| http://localhost:6333/dashboard | Qdrant dashboard |

## Search evaluation fixtures

[`fixtures/seed-docs`](./fixtures/seed-docs) contains ten short documents built around
ambiguous words (Apple, Java, bank, crane, Mercury). Use them to verify semantic
disambiguation:

```bash
pnpm -w run seed:docs
```

Sense-rich queries should rank the matching document first; single-word queries
may mix senses. Details: [`fixtures/seed-docs/README.md`](./fixtures/seed-docs/README.md).

## Architecture notes

### Ports & adapters

Domain code depends on ports (`ObjectStore`, `JobQueue`, `EmbeddingProvider`,
`VectorStore`, repositories). Infrastructure packages provide adapters (S3/MinIO,
BullMQ, Ollama, Qdrant, Prisma). Feature routes live as vertical slices under
`apps/api/src/routes/`.

### Ingestion pipeline

1. API streams file bytes to object storage
2. API writes document + job rows (tenant from JWT only)
3. API enqueues BullMQ payload `{ jobId, documentId, tenantId, storageKey }`
4. Worker downloads object → extract → normalize → chunk → embed → upsert Qdrant
5. Worker stores chunk text in Postgres for citations
6. Re-processing deletes prior vectors/chunks for that document (idempotent index)

### Dual-write order

**Object bytes → DB metadata → queue.**  
If DB fails after object write, the API best-effort deletes the object. If enqueue
fails after DB write, job/document are marked `failed`.

### Tenancy

`tenantId` always comes from the JWT. Search filters Qdrant by `tenantId`. Never
accept tenant IDs from request bodies.

### Job state machine

`queued → processing → completed|failed` with optimistic updates
(`UPDATE … WHERE status = from`). Illegal transitions are rejected in domain code.

## Security

- `.env` is gitignored; only `.env.example` is committed
- Docker images exclude `.env` via `.dockerignore`
- Production boot refuses weak/default `JWT_SECRET` values
- Passwords are bcrypt-hashed; JWTs are signed with HS256
- Default Compose credentials are **lab-only**

Read the full policy: [SECURITY.md](./SECURITY.md).

## Development

```bash
pnpm typecheck          # strict TypeScript (unused locals, exact optionals, …)
pnpm build              # typecheck then compile all packages
pnpm --filter @atlas/domain test
pnpm lint               # currently runs typecheck
```

Integration test (API + worker + infra must be up):

```bash
pnpm --filter @atlas/api exec vitest run src/ingestion.integration.test.ts
```

Prisma workflow:

```bash
pnpm db:generate        # also runs on postinstall
pnpm db:migrate
pnpm db:seed
```

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| `health/ready` → ollama error | Start Ollama; `ollama pull qwen3-embedding` |
| `health/ready` → qdrant error | `docker compose up -d qdrant` |
| Embed dim mismatch | Align `EMBEDDING_DIMENSIONS` with the model (4096 for qwen3-embedding) |
| Worker can't reach Ollama from Docker | Use `host.docker.internal` + `extra_hosts` (already in Compose) |
| PDF chunks start mid-word | Re-upload after latest extract/normalize; old indexes keep prior text |
| `JWT_SECRET` production error | Set a 32+ character random secret |
| Port 3000 in use | Stop other API containers/processes, or change `API_PORT` |

## Roadmap

- Hybrid lexical + vector retrieval and reranking
- Conversational RAG answers
- Enterprise connectors (SharePoint, Gmail, …)
- Knowledge graph enrichment
- Durable multi-step workflows (e.g. Temporal)
- Stronger auth (OIDC/SSO) and rate limiting

## License

See repository license (if present) or contact the maintainer. Contributions
welcome via pull requests.
