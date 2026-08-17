# Bun Build and Test Migration Study

**Status:** Proposed and pending validation
**Date:** 2026-08-17
**Scope:** Replace Vite with the Bun bundler and Vitest with `bun test`

## Executive summary

The repository already uses Bun as its runtime and package manager. This document studies two separate changes:

1. replacing Vitest with Bun's built-in test runner
2. replacing Vite with Bun's bundler and development server

The recommended path is to migrate the test runner first and keep Vite for the application build until a Bun build
prototype reproduces every current build contract. A full replacement should not be treated as a package rename. It
requires replacing Vite-specific runtime features and several plugins.

The recommended target is staged:

| Stage | Runtime and package manager | Application build and dev server | Test runner | Recommendation |
| --- | --- | --- | --- | --- |
| Current | Bun | Vite | Vitest | Existing baseline |
| First migration | Bun | Vite | `bun test` | Recommended first step |
| Full migration | Bun | Bun bundler and `Bun.serve` | `bun test` | Conditional on all gates passing |

## Current baseline

This audit was performed on 2026-08-17.

- `package.json` already runs Vite through `bunx --bun`.
- The application build uses `vite.config.mts` and writes versioned output below `dist/<version>`.
- Vite plugins currently provide Cesium asset serving, PWA generation, Markdown imports, React transforms, a PHP proxy,
  and development branch tracking.
- The test suite contains 146 test files. 145 files import Vitest directly.
- `vitest.config.ts` provides a `jsdom` environment, global test APIs, aliases, the test setup file, and the Markdown
  plugin.
- The application uses Vite-specific features including `import.meta.glob`, `?raw`, `?url`, Markdown imports, CSS
  imports, and worker URLs based on `import.meta.url`.
- `tsconfig.json` already contains the path aliases needed by the application and tests.

## Bun versus Vite

### Advantages of Bun

- One native tool can execute JavaScript and TypeScript, bundle browser assets, run scripts, and serve HTML.
- Bun's bundler supports HTML entry points, TypeScript, JSX, CSS, asset copying, hashing, watch mode, and browser
  targets. See the [Bun bundler documentation](https://bun.sh/docs/bundler).
- Bun's HTML development server can provide HMR for a simple React SPA. See [HTML and static sites](https://bun.sh/docs/bundler/html-static)
  and the [full-stack development server](https://bun.sh/docs/bundler/fullstack).
- Removing Vite would reduce the number of build tools and eliminate Vite-specific configuration from the final stack.

### Disadvantages and risks

- Bun's HTML bundling is still documented as a work in progress. The official documentation identifies missing plugins,
  configuration options, CORS handling, and header configuration.
- Vite plugins cannot be assumed to work with Bun. The current Cesium, PWA, and Markdown integrations require explicit
  replacements or custom Bun plugins.
- `import.meta.glob` has no direct application-level replacement in the current codebase. The widget registry would need
  explicit imports or a generated module registry.
- Vite query imports such as `?raw` and `?url` are part of the current source contract. They would need a Bun loader,
  generated JavaScript modules, or a source refactor.
- The current development proxy and Cesium middleware would have to move to `Bun.serve` routes or a custom development
  server.
- The output layout, source maps, chunk names, PWA files, service worker behavior, and Cesium runtime paths must remain
  compatible with deployment and with existing browser behavior.

### Repository-specific migration inventory

| Current feature | Current owner | Bun migration work | Risk |
| --- | --- | --- | --- |
| React JSX transform and HMR | Vite and React plugin | Configure Bun JSX and validate HMR behavior | Medium |
| Cesium static assets | `vite-plugin-cesium` and custom middleware | Copy or serve Cesium engine and widget assets, then validate `CESIUM_BASE_URL` behavior | High |
| PWA and service worker injection | `vite-plugin-pwa` | Recreate Workbox/service-worker generation and manifest handling | High |
| Markdown imports | `vite-plugin-markdown` | Add a loader or convert Markdown to generated modules | High |
| Widget discovery | `import.meta.glob` | Generate a registry or maintain explicit imports | High |
| Raw and URL imports | Vite query loaders | Replace with explicit file reads or generated asset modules | Medium |
| PHP development proxy | Vite middleware | Implement an equivalent `Bun.serve` route with the existing allowlist | Medium |
| Branch tracking file | Vite `configureServer` hook | Run a pre-dev script or add a Bun server hook | Low |
| Versioned output and asset names | Vite build configuration | Reproduce with `Bun.build` naming and a post-build validation | High |

## Bun versus Vitest

### Advantages of `bun test`

- The runner is built into Bun and supports TypeScript, JSX, lifecycle hooks, snapshots, watch mode, preload scripts,
  and coverage.
- Bun documents compatibility globals for Vitest, including `vi`, `vi.fn`, `vi.spyOn`, `vi.mock`, and common mock
  cleanup methods. See [Bun runtime behavior](https://bun.sh/docs/test/runtime-behavior) and [Bun mocks](https://bun.sh/docs/test/mocks).
- Test scripts become simpler and no longer need Vitest as a separate runner dependency.
- Bun supports React Testing Library with a DOM adapter such as Happy DOM. See [Bun DOM testing](https://bun.sh/docs/test/dom).

### Disadvantages and risks

- Bun describes its runner as Jest-compatible, not as a complete Vitest implementation. Compatibility must be proven for
  this repository rather than inferred from the `vi` alias.
- Module mock timing is critical. Tests using `vi.hoisted` or mocks that must run before imports may need a preload file,
  `mock.module`, or a test refactor. Bun documents preload as the mechanism for pre-import mocks.
- The current `jsdom` environment setting in `vitest.config.ts` has no direct equivalent in that file. A Bun preload must
  register a DOM implementation and then apply the current `src/__tests__/setup.js` patch.
- Bun runs the test suite in one process by default. Shared globals, module cache, browser state, and mock state require
  deliberate cleanup between tests.
- Timer behavior, module mocking, import of actual modules, and error reporting may differ in edge cases.
- Removing Vitest does not remove Vite if Vite remains the application bundler. The dependency reduction is therefore
  limited until the build migration is also complete.

## Proposed migration method

### Phase 0: Freeze the baseline

Create a dedicated migration branch and record the current results before changing scripts:

```bash
bun install --frozen-lockfile
bun run test
bun run lint
bun run typecheck
bun run build
```

Keep the existing `test`, `test:stores`, `test:watch`, `dev`, and `build` scripts working throughout the experiment.
Do not delete `vitest.config.ts` or Vite dependencies during the pilot.

### Phase 1: Pilot `bun test`

1. Add a temporary Bun test command and keep the Vitest command as the comparison baseline.
2. Add a `bunfig.toml` test section with a preload file. The preload should register Happy DOM, then apply the existing
   DOM setup from `src/__tests__/setup.js`.
3. Start with tests that do not use module mocks. Confirm discovery, JSX, TypeScript, aliases from `tsconfig.json`,
   DOM APIs, and cleanup behavior.
4. Port imports in small batches:

   ```js
   import {describe, expect, it, vi} from 'bun:test'
   ```

   The existing `vi` API may remain temporarily where Bun supports it. Prefer `mock`, `spyOn`, and explicit imports from
   `bun:test` for new tests.
5. Port mock-heavy tests separately. In particular, audit every use of `vi.hoisted`, `vi.importActual`, `vi.mock`, global
   stubs, and fake timers. Use a preload for mocks that must exist before module evaluation.
6. Compare the full test list and failures with Vitest. Do not accept a green run if fewer tests were discovered.
7. Add coverage and watch-mode checks after the functional suite is green.

Useful pilot commands are:

```bash
bun test
bun test --watch
bun test --coverage
bun test ./src/__tests__/unit/data/store-proxy-contracts.test.js
```

### Phase 2: Port the test scripts

After test parity is demonstrated, replace the test scripts in a separate change:

```json
{
  "test": "bun test && bun run test:lint-config",
  "test:stores": "bun test ./src/__tests__/unit/data/store-proxy-contracts.test.js",
  "test:watch": "bun test --watch"
}
```

Keep `vitest.config.ts` and the Vitest dependency until no CI job or local script uses them. Remove them only after the
repository-wide search and CI validation show no remaining references.

### Phase 3: Build a Bun bundler proof of concept

Do not start by deleting `vite.config.mts`. Create an isolated build entry point, for example
`scripts/bun-build.mjs`, and reproduce the smallest valid build first:

```js
await Bun.build({
    entrypoints: ['./index.html'],
    outdir: `./dist/${version}`,
    target: 'browser',
    minify: true,
    sourcemap: 'external',
})
```

Then implement and validate the missing application contracts in this order:

1. React JSX and CSS imports
2. versioned output and asset naming
3. Markdown, raw, and URL imports
4. generated widget registry to replace `import.meta.glob`
5. Cesium engine and widget assets
6. PHP proxy and development headers
7. PWA manifest, service worker injection, and update behavior
8. worker URLs, source maps, and production deployment layout

For development, prototype `Bun.serve` with the existing host, port, static assets, SPA fallback, proxy allowlist, and
HMR. The prototype must support the same workflows as the current Vite server before it can replace `bunx --bun vite`.

### Phase 4: Full cutover

Only after the test and build gates pass:

1. switch `dev`, `build`, and `preview` scripts to the approved Bun commands
2. remove Vite-only configuration and dependencies
3. update the dependency inventory in `tech-doc/specs/README_DEPENDENCIES.md`
4. update CI and deployment documentation
5. run the complete validation suite and inspect the generated application manually

Do not combine the test-runner cutover and the build cutover in one unverified change. They have different failure modes
and different rollback paths.

## Acceptance gates

The migration is complete only when all of the following are true:

- Bun discovers and executes all 146 current test files, or an explicit reviewed split explains any exclusions.
- Unit, UI, integration, snapshot, mock, timer, and DOM tests have equivalent results.
- `bun run lint`, `bun run typecheck`, and the production build pass.
- The application loads Cesium terrain, imagery, 3D Tiles, workers, and widgets in development and production.
- PWA installation, update detection, service worker scope, and offline behavior remain unchanged.
- Markdown content, raw assets, URL assets, CSS, and lazy widget loading work in the browser.
- The PHP proxy keeps its method check, target allowlist, request headers, status forwarding, and error behavior.
- Generated files retain the expected versioned directory, asset paths, source maps, and deployment contract.
- CI runs the same checks from a clean checkout with `bun install --frozen-lockfile`.
- Startup time and test duration are measured before and after the change. Speed improvements are not assumed.

## Recommendation

Approve the `bun test` pilot independently. Keep Vite as the application build tool unless the Bun bundler proof of
concept passes the Cesium, PWA, Markdown, widget registry, proxy, and deployment gates. For this repository, Bun is an
obvious replacement for the test runner to evaluate, but it is not yet a drop-in replacement for the complete Vite build
pipeline.

## References

- [Bun test runner](https://bun.sh/docs/test)
- [Bun test configuration](https://bun.sh/docs/test/configuration)
- [Bun DOM testing](https://bun.sh/docs/test/dom)
- [Bun mocks and Vitest compatibility](https://bun.sh/docs/test/mocks)
- [Bun bundler](https://bun.sh/docs/bundler)
- [Bun HTML and static sites](https://bun.sh/docs/bundler/html-static)
- [Bun full-stack development server](https://bun.sh/docs/bundler/fullstack)
