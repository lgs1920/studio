---
name: lgs-1920-studio-documentation-maintenance
description: Maintain LGS1920 README files, technical documentation, configuration references, shortcuts, provider credits, and implementation documentation after code changes.
---

# Documentation Maintenance

Use when behavior, configuration, shortcuts, providers, dependencies, or release workflows change. Inspect nearby documentation and source configuration before editing.

Workflow:

1. Locate the canonical document and avoid duplicating the same rule in multiple places.
2. Document user-visible behavior, configuration keys, availability, limitations, and recovery paths.
3. Keep code comments and JSDoc in professional English, while matching the project's existing documentation language.
4. Update shortcut documentation for every new shortcut.
5. Keep provider, open-source, terrain, sponsor, and license credits accurate.
6. Validate links, examples, configuration names, and build-sensitive snippets.

Do not document assumptions as guarantees or create auxiliary README, quick-reference, or changelog files inside a skill.
