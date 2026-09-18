# LGS1920 shared agent guidance

This directory contains guidance shared by the LGS1920 repositories. The
shared baseline is `PROJECT_RULES.common.md`. Shared skills live under
`skills/`. Each repository keeps its own project-specific `PROJECT_RULES.md`
and adds the baseline before reading it.

During local development, target repositories may link common guidance and
provider-specific skill directories to an external source. Their Git hooks
materialize those external paths as physical files before a commit, so a
cloned repository remains self-contained and does not depend on that source.

After cloning a repository, activate its hooks once with:

```bash
bun run git:hooks:install
```

The pre-commit hook prepares the physical files and the post-commit hook
restores local links. A repository with no development links is unaffected.
The pre-commit hook also updates the headers of staged source files according
to the repository-specific rules.

Keep product-specific rules and skills in the repository that owns them. Add a
shared rule here only when it applies to every repository using the baseline.
