# Test and Deployment Next Steps

**Status:** Coverage and browser baseline implemented; Studio GitHub deployment workflow implemented
**Date:** 2026-09-13
**Scope:** Vitest coverage and GitHub Actions deployment for Studio

## Current baseline

The local quality gates and coverage baseline have been run on the current
working tree. The GitHub Actions quality workflow now includes the coverage
and browser steps for the next push.

- 223 test files pass under coverage instrumentation.
- 1,450 Vitest tests pass under coverage instrumentation.
- Oxlint passes.
- TypeScript validation passes.
- The production build passes.
- `actions/checkout` uses the Node.js 24-compatible `v5` release.
- Vitest remains the project test runner.

The suite is broad across replay, camera, journey, data, stores, widgets, UI,
video, and deployment helpers. It uses separate `unit`, `ui`, and `integration`
projects. The integration project currently runs in jsdom; it is not a real
browser end-to-end suite.

## Coverage baseline

Coverage is generated with Vitest 5 and the V8 provider. The reports are
written to the ignored `coverage/` directory in text, JSON, and HTML formats.

The first baseline is:

| Metric | Covered | Total | Percentage |
| --- | ---: | ---: | ---: |
| Statements | 28,753 | 52,062 | 55.22% |
| Branches | 20,325 | 41,468 | 49.01% |
| Functions | 4,737 | 9,233 | 51.30% |
| Lines | 27,687 | 49,921 | 55.46% |

### Tasks

1. ~~Add the Vitest 5-compatible `@vitest/coverage-v8` development dependency.~~
2. ~~Add a `test:coverage` package script.~~
3. ~~Run coverage without enforcing thresholds.~~
4. ~~Review line, function, branch, and statement coverage by domain.~~
5. ~~Identify uncovered critical paths in replay, camera, stores, persistence,
   video recording, and deployment.~~
6. Add targeted behavior tests for the remaining high-risk paths.
7. Set targeted thresholds after the new tests and deployment workflow are
   validated.

The first targeted test additions cover the browser rendering path for the
update dialog and the manual clipped and blurred video overlay compositor.
The baseline also identifies these follow-up gaps:

- `deployment/Deployment.js`: 7.37% statements and 12.00% branches. Remote
  activation failure, SSH cleanup, and build/archive error paths need focused
  tests before deployment automation is relied on.
- `src/core/ui/screen-media-recorder/ScreenMediaRecorder.js`: 57.78%
  statements and 45.81% branches. Stop, cancel, codec fallback, and size or
  duration limit paths remain the next video targets.
- Persistence and synchronization paths have useful coverage but still need
  failure and migration cases reviewed before thresholds are set.

The current browser project uses Vitest Browser Mode with Playwright and runs
the same smoke tests on Chromium, Firefox, and WebKit. WebKit covers the Safari
engine; testing the Safari application on an iPhone still requires a real Apple
device or a macOS/browser-cloud environment. The existing integration project
remains jsdom; browser coverage is provided by the separate `test:browser`
command and its dedicated test tree.

Coverage should guide missing behavior tests. It should not become a global
percentage target that encourages tests with little behavioral value.

## Deployment constraint

The hosting provider accepts password-based SSH deployment but does not accept
deployment SSH keys. The deployment workflow must therefore use a password
stored as a GitHub Secret.

The existing deployment entry point already reads platform-specific variables:

```text
LGS1920_PASSWORD_STAGING
LGS1920_PASSWORD_PRODUCTION
LGS1920_PASSWORD_TEST
```

The password must never be committed, printed, passed in a command-line
argument, or written to a build artifact.

## Environment configuration

Environment values must be classified before the workflow is implemented.

### Build-time values

Values required by the Vite build may be provided to the workflow through
environment variables or GitHub environment secrets. Any `VITE_*` value is
embedded in the browser bundle and must be treated as public configuration.
It must never contain a private credential.

### Deployment credentials

SSH passwords and any GitHub write token required by the existing deployment
tag flow belong in the GitHub `staging` or `production` environment. They must
not be stored in repository files.

### Backend runtime values

Backend runtime configuration belongs outside versioned releases in the
platform-specific shared environment file:

```text
shared/backend.env
```

The file must remain protected with a `700` directory and `600` file mode. It
must not be included in `dist` or in the release archive. PM2 must reload the
environment with `--update-env` after a backend deployment.

The first workflow should deploy Studio only. Backend deployment should be
added after the workflow has proven that shared environment handling works for
the selected platform.

## GitHub Actions workflow

The deployment flow should be separate from pull request validation while
sharing the same quality gates.

### Staging

The first deployment workflow should be manually triggered for `staging`.
It should:

1. Check out the selected commit.
2. Install Bun and the private package dependencies.
3. Run the test, lint, typecheck, and build gates.
4. Load the staging deployment password from the GitHub environment.
5. Run `bun run deploy -- --staging` from the Studio repository.
6. Check the deployed Studio URL over HTTPS.
7. Report the deployed commit and release version in the workflow summary.

The current transfer implementation uses password-based SCP through `sshpass`.
The first implementation may keep that behavior if the GitHub runner provides
the required command. A later hardening step should transfer the archive over
the existing SSH2 connection instead of invoking a password-bearing helper
process.

### Production

Production should use a separate GitHub `production` environment with:

- a separate deployment password;
- a branch or tag restriction;
- manual approval before the deployment job starts;
- serialized deployments for the same target;
- a post-deployment health check.

Production must not deploy automatically on every push to the development
branch.

Production should be associated with a GitHub Release. The release tag is the
immutable source reference used by the production workflow. A release can be
created from the command line with a deployment release mode:

```bash
bun run deploy -- --prod --release
```

The release mode should:

1. Read the Studio version from `public/version.json`.
2. Create a tag such as `v1.0.0` on the selected commit.
3. Create and publish the GitHub Release with generated notes.
4. Stop after creating the release; it must not deploy directly from the local
   machine.

Publishing the release triggers the production workflow:

```yaml
on:
  release:
    types: [published]
```

The workflow then runs the quality gates, waits for the protected `production`
environment approval, deploys with the production password, and performs the
health check. A release command must reject an already-used version unless the
operator explicitly handles that release first.

The existing deployment tags such as `production-1.0.0-<branch>-<date>` must
not be created by a release-based production deployment. The GitHub Release
tag is the authoritative production reference.

## Release activation and rollback

The existing remote release model should be preserved:

```text
upload archive
    -> extract versioned release
    -> verify required files
    -> switch current atomically
    -> restart PM2 when deploying Backend
    -> run health check
```

The previous release must remain available so that `current` can be switched
back if the health check or runtime verification fails. A deployment failure
must never leave `current` pointing to a partially extracted release.

## Acceptance criteria

- Coverage can be generated locally and in CI.
- Coverage output does not contain credentials.
- Staging Studio can be deployed manually with password authentication.
- The deployment password is available only to the deployment job.
- The release archive contains no backend secrets.
- The deployed staging URL responds successfully after activation.
- A failed activation leaves the previous release available.
- Production requires an explicit protected-environment approval.
- The local deployment command remains usable while the workflow is being
  validated.

## Recommended order

1. Establish the coverage baseline.
2. Add and test the staging deployment workflow.
3. Add the staging health check.
4. Test rollback with two releases.
5. Add Backend deployment and shared environment transfer.
6. Add the production release mode and release-triggered workflow.
7. Enable protected production deployment.

## Command interface

The local and GitHub deployment commands should remain distinguishable:

```bash
bun run deploy -- -t                 # direct local test deployment
bun run deploy:action -- -t          # manually trigger the GitHub test workflow
bun run deploy:action -- -s          # manually trigger the GitHub staging workflow
bun run deploy -- --prod --release   # create a GitHub Release for production
```

The release mode requires an authenticated GitHub CLI session when it is run
locally. The production deployment password remains a GitHub environment
secret and is never required by the release creation command.
