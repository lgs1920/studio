---
name: lgs-1920-studio-webawesome-ui
description: Build or style LGS1920 interfaces with Web Awesome 3, FontAwesome, project themes, drawers, toolbars, forms, menus, and responsive layout.
---

# WebAwesome UI

Use this skill for new or redesigned UI. Inspect nearby components, theme tokens, existing Web Awesome usage, and `.aiassistant/rules/development-standards.md` first.

The project baseline is Web Awesome Pro `3.12.0`, matching the package manifest
and lockfile. When the installed Web Awesome version changes, review the
affected legacy component guidance, tokens, patterns, and React wrapper APIs
against the official changelog and component references. Update this skill and
the project baseline when needed, then run its structural validation and the
relevant component tests. Record unresolved compatibility or unavailable
verification as follow-up work.

Workflow:

1. Reuse the closest existing Web Awesome component and interaction pattern.
2. Keep layout responsive and consistent with the project drawer, toolbar, and on-map conventions.
3. Use Web Awesome tokens and project CSS variables. Every new CSS custom property needs an English purpose comment.
4. Preserve keyboard access, disabled and selected contrast, focus behavior, labels, and loading or error states.
5. Use FontAwesome icons through the existing integration and add shortcut documentation when introducing shortcuts.
6. Test the component at narrow and wide layouts and in light or dark theme contexts when relevant.

## Icons

Use the native Web Awesome icon component or its React wrapper for all UI icons. Use the
Font Awesome `iconName` in kebab case as the public `name`, such as `camera-sliders`. Do not
expose JavaScript export names such as `faCameraSliders` or Font Awesome definition prefixes
such as `fak` and `fakd` in component props.

Omit `family` for the default `classic` family. Specify `family` for `duotone`, `brands`,
`sharp`, or another non-default family, and specify `variant` when the selected icon depends
on a style. Custom kit imports belong in `src/Utils/FA2WA.js` and must be registered once at
application initialization. The resolver uses the requested family and variant, keeps the
first matching definition from the ordered kit list, and delegates missing icons to Web
Awesome's default resolver.

See [the icon system specification](../../tech-doc/specs/ui-widgets/CORE-UI-ICONS-SPEC.md)
for the complete contract and extension rules.

Do not introduce another component library, generic utility CSS, or inaccessible icon-only controls. Add focused interaction tests.
