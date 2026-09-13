# Technical Specification — Oxlint TypeScript 7 Migration

## Status

Implemented. The current implementation is documented in
[CORE-OXLINT-TYPESCRIPT-7-MIGRATION.md](CORE-OXLINT-TYPESCRIPT-7-MIGRATION.md).

This file is retained as the original issue proposal so the issue's historical
link remains valid.

## Objective

Replace the current `typescript-eslint` parser and plugin integration with Oxlint so the studio can keep TypeScript 7 while retaining TypeScript-aware linting and React-specific checks.

## Context

The studio currently uses:

- `typescript@7.0.2`
- `eslint@10.8.0`
- `@typescript-eslint/parser@8.65.0`
- `@typescript-eslint/eslint-plugin@8.65.0`
- a flat ESLint configuration in `eslint.config.mjs`

The current `typescript-eslint` release line does not officially support TypeScript 7. Its parser relies on TypeScript compiler APIs that are not compatible with the TypeScript 7 toolchain, which causes an unsupported-version warning during linting.

The project also uses React, TSX, React Hooks, React Refresh, Bun, Vite, and TypeScript path aliases. The migration must preserve these workflows.

## Proposed solution

Use Oxlint as the primary JavaScript and TypeScript linter, with its TypeScript 7 type-aware engine enabled through `oxlint-tsgolint@7`.

The migration must use the Oxlint React plugin for the rules currently provided by `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`.

Recommended development dependencies:

```json
{
  "oxlint": "latest",
  "oxlint-tsgolint": "7"
}
```

The exact versions must be locked in `package.json` and `bun.lock` after validation. The `oxlint-tsgolint` major version must match the installed TypeScript major version.

## Scope

### Included

- add Oxlint and the TypeScript 7 type-aware engine
- migrate the current ESLint rules to Oxlint equivalents
- enable TypeScript, React, React Hooks, and React Refresh coverage
- add an Oxlint configuration file
- update the `lint` package script
- remove `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` if no remaining ESLint workflow requires them
- keep `tsc --noEmit` as the authoritative TypeScript compiler check
- validate the migration against the existing source tree and test suite
- document any rules that have no direct Oxlint equivalent

### Excluded

- changing the TypeScript version
- changing the React, Vite, or Bun toolchain
- introducing a formatter migration
- changing application runtime behavior
- adding type-aware lint rules unrelated to the current ESLint configuration
- rewriting existing source files solely to reduce lint output without an explicit rule decision

## Configuration requirements

The Oxlint configuration must:

- lint `.js`, `.jsx`, `.ts`, and `.tsx` files
- ignore generated `dist` output and other generated artifacts already excluded by the project
- enable the built-in TypeScript plugin
- enable the React plugin
- enable type-aware linting through `oxlint-tsgolint@7`
- report unused disable directives
- preserve the project globals `lgs` and `__`
- preserve the existing alias and import-resolution behavior where Oxlint supports it

The configuration should be generated or cross-checked with Oxlint's ESLint migration tooling, then reviewed manually. Generated configuration is not authoritative until the resulting rule set has been compared with `eslint.config.mjs`.

## TypeScript configuration risk

The current `tsconfig.json` uses `baseUrl` together with `paths` for aliases such as `@Core`, `@Components`, and `@Utils`.

Oxlint's type-aware mode documents limitations around legacy `tsconfig` options, including `baseUrl`. The implementation must therefore verify all alias imports before removing the existing ESLint configuration. If required, the migration must introduce the supported Oxlint resolution equivalent without changing runtime aliases used by Vite.

This verification is a release blocker for the migration because unresolved aliases can produce false-positive import diagnostics or hide real import errors.

## Migration strategy

1. Install Oxlint and `oxlint-tsgolint@7`.
2. Generate an initial Oxlint configuration from the existing ESLint configuration.
3. Enable type-aware linting and the React plugin.
4. Compare the generated rules with `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:react-hooks/recommended`, and `react-refresh/only-export-components`.
5. Resolve configuration differences, alias-resolution issues, and genuine diagnostics.
6. Run Oxlint and the existing ESLint command in parallel during validation.
7. Remove overlapping or obsolete ESLint dependencies only after Oxlint produces an equivalent result for the accepted rule set.
8. Make Oxlint the command executed by `bun run lint`.
9. Keep the compiler validation as a separate `bun run typecheck` command if one is not already present.

An incremental migration is allowed if one or more project-specific ESLint rules cannot yet be replaced. In that case, ESLint may remain temporarily for the non-overlapping rules, but TypeScript files must not be parsed by both incompatible TypeScript parser integrations in the same lint command.

## Package script requirements

The final scripts must expose separate responsibilities:

- `lint`: Oxlint diagnostics and unused-disable-directive reporting
- `typecheck`: `tsc --noEmit`
- `test`: the existing Vitest command
- `build`: the existing build and store-test workflow

The implementation must not run `bun run dev` as part of validation.

## Validation and tests

The implementation must validate:

- JavaScript, JSX, TypeScript, and TSX files are linted
- TypeScript 7 no longer produces a `typescript-eslint` unsupported-version warning
- React Hooks violations are still detected
- React Refresh export violations are still detected
- TypeScript-specific recommended diagnostics are preserved or explicitly documented
- alias imports resolve without false positives
- generated `dist` files are ignored
- unused disable directives are reported
- `bun run lint` completes successfully with zero warnings treated as errors
- `bun run typecheck` completes successfully
- `bun test` completes successfully
- `bun run build` completes successfully

At least one focused test or fixture must cover each migration-specific rule or configuration behavior that cannot be validated by the existing application tests.

## Acceptance criteria

- Oxlint is the primary linter invoked by `bun run lint`.
- TypeScript 7 remains installed and is supported by the linting toolchain.
- The current ESLint parser warning is removed.
- React Hooks and React Refresh checks remain active.
- TypeScript-aware linting remains available through `oxlint-tsgolint@7`.
- Existing source aliases do not generate unresolved-import regressions.
- Unused lint-disable directives continue to fail the lint command.
- The final dependency tree does not contain unused `typescript-eslint` parser/plugin packages unless an explicitly documented compatibility rule still requires them.
- Lint, type checking, tests, and build validation all pass.
- The migration and any intentionally changed rule behavior are documented in this specification or its implementation notes.

## Rollback

If Oxlint cannot reproduce a required rule or resolve the project aliases reliably, restore the previous ESLint command and configuration, then use a supported TypeScript version with `typescript-eslint`. The rollback must not alter application source behavior.

## Related issue

The implementation is tracked by the GitHub issue created for the 1.1.0 backlog and milestone.
