# Atlas documentation

Technical documentation for Atlas: architecture, ADRs, engineering standards, evaluation, and operations.

Getting started:

1. [Architecture overview](./architecture/overview.md)
2. [AI pipeline](./architecture/ai-pipeline.md)
3. [ADR index](./adr/README.md)
4. Root [README](../README.md) for local setup

## Structure

| Folder | Audience | Contents |
|--------|----------|----------|
| [`architecture/`](./architecture/overview.md) | Contributors | System design, pipeline, sequences, deployment, observability |
| [`engineering/`](./engineering/monorepo.md) | Implementers | Monorepo, testing strategy, coding standards |
| [`adr/`](./adr/README.md) | Reviewers | Architecture Decision Records |
| [`benchmark/`](./benchmark/README.md) | Performance | Latency / throughput suite (planned) |
| [`evaluation/`](./evaluation/README.md) | Retrieval quality | Fixtures, metrics, future `pnpm evaluate` |
| [`security/`](./security/overview.md) | Operators | Tenancy, secrets, hardening |
| [`performance/`](./performance/README.md) | Operators | Tuning knobs, known bottlenecks |
| [`contributing/`](./contributing/README.md) | Contributors | Contribution guidelines |

## Guidelines

Prefer maintainability and clear package boundaries over premature abstraction. Keep changes incremental and reviewable.
