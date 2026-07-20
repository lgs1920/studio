---
name: lgs-1920-studio-git-commit-quality
description: Prepare high-quality LGS1920 Git commits by checking scope, preserving unrelated work, grouping changes, validating tests, and applying the repository commit convention.
---

# Git Commit Quality

Use when reviewing, splitting, or preparing commits. Inspect `git status`, the full diff, recent commit style, and required documentation updates before staging anything.

Workflow:

1. Separate user changes from unrelated or pre-existing work.
2. Group one coherent topic per commit and inspect staged content before committing.
3. Use the key format `feat`, `fix`, `refactor`, `docs`, `style`, `test`, or `chore`.
4. Run relevant tests, lint, and build checks before committing.
5. Update required README and changelog documentation when the repository workflow requires it.
6. Report the exact commit scope and remaining working-tree changes.

Never reset, checkout, or discard user changes without explicit authorization. Never commit secrets, generated noise, or unrelated modifications.
