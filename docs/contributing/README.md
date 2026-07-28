# Contributing

Contributions to Atlas are welcome.

## Before you start

1. Read [Architecture overview](../architecture/overview.md).  
2. Skim [Coding standards](../engineering/coding-standards.md).  
3. Check [ADRs](../adr/README.md) for settled trade-offs.  

## Change policy

- Keep each PR focused on one concern.  
- Refactors must compile, keep tests green, and preserve public behavior unless the PR changes the contract.  
- Non-obvious trade-offs should get a new ADR.  
- Do not import Aspire into `packages/domain` or `packages/infra`.  

## Local checklist

```bash
pnpm typecheck
pnpm --filter @atlas/domain test
# with stack up:
pnpm --filter @atlas/api exec vitest run src/ingestion.integration.test.ts
```

## Docs PRs

Docs-only improvements (diagrams, ADRs, screenshots under `docs/architecture/assets/`) are first-class contributions — they are how Atlas teaches.

## Security

Report vulnerabilities privately per [SECURITY.md](../../SECURITY.md).
