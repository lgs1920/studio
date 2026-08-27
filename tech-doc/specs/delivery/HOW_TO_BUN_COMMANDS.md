# Bun Command Reference

This document lists the Bun commands currently available in the LGS1920 Studio repository. The source of truth for
project scripts is the `scripts` object in the root `package.json`.

Run all commands from the repository root:

```bash
cd /home/christian/devs/assets/lgs1920/studio
```

## Prerequisites

- Install Bun and verify the installed version with `bun --version`.
- Install the locked dependencies before running project commands:

  ```bash
  bun install --frozen-lockfile
  ```

  Use `bun install` without `--frozen-lockfile` only when intentionally updating the lockfile.
- Do not commit generated files or dependency changes unless the task requires them.

## Project scripts

The following commands are defined in the root `package.json`.

### Development and production build

| Command | Purpose | Notes |
| --- | --- | --- |
| `bun run dev` | Starts Vite in development mode. | This command exists for local development, but project validation must not start it manually. |
| `bun run build` | Runs the store contract test, then creates the Vite production build. | The generated application is written to `dist/`. |
| `bun run preview` | Serves the Vite production build locally for inspection. | Run `bun run build` first. |

The development command is intentionally excluded from validation workflows. Use focused tests, linting, type checking,
or a production build when verifying a change.

### Tests and static checks

| Command | Purpose | Notes |
| --- | --- | --- |
| `bun run test` | Runs the complete Vitest suite and the Oxlint migration test. | This is the main automated test command. |
| `bun run test:watch` | Runs Vitest in watch mode. | Use during local test authoring; stop it with `Ctrl+C`. |
| `bun run test:stores` | Runs the store proxy contract test only. | This is also the first step of `bun run build`. |
| `bun run test:lint-config` | Runs the Oxlint migration fixtures and assertions. | It is also included in `bun run test`. |
| `bun run lint` | Runs Oxlint with type-aware analysis. | Unused-disable directives are treated as errors. |
| `bun run typecheck` | Runs TypeScript without emitting files. | Equivalent to `tsc --noEmit`. |

Typical validation commands are:

```bash
bun run test
bun run lint
bun run typecheck
bun run build
```

### Repository maintenance

| Command | Purpose | Notes |
| --- | --- | --- |
| `bun run commit-history:update` | Updates `COMMIT_HISTORY.md` with commits that are not documented yet. | This command modifies a tracked file. |
| `bun run commit-history:update -- --check` | Checks whether `COMMIT_HISTORY.md` is up to date without writing it. | The second `--` forwards `--check` to the script. |
| `bun run cesium:skills:check` | Compares every Cesium skill document with the latest CesiumJS version published to npm. | Exits with status `1` and lists stale or undocumented baselines when an update is needed. |

Run `bun run cesium:skills:check` after a CesiumJS dependency update or before starting Cesium-related work. The check
inspects all Markdown files under `skills/cesiumjs-*`, including `SKILL.md` and `REFERENCE.md`, and points to the
[official CesiumJS API reference](https://cesium.com/learn/cesiumjs/ref-doc/) when a document needs review.

### Logo assets

| Command | Purpose | Default input/output |
| --- | --- | --- |
| `bun run logo:export` | Converts the canonical SVG logo into an editable SVG and renders the canonical PNG variants. | `logo.svg` → `logo-editable.svg` |
| `bun run logo:import` | Imports edited path geometry into the canonical SVG and renders the canonical PNG variants. | `logo-editable.svg` → `logo.svg` |
| `bun run logo:png` | Renders the three canonical SVG logos as PNG files. | `logo.svg`, `logo-horizontal.svg`, and `logo-vertical.svg` |

The logo tool also accepts explicit paths:

```bash
bun scripts/logo-tool.mjs export path/to/logo.svg path/to/logo-editable.svg
bun scripts/logo-tool.mjs import path/to/logo-editable.svg path/to/logo.svg
bun scripts/logo-tool.mjs png path/to/logo.svg path/to/logo.png
bun scripts/logo-tool.mjs --help
```

`export` and `import` always regenerate the canonical PNG variants in `public/assets/logo/`.

### Deployment

| Command | Purpose | Side effects |
| --- | --- | --- |
| `bun run deploy -- -s` | Deploys Studio to staging. | Builds, archives, transfers, updates the remote release, and creates/pushes a Git tag. |
| `bun run deploy -- -p` | Deploys Studio to production. | Same remote and Git side effects for production. |
| `bun run deploy -- -t` | Deploys Studio to test. | Same remote and Git side effects for test. |

Long platform names are also accepted:

```bash
bun run deploy -- --staging
bun run deploy -- --prod
bun run deploy -- --test
```

The deployment command derives the product from the current directory name, so it must be run from the `studio`
directory for a Studio deployment. Exactly one platform flag is intended. Do not omit the flag: the current launcher
falls back to the test platform when no platform flag is provided. Deployment also requires the configured SSH/GitHub
credentials and `deployment/deploy.yml`; never put those credentials in tracked files or command output.

## Bun commands used by the project

These are not additional `package.json` scripts, but they are useful when working on the repository:

```bash
# Install exactly the versions recorded in bun.lock
bun install --frozen-lockfile

# Run a package.json script
bun run <script>

# Forward arguments to a package.json script
bun run <script> -- <argument>

# Run a package executable with Bun instead of Node.js
bunx --bun <package> <arguments>

# Run a local JavaScript or TypeScript file
bun <file>
```

The repository uses `bunx --bun vite` for Vite commands so that Vite runs with Bun. Prefer the existing project scripts
over invoking tools directly, unless a targeted command is required for debugging.

## Commands not defined as project scripts

There are currently no root scripts named `start`, `format`, `check`, or `coverage`. Do not document or rely on those
names as project commands unless they are added to `package.json`.

## Source of truth

When this document and the command line differ, inspect these files first:

- `package.json` for project scripts
- `scripts/logo-tool.mjs` for logo arguments and defaults
- `scripts/update-commit-history.mjs` for history-update options
- `scripts/check-cesium-skills.mjs` for CesiumJS skill freshness checks
- `deploy.js` and `deployment/Deployment.js` for deployment arguments and behavior
- `bun.lock` for the locked dependency graph
