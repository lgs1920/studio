# Oxlint TypeScript 7 Migration

## Status

Implemented for issue 407.

## Objective

Use Oxlint as the JavaScript and TypeScript linter while keeping TypeScript 7,
type-aware analysis, React Hooks checks, React Refresh checks, and the
project's Vite aliases.

## Toolchain

The lint toolchain is pinned in `package.json` and `bun.lock`:

- `oxlint@1.76.0`
- `oxlint-tsgolint@7.0.2001`
- `typescript@7.0.2`

`oxlint-tsgolint` provides the TypeScript 7 semantic engine used by Oxlint.
The authoritative compiler validation remains available separately through
`bun run typecheck` (`tsc --noEmit`).

## Configuration

The root configuration is `.oxlintrc.jsonc`.

- The `eslint`, `typescript`, and `react` Oxlint plugins are enabled.
- Type-aware linting is enabled through `options.typeAware` and the lint
  script's `--type-aware` flag.
- The browser and built-in ECMAScript environments are enabled.
- `lgs` and `__` remain read-only globals.
- `dist`, `dev-dist`, `dist-ssr`, and the legacy `.eslintrc.cjs` are ignored.
- Unused `oxlint-disable` and supported `eslint-disable` directives are
  reported as errors.

The lint script is:

```text
oxlint --type-aware --report-unused-disable-directives-severity error
```

## Rule mapping

| Previous ESLint rule | Oxlint rule | Behavior |
| --- | --- | --- |
| `react-hooks/rules-of-hooks` | `react/rules-of-hooks` | Warning; violations remain visible without blocking the existing source tree |
| `react-hooks/exhaustive-deps` | `react/exhaustive-deps` | Warning |
| `react-refresh/only-export-components` | `react/only-export-components` | Warning; constant exports allowed |
| `eslint:recommended` | Oxlint `eslint` plugin defaults | Preserved through the native rule set |
| `plugin:@typescript-eslint/recommended` | Oxlint `typescript` plugin defaults | Preserved through the native rule set |

The old `react/jsx-uses-vars` rule has no separate configuration entry because
Oxlint's parser accounts for JSX bindings while running its unused-variable
analysis.

The React Hooks compiler rules introduced by the newer ESLint plugin preset
(`static-components`, `immutability`, `refs`, `purity`, and related rules) do
not all have one-to-one Oxlint rule identifiers. They are not silently mapped
to unrelated diagnostics. The two core Hooks rules and the React Refresh
export rule are the supported equivalents required by the application; the
fixture suite can be extended when native coverage is added.

## TypeScript aliases

TypeScript 7 removes `baseUrl` and rejects non-relative `paths` targets. The
`tsconfig.json` aliases therefore use `./src/...` targets without `baseUrl`.
Vite and Vitest keep their existing runtime alias mappings, so application
imports such as `@Core/...`, `@Components/...`, and `@Utils/...` are unchanged.

The migration test runs Oxlint's type-aware engine against a real `@Core`
import and fails if the TypeScript program reports an invalid configuration.

## Validation

`bun run test` runs the Vitest suite and
`scripts/oxlint-migration-test.mjs`. The focused migration checks cover:

- TypeScript and TSX parsing
- React Hooks violations
- React Refresh export violations
- unused disable directives
- type-aware resolution of a project alias

The complete validation commands are:

```text
bun run lint
bun run typecheck
bun test
bun run build
```
