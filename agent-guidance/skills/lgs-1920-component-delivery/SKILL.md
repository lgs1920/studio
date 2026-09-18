---
name: lgs-1920-component-delivery
description: Build, test, document, and prepare releases for a standalone LGS1920 UI component package and its demo.
---

# LGS1920 component delivery

Use this skill when a change spans a reusable UI component, its public package,
tests, documentation, demo, or delivery workflow.

## Workflow

1. Inspect the current Git status, package metadata, source entry points,
   tests, demo source, and repository workflows.
2. Keep public behavior in source, regression coverage at the public boundary,
   and user-facing explanations in package documentation.
3. Build generated artifacts from source and never edit `dist/` or generated
   demo output.
4. Keep exports, README examples, demo, version metadata, and delivery config
   synchronized.
5. Run focused tests, then the complete checks documented by project rules and
   package scripts.
6. Preview release text before release or publication.

## Boundaries

- Keep the component independent of host application state, persistence, and
  external services unless its contract explicitly requires them.
- Preserve the custom element, package exports, accessibility, theme
  integration, CSS variables, and CSS parts.
- Do not introduce a second component library or edit generated source.
- Preserve unrelated work and keep commit, push, publication, and deployment
  as separate actions.
