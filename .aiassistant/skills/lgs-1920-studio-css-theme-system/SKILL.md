---
name: lgs-1920-studio-css-theme-system
description: Create or repair LGS1920 CSS themes, design tokens, nested styles, light and dark contrast, on-map colors, widget styling, and responsive visual states.
---

# CSS Theme System

Use for visual styling, theme changes, contrast issues, and new component states. Inspect nearby CSS, theme declarations, Web Awesome tokens, and project style rules first.

Rules:

- Prefer existing project and Web Awesome tokens over hard-coded colors.
- Use nested CSS syntax with `&` as required by the repository.
- Add an English comment explaining every new CSS custom property.
- Verify text, icons, disabled controls, selected states, overlays, and map backgrounds in each supported theme.
- Keep capture and on-map styling independent from editor-only affordances.
- Preserve responsive behavior and avoid layout shifts during Replay or export.

Test visual state behavior through focused component tests and build validation. Do not add an external CSS framework.
