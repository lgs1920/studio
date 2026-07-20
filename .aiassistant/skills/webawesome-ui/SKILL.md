---
name: webawesome-ui
description: Build or style LGS1920 interfaces with Web Awesome 3, FontAwesome, project themes, drawers, toolbars, forms, menus, and responsive layout.
---

# WebAwesome UI

Use this skill for new or redesigned UI. Inspect nearby components, theme tokens, existing Web Awesome usage, and `.aiassistant/rules/development-standards.md` first.

Workflow:

1. Reuse the closest existing Web Awesome component and interaction pattern.
2. Keep layout responsive and consistent with the project drawer, toolbar, and on-map conventions.
3. Use Web Awesome tokens and project CSS variables. Every new CSS custom property needs an English purpose comment.
4. Preserve keyboard access, disabled and selected contrast, focus behavior, labels, and loading or error states.
5. Use FontAwesome icons through the existing integration and add shortcut documentation when introducing shortcuts.
6. Test the component at narrow and wide layouts and in light or dark theme contexts when relevant.

Do not introduce another component library, generic utility CSS, or inaccessible icon-only controls. Add focused interaction tests.
