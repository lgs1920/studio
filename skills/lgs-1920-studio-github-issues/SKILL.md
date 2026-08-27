---
name: lgs-1920-studio-github-issues
description: Manage LGS1920 GitHub issues and Project planning, including triage, issue templates, workflow status, target releases, milestone migration, project views, and issue-to-pull-request tracking. Use when creating, reviewing, triaging, updating, or planning issues in the LGS1920 organization Project.
---

# GitHub Issues and Project Workflow

Use this skill to keep issue metadata, the organization Project, branches, pull
requests, and releases aligned with the [GitHub Project release and branch
workflow specification](../../../tech-doc/specs/delivery/TECH-GITHUB-PROJECT-RELEASE-WORKFLOW-SPEC.md).

## Scope and source of truth

- Work in the LGS1920 organization Project used by the repository
  `lgs1920/studio` and related repositories.
- Keep one shared Project across releases. Do not create a Project per version.
- Use the Project `Status` field for delivery workflow only.
- Use the Project `Target release` field as the cross-repository source of truth
  for version planning.
- Keep issue and Project documentation in English, as required by the
  repository rules.
- Read `PROJECT_RULES.md` before creating or changing issues, and preserve
  unrelated working-tree changes.

## Create or update an issue

1. Clarify the request and ask for missing information before creating an issue.
2. Prepare the complete proposed issue and obtain explicit user validation before
   creating it. Do not create an issue from an unvalidated draft.
3. Select the repository template:
   - `.github/ISSUE_TEMPLATE/bug_report.md` for a bug or regression
   - `.github/ISSUE_TEMPLATE/feature_request.md` for a feature or improvement
4. Preserve the hidden issue-type marker in the template body:
   `<!-- issue-type: bug -->` or `<!-- issue-type: feature -->`.
5. Write an English title and body with context, requested behavior, observable
   acceptance criteria, and technical notes. For bugs, include reproducible
   actions, expected result, actual result, and reproducibility.
6. Add the issue to the organization Project before editing Project fields.
7. Set only fields that are known or explicitly requested: repository, assignee,
   labels, issue type, priority, target release, milestone, and status.
8. Re-read the issue and Project item after each mutation and report the final
   values.

## Project fields

Use these workflow statuses and meanings:

- `Triage`: new work needing clarification, ownership, or prioritization
- `Backlog`: accepted work that is not ready to start
- `Ready`: scoped work with acceptance criteria and a target release
- `In Progress`: active implementation
- `Review`: a pull request is open
- `QA`: automated or manual validation is in progress
- `Blocked`: an explicit dependency or decision prevents progress
- `Done`: the linked pull request is merged and the work is complete

Use these `Target release` options when available:

- `Unplanned`
- `1.0.0-beta.4`
- `1.1.0`
- `1.2.0`
- `1.3.0`

Add a new release option only after the release has been approved. Do not encode
versions in labels or statuses when `Target release` already contains them.

Treat `Milestone` as repository-level historical metadata during the migration:

- Do not require a milestone for a new issue when `Target release` is known.
- For an issue with a milestone, copy the exact milestone title to the matching
  `Target release` option when one exists.
- If there is no approved matching option, use `Unplanned` and report the
  mismatch rather than inventing a release value.
- Do not clear or delete milestones automatically. Keep them until the
  migration has been reviewed and dependent reporting has been checked.
- Do not overwrite an existing explicit `Target release` without comparing both
  values and reporting the conflict first.

## Issue and pull request lifecycle

1. Start a new issue in `Triage` with context, requested behavior, and
   acceptance criteria.
2. Complete ownership, labels, priority, repository, and `Target release` during
   triage. Use `Target release: Unplanned` for accepted work without a release
   commitment.
3. Move accepted unscheduled work to `Backlog`.
4. Move scoped work with testable acceptance criteria and a release target to
   `Ready`.
5. Use one short-lived branch per issue or deliberately grouped set of issues.
6. Link the pull request to the issue and move the Project item to `Review`.
7. Move the item to `QA` after review approval while validation runs.
8. Move the item to `Done` only after the pull request is merged and the release
   or deployment consequence is known.

Use these branch patterns:

- `feature/issue-<number>-<slug>` for new functionality
- `fix/issue-<number>-<slug>` for bugs and regressions
- `docs/issue-<number>-<slug>` for documentation-only changes
- `chore/issue-<number>-<slug>` for maintenance
- `release/<version>` for temporary release stabilization
- `hotfix/<version>-<slug>` for urgent fixes from a released version

Create feature, fix, documentation, and maintenance branches from `main`.
Reserve release branches for stabilization and merge them back into `main`.

## Project views

Preserve the stable operational views and their intent:

- `Inbox / Triage`: `Status: Triage`
- `Product backlog`: `Status: Backlog`
- `Delivery flow`: all items except `Done`, grouped by workflow status
- `Current release - 1.0.0-beta.4`: current release items except `Done`
- `Next release - 1.1.0`: next release items except `Done`
- `Roadmap`: planned items for `1.1.0`, `1.2.0`, and `1.3.0`
- `QA / Release`: items with `Status: Review` or `Status: QA`

Include unfinished triage and backlog items in the relevant release views. Do
not delete or rename historical views without explicit approval and a verified
replacement.

## Safe mutations and verification

- Inspect the current issue, Project item, fields, views, and existing values
  before writing.
- Use the connected GitHub integration for issue and pull request data. Use
  `gh` or the available Project API for Project v2 fields and views when the
  connector does not expose them.
- Batch Project item mutations in small groups. Keep batches at 20 items or
  fewer to avoid Project GraphQL resource limits encountered in practice.
- Before a bulk migration, state the deterministic mapping and its scope. Stop
  on missing release options or conflicting explicit values.
- Never delete issues, Project items, views, tags, branches, or milestones as
  part of routine triage.
- Do not commit or push repository changes unless the user explicitly asks.
- After mutations, re-read the affected items and report counts, skipped items,
  conflicts, and remaining legacy metadata.
