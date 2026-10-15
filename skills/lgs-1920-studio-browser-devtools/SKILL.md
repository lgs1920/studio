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

Call `chrome-devtools list_pages` directly. The daemon starts implicitly and is reused by subsequent commands.
Do not run `start`, `status`, or `stop` before every use. An `about:blank` page confirms connectivity but does not
prove that Studio is loaded or that an existing application profile has been restored.

Use `chrome-devtools <command> --help` for the installed command signature. Page-scoped commands may require
the page ID as their first positional argument. Prefer `take_snapshot` for inspecting the page.

The CLI defaults to a headless browser and, unless `userDataDir` is supplied, an isolated profile. Use a persistent
profile for Studio work so IndexedDB data and service-worker caches survive daemon restarts. Cesium requires
WebGL; launch Chrome with SwiftShader enabled because the default headless GPU configuration may disable WebGL:

```bash
chrome-devtools start \
  --userDataDir "$HOME/.cache/chrome-devtools-mcp-cli/chrome-profile" \
  --chromeArg=--enable-webgl \
  --chromeArg=--ignore-gpu-blocklist \
  --chromeArg=--use-gl=angle \
  --chromeArg=--use-angle=swiftshader-webgl \
  --chromeArg=--enable-unsafe-swiftshader
chrome-devtools list_pages
```

Use these flags only for the local diagnostic browser; they do not configure the production application.
The startup command restarts the daemon and closes its active pages. Reuse the same profile when restarting so
local application data is retained, and check `chrome-devtools list_pages` after startup. Confirm WebGL with a
small `canvas.getContext('webgl2')` or `canvas.getContext('webgl')` probe before diagnosing Cesium initialization.
Do not start the Studio development server from this workflow.

## Connection failures

Diagnose the reported error before changing configuration:

- For a missing executable, check `command -v google-chrome` and `google-chrome --version`.
- For an unexpected browser or failed attachment, inspect `chrome-devtools status` and its daemon arguments.
- For a Cesium `Error constructing CesiumWidget` WebGL failure, restart with the persistent profile and SwiftShader
  flags above, then confirm a WebGL context before retrying Studio.
- For a stale daemon, restart with the intended browser/profile configuration and verify with `list_pages`.
- For a Windows browser attachment, use its reachable debugging endpoint with `--browserUrl`. Verify access
  from WSL first. Do not assume Windows localhost is reachable from WSL or that `--autoConnect` supports Edge.

Keep project-specific guidance here. Do not edit the JetBrains-managed `chrome-devtools-cli` skill because an
IDE update may replace it. Package-manager incidents such as an incomplete Postfix installation are separate
from browser connection configuration and do not belong in the normal workflow.

## References

- [Official CLI workflow and defaults](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/cli.md)
- [Connecting to an existing browser](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md#connecting-to-a-running-chrome-instance)
