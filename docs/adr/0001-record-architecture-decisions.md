# ADR 0001: Record architecture decisions

- **Status:** accepted

## Context

Atlas has multiple durable design choices (hexagonal boundaries, async ingestion, telemetry). Without recorded decisions, rationale is lost to chat history and commit messages.

## Decision

Maintain Architecture Decision Records in `docs/adr/` using:

- **Status:** proposed | accepted | superseded | deprecated
- **Context:** forces at play
- **Decision:** what we chose
- **Alternatives:** what we rejected and why
- **Consequences:** trade-offs and follow-ups
- **Revisit when:** conditions that would reopen the decision

Index and topic map: [README.md](./README.md).

## Alternatives

- Wiki-only docs: drift from the repository  
- Code comments alone: incomplete for system-level trade-offs  

## Consequences

Contributors can review prior trade-offs before proposing changes. ADRs require maintenance when decisions change.

## Revisit when

The project outgrows markdown ADRs (for example, formal RFCs with a review board).
