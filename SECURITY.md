# Security Policy

## Supported environments

Atlas is published as an open-source, local-first knowledge platform. The default
Docker Compose stack and seed user are for **local development only**.

## Reporting a vulnerability

Please report security issues privately:

- Open a GitHub Security Advisory on this repository, or
- Email the maintainer via the address on the GitHub profile

Include steps to reproduce, impact, and any suggested fix. Do not open a public
issue for undisclosed vulnerabilities.

## Hardening checklist before exposing Atlas beyond localhost

1. Generate a strong `JWT_SECRET` (32+ random bytes). Production refuses weak/default secrets.
2. Change the seeded admin password (or disable seed in production images).
3. Replace MinIO/Postgres/Redis default credentials; do not publish their ports publicly.
4. Terminate TLS at a reverse proxy; do not expose the API as plain HTTP on the internet.
5. Restrict CORS and network access (private VPC / firewall).
6. Keep Ollama and embedding endpoints on a private network.
7. Enable backups for Postgres, object storage, and Qdrant volumes.
8. Review tenant isolation: every query path must scope by JWT `tenantId`.

## What is intentionally out of scope in the default stack

- No built-in WAF, bot protection, or advanced rate limiting
- No SSO / OIDC (JWT login is local demo auth)
- Compose services bind to host ports for developer convenience

Treat the defaults as a lab environment, not a production deployment blueprint.
