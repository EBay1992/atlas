# Contributing

Thank you for helping Atlas stay a credible **enterprise AI platform reference**.

## Before you start

1. Read [Architecture overview](../architecture/overview.md).  
2. Skim [Coding standards](../engineering/coding-standards.md).  
3. Check [ADRs](../adr/README.md) so you do not reopen settled trade-offs casually.  

## Change policy

- **One logical concern per PR** — reviewable by a Staff Engineer in one sitting.  
- Refactors must **compile**, keep tests green, and **preserve public behavior** unless the PR explicitly changes the contract.  
- New non-obvious trade-offs → **new ADR**.  
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
