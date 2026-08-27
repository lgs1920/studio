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

Technical-documentation organization:

- Treat `PROJECT_RULES.md` as the canonical rule source for documentation placement.
- Classify implementation specifications from their content and the code, not from `COMMIT_HISTORY.md`.
- Place proposed, pending-validation, explicit TODO, and future implementation specifications in `tech-doc/todo/`.
- Place specifications and architecture documents describing the implemented behavior in `tech-doc/current/`.
- Preserve module structure below those directories when it improves discoverability.
- Update every link affected by a move, including links in the repository README and `tech-doc/README.md`.

Do not document assumptions as guarantees or create auxiliary README, quick-reference, or changelog files inside a skill.
