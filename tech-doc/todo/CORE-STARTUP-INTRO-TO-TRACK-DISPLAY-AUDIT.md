# Startup Audit: Intro to Track Display

**Date:** 2026-09-20
**Status:** Audit completed; P0 corrective pass implemented; browser validation pending
**Scope:** Static intro, bootstrap, application initialization, Cesium viewer, terrain, current journey, current POIs, camera focus, and first track rendering.

This audit describes the current worktree implementation. It does not treat the progressive startup worker as production-ready until the browser validation and broader data-fidelity tests are complete.

## Executive assessment

| Stage | Status | Assessment |
| --- | --- | --- |
| Static splash image | **OK** | The HTML shell and `welcome-startup-background.js` can display a fallback image before React is mounted. |
| Intro video setup | **PARTIAL** | `main.jsx` prepares the video before importing the heavy application modules, but a real browser measurement is still missing. |
| Intro visibility | **PARTIAL** | The boot class masks Cesium and keeps the welcome screen visible, but the current documentation still describes the splash as PWA-only. |
| Enter button guard | **OK in isolation** | `WelcomeHero` refuses entry until `initComplete` and `appReady` are both true. |
| Application initialization | **TOO BLOCKING** | Configuration, backend, managers, terrain, current journey, starter POI, and camera preparation are chained before entry becomes possible. |
| Worker current journey loading | **FIXED in code** | Requests now use the `type: 'request'` envelope with an explicit `requestType`; a regression test covers this contract. |
| Current POIs | **IMPROVED** | The current journey POIs are loaded once before readiness; the deferred path skips that duplicate scan. |
| Camera focus | **PARTIAL** | Focus has a callback and a 2.5 second fallback, but readiness is not tied to a verified rendered current track. |
| Current track rendering | **UNVERIFIED through worker** | The legacy path calls `prepareDrawing()` and then `Journey.draw()`. The worker path reconstructs data and creates equivalent data sources manually, but has no dedicated regression test. |
| Secondary journeys | **PARTIAL** | Loading is deferred, but each journey is still deserialized, converted to Cesium data sources, styled, and drawn on the main thread. |
| Terrain and 3D layers | **PARTIAL** | Terrain is awaited on the critical path. Base 3D, 3D Tiles, and imagery start from the surface and are not included in a precise readiness contract. |
| Observability | **KO** | There are no startup performance marks covering first intro, worker packets, first current track, camera focus, surface readiness, and Enter availability. |

The urgent worker protocol mismatch is fixed in the current worktree. The primary journey and its current POIs now complete before readiness is reported, and worker failures fall back to the legacy database readers. Browser validation with a real multi-journey local database remains required.

## Priority review

The current worker does not yet provide progressive display for the primary journey. `StartupDataLoader.loadJourney()` consumes all journey and track packets first, then creates the Cesium data sources and calls `journey.draw()`. A large current journey therefore remains a single blocking unit even though its IndexedDB read runs in a worker. `Journey.draw()` then waits for all tracks in that journey through `Promise.all()`.

The startup chain also contains three independent delays before the entry button can be enabled:

1. `AppUtils.init()` performs configuration, server discovery, backend ping, settings, layer, widget, replay, country, and build fetches in sequence.
2. `LGS1920Context.initManagers()` awaits `DatabaseSyncManager.bootstrap()`. When a persistent folder is linked, bootstrap can enumerate and import every JSON file before the viewer is created.
3. `initializeData()` awaits terrain, the complete current journey reconstruction, all current journey POI packets, and the widget cache before continuing to camera setup.

The no-journey path has its own unnecessary dependency. `setupStarterPOI()` can call `ensurePOILocation()`, which invokes the geocoder before the intro can be released. An empty workspace should be able to reach the ready state without a network geocoding request.

The implementation priority is therefore:

1. **P0 — Measure the actual boot gates.** Add marks around configuration, sync bootstrap, terrain, current journey packet completion, first current track source, first current POI batch, camera focus, surface readiness, and Enter availability. Run this against an empty database, a large current journey, several journeys with many POIs, a linked folder, slow terrain, and worker failure.
2. **P0 — Make the primary journey progressive.** Reconstruct and draw the persisted current track as soon as its packets are complete. Create the remaining current journey tracks afterward, with yields between Cesium source loads. Readiness must be based on the first visible current track and the required initial POI batch, not on the complete journey.
3. **P0 — Remove external services from the first visible track gate.** Terrain must have a bounded fallback policy. The current track must be displayable on the available globe or ellipsoid while terrain resolves; terrain refinement can update clamping and request another render.
4. **P0 — Keep synchronization consistent without freezing the interface.** The linked-folder import must either complete before the database snapshot is selected or expose a documented snapshot policy. It must not silently clear the local data and then hold the intro indefinitely while importing a large profile.
5. **P1 — Make the empty-workspace path independent.** Do not resolve or persist the starter location before entry unless it is required for the first camera frame. Use the configured coordinates immediately and resolve descriptive location data later.
6. **P1 — Move widget cache hydration and all secondary work out of the first gate.** Widget positions, groups, secondary journeys, remaining POIs, location geocoding, and SnapDOM preparation must run cooperatively after the first visible state.
7. **P1 — Verify the worker data contract.** Test every supported track geometry and metadata variant, including smoothing inputs and source versus render content, before making the progressive worker path the only normal path.

Until the first two P0 items are complete, changing Cesium terrain or adding more workers is unlikely to solve the observed startup stall. The first browser test should prove the following sequence with a large local database: intro visible, current track visible, initial POIs visible, Enter enabled, then secondary loading continuing without a long main-thread block.

## Current execution path

```mermaid
flowchart TD
    A[index.html: boot class, splash image, video element]
    B[welcome-startup-background.js]
    C[main.jsx: media and blocker imports]
    D[main.jsx: video source and playback preparation]
    E[main.jsx: heavy application imports]
    F[LGS1920 initialization]
    G[AppUtils.init: backend, settings, DB, tokens]
    H[Managers and Cesium viewer]
    I[TerrainUtils.changeTerrain]
    J[StartupDataLoader.loadCurrentJourney]
    K[Starter POI and startup camera configuration]
    L[Legacy startup POI read]
    M[Camera focus]
    N[AppSurface and Cesium/UI surface]
    O[WelcomeHero enables Enter]
    P[Deferred worker journeys and POIs]
    Q[Journey groups, POI locations, SnapDOM preparation]

    A --> B --> C --> D --> E --> F
    F --> G --> H --> I --> J --> K --> L --> M --> N --> O
    M --> P --> Q
```

The intended product behavior is narrower than this graph: the intro should be visible immediately, the current journey and its associated POIs should become ready first, and all secondary work should remain outside the blocking path.

## What currently works

### The static intro can appear before React

`index.html` contains the splash and the Cesium container independently of React. `welcome-startup-background.js` applies the selected fallback image before the React application is mounted. This is the correct foundation for avoiding a blank page while JavaScript modules are evaluated.

`main.jsx` also loads the welcome media module before importing `LGS1920`, applies the video source with `load: false`, and then starts the heavier application imports. This ordering is aligned with the requirement that the user sees the intro while Studio initializes.

The static splash and the React welcome hero now share one startup video. The splash logo is hidden once React is mounted so the hero keeps one logo and one slogan at the normal size and position. The initialization panel and numeric progression are removed; a small callout below the CTA remains until entry is available.

### Entry is protected by an explicit readiness check

`WelcomeHero` derives `readyToEnter` from `initComplete && appReady`. It disables the Enter action while that value is false and calls `onEnter` only after the guard succeeds. The existing UI tests cover the disabled state and the transition after readiness.

Cesium remains mounted and hidden behind the intro while the current journey, track, POIs, camera, and first surface render become ready. Secondary journey and POI loading starts after the user reveals Studio and does not block this visible state. After reveal, Studio displays `Gameplay is ready.` only when a current journey exists. An empty workspace stays quiet until the user imports or creates a journey.

### Cesium uses an explicit render request mode

`ensureViewer()` enables `scene.requestRenderMode`. Track drawing calls `scene.requestRender()` after the GeoJSON source has been loaded and styled. This reduces continuous rendering pressure when the scene is idle, provided that every asynchronous scene mutation continues to request a render.

### The worker protocol is designed to apply back pressure

`StartupWorkerClient` waits for the consumer before acknowledging a packet. The worker emits journey geometry and POI batches instead of posting an unbounded stream. The worker also opens IndexedDB read-only and does not perform application migrations or cache writes. These are good design decisions for large local databases.

### Secondary Cesium layers are not awaited by the initial React state

`MapLayer`, `Base3DLayer`, and `Tiles3DLayer` start their provider or tileset work from React effects. Their asynchronous readiness is not used as the main `appReady` condition. This is compatible with keeping secondary map resources outside the current journey's critical path, although their network and rendering work can still compete with the first display.

## Problems and risks

### P0 — The worker request could not be dispatched — fixed

`StartupWorkerClient.request()` posts the request object and preserves its `type`. `StartupDataLoader` uses `type: 'journey'`, `type: 'journey-keys'`, and `type: 'pois'`. However, `startupData.worker.js` begins with a guard equivalent to:

```js
if (message?.type !== 'request') {
    return
}
```

The worker therefore ignored all three application requests. The client now removes the operation-specific `type` from the payload and sends it as `requestType` inside a `type: 'request'` envelope. `startup-worker-client.test.js` locks this protocol down.

Before the fix, this made the following state transition unsafe:

```text
loadCurrentJourney() -> no hydrated journey -> currentJourneyReady = true
```

This explains why the UI can appear initialized while the current journey or its tracks are absent.

### P0 — Readiness could be reported without a usable current journey — improved

`initializeData()` now waits for the current journey and current-only POI load, then verifies that the resolved journey is installed as `lgs.theJourney` and that the application store is ready before setting `currentJourneyReady`. The journey drawing is awaited by `StartupDataLoader` before this point.

The remaining limitation is that there is no browser-level assertion that the first rendered Cesium frame contains the current track. The following checks still belong in the next regression test:

- a current journey was found;
- the journey was registered in `lgs.journeys`;
- a current track was selected;
- every current track has a corresponding `GeoJsonDataSource`;
- the source contains loaded entities;
- the first render was requested;
- the associated current POI batch has been installed.

`appReady` also includes `appSurfaceReady`, but `AppSurface` reports readiness after animation frames or a `postRender` callback. That callback says that the surface rendered; it does not prove that the current route entities are visible.

### P0 — The primary worker failure had no safe fallback — fixed in code

The worker is used to load the primary journey during initialization. `StartupDataLoader` now catches worker creation and request failures, disposes the failed client, and falls back to the known `TrackUtils.readCurrentFromDB()` path. The same boundary exists for remaining journeys and POIs.

For the primary journey, the worker should be an optimization boundary. It must not become the only path that can display an existing local journey.

### P1 — Terrain is still on the critical path

`initializeData()` awaits `TerrainUtils.changeTerrain()` before loading the current journey. `TerrainUtils.setTerrain()` can wait for an external Cesium terrain provider or an Ion resource. A slow provider, an unavailable network, an expired credential, or a blocked terrain request therefore delays current track loading and Enter availability.

The current catch path only has a specific fallback for some user-token authorization errors. It does not define a bounded startup policy for slow or unavailable terrain. The audit must decide whether terrain is required before the first track display. The recommended policy is to display the current track on the available globe or ellipsoid, then replace or refine terrain asynchronously.

### P1 — Current POI ownership was duplicated — improved

The initialization path now lets `StartupDataLoader` install the current POIs before the camera focus. `runDeferredJourneyDataLoad()` receives `currentPOIsReady: true` and skips the second current-only scan. The legacy POI read remains the fallback when the worker is unavailable.

The manager's map prevents some duplicate objects from being retained, but it does not prevent the duplicate IndexedDB scan or the duplicate filtering work. The primary POI path needs one owner and one completion signal.

### P1 — Main-thread work remains heavy after the worker

The worker moves IndexedDB reads, decoding, filtering, and packetization away from the main thread. It does not move Cesium mutations away from the main thread. For each secondary journey, `StartupDataLoader.loadJourney()` still creates `Journey` and `Track` instances, adds Cesium data sources, invokes `Journey.draw()`, loads GeoJSON, applies track styles, and requests a render on the main thread.

The deferred promise is not awaited by the React render, but work inside that promise can still produce long main-thread tasks and visible interaction stalls. `poiManager.ensureAllPOILocations()` and `journeyGroupManager.initialize()` are also run after the data load without an explicit per-frame budget.

### P1 — The worker path reconstructs only a reduced track feature

`startupData.js` removes the original `content` and sends geometry chunks plus `contentProperties` and `geometryType`. `StartupDataLoader` rebuilds a `Feature` from these fields. This is sufficient for a simple `LineString` or `MultiLineString`, but it needs validation against all persisted track content variants.

Potentially lost or altered information includes feature-level metadata, non-line geometry, custom properties, and any coordinate-related arrays stored outside `geometry.coordinates`. The legacy path reads the serialized track as a whole and therefore has different fidelity characteristics.

### P1 — Smoothing ownership is not proved

The application contains track-render smoothing and a cache for prepared render content. The startup worker streams source coordinates, but the audit did not find a dedicated end-to-end test proving that the worker startup path preserves source coordinates, applies the configured smoothing policy, and uses the prepared render content only for display. This needs a focused contract test before the worker becomes the default path.

### P2 — Startup lifecycle does not dispose the worker

`StartupWorkerClient` exposes `dispose()`, but the `LGS1920` component does not dispose the `StartupDataLoader` when the component unmounts or initialization is abandoned. A retry, hot reload, or surface replacement can leave a worker and pending IndexedDB operation alive.

### P2 — The intro contract and PWA documentation disagree

The current HTML/CSS work makes the boot splash visible whenever `body` has `lgs-app-booting`. The platform documentation still says that the boot splash belongs to the installed PWA only. The product decision must be made explicit and the documentation aligned with the actual behavior.

### P2 — There is no complete startup measurement

The current code logs that Studio is loaded, but it does not expose a reliable timeline for:

- first static intro paint;
- video source assignment and first playback;
- React bootstrap completion;
- backend/configuration completion;
- viewer creation;
- terrain request start and completion;
- first current journey packet;
- first current track source loaded;
- current POI batch installed;
- camera focus callback;
- surface readiness;
- Enter enabled;
- Studio revealed;
- secondary loading completion.

Without these marks, a local database with several journeys cannot be compared with a small database, and Cesium terrain or 3D Tiles cannot be separated from application work.

## Audit of the first track display

The legacy path is:

1. Read the persisted current journey key.
2. Deserialize the journey and tracks.
3. Register the journey in the application context.
4. Select the persisted current track or the first track.
5. Call `journey.prepareDrawing()`, which creates one GeoJSON data source per track and one custom data source for the journey.
6. Call `journey.draw({action: DRAWING_FROM_DB, mode: FOCUS_ON_FEATURE})`.
7. Each track calls `TrackUtils.draw()`, which loads the track content into its GeoJSON data source with `clampToGround: true`, applies the track style, updates visibility, and requests a Cesium render.
8. Configure the camera and start the focus operation.

This path is conceptually coherent and should remain the reference behavior for the fallback implementation.

The worker path is intended to perform the same sequence incrementally, but its current status is not equivalent:

- worker dispatch now uses the explicit request envelope; a focused client test covers the message type;
- the loader creates data sources manually instead of using the shared `prepareDrawing()` contract;
- the loader verifies the current journey/store readiness before the application readiness flag is set, but still lacks a first-render assertion;
- the loader reconstructs a reduced feature object;
- no browser test proves that a real local database reaches visible current track entities.

## Recommended action plan

### Phase 0 — Restore a safe primary path

1. **Fix and specify the worker protocol — implemented.** Requests now use `{type: 'request', requestType: 'journey'}` and the client regression test covers the envelope. Tests for `journey-keys`, `pois`, `ack`, worker error, and disposal remain useful follow-up coverage.
2. **Add a primary fallback — implemented.** Worker creation and request failures fall back to the known main-thread readers for the current journey, remaining journeys, and POIs.
3. **Make readiness truthful — partially implemented.** The current journey, current-only POIs, journey/store state, and awaited journey drawing now precede `currentJourneyReady`. A browser assertion for current track entities and the first render is still required.
4. **Validate the single primary POI owner.** The worker loader now installs the current POIs before readiness and the deferred path skips the current-only request. Keep this contract covered by an end-to-end startup test.

### Phase 1 — Measure the critical path

5. Add `performance.mark()` and `performance.measure()` entries at each startup boundary listed above. Include a database-size summary such as journey count, current track count, and POI count without logging route content.
6. Capture a startup trace on representative cases: empty database, one small journey, one large journey, several journeys with many POIs, slow terrain, unavailable terrain, and worker failure.
7. Record the first long task after the intro appears and after Enter becomes available. Separate React evaluation, IndexedDB, Cesium source loading, terrain, imagery, 3D Tiles, and POI location work.

### Phase 2 — Define the critical path explicitly

8. Keep the static intro independent from React and heavy module evaluation.
9. Move only the minimum required work before current journey readiness: application context, database access, current journey, current track sources, associated POIs, and camera target preparation.
10. Treat terrain, imagery, base 3D, 3D Tiles, groups, secondary journeys, all remaining POI locations, and SnapDOM preparation as background work unless a product requirement proves they are needed for the first track frame.
11. If terrain is needed for correct clamping, use a bounded policy: display a clearly defined fallback state while terrain resolves, then reapply ground clamping and request a render after terrain becomes available.

### Phase 3 — Make background work cooperative

12. Schedule secondary journey work one journey or one track at a time, with an explicit yield after each Cesium source load and style update.
13. Process all POIs in bounded batches and schedule location resolution independently from initial POI visibility.
14. Make group initialization incremental or defer it until the first user request if it does not affect the current journey display.
15. Dispose the startup worker, pending listeners, timers, and request handlers on unmount, retry, and initialization failure.

### Phase 4 — Validate Cesium behavior

16. Verify the Cesium 1.145 behavior used by the project for `Scene.setTerrain`, `Terrain`, clamped GeoJSON entities, `requestRenderMode`, and ground clamping.
17. Confirm that base imagery, base 3D, and 3D Tiles do not change the current journey camera or visibility while they load in the background.
18. Measure data-source and entity counts for large journeys. Keep `GeoJsonDataSource` where its styling and interaction contract requires it; consider a lower-level primitive path only after profiling proves entity overhead is the bottleneck.

### Phase 5 — Add regression coverage

19. Add a unit test for the worker protocol and acknowledged packet ordering.
20. Add a unit test for journey and track reconstruction that preserves map order, geometry type, endpoints, feature properties, and source versus render content.
21. Add a unit test for primary readiness and worker fallback.
22. Add a UI test for the full Enter guard: intro visible, button disabled, current journey ready, button enabled, and reveal callback invoked once.
23. Add a browser test with a deterministic IndexedDB fixture containing multiple journeys and many POIs. Assert that the current journey appears before secondary work completes and that the UI remains responsive while secondary work continues.
24. Add failure cases for slow or unavailable terrain, worker errors, empty databases, malformed journeys, and missing current-track keys.

## Acceptance criteria

The implementation should not be considered complete until all of these are observable in a real browser:

- the intro image or video appears before the heavy Studio UI is evaluated;
- Cesium and secondary UI remain hidden during initialization;
- the current journey is selected from persisted state or the documented fallback journey;
- the current track source contains visible entities before Enter is enabled;
- the associated current POIs are available before Enter is enabled;
- pressing Enter does not wait for secondary journeys, all POI locations, groups, SnapDOM, base 3D, or 3D Tiles;
- secondary work is incremental and does not create repeated long main-thread stalls;
- a worker failure falls back safely and does not silently report a false-ready state;
- slow or unavailable terrain follows the documented bounded policy;
- the full path is covered by deterministic unit/UI tests and at least one browser test using a multi-journey local database;
- the actual measured startup marks are recorded for an empty database and a representative large database.

## Relevant implementation files

- [`index.html`](../../index.html) — static splash, boot class, Cesium container, and React mount point.
- [`welcome-startup-background.js`](../../src/assets/media/welcome-startup-background.js) — pre-React fallback image setup.
- [`main.jsx`](../../src/main.jsx) — media preparation and deferred application imports.
- [`LGS1920.jsx`](../../src/components/LGS1920.jsx) — initialization sequence, readiness state, camera focus, and deferred loading trigger.
- [`AppSurface.jsx`](../../src/components/AppSurface.jsx) — Cesium/UI surface and surface readiness signal.
- [`StartupDataLoader.js`](../../src/core/ui/startup/StartupDataLoader.js) — current and deferred journey/POI hydration.
- [`StartupWorkerClient.js`](../../src/core/ui/startup/StartupWorkerClient.js) — acknowledged worker protocol on the main thread.
- [`startupData.worker.js`](../../src/core/ui/startup/startupData.worker.js) — IndexedDB reads and worker dispatch.
- [`startupData.js`](../../src/core/ui/startup/startupData.js) — journey, geometry, and POI packetization.
- [`TerrainUtils.js`](../../src/Utils/cesium/TerrainUtils.js) — terrain provider resolution and terrain assignment.
- [`Viewer.jsx`](../../src/components/cesium/Viewer.jsx) — Cesium viewer configuration and render mode.
- [`TrackUtils.js`](../../src/Utils/cesium/TrackUtils.js) — data-source preparation and track rendering.
- [`Journey.js`](../../src/core/Journey.js) and [`Track.js`](../../src/core/Track.js) — journey and track draw contracts.
- [`POIManager.js`](../../src/core/ui/POIManager.js) — startup and complete POI reads.

## Existing validation and gaps

The existing suite covers welcome hero behavior, camera startup configuration, track render smoothing, and the legacy deferred journey loader. The audit did not find a dedicated worker startup test or a browser test that loads a real multi-journey IndexedDB fixture through the intro-to-track path.

The repository checks already run during this audit passed for the current worktree build and unit suite, but they do not validate the real worker protocol or Cesium startup timing. A successful build must therefore not be interpreted as evidence that the current journey is displayed.
