# Atlas AppHost (Aspire)

Isolated **control plane** for local orchestration and the Aspire Dashboard.

Atlas application code (`apps/*`, `packages/domain`, `packages/infra`) must **never** import Aspire.

## Prerequisites

1. [Install Aspire CLI](https://aspire.dev/get-started/install-cli/) (Node 20+, Docker/Podman)
2. From this directory:

```bash
aspire restore   # generates .aspire/modules (gitignored)
aspire run
```

Or from repo root: `pnpm aspire:run`

## Resource graph

| Resource | Role |
|----------|------|
| postgres + `atlas` DB | Metadata |
| redis | BullMQ |
| minio | Object storage |
| qdrant | Vectors |
| api | Fastify |
| worker | Ingestion |

Ollama remains on the **host** (`OLLAMA_BASE_URL`).

## Without Aspire CLI

Use Docker Compose fallback (repo root):

```bash
docker compose up -d postgres redis minio minio-init qdrant aspire-dashboard
# set OTEL_ENABLED=true and OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
pnpm dev:api
pnpm dev:worker
```

Dashboard UI: http://localhost:18888
