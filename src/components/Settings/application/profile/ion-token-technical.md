# Cesium Ion Token Management

## Purpose

LGS1920 uses Cesium Ion as the backend for hosted geospatial assets such as terrain, imagery, and 3D tiles. This
document describes the technical handling of Ion access tokens in the application, including persistence, runtime
selection, prompt behavior, and user-facing operations.

The goal is to keep the application usable with the shared application token while allowing users to switch to a
personal Cesium Ion token when they want their own quota, control, and entitlement scope.

## Token Model

The application recognizes two token sources:

- `default` token: the shared Cesium Ion token shipped with the application configuration.
- `user` token: a personal Cesium Ion token stored locally in the user's vault.

Only one token is active at a time. The active token is always assigned to `Cesium.Ion.defaultAccessToken` before
Cesium-dependent assets are initialized.

## Runtime Behavior

At startup, the application performs the following sequence:

1. Load the local vault.
2. Read the stored personal Ion token, if any.
3. Restore the accumulated shared-token usage counter.
4. Select the active token source.
5. Apply the token to Cesium.
6. Start the timer that tracks shared-token usage when no personal token is present.

If a personal token exists, the application uses it immediately and disables the shared-token prompt.
If no personal token exists, the shared token remains active until the configured threshold is reached.

## Prompt Policy

The shared token is not intended for unlimited long sessions. The application therefore displays a prompt after a
cumulative delay when the user has remained on the shared token.

Important properties of the prompt policy:

- the delay is cumulative across sessions;
- the counter is persisted locally;
- dismissing the prompt only suppresses it for the current session;
- saving a personal token disables the prompt entirely;
- removing the personal token re-enables shared-token tracking.

The default threshold is 480 seconds, unless overridden by configuration.

## Configuration

The shared-token prompt delay is controlled by product configuration, not hardcoded in the UI.

Recommended configuration:

```yaml
ion:
  promptDelaySeconds: 480
```

Runtime fallback:

```js
const promptDelaySeconds = Number(lgs.configuration.ion?.promptDelaySeconds)
const promptDelay = (Number.isFinite(promptDelaySeconds) ? promptDelaySeconds : 480) * 1000
```

Rules:

- invalid values fall back to 480 seconds;
- the delay is expressed in seconds in configuration;
- the UI and manager must consume the same value.

## Persistence

The personal token and usage state are stored locally in the vault database.

Recommended vault keys:

- `cesium_ion_token`: the personal token value;
- `cesium_ion_token_usage_seconds`: cumulative shared-token usage.

Requirements:

- the personal token must never be stored in regular settings storage;
- the token must survive application restarts;
- the usage counter must survive application restarts;
- vault reset flows must clear the personal token with the rest of the user-owned secrets.

## Application Responsibilities

### IonTokenManager

The token manager should own the business logic and persistence operations.

Responsibilities:

- load the personal token from the vault;
- apply the active token to Cesium;
- persist a new personal token;
- delete the personal token;
- maintain the usage counter;
- decide when the prompt should open;
- handle session-level dismissal.

Suggested API:

- `load()`
- `applyToken(token, source)`
- `save(token)`
- `clear()`
- `dismissForSession()`
- `startPromptTimer()`
- `stopPromptTimer()`
- `persistUsage()`

### Runtime Store

A lightweight runtime store should expose state for the UI only.

Suggested fields:

- `token`: the currently loaded personal token, or `null`;
- `source`: `default` or `user`;
- `loaded`: whether the vault read has completed;
- `showPrompt`: whether the prompt dialog should be visible;
- `timerActive`: whether shared-token tracking is currently running;
- `accumulatedSeconds`: total time spent on the shared token;
- `dismissedThisSession`: whether the prompt has already been dismissed in the current session.

The store should not perform persistence by itself.

## User Workflow

### First Launch

1. The app starts with the shared Cesium Ion token.
2. The usage timer begins.
3. When the configured threshold is reached, the prompt opens.
4. The user may enter a personal token or dismiss the prompt for later.

### Saving a Personal Token

1. The user enters a token in the prompt or in the profile settings.
2. The value is trimmed and validated locally.
3. The manager writes it to the vault.
4. The manager applies it immediately to Cesium.
5. The prompt closes and shared-token tracking stops.

### Removing a Personal Token

1. The user clears the token from settings.
2. The manager removes the vault entry.
3. The app falls back to the shared token.
4. Shared-token usage tracking resumes.
5. The prompt becomes eligible again once the threshold is reached.

### Dismiss for This Session

The user can choose to keep using the shared token during the current session. In that case:

- the prompt closes;
- it does not reopen during the same session;
- the usage counter continues to be updated;
- the prompt can reappear later, in a future session, if no personal token has been saved.

## UI Surface

The application should expose two user-facing surfaces:

- a modal prompt for first-time or threshold-based onboarding;
- a profile settings section for managing the token directly.

Both surfaces must use the same manager so validation and persistence stay consistent.

### Prompt Dialog

The prompt should:

- explain that the shared token is temporary;
- link to the Cesium Ion website;
- let the user enter a token securely;
- offer a clear save action;
- offer a dismiss action for later use.

### Profile Settings

The profile settings section should:

- show whether the active source is shared or personal;
- allow saving or replacing a personal token;
- allow removing the personal token;
- avoid revealing the full token value.

## Operational Notes

- The active Cesium token should be set early in startup, before Cesium-backed resources are consumed.
- The prompt timer should be tied to the application session, not to the Cesium viewer instance.
- The timer must be cleaned up on unmount or shutdown.
- The manager should guard against empty tokens and against saving the shared token as a personal token.
- If the vault is slow or temporarily unavailable, the application should fail gracefully and keep the shared token path
  available.
- The Ion prompt must not block application readiness. Startup loading is controlled by the main application surface and
  initial camera focus. If Cesium does not call the startup focus callback, the app must still release the loading screen
  through a bounded fallback.

## Validation Checklist

- Save a personal token and reload the app.
- Confirm the token is restored from the vault.
- Confirm the prompt does not reappear.
- Remove the personal token and reload the app.
- Confirm the shared token is used again.
- Confirm the prompt opens after the configured delay.
- Set `ion.promptDelaySeconds` to a small value and verify the prompt timing.
- Dismiss the prompt and verify it does not reopen in the same session.

## External Reference

Cesium Ion documentation: https://ion.cesium.com/
