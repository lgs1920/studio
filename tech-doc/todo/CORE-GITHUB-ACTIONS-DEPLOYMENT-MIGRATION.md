# GitHub Actions Deployment Migration Study

Status: proposal pending validation

Date: 2026-07-28

## Purpose

This document studies the migration of the LGS1920 Studio deployment from a
developer-controlled local command to GitHub Actions.

It compares two implementation strategies:

1. GitHub Actions orchestrates the existing deployment script
2. GitHub Actions owns the complete deployment workflow and the current script
   is progressively replaced

The document also explains how the migration relates to the Draft/HQ replay
rendering architecture described in
[`CORE-REPLAY-RENDER-MODE-ARCHITECTURE.md`](../specs/replay-video/CORE-REPLAY-RENDER-MODE-ARCHITECTURE.md).

The scope is the Studio application. The current deployment class also
contains backend-specific behavior, but backend migration should be treated as
a separate workflow or as a coordinated follow-up with the backend repository.

## Executive recommendation

Adopt a staged migration.

The first production-ready step should use GitHub Actions as an orchestrator
around a hardened version of the existing deployment logic. This limits the
initial change surface while moving execution, credentials, approvals, and
traceability to GitHub Actions.

The long-term target should be a workflow-owned deployment pipeline, but not a
large collection of untested shell commands embedded directly in YAML. The
deployment behavior should first be split into small, testable operations that
can be called by the workflow:

- build and validate
- prepare environment metadata
- package the immutable release
- upload the release
- activate the release atomically
- verify the deployment
- record the release

The current release layout and `current` symbolic-link strategy should be
preserved. It already provides a useful foundation for atomic activation and
rollback.

The migration must not mix deployment migration with the implementation of the
Draft/HQ render-mode contract. GitHub Actions can validate and deliver the
rendering code, but it does not replace the browser-side replay scheduler,
Cesium output adapter, live recorder, or deferred HQ exporter.

## Current baseline

### Local entry point

The current package scripts expose:

```json
{
  "build": "bun run test:stores && bunx --bun vite build",
  "deploy": "bun deploy.js",
  "lint": "eslint . --ext js,jsx,ts,tsx --report-unused-disable-directives --max-warnings 0",
  "test": "vitest run"
}
```

The deployment is normally started locally with one platform flag:

```bash
bun run deploy -- --staging
bun run deploy -- --prod
bun run deploy -- --test
```

The product is inferred from the current working directory. This is convenient
for a developer, but it is implicit state that should not remain part of the
CI contract.

### Current deployment sequence

The deployment class currently performs the following operations:

1. Read `deployment/deploy.yml`.
2. Read the Studio version from `public/version.json`.
3. Determine the current branch.
4. Run `bun run build`.
5. Create a deployment tag and commit through `simple-git`.
6. Add deployment metadata such as `branch.json`, `servers.json`, and
   `build.json`.
7. Update the service worker and manifest for the selected platform.
8. Create a versioned ZIP archive.
9. Copy the archive to the remote server with SCP.
10. Extract it into the versioned release directory.
11. Update the remote `current` symbolic link.
12. Run backend-specific PM2 actions when the product is the backend.
13. Push the branch and deployment tag.

The remote directory model is conceptually:

```text
/home/www/lgs1920/<platform>/<product>/
├── current -> releases/<version>
└── releases/
    ├── <version-a>/
    ├── <version-b>/
    └── <version-b>.zip
```

The exact path and server remain configuration values. They must not be
duplicated in multiple workflow files.

### Existing strengths to preserve

The migration should retain these properties:

- release directories are versioned
- the active release is selected through a stable `current` link
- an upload or extraction failure does not need to replace the current release
- staging, test, and production are explicit deployment targets
- the build contains version, branch, server, and build-date information
- the backend can be restarted after activation when applicable
- a release can be identified from the source version and deployment context

### Existing risks to resolve

The current implementation has several characteristics that are unsuitable as
the final CI security and reliability model:

- SSH authentication uses a platform password and `sshpass`
- SCP disables host-key verification with `StrictHostKeyChecking=no`
- the deployment class mutates Git state by creating a commit and tag
- the deployment class pushes the branch as part of a successful deployment
- the product and local path are inferred from the current working directory
- remote shell commands interpolate paths and should be validated and safely
  quoted
- a full deployment build is currently coupled to the upload process
- `bun run build` runs the store contract test, but it does not run the full
  Vitest suite or lint automatically

These risks exist independently of GitHub Actions. Moving the same script to a
runner without addressing them would improve centralization but would not by
itself produce a secure deployment system.

## Relationship with the Draft/HQ replay architecture

The replay architecture is a runtime rendering architecture, not a server
deployment architecture.

Draft Mode and HQ Mode execute in the application and must share the same
renderer-independent logical frame, camera-pose resolution, crop contract,
widget visibility rules, replay phases, and final-frame semantics. GitHub
Actions cannot make those two paths visually equivalent. That equivalence must
be implemented and tested in the Studio source code.

GitHub Actions can support the architecture in four ways:

1. Run deterministic unit and integration tests for the shared replay frame
   contract.
2. Run the build that packages the current replay implementation.
3. Optionally run browser-based smoke tests for the Draft recorder and HQ
   preparation path.
4. Prevent an unvalidated replay change from reaching staging or production.

The deployment pipeline must therefore treat the render-mode contract as a
quality gate, not as a deployment responsibility.

The relevant validation target is parity of the composed frame before video
encoding. The pipeline must not require Draft and HQ to produce byte-identical
encoded media, because codec and bitrate behavior are intentionally outside the
shared visual contract.

## Migration goals and non-goals

### Goals

- make deployments reproducible from a commit or release tag
- remove the dependency on a developer workstation for deployment execution
- protect production with explicit GitHub environment approval
- preserve versioned releases and atomic activation
- make the build artifact visible and downloadable from the workflow
- make failed deployments observable without hiding the previous release
- establish a tested rollback operation
- run replay-contract validation before deployment
- keep render mode separate from output profile and deployment environment
- provide a clear path to migrate the backend later

### Non-goals

- moving replay rendering to GitHub-hosted servers
- making Draft Mode temporally deterministic
- replacing Cesium with a server-side renderer
- making encoded Draft and HQ media byte-identical
- changing the Studio runtime environment
- changing the release-directory layout without a separate migration
- introducing a cloud hosting migration as part of this work

## Strategy A — GitHub Actions orchestrates the existing deployment script

### Definition

In Strategy A, GitHub Actions performs the validation, selects the target
environment, provides credentials, and invokes a deployment entry point. The
existing release operations remain in JavaScript.

The first version should not invoke the current implementation unchanged. A
small compatibility refactor is required because a CI runner has different Git
and security semantics from a developer workstation.

### Required compatibility refactor

The deployment API should receive explicit values rather than infer them:

```js
new Deployment({
  product: 'studio',
  platform: 'staging',
  sourceRef: process.env.GITHUB_SHA,
  sourceBranch: process.env.GITHUB_REF_NAME,
  releaseVersion: process.env.RELEASE_VERSION,
  releaseDate: process.env.RELEASE_DATE,
})
```

The exact API is illustrative. The important properties are:

- product is explicit
- platform is explicit
- source commit is explicit
- branch and tag metadata are explicit
- release date is generated once by the workflow or deployment process
- no working-directory inference is required

The deployment script should also support a CI mode with these rules:

- do not create an empty or unrelated Git commit
- do not push the source branch as a side effect of deployment
- do not create a tag until the remote release is verified, or accept a tag
  created before the workflow and use it as the immutable source ref
- do not delete an existing release unless its exact version was created by
  the current run and the operation is explicitly part of cleanup
- return a non-zero exit code for every failed build, transfer, extraction,
  activation, or verification step

The safest release model is to deploy an already identified source ref and tag
that ref only after successful verification. It is not safe for a deployment
job to alter the branch that triggered it.

### Workflow shape

An illustrative workflow could be structured as follows:

```yaml
name: Deploy Studio

on:
  workflow_dispatch:
    inputs:
      platform:
        required: true
        type: choice
        options:
          - test
          - staging
          - production
      ref:
        required: true
        type: string

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-bun
      - install-dependencies
      - run: bun run test
      - run: bun run lint
      - run: bun run build

  deploy:
    needs: validate
    environment: ${{ inputs.platform }}
    runs-on: ubuntu-latest
    steps:
      - checkout-ref
      - setup-bun
      - install-dependencies
      - configure-ssh
      - run: bun run deploy -- --platform ${{ inputs.platform }} --product studio --ci
```

The action names in this example are placeholders. The real workflow must use
approved, pinned action references and must not pass secrets on the command
line.

### Authentication model for Strategy A

Password authentication should be considered transitional only. The preferred
model is:

- a dedicated deployment SSH key
- a dedicated remote account or restricted deployment account
- a restricted authorized-key command or deployment directory where practical
- a repository or environment secret containing the private key
- a repository or environment secret containing the expected host key
- strict host-key verification enabled in the runner
- separate credentials for test, staging, and production

The workflow should configure `known_hosts` from a reviewed value. It must not
use `StrictHostKeyChecking=no`.

GitHub's token should be scoped separately from the server credential. A
deployment that only reads the repository should have read-only contents
permission. Tag creation, if retained, should be isolated in a separate step
with the smallest required permission.

### Advantages

- smallest initial implementation surface
- existing remote release behavior remains available
- lower operational risk during the first migration
- easy fallback to the local command while the workflow is validated
- JavaScript remains the place where deployment logic is tested and reviewed
- fastest way to obtain CI logs, protected environments, and repeatability

### Disadvantages

- the deployment script keeps responsibilities that are difficult to observe
  independently
- the final artifact remains coupled to the script's local preparation flow
- Git mutation and remote operations are still mixed unless refactored
- the workflow may hide deployment behavior behind one opaque command
- local and CI execution can diverge if CI-specific flags are not tested
- a future migration to another CI provider would still depend on the script's
  current assumptions

### When Strategy A is appropriate

Strategy A is appropriate when the immediate priority is to remove local
deployment dependency with minimal disruption, especially before the replay
render-mode architecture has finished validation.

It is not the best final shape if the project requires independently reusable
build artifacts, multiple deployment consumers, rich rollback control, or
separate deployment permissions for packaging and activation.

## Strategy B — GitHub Actions owns the complete deployment workflow

### Definition

In Strategy B, the workflow explicitly controls validation, artifact creation,
transfer, activation, verification, and release recording. The current
`Deployment` class is removed or reduced to reusable libraries.

The workflow becomes the visible release process, while complex logic remains
in tested scripts or composite actions.

### Target workflow shape

The recommended target is a job graph with clear boundaries:

```text
source ref
    |
    v
quality gates
    |
    v
build once
    |
    v
immutable release artifact
    |
    +--> deploy test
    |
    +--> deploy staging
    |
    +--> production approval
             |
             v
       activate and verify
             |
             v
       record release ref
```

The artifact should be built once for a source ref and promoted whenever the
environment contract permits it. If environment-specific files must differ,
that difference must be made explicit rather than silently rebuilding the
application.

### Main implementation steps

#### 1. Separate validation from deployment

Add an explicit CI quality command or equivalent workflow steps for:

- dependency installation from the lockfile
- full unit and integration test execution
- lint execution
- Vite production build
- replay-specific contract tests
- optional browser smoke tests

The current `build` script only includes the store contract test before the
Vite build. The workflow must call the full test and lint commands explicitly
until the project defines a dedicated quality script.

#### 2. Build a release manifest

Create one manifest for each artifact containing at least:

- source commit SHA
- source branch or tag
- Studio version
- build timestamp
- target output profile, if applicable
- artifact checksum
- workflow run identifier

The manifest should be generated once and copied into the package. Existing
`branch.json`, `build.json`, and `version.json` behavior should be normalized
instead of being produced by unrelated steps.

#### 3. Separate application content from environment configuration

The current deployment preparation writes platform-dependent values into the
distribution, including server configuration and the Studio manifest.

The migration must decide which values are:

- immutable application content
- environment metadata
- runtime configuration

The preferred design is to keep the application artifact immutable and inject
only environment metadata at a controlled boundary. If a static file must be
different for staging and production, the workflow must declare that as an
explicit packaging step and record the resulting artifact identity.

#### 4. Package and checksum the artifact

The packaging step should:

- create a deterministic archive where practical
- validate the expected files such as `index.html` and
  `manifest.webmanifest`
- calculate a SHA-256 checksum
- upload the archive as a workflow artifact
- retain the artifact for the configured retention period

The archive must not contain secrets. Server credentials belong to the
workflow environment and never to `dist`.

#### 5. Transfer without disabling host verification

The transfer step should use a dedicated SSH key and a reviewed host key.

The remote target must be derived from validated configuration. The workflow
must reject unsupported platform, product, release-version, or path values
before opening the SSH connection.

#### 6. Activate atomically

The remote activation sequence should remain conceptually:

```text
upload archive
    |
    v
extract into a new version directory
    |
    v
validate release contents
    |
    v
switch current symlink
    |
    v
run service restart when required
    |
    v
run health checks
```

The current link must not change until extraction and release validation have
completed successfully.

#### 7. Verify before recording success

Verification should include:

- remote release directory exists
- expected files are readable
- `current` resolves to the intended version
- Studio endpoint returns a successful response
- the served `build.json` or equivalent manifest matches the source ref
- service-worker and cache metadata are consistent with the release
- backend health checks pass when backend deployment is included

Only after verification should the workflow create or publish a deployment
record or release tag.

#### 8. Add rollback as a first-class operation

Rollback should be a manual workflow operation accepting a known release
version. It should:

- validate that the release directory exists
- switch `current` to that release
- restart the backend only when required
- run the same health checks as a forward deployment
- record the rollback run and source release

Rollback must never rebuild the application.

### Advantages

- each deployment phase is observable and independently retryable
- the build artifact can be promoted without rebuilding
- permissions can be separated between validation, packaging, and production
  activation
- rollback can be a dedicated and auditable operation
- remote commands can be reduced, validated, and tested explicitly
- the workflow expresses the release policy directly
- the deployment script no longer needs to mutate or push Git state
- the same artifact can be used for repeatable environment promotion

### Disadvantages

- larger initial refactor and higher migration cost
- greater responsibility for workflow design and maintenance
- more interfaces between jobs, artifacts, secrets, and remote scripts
- more care is required for environment-specific static configuration
- partial failures need explicit retry and cleanup behavior
- workflow YAML can become difficult to maintain if logic is not extracted
  into scripts or composite actions
- rollback, retention, health checks, and release records must all be designed
  instead of relying on the current script's implicit behavior

### When Strategy B is appropriate

Strategy B is appropriate after the first workflow has demonstrated stable
staging and production deployments, and when the team is ready to own a proper
artifact-promotion and rollback model.

It should not be implemented as a single large YAML rewrite. The risky part is
not moving commands from JavaScript into YAML, it is making the release
boundaries explicit and testable.

## Strategy comparison

| Concern | Strategy A: orchestrate existing script | Strategy B: workflow-owned deployment |
| --- | --- | --- |
| Initial effort | Low to medium | Medium to high |
| First migration risk | Lower | Higher |
| Deployment observability | Mostly one opaque step | Explicit job and step boundaries |
| Artifact promotion | Limited unless added | Natural target |
| Rollback | Must be added around existing script | First-class workflow operation |
| Git side effects | Must be removed from the script | Can be prohibited by design |
| Security improvement | Possible after script hardening | Easier to enforce centrally |
| Reuse outside GitHub Actions | Preserved | Requires a reusable deployment layer |
| Long-term maintainability | Acceptable transitional state | Better final architecture |
| Recommended timing | First migration | Second migration stage |

## Recommended target architecture

### Workflow responsibilities

The final workflow set should contain separate responsibilities:

#### Pull request quality workflow

Triggered by pull requests. It should run:

- dependency installation
- full tests
- lint
- production build
- replay render-contract tests
- optional browser smoke tests when the runner supports the required APIs

This workflow must never deploy.

#### Staging deployment workflow

Triggered by an approved branch update or manual dispatch. It should:

- deploy the exact source commit that passed quality gates
- use the `staging` environment
- publish the artifact and checksum
- activate the new release
- run smoke checks
- expose the release identifier in the workflow summary

#### Production deployment workflow

Triggered by a release tag or manual dispatch with an explicit source ref. It
should:

- require the `production` environment
- require an approval rule
- deploy the artifact already validated in staging when possible
- prevent concurrent production deployments
- run post-activation health checks
- record the deployment after successful verification

#### Rollback workflow

Triggered manually with a selected release version. It should not run the
build or test pipeline because it restores an existing immutable release. It
must still run activation and health checks.

### Environment and concurrency policy

Each GitHub environment should define its own:

- deployment credentials
- server host and path
- approval rules
- optional wait timer
- deployment protection rules

Deployments to the same target must be serialized. A second production run
must not switch `current` while a previous production run is still uploading,
extracting, or verifying.

An in-progress deployment should not be cancelled automatically after remote
activation has started. Cancellation at that point can leave an unknown
deployment state.

### Source reference policy

Every deployment must identify one immutable source reference:

- a commit SHA for test and staging
- a release tag pointing to a commit SHA for production

The workflow must not deploy the mutable state of a moving branch without
recording the resolved SHA.

The deployment process must not create a commit merely to record a deployment.
The workflow run, artifact manifest, and deployment tag or release record are
the appropriate places for deployment metadata.

### Render-mode quality gates

The deployment pipeline should verify the replay architecture in layers:

1. Pure tests for logical replay frame and camera-pose resolution.
2. Parity tests proving Draft and HQ resolve the same composed frame state.
3. Tests proving Draft does not depend on Cesium flight or focus completion.
4. Warm HQ plan invalidation tests.
5. Final-frame and stop-clip tests for both modes.
6. Browser smoke tests for the user-facing recording and export dialogs when
   the required browser environment is available.

The quality gate should assert the following contract:

```text
same logical frame
    -> same replay sample
    -> same camera pose
    -> same crop and geometry
    -> same widget visibility and ordering
    -> same composed scene state
    -> different scheduling or encoder behavior is allowed
```

The deployment environment must not become the source of replay timing. A
GitHub runner may execute tests, but the application itself must continue to
resolve trajectory and camera pose outside Cesium as required by the replay
architecture.

## Detailed migration plan

### Phase 0 — Baseline and decisions

Before changing deployment behavior:

1. Confirm the supported products and whether this migration covers Studio
   only or Studio and backend together.
2. Record the current staging and production release paths.
3. Perform one successful deployment and one documented rollback using the
   current process.
4. Record the current version, branch, commit, remote release, and served
   metadata.
5. Decide whether environment-specific files are part of the artifact or
   runtime configuration.
6. Define the production approval policy.

No workflow should be allowed to deploy until these decisions are recorded.

### Phase 1 — CI-only validation

Create a pull request workflow without deployment.

Minimum checks:

```bash
bun install --frozen-lockfile
bun run test
bun run lint
bun run build
```

The workflow should also upload the build output or a diagnostic artifact when
the build succeeds. This phase exposes missing dependencies, browser
assumptions, and replay-test gaps without introducing server risk.

### Phase 2 — Harden the deployment boundary

Refactor the current deployment class while keeping its local entry point
working.

Required changes:

- accept explicit product, platform, and source reference values
- remove branch pushing from the deployment operation
- remove deployment-created commits
- replace password-based SSH with key-based authentication
- enforce host-key verification
- validate remote paths and release versions
- separate build, package, transfer, activation, and verification methods
- add a dry-run mode that performs validation without activation
- make failures preserve the existing `current` release

Run the refactored code locally against test or staging before enabling Actions.

### Phase 3 — Strategy A on test and staging

Create a manual workflow that invokes the hardened deployment entry point.

The first workflow should target `test`, then `staging`. Production should not
be enabled in the same initial change.

For each run, verify:

- the runner uses the expected commit SHA
- the artifact version matches the source metadata
- the remote release directory is new
- `current` points to the new release only after extraction succeeds
- the previous release remains available
- the served manifest and cache metadata are correct
- the replay application starts and the rendering quality gates passed

### Phase 4 — Production enablement

Enable production only after multiple successful staging runs and one tested
rollback from a workflow-created release.

Production must require:

- a release tag or explicit immutable commit
- a protected GitHub environment
- an approval from an authorized maintainer
- serialized deployments
- post-deployment health checks
- a documented rollback command

### Phase 5 — Strategy B extraction

Once Strategy A is stable, extract the deployment operations into reusable
modules or scripts.

Suggested boundaries:

```text
deployment/
├── config/
├── package-release.js
├── validate-release.js
├── transfer-release.js
├── activate-release.js
├── rollback-release.js
└── verify-release.js
```

The names are illustrative. The actual modules should follow existing project
conventions and must include tests for validation, path construction, release
selection, and failure behavior.

The workflow should then call these operations explicitly. The local command
can remain as a compatibility wrapper until Strategy B has been proven.

### Phase 6 — Decommissioning decision

The local deployment command may be removed only when all of the following are
true:

- the workflow is the documented deployment path
- production rollback has been exercised
- no workflow step depends on an unreviewed local-only secret
- deployment logic is covered by tests
- artifact retention and release retention are sufficient
- the backend migration decision is recorded if the shared script remains in
  use by the backend repository
- the deployment documentation has been updated in a pull request

## File-level impact

### Existing files likely to change

- `package.json`
  - add explicit CI quality scripts when the command contract is agreed
- `deploy.js`
  - accept explicit options and provide a CI-safe entry point
- `deployment/Deployment.js`
  - remove Git mutation from deployment
  - harden SSH and remote command handling
  - split deployment phases
- `deployment/deploy.yml`
  - remain the canonical environment configuration, or be replaced by a
    validated configuration source
- `tech-doc/specs/delivery/DEPLOYMENT-README.md`
  - document the final current behavior after migration

### New files likely to be added

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `.github/workflows/rollback.yml`
- reusable deployment scripts or composite actions
- deployment-specific tests
- release manifest and rollback documentation

### Replay files affected indirectly

The deployment migration should not change replay behavior by itself. The
render-mode implementation may change the following files independently:

- `src/core/ui/replay/ReplayVideoRenderSpec.js`
- `src/core/ui/replay/ReplayOverlayResolver.js`
- `src/core/ui/replay/ReplayVideoRenderSession.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`
- `src/core/ui/replay/JourneyReplayVideoSync.js`
- `src/core/ui/screen-media-recorder/recorder/ScreenMediaRecorder.js`
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`

Those changes must pass the render-contract quality gates before a deployment
workflow can promote them.

## Security requirements

The following requirements are mandatory for the final design:

- do not store passwords in workflow files
- do not print secret values or command lines containing secrets
- do not use `sshpass` in the final workflow
- do not disable SSH host-key verification
- use separate credentials for test, staging, and production
- restrict GitHub token permissions to the minimum required scope
- protect production with environment approval rules
- validate all workflow inputs against an allowlist
- validate the source ref before deployment
- keep deployment commands safe when a version or path contains unexpected
  characters
- retain enough remote releases for rollback
- do not delete the active release during cleanup
- use immutable artifact checksums
- rotate deployment credentials and document the rotation procedure

For a server-based deployment, GitHub Actions OIDC may not remove the need for
SSH. It should still be evaluated for any future hosting provider or secret
broker that supports short-lived credentials.

## Failure and rollback behavior

The deployment must have a defined result for every failure point:

| Failure point | Required result |
| --- | --- |
| Quality gate | No artifact promotion and no server change |
| Build | No deployment attempt |
| Package checksum | No upload |
| Upload | Current release remains active |
| Extraction | Current release remains active and partial release is cleaned safely |
| Release validation | Current release remains active |
| Symlink switch | Report failure without deleting the previous release |
| Backend restart | Report degraded deployment and provide rollback path |
| Health check | Roll back automatically only if the rollback operation is proven safe, otherwise stop and require explicit rollback |
| Release recording | Do not report success if the deployment state cannot be identified |

Automatic rollback should not be enabled in the first production version unless
the health check is reliable and the remote activation operation is idempotent.
An explicit rollback workflow is safer during the initial migration.

## Cost and operational considerations

The build is currently a Bun/Vite build that includes Cesium assets. Runner
time and artifact size should be measured during Phase 1.

The study should record:

- dependency installation duration
- full test duration
- lint duration
- Vite build duration
- archive size
- upload duration
- extraction duration
- health-check duration
- total time to staging and production

Caching dependencies can reduce runtime, but cache keys must include the lockfile
and runtime version. A cache must never be treated as the release artifact.

If browser-based replay smoke tests require a graphical environment, they may
need a dedicated browser runner or a separately managed test environment. They
must not be silently omitted from the quality gate because the standard runner
cannot provide the required rendering APIs.

## Decision criteria

The project should choose Strategy A first if:

- the priority is rapid centralization of deployment
- the current release layout is trusted
- the team wants a low-risk transition
- the replay architecture is still under active implementation

The project should move to Strategy B when:

- artifact promotion is required
- rollback must be independently executable
- deployment permissions need to be separated
- the current script has become a maintenance bottleneck
- multiple products or repositories need a common deployment interface

The recommended decision is therefore:

```text
Strategy A for the first migration
    -> harden and observe the release process
    -> validate staging and production rollback
    -> extract reusable deployment operations
Strategy B as the long-term target
```

## Acceptance criteria

The migration is ready for production when:

- a workflow deploys the exact requested source SHA
- the workflow runs full tests, lint, and production build before deployment
- replay render-contract tests pass before promotion
- Draft/HQ parity is checked on composed frame state rather than encoded bytes
- the workflow does not depend on Cesium callbacks for logical replay timing
- production requires an explicit protected-environment approval
- secrets are stored in GitHub environments and are absent from logs
- SSH host verification is enabled
- deployment does not create or push unrelated source commits
- releases are versioned and activated through the `current` link
- failed upload and extraction leave the previous release active
- the deployed artifact exposes the expected source and build metadata
- a documented rollback workflow restores a previous release without rebuilding
- a production rollback has been tested successfully
- deployment documentation reflects the final implementation

## Open decisions

The following decisions require explicit project validation before implementation:

1. Should production deployment be tag-triggered, manually dispatched, or both?
2. Should the backend be migrated in the same program or in a separate workflow?
3. Which environment-dependent values can move from build-time files to runtime
   configuration?
4. How many releases should remain on the remote server?
5. Which browser-based replay tests are mandatory for the deployment gate?
6. Should deployment tags be created by GitHub Actions, or should production
   always start from a pre-existing release tag?
7. What is the required retention period for workflow artifacts and release
   manifests?

## Related documents

- [Replay render mode architecture](../specs/replay-video/CORE-REPLAY-RENDER-MODE-ARCHITECTURE.md)
- [Deployment specification](../specs/delivery/DEPLOYMENT-README.md)
- [Replay/video issue analysis](../specs/replay-video/JOURNEY-REPLAY-VIDEO-ISSUES.md)
- [Replay core documentation](../specs/replay-video/CORE-UI-REPLAY-README-REPLAY.md)
- [Screen media recorder](../specs/replay-video/CORE-SCREEN-MEDIA-RECORDER-RECORDER-README.md)
