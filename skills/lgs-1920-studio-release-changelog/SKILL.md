---
name: lgs-1920-studio-release-changelog
description: Prepare LGS1920 release changelogs, commit history entries, README updates, version validation, and release-ready documentation from implemented changes and repository issues.
---

# Release Changelog and Commit History

Use this skill when preparing a release changelog, commit, or commit history update. Inspect the current diff, existing README and commit history conventions, package version, target release, repository issue data, and related tests first.

## Changelog file and header rules

- Store release files in `public/assets/changelog/`.
- Use the exact filename `YYYYMMDD-<version>.md`. `YYYYMMDD` is always today's execution date for the current draft and `<version>` is the exact version, including prerelease identifiers. At every creation or draft update, refresh the date in the filename and every applicable current-release date field to today. Rename the current draft when necessary, but never rewrite dates in published historical changelogs.
- If the target file is absent, create it automatically with today's date; do not wait for a separate file-creation request.
- Before creating a file, inspect the nearest existing changelog in the same release line. Preserve its heading level, title style, section spelling, and blank-line conventions. Existing historical files may use either `#` or `##`; new files must follow the closest applicable pattern rather than retroactively changing old files.
- The first heading must identify the release and its user-facing theme. Use the established repository pattern, for example `## Replay, HQ Video Export, Widgets, and Map Providers`, followed by the release content. Do not add a generated date line unless the established pattern for the selected release line includes one.
- Keep only the current draft for each release line. After creating a newer draft, delete the previous draft changelog. Never delete a published release changelog.
- Never overwrite an existing target changelog. Update it only when the user explicitly asks for a revision.

## Issue source and ownership

- Treat `studio`, `site`, and `backend` as separate issue repositories. Attribute each issue to the repository that owns it and link to that repository's issue URL.
- For `site` and `backend`, build the release issue dataset from every issue closed on or after the date in the latest previous Studio changelog filename, including issues without a matching Project `Target release` or milestone. Apply the 10-issue display cap to the rendered list; when the cap is exceeded, the GitHub search link must expose the complete dataset.
- Never create or use a mirror issue in `studio` for a `site` or `backend` issue. If legacy mirrors are found, list them separately as migration data; do not include their duplicate numbers in release notes.
- For legacy cleanup, confirm the owning issue, remove references to the mirror from the owning issue and related documents, then delete only the confirmed mirror. Verify that no active issue still links to the deleted URL.
- Do not invent issue numbers, repository ownership, release membership, issue state, or user-facing outcomes. When ownership or release membership is ambiguous, report it instead of guessing.

## Changelog structure

Use the following logical structure, adapting section titles to the nearest existing changelog:

1. User-facing capabilities and improvements.
2. Fixes and reliability.
3. Closed issues, grouped by owning repository.
4. Remaining bugs, grouped by owning repository.
5. Remaining features, grouped by owning repository.
6. Technical enhancements and existing resource links.

For closed issues, render only repositories that have at least one issue. Display at most the 10 latest issues for each repository, sorted by descending issue number:

```markdown
## Closed Issues

### Studio

- [#123](https://github.com/lgs1920/studio/issues/123) Issue title

### Site

- [#456](https://github.com/lgs1920/site/issues/456) Issue title
```

Conditional links for dense release sections:

- When a repository has more than 10 closed issues for the release, render only its 10 latest issues and add a repository-specific GitHub issues search link listing all issues closed since the previous release version. Build the query from the verified previous-release boundary and repository ownership filter used for the list.
- When a repository has 10 or fewer closed issues, render all of them and do not add a closed-issue search link.
- When a repository has more than 10 entries in `New Features and Improvements`, render the complete list and add that repository's GitHub compare link from the previous release reference to the current release reference. Use verified version tags, commit references, or release references; for Site, use verified commit or release references because Site has no version number. Do not fabricate a compare reference.

Apply the same repository grouping to `Remaining Bugs` and `Remaining Features`. Omit a repository heading and its entries when that repository has no issue in the category. Omit the category heading entirely when no repository has an issue in that category. Do not render empty headings, placeholder text, or empty lists.

Use consistent repository labels (`Studio`, `Site`, `Backend`) and preserve the issue title's meaning while correcting only obvious formatting errors. Closed issues belong under the repository where they were closed; an issue moved between repositories must be listed using its final owning URL.

Workflow:

1. Determine the exact target version and set the current draft date, filename date, and every applicable current-release date field to today's execution date.
2. Inspect the nearest existing changelog and create the target file if necessary, matching its filename and header conventions.
3. Inspect the current diff and issue data from `studio`, `site`, and `backend`. Separate shipped outcomes, closed issues, remaining bugs, and remaining features.
4. Group every issue by owning repository, sort each repository's issues by descending issue number, display at most 10, and apply the conditional-link rules above. Add the closed-issue search link only when a repository exceeds 10 issues.
5. Group changes by user-facing capability, fixes, reliability, and technical maintenance. Describe outcomes clearly and avoid implementation-only noise unless it affects users or maintainers. Add a verified previous-to-current GitHub compare link when a repository exceeds ten improvement entries.
6. Link issues using their owning repository URLs and distinguish shipped features from remaining issues. Never include mirror issue links.
7. Update the required project documentation and `COMMIT_HISTORY.md` with the current date, preserving existing sections.
8. Check that wording matches the actual diff, issue state, repository ownership, and version or beta labels.
9. Run relevant validation and report remaining uncommitted changes without altering unrelated work.

Do not invent features, issue numbers, dates, or compatibility claims. Follow the repository commit key format when a commit is explicitly requested.
