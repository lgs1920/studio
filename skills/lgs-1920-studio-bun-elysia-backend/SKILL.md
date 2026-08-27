---
name: lgs-1920-studio-bun-elysia-backend
description: Build or modify LGS1920 server-side functionality with Bun and Elysia, including routes, proxies, configuration, file handling, errors, security, and deployment behavior.
---

# Bun Elysia Backend

Use for server routes, proxy endpoints, provider access, configuration, or deployment. Inspect `servers.json`, server entry points, `deploy.js`, environment handling, and existing request consumers first. The Studio repository owns the deployment orchestrator; the runtime contact-mail implementation lives in the sibling `../backend` repository.

Workflow:

1. Define the route contract, input validation, response shape, timeout, and failure behavior.
2. Use Elysia and Bun-native APIs already established by the project.
3. Keep secrets in environment configuration, validate them at the boundary, and redact them from errors and logs.
4. Proxy only the required upstream resources and preserve safe content type, cache, and origin behavior.
5. Handle cancellation, upstream failure, malformed input, and oversized files.
6. Add route tests and verify deployment configuration without running the development server manually.

Do not add a second backend framework or trust user-provided URLs without validation.

## Contact mail and backend deployment

When a change concerns the public contact form, read the backend
`docs/CONTACT-API.md` and `docs/SMTP-DEPLOYMENT.md` before editing Studio. Keep the
browser and Studio release free of SMTP credentials, CSRF secrets, and recipient
addresses. The site may contain only the public API URL and an opaque target key.

For backend deployment, the local source of truth is `../backend/.env`. The Studio
deployment command uploads that file over the active SSH/SFTP connection to the
configured remote backend shared path, normally `shared/backend.env`, after
creating the directory with mode `700`; it then enforces file mode `600`. PM2
sources the remote file and starts or restarts the backend with `--update-env`.
Never copy the file into `dist`, a release archive, a Studio `.env`, or a Git
tracked file, and never log its contents.

Inspect `deployment/deploy.yml`, `deployment/Deployment.js`, and
`deployment/DeploymentCommands.js` when changing this boundary. Test path
calculation, shell quoting, environment upload ordering, and the PM2 command
without performing a real deployment. A real deployment still requires explicit
user authorization.
