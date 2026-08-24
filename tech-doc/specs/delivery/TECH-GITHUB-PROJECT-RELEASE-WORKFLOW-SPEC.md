# GitHub Project Release and Branch Workflow

## Purpose

This specification defines the current operating model for planning, developing,
testing, versioning, and releasing LGS1920 Studio work through GitHub Projects,
issues, pull requests, branches, milestones, tags, and releases.

The model keeps product planning in one organization project while separating
workflow state from release targeting. A release is represented by a milestone
or target-release value, not by a project status or a long-lived development
branch.

## Scope

This specification applies to the LGS1920 organization project and the
`lgs1920/studio` repository. The organization project may also contain related
backend and website work. Repository-specific milestones remain useful for
issue tracking, while the project-level target release provides a shared view
when a delivery spans multiple repositories. Repository milestones are retained
as legacy metadata during the migration, but they are not required for new
planning work.

## Project configuration

The project uses one shared project with a small set of stable views. Old
release-specific views may remain available for historical reference, but new
releases should not require creating a new project.

### Status field

The `Status` field describes the delivery workflow only. It must not contain a
version number.

The supported statuses are:

| Status | Meaning |
| --- | --- |
| `Triage` | New work that still needs clarification, ownership, or prioritization. |
| `Backlog` | Accepted work that is not ready to start. |
| `Ready` | Scoped work with acceptance criteria and a target release. |
| `In Progress` | Work actively being implemented. |
| `Review` | A pull request is open and awaiting review or requested changes. |
| `QA` | Automated or manual validation is in progress. |
| `Blocked` | Work cannot continue until an explicit dependency or decision is resolved. |
| `Done` | The work is complete and the associated pull request is merged. |

### Target release field

The `Target release` single-select field identifies the intended product
release across repositories and is the project-level source of truth:

- `Unplanned`
- `1.0.0-beta.4`
- `1.1.0`
- `1.2.0`
- `1.3.0`

The field also contains legacy release values copied from existing milestones
so that historical planning information is not lost during migration. New
release values must be added only when a release is approved. New issues should
use `Target release` directly and should not require a repository milestone.

### Existing project metadata

The following metadata remains authoritative for its existing purpose:

- `Priority` expresses urgency or product importance.
- `Labels` express type and area.
- `Milestone` preserves repository-level historical associations during the
  migration and is optional for new planning work.
- `Repository` identifies the owning repository.
- `Linked pull requests` connects planning work to implementation.
- `Parent issue` and `Sub-issues progress` express hierarchy and decomposition.

Versions must not be encoded again in labels or statuses when `Target release`
already provides that information.

## Project views

The project should expose the following stable operational views:

| View | Layout | Filter intent |
| --- | --- | --- |
| `Inbox / Triage` | Board | Items with `Status: Triage`. |
| `Product backlog` | Board | Items with `Status: Backlog`. |
| `Delivery flow` | Board | All items except `Done`, grouped by workflow state. |
| `Current release - 1.0.0-beta.4` | Board | Current release items except `Done`. |
| `Next release - 1.1.0` | Board | Next release items except `Done`. |
| `Roadmap` | Roadmap | Planned items for `1.1.0`, `1.2.0`, and `1.3.0`. |
| `QA / Release` | Board | Items with `Status: Review` or `Status: QA`. |

The active release view is updated when a new release enters stabilization. The
previous active-release view may then be retained as a historical view or
archived through the GitHub interface after validation.

The current release view must include all unfinished items for the release,
including triage and backlog items. Excluding them hides unfinished scope and
weakens release readiness tracking.

## Issue and pull request lifecycle

1. An issue starts in `Triage` with a clear context, requested behavior, and
   acceptance criteria.
2. During triage, the owner, labels, priority, repository, and target release
   are completed. The repository milestone is also set when applicable.
3. Accepted but unscheduled work moves to `Backlog` and keeps
   `Target release: Unplanned`.
4. Work selected for a release moves to `Ready` after its scope and acceptance
   criteria are reviewable.
5. Implementation takes place on a short-lived branch linked to one issue or a
   deliberately grouped set of issues.
6. Opening a pull request moves the project item to `Review`. The pull request
   must link the issue and describe tests, risks, and user-visible changes.
7. After review approval, the item moves to `QA`. The pull request is merged
   only after the required checks pass.
8. The item moves to `Done` only after the pull request is merged and the
   release or deployment consequence is known.

## Branch strategy

The repository uses the following branch names:

| Branch pattern | Purpose | Lifetime |
| --- | --- | --- |
| `main` | Releasable integration branch. | Permanent. |
| `feature/issue-<number>-<slug>` | New functionality. | Short-lived. |
| `fix/issue-<number>-<slug>` | Bug fix or regression fix. | Short-lived. |
| `docs/issue-<number>-<slug>` | Documentation-only change. | Short-lived. |
| `chore/issue-<number>-<slug>` | Maintenance work. | Short-lived. |
| `release/<version>` | Release stabilization and release-only fixes. | Temporary. |
| `hotfix/<version>-<slug>` | Urgent fix derived from a released version. | Short-lived. |

Long-lived branches named only after a version should not be created for new
development. The existing `1.0.0-beta.4` branch is treated as a transitional
release branch until that release is completed.

Feature, fix, documentation, and maintenance branches are created from
`main`, unless the change is explicitly a release or hotfix correction. A
release branch accepts only stabilization changes and must be merged back into
`main` after release.

## Version and release strategy

Git tags identify deployable source states. The preferred tag format is:

```text
v<semantic-version>
```

Examples:

- `v1.0.0-beta.4`
- `v1.0.0-rc.1`
- `v1.0.0`
- `v1.1.0`

Each deployable tag should have one corresponding GitHub Release. Beta and
release-candidate releases are marked as pre-releases. Stable releases are
published as normal releases with generated or reviewed release notes.

Staging deployments should be identified by their commit SHA, deployment
environment, build metadata, and artifact. Repeated staging deployments should
not create permanent Git tags. Existing staging tags must be reviewed before
any cleanup; no tag deletion is implied by this specification.

Build metadata should make the source ref, version, branch, commit SHA, and
build date recoverable from the deployed artifact. The release process must be
able to reproduce a release from its tag without depending on uncommitted local
changes.

## Release readiness checklist

Before publishing a release:

- all planned release items are either `Done` or explicitly deferred;
- all release pull requests are merged;
- lint, unit tests, integration tests, and the production build pass;
- `public/version.json` and `public/build.json` identify the intended source;
- the release tag points to the exact commit being deployed;
- deployment metadata records the version, branch, commit, and build date;
- release notes identify user-visible changes, fixes, known limitations, and
  migration notes when applicable;
- the previous release remains available for rollback.

## Governance rules

- Do not create a new project for every version.
- Do not use a version as a workflow status.
- Do not assign a release target before the issue is sufficiently understood.
- Do not merge unrelated work into a release branch.
- Do not publish a tag from a dirty working tree.
- Do not delete historical branches, views, or tags without an explicit cleanup
  decision and a verified replacement for any required audit information.
- Every implementation issue must be linked to its pull request.
- Every feature or fix must include relevant automated tests according to the
  repository rules.

## Migration notes

The project configuration can be migrated without moving existing items. The
status renames preserve the purpose of the existing values, while new statuses
are available for future work. The `Target release` value has been copied from
the milestone on all 245 project elements that had a milestone. The release
views now filter on `Target release` rather than `Milestone`.

The original milestones have not been removed yet. They should remain until
the migration has been reviewed and any repository-level reporting or release
history depending on them has been replaced.

The repository branch and release protections remain a repository-settings
concern. They should be enabled in a separate controlled change after the CI
checks required by the release checklist are available.
