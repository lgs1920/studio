---
name: widget-creation
description: Create, extend, or repair LGS1920 on-map scene widgets and their replay or video composition behavior. Use when adding a widget to the catalog, implementing a React widget component, adding static or dynamic rendering, exposing editor configuration, changing widget positioning, grid snapping, mandatory widgets, credits, Logo, Stats, capture, or scene replacement behavior.
---

# Widget Creation

## Purpose

Use this skill for all LGS1920 widget work. Treat a widget as a complete feature spanning its catalog definition, rendering component, lifecycle, configuration, interaction, persistence, and capture behavior.

The current widget model is documented in [widget-architecture.md](references/widget-architecture.md). Read that reference before making a non-trivial widget change.

## Workflow

1. Inspect the existing implementation before editing:
   - `public/widgets.yaml` for catalog metadata and defaults
   - `src/components/MainUI/widgets/Widget.jsx` for the host lifecycle and interaction contract
   - `src/components/MainUI/widgets/DynamicWidget.jsx` and `SceneWidgetsRenderer.jsx` for rendering paths
   - `src/core/ui/widget-manager/` for positioning, scaling, persistence, capture, and grid behavior
   - `src/core/constants.js` when adding widget IDs, groups, components, or static and dynamic part markers
   - analogous widgets under `src/components/MainUI/widgets/list/`, `src/components/`, or `src/components/Stats/`

2. Decide the widget contract before coding:
   - Is it visual, dynamic, or both?
   - Is it available on the scene board, the video crop board, or both?
   - Is it mandatory, singleton, removable, lockable, scalable, editable, reducible, or fixed?
   - Which journey, replay, profile, or map state is required?
   - Which parts must remain visible and stable during snapshots and HQ video export?

3. Add or update the catalog entry in `public/widgets.yaml`.
   - Use a unique kebab-case ID and an existing group unless a new group is justified.
   - Declare `component`, `type: "lgs-visual-widget"`, `path` when needed, `mandatory`, `max`, and `availability` explicitly.
   - Put user-editable defaults under `configuration.default` and preserve the `user` and `elements` layers.
   - Keep dynamic Stats restricted to the video board and journey availability unless the product requirement says otherwise.
   - When changing a widget definition, check whether the matching icon and component mapping in `src/core/constants.js` must also change.

4. Implement the component using the existing React and Valtio patterns.
   - Resolve the instance configuration in the same order as existing widgets: element-specific configuration, user configuration, then defaults.
   - Separate static content from live or replay-dependent content with `STATIC_WIDGET_PART` and `DYNAMIC_WIDGET_PART` where capture or replay rendering needs that distinction.
   - Keep DOM structure stable during capture. Avoid timers, layout shifts, and asynchronous content changes unless the capture lifecycle explicitly handles them.
   - Use Web Awesome and FontAwesome conventions already used by the project. Do not introduce a parallel UI or CSS framework.
   - Preserve the widget host classes and interaction exclusions such as `lgs-widget-no-drag` for controls inside a widget.

5. Integrate editor and interaction behavior only as required.
   - Reuse existing editor elements for background, border, padding, text, shadow, scale, alignment, and separators.
   - Add a dedicated editor element only when the configuration cannot be represented by existing controls.
   - Respect locked, reduced, fixed-position, always-on-top, and mandatory semantics in context menus, ordering, keyboard movement, and pointer interaction.
   - Use widget-manager APIs for position and scale changes so browser persistence and crop bounds stay synchronized.
   - Keep grid visibility and snapping scoped to the active widget board and selected widget. Never move unrelated widgets as a side effect.

6. Verify composition behavior.
   - Test normal scene rendering and the video crop board separately.
   - Test scene replacement and remounting so stale widget instances are not retained.
   - Test grid settings, snapping, margins, bounds, selection scope, keyboard movement, scaling, and persisted positions when relevant.
   - Test background toggles, credits anchoring and scaling, mandatory Logo presence, and dynamic Stats updates when relevant.
   - Test snapshot and HQ replay export paths when the widget appears in captured output. Confirm visibility, z-index, crop alignment, and cleanup after cancellation or completion.

7. Add focused tests beside the affected code. Run the smallest relevant test set, then `bun run lint` and an allowed production build when the change crosses module boundaries. Do not run `bun run dev`.

## Guardrails

- Do not duplicate widget positioning or persistence logic inside a component.
- Do not assume a widget ID is a complete instance ID. Non-mandatory repeated widgets may use composite IDs such as `<id>#<uuid>`.
- Do not hide or remove the mandatory Logo or Credits widgets from a scene or export without an explicit product requirement.
- Do not make replay-only dynamic content depend on a static render pass.
- Do not modify unrelated work already present in the working tree.
- Follow the repository rules in `.aiassistant/rules/development-standards.md`, including no semicolons, named exports, English code documentation, Valtio proxy naming, and relevant tests.

## Completion Checklist

- Catalog metadata and availability are correct
- Component lifecycle works on every supported board
- Static and dynamic parts are intentionally separated
- Editor configuration has safe defaults and persistence behavior
- Position, scale, lock, grid, snap, and z-index semantics are correct
- Mandatory and replacement behavior is preserved
- Scene rendering, replay or video capture, and cleanup are tested as applicable
- Relevant tests, lint, and build checks pass
