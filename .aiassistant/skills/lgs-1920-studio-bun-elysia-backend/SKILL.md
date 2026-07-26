---
name: lgs-1920-studio-bun-elysia-backend
description: Build or modify LGS1920 server-side functionality with Bun and Elysia, including routes, proxies, configuration, file handling, errors, security, and deployment behavior.
---

# Bun Elysia Backend

Use for server routes, proxy endpoints, provider access, configuration, or deployment. Inspect `servers.json`, server entry points, `deploy.js`, environment handling, and existing request consumers first.

Workflow:

1. Define the route contract, input validation, response shape, timeout, and failure behavior.
2. Use Elysia and Bun-native APIs already established by the project.
3. Keep secrets in environment configuration, validate them at the boundary, and redact them from errors and logs.
4. Proxy only the required upstream resources and preserve safe content type, cache, and origin behavior.
5. Handle cancellation, upstream failure, malformed input, and oversized files.
6. Add route tests and verify deployment configuration without running the development server manually.

Do not add a second backend framework or trust user-provided URLs without validation.
