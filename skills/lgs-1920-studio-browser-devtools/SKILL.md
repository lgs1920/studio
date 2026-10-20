---
name: lgs-1920-studio-browser-devtools
description: Connect to and troubleshoot LGS1920 browser automation through the chrome-devtools CLI in the project's WSL environment.
---

# Browser DevTools in WSL

## Default browser

Use Google Chrome installed inside WSL. The CLI discovers the stable Linux executable at `/opt/google/chrome/chrome`.
This browser has a separate profile from the usual Windows browser. Windows tabs, sign-ins, IndexedDB databases,
and service-worker caches are not shared. Inspect the browser that actually contains the data relevant to the task.
When the user explicitly requests the usual Windows browser, connect to that browser rather than silently switching profiles.

## Normal workflow

Before the first browser interaction in each Studio validation task, apply
[Reliable Studio Browser Tests](../lgs-1920-studio-browser-webgl/SKILL.md) and run its WebGL preflight:

```bash
bun skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs ensure
bun skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs list_pages
```

Use that wrapper for subsequent CLI commands to preserve the WSL runtime-directory fallback when needed.
It reuses a running daemon. Do not unconditionally restart or stop the browser before every action. An
`about:blank` page confirms connectivity but does not prove that WebGL, Studio, or the intended profile works.

Use `chrome-devtools <command> --help` for the installed command signature. Page-scoped commands may require
the page ID as their first positional argument. Prefer `take_snapshot` for inspecting the page.

The CLI defaults to a headless browser and, unless `userDataDir` is supplied, an isolated profile. The WebGL skill
owns the persistent-profile launch command, graphics flags, headless environment, render probe, and bounded repair
procedure. Keep those details there rather than starting a second browser with default settings. They configure
only the local diagnostic browser. Do not start the Studio development server from this workflow.

## Connection failures

Diagnose the reported error before changing configuration:

- For a missing executable, check `command -v google-chrome` and `google-chrome --version`.
- For an unexpected browser or failed attachment, inspect `chrome-devtools status` and its daemon arguments.
- For a Cesium `Error constructing CesiumWidget` WebGL failure or a stalled daemon, apply the WebGL skill's
  diagnostic and repair procedure, then verify actual rendering before retrying Studio. Preserve the active profile.
- For a Windows browser attachment, use its reachable debugging endpoint with `--browserUrl`. Verify access
  from WSL first. Do not assume Windows localhost is reachable from WSL or that `--autoConnect` supports Edge.

Keep project-specific guidance here. Do not edit the JetBrains-managed `chrome-devtools-cli` skill because an
IDE update may replace it. Package-manager incidents such as an incomplete Postfix installation are separate
from browser connection configuration and do not belong in the normal workflow.

## References

- [Official CLI workflow and defaults](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/cli.md)
- [Connecting to an existing browser](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md#connecting-to-a-running-chrome-instance)
