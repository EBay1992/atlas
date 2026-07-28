# Load testing

## Goal

Exercise API upload + search under concurrency; publish summaries beside benchmark results.

## Tooling (planned)

- [k6](https://k6.io/) **or** [Artillery](https://www.artillery.io/)  
- Scripts under `scripts/load/`  
- Scenarios: login → upload N docs → poll → search M queries  

## Status

**Not implemented yet.** When added, commit HTML/JSON summaries under `docs/performance/results/` with date, git SHA, and VUs.

## Safety

Never point load tests at shared environments with production-like data. Lab stack only.
