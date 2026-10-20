---
name: lgs-1920-studio-browser-webgl
description: Prepare and verify a working WebGL 2 browser before any LGS1920 Studio browser test, visual check, screenshot, Cesium interaction, or Replay validation in WSL. Recover from Chrome startup, runtime-directory, and graphics failures instead of repeatedly launching an unusable browser. Applies to DevTools sessions and browser test runners, not DOM-only unit tests.
---

# Reliable Studio Browser Tests

Apply this skill before the first browser interaction in every Studio validation task, even when the requested
change is unrelated to Cesium. A connected browser, an `about:blank` tab, or a visible toolbar does not prove that
WebGL or the Studio scene works.

## Prepare the browser before opening Studio

Run from the repository root:

```bash
bun skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs ensure
```

The helper reuses a running daemon, or starts Linux Google Chrome with the persistent profile
`~/.cache/chrome-devtools-mcp-cli/chrome-profile` and the project's SwiftShader flags. It verifies WebGL 2 by
clearing a one-pixel canvas and checking the actual pixels read back. Its temporary background tab and context
are cleaned up, and the previously selected page is restored. A successful JSON result includes the renderer,
pixel values, profile, and whether the daemon was started.

The helper also handles two observed WSL failures without changing the user's shell or system configuration:

- When `XDG_RUNTIME_DIR` is inaccessible or belongs to another user, child CLI processes use the CLI's standard
  per-user `/tmp` fallback. Do not use `sudo`, change ownership of `/run/user`, or delete daemon sockets manually.
- For a headless Chrome launch only, omit inherited `DISPLAY`, `WAYLAND_DISPLAY`, and `DBUS_SESSION_BUS_ADDRESS`.
  Stale Windows display or inaccessible session-bus settings can block WebGL context creation despite valid flags.

Use the same helper for subsequent DevTools commands so they reach the same daemon even when the runtime-directory
fallback was needed:

```bash
bun skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs list_pages
bun skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs take_snapshot 1
bun skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs evaluate_script --help
```

Check installed command signatures with `--help`; not all page-scoped commands use the same positional arguments.
Do not call a raw browser tool as the first action: implicit daemon startup can omit the required configuration.
Do not replace the browser with a new Playwright installation or a disposable profile just to bypass a failure.

## Repair once, then verify again

Classify the failure from the helper output before changing anything:

- A missing executable or CLI is a tooling problem. Check the installed paths and versions before retrying.
- A daemon PID-file timeout can be a runtime-directory permission problem, not a GPU problem. Use the helper's
  normalized environment instead of repeating the same raw command.
- A null context, incorrect pixels, lost context, or timeout during context creation is a failed WebGL preflight.
  Do not navigate to Studio and count the application failure as a product regression.
- A failed command or missing probe output is a failed check even when the upstream CLI exits with code zero.

If the existing local test daemon fails the check, retain its profile and finish or save any temporary test edits
before restarting. Restart only the test session owned by the current task. `repair` closes its browser tabs:

```bash
bun skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs repair
```

This performs one configured restart and the same render check. Do not loop, clear caches or IndexedDB, remove a
profile lock, terminate unrelated Chrome processes, disable WebGL, or change application rendering code to make
the environment check pass. The helper refuses to repair an externally attached browser or an isolated daemon
whose persistent profile cannot be identified. For a user-requested Windows browser, follow the attachment workflow
in [Browser DevTools](../lgs-1920-studio-browser-devtools/SKILL.md) and check WebGL in that browser; do not silently
switch to the Linux profile.

If the configured repair still fails, keep the exact error and inspect the Chrome log at
`~/.cache/chrome-devtools-mcp-cli/webgl-browser.log`. Use that evidence for a targeted correction. Report browser
validation as blocked if no working context can be established; continue checks that do not require a browser.
Never report a mock context, skipped check, or toolbar-only screenshot as successful Cesium validation.

## Validate the application in the verified browser

Open the already-running Studio instance or the task's authorized preview. Never start `bun run dev` from this
workflow. Check console errors and confirm that the Cesium canvas renders the expected journey or terrain before
performing the requested interaction. A successful standalone probe does not prove that an existing Studio scene
has recovered from context loss: reload the affected test page only after preserving its temporary changes, and
verify the scene again.

Keep the persistent profile, selected origin, IndexedDB, and PWA caches. Do not silently use a different profile
when reproducing a data-dependent issue. Keep service workers enabled and network bypass disabled unless the task
explicitly requires another setting. Repeat the preflight after a browser restart, context loss, or graphics failure.

For existing Playwright or Vitest browser tests, apply the same verified launch settings in that runner's existing
configuration or task-local launch options. A DevTools probe validates only its own browser, not a separate runner.
Probe WebGL 2 and pixels in the runner's actual browser before testing Cesium. Use these Chrome arguments:

```text
--enable-webgl
--ignore-gpu-blocklist
--use-gl=angle
--use-angle=swiftshader-webgl
--enable-unsafe-swiftshader
```

Use an accessible runtime directory and omit desktop display/session-bus variables from a headless browser's
child environment. Keep runner changes within the task's scope. Preserve its existing test isolation and lifecycle.
Software rendering is suitable for behavior and visual checks; do not present its timings as hardware-GPU performance.

## Sources

- [Chromium SwiftShader modes and explicit WebGL opt-in](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md)
- [Official Chrome DevTools CLI lifecycle and output](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/cli.md)
