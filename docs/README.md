# Atlas documentation

This handbook is how Atlas presents itself as a **reference implementation of a production-grade enterprise AI platform** — not a chatbot demo.

If you are new:

1. [Architecture overview](./architecture/overview.md)
2. [AI pipeline](./architecture/ai-pipeline.md)
3. [ADR index](./adr/README.md)
4. Root [README](../README.md) for quick start

## Structure

| Folder | Audience | Contents |
|--------|----------|----------|
| [`architecture/`](./architecture/overview.md) | Architects, new contributors | System design, pipeline, sequences, deployment, observability |
| [`engineering/`](./engineering/monorepo.md) | Implementers | Monorepo, testing strategy, coding standards |
| [`adr/`](./adr/README.md) | Everyone reviewing trade-offs | Architecture Decision Records |
| [`benchmark/`](./benchmark/README.md) | Perf owners | Latency / throughput suite (planned + conventions) |
| [`evaluation/`](./evaluation/README.md) | Retrieval quality | Fixtures, metrics, future `pnpm evaluate` |
| [`security/`](./security/overview.md) | Operators | Tenancy, secrets, hardening |
| [`performance/`](./performance/README.md) | Operators | Tuning knobs, known bottlenecks |
| [`contributing/`](./contributing/README.md) | Contributors | PR norms, incremental change policy |

## Design north star

> Would a Staff Engineer copy ideas from this project?

Prefer maintainability, architectural consistency, and developer experience over novelty. Work incrementally; one concern per PR.
