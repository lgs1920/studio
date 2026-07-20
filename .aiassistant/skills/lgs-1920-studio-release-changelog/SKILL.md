---
name: lgs-1920-studio-release-changelog
description: Prepare LGS1920 release notes, changelog entries, README updates, version validation, and release-ready documentation from implemented changes and closed issues.
---

# Release Changelog

Use this skill when preparing a commit, release, or changelog update. Inspect the current diff, existing README and changelog conventions, package version, and related tests first.

Workflow:

1. Group changes by user-facing capability, fixes, reliability, and technical maintenance.
2. Describe outcomes clearly and avoid implementation-only noise unless it affects users or maintainers.
3. Link closed issues using the repository's existing format and distinguish shipped features from known issues.
4. Update the required project documentation with the current date and preserve existing sections.
5. Check that wording matches the actual diff and that version or beta labels are consistent.
6. Run relevant validation and report remaining uncommitted changes without altering unrelated work.

Do not invent features, issue numbers, dates, or compatibility claims. Follow the repository commit key format when a commit is explicitly requested.
