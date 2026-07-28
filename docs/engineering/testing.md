# Testing strategy

Target pyramid for a platform reference implementation:

| Layer | Purpose | Status |
|-------|---------|--------|
| **Unit** | Pure domain (chunking, normalize, state machine) | ✅ Vitest in `@atlas/domain` |
| **Observability unit** | Span/context helpers | ✅ `@atlas/observability` |
| **Integration** | Upload → worker → search against real infra | ✅ `apps/api` Vitest (stack up) |
| **Contract** | Port/adapter behavioral contracts | 🗺️ |
| **Architecture** | Import rules (domain ↛ infra), no cycles | 🗺️ |
| **Smoke** | `scripts/happy-path.sh` | ✅ |
| **Performance** | `pnpm benchmark` | 🗺️ |

## Architecture tests (planned)

Examples that signal seniority:

- `packages/domain` source never imports `packages/infra`  
- No circular package dependencies  
- Ports modules only depend on domain types  

## Running

```bash
pnpm --filter @atlas/domain test
pnpm --filter @atlas/api exec vitest run src/ingestion.integration.test.ts
bash scripts/happy-path.sh
```
