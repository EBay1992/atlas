# ADR 0012: Streaming object upload

- **Status:** accepted
- **Date:** 2026-07-28

## Context

Document upload can be tens of megabytes (API cap 50MB). Buffering entire files in API memory before writing storage would:

- Spike RSS under concurrent uploads  
- Delay time-to-first-byte on object storage  
- Encourage accidental “bytes in Postgres” designs  

Atlas is also often confused with “LLM token streaming.” This ADR clarifies **what streaming means today**.

## Decision

1. **Stream multipart file bytes** from the HTTP request into the `ObjectStore` (`putObject` accepts `Readable`) using S3 multipart-friendly uploads (AWS SDK upload helper).  
2. **Do not** stream LLM tokens yet — there is no generative completion path. Async UX is **202 + job polling** ([ADR 0009](./0009-async-upload-polling.md)).  
3. Compute checksum while streaming when practical so metadata stays trustworthy without a second full read.  

## Alternatives

| Option | Why not (now) |
|--------|----------------|
| Buffer whole file in memory | Simple; does not scale under concurrent large uploads |
| Write temp files on API disk | Extra IO and cleanup; still not the system of record |
| SSE progress for ingestion | Better UX later; more moving parts than polling for Week-1 reliability |

## Consequences

- API memory stays bounded by stream backpressure, not file size alone  
- Object storage becomes the system of record for bytes immediately  
- Future **answer token streaming** (SSE/WebSocket) is a separate ADR when conversational RAG lands  

## Revisit when

- Generative RAG requires first-token latency UX (SSE)  
- Upload limits grow into multi-GB territory (resumable / multipart client protocols)  
