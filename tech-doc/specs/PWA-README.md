# Progressive Web App

## Scope

LGS1920 Studio has two runtime surfaces:

- **Webapp**: Studio runs in a normal browser tab. The service worker is checked before the Studio entry action becomes available. A detected release is installed automatically and the page reloads after the new worker takes control.
- **Installed PWA**: Studio runs in standalone display mode. A detected release is presented in an update dialog so the user can start the update explicitly.

The boot splash belongs to the installed PWA only. The normal webapp keeps the WelcomeHero and does not display the PWA boot splash.

## Installation

The webapp listens for the browser `beforeinstallprompt` event. When the browser makes installation available, Studio opens a dismissible installation dialog. The user can:

1. start the native installation prompt;
2. open browser-specific manual instructions when no native prompt is available; or
3. postpone installation.

The installation dialog is not a permanent banner. After it is dismissed, installation can be opened again from the application settings surface. The browser may also expose installation from its address bar or application menu.

Browser-specific instructions are stored in `src/locales/en/pwa-instructions/` and are rendered in the fallback installation dialog.

## Release fingerprint

The service worker uses a release fingerprint made from:

- the deployed build time;
- the Studio version from `version.json`;
- the Git deployment tag; and
- the deployed branch.

The fingerprint is injected into `public/service-worker-pwa.js` during the Vite build. A deployment must therefore produce a new service-worker script or a new injected fingerprint. Changing only a runtime UI module is not sufficient if the deployed service-worker response remains byte-for-byte unchanged.

The service worker also reads `build.json`, `version.json`, and `branch.json` with `cache: no-store` when it resolves its runtime cache metadata. Application caches are named with the platform, version, tag, and build time, and older application caches are removed during activation.

## Update detection

`AppUpdateManager` registers `/service-worker-pwa.js` with `updateViaCache: 'none'` and checks for updates:

- after the initial registration;
- when the browser window receives focus; and
- when the document becomes visible again.

Checks are throttled to one request per minute unless an initial check is forced. A service worker reports a new version with a `NEW_VERSION` message and its deployment tag.

## Webapp update flow

For a normal browser tab, the update is automatic:

1. Studio displays a persistent information callout while the initial check is pending.
2. If a new worker is found, the callout reports that the new version is being installed.
3. The waiting worker receives `SKIP_WAITING`.
4. Studio waits for `controllerchange` and reloads the page once the new worker controls the page.
5. If activation cannot be completed, the callout shows the error and provides a **Relaunch Studio** action.

The check and installation happen before the Studio entry action is enabled, so the user does not have to wait once Studio is ready to use.

## Installed PWA update flow

For standalone PWA sessions, Studio shows an update dialog instead of applying the update silently. The dialog provides:

- the available release information;
- an **Update** action;
- a **Later** action; and
- persistent progress while the update is being installed.

The dialog explicitly states that the application will restart once the update is complete. Selecting **Update** sends `SKIP_WAITING` to the waiting worker, waits for `controllerchange`, and reloads Studio. If activation fails, the error remains visible so the user can retry or reload Studio.

## Deployment checklist

Before validating a PWA release:

1. Update the intended release version and deploy a new Git tag.
2. Run the Studio deployment for the target platform.
3. Verify that `/service-worker-pwa.js` returns HTTP 200 and contains the new release fingerprint.
4. Open the webapp in a normal browser tab and confirm the initial update callout completes before Studio can be entered.
5. Open the installed PWA and confirm the update dialog, progress state, restart message, and final reload.
6. Validate both a successful activation and a failed activation with the **Relaunch Studio** fallback.

The service worker must be served from the site root so its scope covers the Studio application. A missing or non-200 service-worker response prevents update detection and installation.
