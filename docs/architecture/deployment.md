# Deployment diagram

Atlas supports two local orchestration paths. Application code does not depend on which path you pick.

## Docker Compose (fallback / CI)

```mermaid
flowchart TB
  subgraph host [Developer host]
    Ollama["Ollama :11434"]
    API["atlas-api :3000"]
    Worker["atlas-worker"]
  end
  subgraph compose [docker compose]
    PG[("Postgres :5432")]
    Redis[("Redis :6379")]
    MinIO[("MinIO :9000")]
    Qdrant[("Qdrant :6333")]
    Dash["Aspire Dashboard :18888"]
  end
  API --> PG
  API --> Redis
  API --> MinIO
  API --> Qdrant
  API --> Ollama
  Worker --> PG
  Worker --> Redis
  Worker --> MinIO
  Worker --> Qdrant
  Worker --> Ollama
  API -.->|"OTLP :4318"| Dash
  Worker -.->|"OTLP :4318"| Dash
```

Compose can also run API/worker as containers; then `OLLAMA_BASE_URL=http://host.docker.internal:11434` and service DNS names apply (see root README).

## Aspire AppHost (recommended control plane)

```mermaid
flowchart LR
  AppHost["Aspire AppHost"]
  AppHost --> API[api]
  AppHost --> Worker[worker]
  AppHost --> PG[(postgres)]
  AppHost --> Redis[(redis)]
  AppHost --> MinIO[(minio)]
  AppHost --> Qdrant[(qdrant)]
  AppHost --> Dash["Dashboard / OTLP"]
```

**Rule:** Aspire orchestrates processes and resources. It is **never** imported by `packages/domain` or `packages/infra` ([ADR 0002](../adr/0002-aspire-as-control-plane-not-framework.md), [ADR 0004](../adr/0004-compose-remains-fallback.md)).

## Production posture (intentional gaps)

The default stack is a **lab / reference** environment:

- No Kubernetes manifests or Helm charts yet  
- JWT demo auth (not OIDC)  
- Compose ports bound for developer convenience  

Hardening checklist: [Security overview](../security/overview.md) and root [SECURITY.md](../../SECURITY.md).
