---
name: lgs-1920-studio-release-changelog
description: Prepare LGS1920 release changelogs, README updates, version validation, and release-ready documentation from implemented changes and repository issues.
---

# Release Changelog

Use this skill when preparing or revising a release changelog. For routine commit
preparation, use `lgs-1920-studio-git-commit-quality`.

Read [PROJECT_RULES.md §7](../../PROJECT_RULES.md#7-release-changelog-workflow)
for the shared public changelog's dates, application identifiers, four required
sections, repository ordering, issue selection, display limits, and search or
compare links. These are the canonical rules. Historical formatting is not
authoritative where it conflicts.

## Workflow

1. Inspect the requested release scope, package version, current diff, existing
   changelogs, and issue data from the owning repositories.
2. Determine the exact target version and the previous release boundary from
   verified repository evidence. Do not invent versions, references, dates,
   issue numbers, release membership, or user-facing outcomes.
3. Locate the current draft under `public/assets/changelog/`. Create it
   automatically when absent. For an existing target changelog, update it only
   when the user explicitly requests a revision. Do not overwrite an existing
   changelog merely to normalize historical formatting.
4. Apply the canonical filename and current-release date rules. Inspect the
   nearest changelog in the same release line for compatible heading levels,
   title style, and blank lines. The first heading identifies the release and
   its user-facing theme. Do not add a generated date line unless the established
   pattern includes one. Retain only the current draft for the release line;
   never delete published changelogs or rewrite their dates.
5. Describe implemented improvements and fixes in `New Features and Improvements`.
   Build `Closed Issues` from verified owning-repository data. Keep
   `Remaining Bugs` and `Remaining Features` as filtered GitHub search links,
   not lists of individual open issues. Retain all four required section headings
   and omit only application headings without matching entries.
6. Preserve issue titles' meaning, correct only obvious formatting errors, and
   link moved issues using their final owning URLs. Never create or include a
   Studio mirror of a Site or Backend issue. Report legacy mirrors separately;
   any authorized mirror-removal migration follows `PROJECT_RULES.md`.
7. Update other project documentation only when required by the changed behavior.
   `COMMIT_HISTORY.md` is maintained by the GitHub workflow; do not edit it
   during routine commit or release preparation.
8. Verify wording, release identifiers, dates, ownership, ordering, caps, and
   links against the canonical rules and collected evidence. Run relevant
   validation and report remaining uncommitted changes and unresolved evidence.

Follow the repository commit key format when a commit is explicitly requested.
Preserve unrelated work and report ambiguous ownership or release membership
instead of guessing.
