# ADR 0001: Record architecture decisions

- **Status:** accepted

## Context

Atlas is positioned as a **reference implementation of an enterprise AI platform**. Readers (including Staff-level interviewers) need durable explanations of trade-offs, not tribal knowledge in chat logs.

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

- Wiki-only docs: drift from the repo  
- Code comments alone: invisible in review of system shape  

## Consequences

ADRs are interview and onboarding assets: they show reasoned trade-offs, not tutorial defaults.

## Revisit when

The project outgrows markdown ADRs (e.g. RFCs with formal review boards).
