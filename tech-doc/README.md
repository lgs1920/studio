# Technical Documentation

This directory centralizes Studio technical documentation. Documents are grouped
below by engineering domain rather than storage directory.

- **Current** links point to implemented behavior under [`specs/`](specs/).
- **Planned** links point to proposals, research, or pending work under
  [`todo/`](todo/).
- **Historical** documents are retained for context but are not authoritative.

## Replay, Camera, and Video

### Current

- [Replay architecture](specs/replay-video/CORE-REPLAY-ARCHITECTURE.md)
- [Replay implementation status](specs/replay-video/CORE-REPLAY-IMPLEMENTATION-STATUS.md)
- [Replay quality validation](specs/replay-video/CORE-REPLAY-QUALITY-VALIDATION.md)
- [Replay audit](specs/replay-video/REPLAY-AUDIT.md)
- [Replay core implementation](specs/replay-video/CORE-UI-REPLAY-README-REPLAY.md)
- [Replay camera tracking zones](specs/replay-video/REPLAY_CAMERA_TRACKING_ZONES.md)
- [Drone camera path architecture](specs/replay-video/CORE-DRONE-CAMERA-PATH-ARCHITECTURE.md)
- [Replay trace and marker visual validation](specs/replay-video/CORE-REPLAY-TRACE-MARKER-GLOW-NEON-VALIDATION.md)
- [Replay trace and marker effects](specs/replay-video/CORE-REPLAY-TRACE-MARKER-GLOW-NEON-SPEC.md)
- [Screen media recorder](specs/replay-video/CORE-SCREEN-MEDIA-RECORDER-RECORDER-README.md)
- [Canvas overlay composer](specs/replay-video/CORE-SCREEN-MEDIA-RECORDER-COMPOSER-README.md)
- [Video and replay test-suite failures — 2026-07-25](specs/replay-video/VIDEO_TEST_SUITE_FAILURES_2026-07-25.md)

### Planned

- [Replay start camera editor and clip synchronization](specs/replay-video/CORE-REPLAY-START-CAMERA-EDITOR-SPEC.md)
- [Replay Timeline preview](todo/CORE-REPLAY-TIMELINE-PREVIEW-SPEC.md) — TODO, 1.0.0
- [Replay track timeline editor](todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md) — TODO, 1.0.0 preview / 1.1.0 editor
- [POI animation during replay](specs/replay-video/CORE-POI-ANIMATION-DURING-REPLAY-SPEC.md)
- [Clip altitude alignment](specs/replay-video/CORE-CLIP-ALTITUDE-DATA-ALIGNMENT-SPEC.md)
- [Drone camera 3D path editor](specs/replay-video/CORE-DRONE-CAMERA-3D-PATH-EDITOR-SPEC.md)
- [Camera HPR orientation sphere](specs/replay-video/CORE-CAMERA-HPR-THREEJS-SPHERE-WIDGET-SPEC.md)
- [HQ video resolution profiles](specs/replay-video/HQ_4K_VIDEO_EXPORT_SPEC.md)
- [Video widget](specs/replay-video/VIDEO_WIDGET_SPEC.md)

### Historical

- [Replay/video refactoring analysis](specs/replay-video/JOURNEY-REPLAY-VIDEO-ISSUES.md)
- [Legacy replay render-mode architecture](specs/replay-video/CORE-REPLAY-RENDER-MODE-ARCHITECTURE.md)
- [Legacy replay/video architecture](specs/replay-video/CORE-REPLAY-VIDEO-ARCHITECTURE.md)

## Cesium, Mapping, and Environment

### Current

- [Provider and layer integration](specs/cesium/HOW_TO_ADD_PROVIDERS_LAYERS.md)
- [Cesium Ion token management](specs/cesium/CESIUM-ION-TOKEN-MANAGEMENT.md)
- [Elevation design](specs/cesium/CORE-ELEVATION-DESIGN.md)
- [Cesium Ion layers](specs/cesium/CESIUM-ION-LAYERS-SPEC.md)

### Planned

- [Cesium cloud resources research](todo/CORE-CESIUM-CLOUD-MANAGEMENT-RESEARCH.md)
- [Copernicus Sentinel-2 integration](todo/CORE-COPERNICUS-SENTINEL2-SPEC.md)
- [Journey time and Cesium lighting](todo/CORE-JOURNEY-CESIUM-TIME-LIGHTING-SPEC.md)
- [Layer time filtering](todo/CORE-LAYER-TIME-FILTER-SPEC.md)

## Journeys, Tracks, and Data

### Current

- [Journey settings](specs/data/JOURNEY_SETTINGS_README.md)
- [Settings synchronization](specs/data/SETTINGS_SYNC_GUIDE.md)
- [Internal database architecture](specs/data/CORE-INTERNAL-DATABASE-ARCHITECTURE.md)
- [LocalDB API reference](specs/data/CORE-LOCALDB-API-REFERENCE.md)
- [Cache](specs/data/CORE-CACHE-README.md)

### Planned

- [Journey import formats](todo/JOURNEY_IMPORT_FORMATS_SPEC.md)
- [Tracks editor](todo/TRACKSEDITOR-SPEC.md)
- [Cloud synchronization](todo/CLOUD-SYNC-TODO.md)
- [Journey and track map selection](todo/CORE-JOURNEY-CLICK-OVERLAY-SELECTION-SPEC.md)

## User Interface, Widgets, and Assets

### Current

- [Panels](specs/ui-widgets/CORE-UI-PANELS-README.md)
- [Context menu](specs/ui-widgets/CORE-UI-CONTEXT-MENU-README.md)
- [Widget manager](specs/ui-widgets/CORE-WIDGET-MANAGER-README.md)
- [Widget-to-canvas rendering](specs/ui-widgets/CORE-WIDGET-MANAGER-WIDGET-2-CANVAS-README.md)
- [Dynamic widget rendering](specs/ui-widgets/CORE-WIDGET-MANAGER-DYNAMIC-RENDER-README.md)
- [CSS assets](specs/ui-widgets/ASSETS-README-CSS.md)
- [Flags](specs/ui-widgets/PUBLIC-FLAGS-README.md)
- [Logos](specs/ui-widgets/PUBLIC-LOGO-README.md)

### Planned

- [Arrow widget](todo/ARROW_WIDGET_SPEC.md)
- [Brand and season swatch reactivity](todo/BRAND_SEASON_SWATCH_REACTIVITY_SPEC.md)
- [Non-distorting widget resize](todo/CORE-WIDGET-NON-DISTORTING-RESIZE-SPEC.md) — TODO, 1.0.0
- [Main UI work](todo/MAINUI-TODO.md)
- [Profile work](todo/PROFILE-TODO.md)
- [Translation notes](todo/Translate.md)

## Runtime, Events, and Application Platform

### Current

- [Event system](specs/platform/CORE-EVENTS-README.md)
- [EventEmitter library](specs/platform/ASSETS-LIBS-EVENTEMITTER-README.md)
- [PWA architecture](specs/platform/PWA-README.md)
- [Tunnel](specs/platform/TUNNEL-README.md)
- [Dependency inventory](specs/delivery/README_DEPENDENCIES.md)
- [Bun command reference](specs/delivery/HOW_TO_BUN_COMMANDS.md)

## Build, Quality, and Delivery

### Current

- [Deployment](specs/delivery/DEPLOYMENT-README.md)
- [GitHub Project release and branch workflow](specs/delivery/TECH-GITHUB-PROJECT-RELEASE-WORKFLOW-SPEC.md)
- [Oxlint TypeScript 7 migration status](specs/delivery/CORE-OXLINT-TYPESCRIPT-7-MIGRATION.md)

### Historical

- [Oxlint TypeScript 7 migration proposal](specs/delivery/OXLINT_TYPESCRIPT_7_MIGRATION_SPEC.md)

### Planned

- [Bun build and test migration study](todo/CORE-BUN-BUILD-TEST-MIGRATION.md)
- [GitHub Actions deployment migration](todo/CORE-GITHUB-ACTIONS-DEPLOYMENT-MIGRATION.md)

## APIs and Services

### Current

- [Count API and public statistics](specs/apis-services/WEEKLY-COUNT-API-SPEC.md)

### Historical

- [Backend count API issue](specs/apis-services/WEEKLY-COUNT-API-SERVER-ISSUE.md)
- [Studio count API issue](specs/apis-services/WEEKLY-COUNT-API-STUDIO-ISSUE.md)

## Directory Indexes

- [Current implementation documentation](specs/README.md)
- [Proposed and pending work](todo/README.md)
