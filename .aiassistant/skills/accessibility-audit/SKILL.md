---
name: accessibility-audit
description: Audit and improve LGS1920 accessibility for keyboard navigation, focus, semantics, labels, ARIA, contrast, reduced motion, drawers, menus, widgets, and on-map controls.
---

# Accessibility Audit

Use for UI changes or accessibility regressions. Inspect the component, keyboard shortcuts, Web Awesome semantics, theme tokens, and existing interaction tests.

Check:

- every interactive control has an accessible name and an appropriate role
- keyboard focus is visible, ordered, trapped, and restored in drawers or dialogs
- disabled, selected, loading, and error states are conveyed without color alone
- on-map controls remain usable with keyboard and pointer input
- icon-only controls have labels and tooltips where appropriate
- contrast survives light and dark themes
- motion-sensitive paths provide a reduced-motion-safe behavior
- dynamic Stats, progress, and export states announce meaningful changes

Add focused tests for keyboard and semantic behavior. Do not fix contrast by removing state distinctions or labels.
