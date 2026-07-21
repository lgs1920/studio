# LGS1920 Studio

LGS1920 Studio is a web-based geospatial editor built to load, inspect, edit, and present journeys, tracks, and points
of interest on top of a Cesium scene. The application is centered on privacy-first, local-first editing, rich camera
workflows, and media capture for map storytelling.

## Current Application State

The application is already a working geospatial studio, not just a map viewer. It lets users import outdoor journeys,
organize them, inspect their geometry and statistics, style their traces, attach points of interest, and prepare visual
outputs from the same workspace. The default posture is privacy-first: journey data is edited in the browser, most
project state is kept locally, and exports are explicit user actions. IndexedDB is used for persisted journeys, widgets,
settings, and cached runtime data.

The current product surface is built around Cesium. Users can move between 2D and 3D views, focus the camera
on journeys or POIs, run orbit and panorama camera modes, and record the scene with selected overlays. The widget system
is also part of the core workflow: widgets can be positioned, resized, locked, ordered, reduced, and captured by the
video/snapshot pipeline.

Replay and media export are active parts of the codebase. Journey Replay already has a sampler, playback controller,
Cesium renderer, camera behavior, recorder synchronization, replay clips, overlay visibility rules, and a deferred HQ
MP4 export path. The current Replay UI still uses start/stop clip lists, but the underlying video stack already works
with deterministic frames and replay phases.

The repository already contains the main product surface used by the studio:

- Journey, track, and POI management
- Journey group management
- GeoJSON, KML, and GPX import
- Cesium-based 2D / 3D scene navigation
- Journey and POI focus workflows
- Live orbit rotation and panorama controls
- Camera interaction hints and an exportable shortcuts reference panel for app, map, and widget controls
- Elevation-aware metrics and profile widgets
- Widget rendering, placement, ordering, reduction, locking, and export-aware capture
- Geocoding tools and coordinate utilities
- Journey Replay playback and replay-aware video synchronization
- Video recording, deferred HQ export, and image snapshot workflows
- Deterministic HQ camera following for navigation and dynamic corrections, including 1.5-second transitions
- IndexedDB persistence for editor state and loaded content
- Privacy-first local workspace for imported journeys and generated media
- PWA support and offline-friendly caching
- Boot splash video loading uses browser-supported video element preloading

## Main Features

### Journey Editing

- Load and manage multiple journeys at once
- Organize journeys into reusable groups from the Journey Groups drawer
- Edit journey metadata, activity, track styling, visibility, and POI visibility
- Handle start / stop flags and parented POIs
- Tune journey statistics cleaning through activity-aware thresholds persisted with each journey
- Style tracks with presets, underlay, dash patterns, bicolor dashes, far-distance fallback lines, and locator markers
- Persist journey camera state and orbit settings

### Scene and Camera

- Cesium-powered globe and map rendering
- Focus on journeys, tracks, POIs, or arbitrary coordinates
- Continuous orbit rotation with live speed and direction controls
- Panorama mode with live height, pitch, speed, and direction controls
- Camera movement feedback with lock-aware on-map display
- Compass, scene mode switching, and camera targeting helpers

### Metrics and Visualization

- Distance, elevation, duration, speed, and slope metrics
- Elevation profile and journey statistics widgets
- Journey statistics can expose extrema on the map through temporary POI markers
- Responsive date and time display for editors, POIs, and journey statistics
- Text, credits, compass, and scene widget system with draggable, reducible, and lockable on-map controls
- Export-aware widget rendering for recording and snapshots

### Media Workflows

- Video crop area and recording UI
- Snapshot capture
- Media composition through canvas overlays
- Recorder pipeline based on Mediabunny
- Replay-aware recording sync and explicit HQ MP4 generation
- Dynamic overlay visibility for replay-driven widgets

### Journey Reports

- Export journeys as GPX or GeoJSON, including associated POIs while excluding generated start / end system markers
- Export journeys as PDF reports or HTML reports packaged as ZIP archives
- Include journey metadata, description, statistics, dates, elevation profile, POI tables, coordinates, and altitude data
- Generate 2D overview maps and 3D Cesium map captures for the four cardinal orientations
- Add POI badges, start / end markers, walking direction markers

### App Platform

- Local browser persistence with IndexedDB
- Privacy-first by default: user journeys and editor state stay in the browser unless the user exports, shares, syncs, or enables a provider-backed feature
- Settings and widget configuration from YAML files in `public/`
- Shared shortcut catalog displayed in the information drawer, with PDF export
- PWA service worker and version-aware caching

## Upcoming Evolutions

### Drone Mode

Drone mode is the next camera evolution. The goal is to model the camera as an actual drone path with GPS positions,
duration, motion profiles, look-at targets, and optional 360-degree maneuvers. This is intentionally separate from
Journey Replay: the drone path engine should be reusable, deterministic, and testable without a live Cesium scene, while
Cesium remains the runtime adapter that applies the final camera pose.

The first version focuses on a path model, target model, easing, runtime controller, and Cesium adapter. It also defines
deterministic clip transitions, immediate or animated fly-to moves, variable-speed take-off and landing, and directly
editable 3D Bezier camera paths. A later authoring version is planned around a Three.js preview/editor so users can shape
a camera path visually before running it in the main scene.

Technical spec: [Drone camera path architecture](tech-doc/src/core/ui/camera/DRONE_CAMERA_PATH_ARCHITECTURE.md).

### Video Editor

The video editor evolution replaces the current separated Replay `start` / `replay` / `stop` clip UI with a track-based
timeline inside the Replay drawer. The replay clip remains mandatory, but it becomes part of a video-editor-like timeline
where start clips, the locked replay, stop clips, and widget clips are edited together.

Widget tracks are capped at 120, can be reordered by dragging their track headers, and never allow overlapping clips on
the same track. The replay track stays locked as the lowest visual track so it does not hide the widget tracks. Widget
clips control when a widget appears in the video; the existing widget manager still owns screen position, scale, bounds,
and export capture. Enter and exit effects are deterministic so live preview, draft recording, and HQ export can render
the same result.

Technical spec: [Replay track timeline editor evolution](tech-doc/src/core/ui/replay/REPLAY_TRACK_TIMELINE_EDITOR_EVOLUTION.md).

## Technical Documentation

All technical specifications and architecture notes are centralized in [tech-doc/](tech-doc/README.md). Important entry
points include:

- [Replay video architecture](tech-doc/src/core/ui/replay/REPLAY_VIDEO_ARCHITECTURE.md)
- [Replay track timeline editor evolution](tech-doc/src/core/ui/replay/REPLAY_TRACK_TIMELINE_EDITOR_EVOLUTION.md)
- [Drone camera path architecture](tech-doc/src/core/ui/camera/DRONE_CAMERA_PATH_ARCHITECTURE.md)
- [Widget manager](tech-doc/src/core/ui/widget-manager/README.md)
- [Screen media recorder](tech-doc/src/core/ui/screen-media-recorder/recorder/README.md)
- [Canvas overlay composer](tech-doc/src/core/ui/screen-media-recorder/composer/README.md)
- [Tracks editor spec](tech-doc/src/components/TracksEditor/spec.md)
- [All technical docs](tech-doc/README.md)

## Technology Stack

This README only highlights the main runtime pieces. Technical documentation is centralized in
[tech-doc/](tech-doc/README.md), including the complete dependency inventory.

- **Runtime**: Bun
- **Frontend**: React
- **State management**: Valtio
- **Map / 3D engine**: Cesium
- **UI libraries**: Web Awesome, Shoelace
- **Charts**: ECharts
- **Geospatial processing**: Turf, Mapbox GeoJSON helpers, `@tmcw/togeojson`
- **Recording / export**: Mediabunny, html2canvas, canvg, jsPDF, SnapDOM
- **Build tooling**: Vite, `@vitejs/plugin-react`, `vite-plugin-cesium`, `vite-plugin-pwa`
- **Tests**: Vitest, Testing Library React

## Project Layout

- `src/core/`: application core, stores, camera / scene managers, DB layer, widget manager, media recorder
- `src/components/`: React UI components for editing, map controls, widgets, video tools, and panels
- `src/Utils/`: Cesium and app utilities
- `public/`: static configuration, widgets catalog, service worker, images, changelog, and runtime assets
- `deployment/`: deployment helpers and environment-specific deployment scripts
- `tech-doc/`: technical specifications, architecture notes, and module-level documentation

## Development

### Prerequisites

- Bun installed locally
- A modern browser with WebGL support

### Install

```bash
bun install
```

### Run the Development Server

```bash
bun run dev
```

Important: the Vite dev server is currently configured to run on `dev.lgs1920.fr:5173` in `vite.config.ts`. If your
machine does not resolve that host locally, either:

1. add an entry in your hosts file for `dev.lgs1920.fr`
2. or adapt the Vite server configuration for your environment

### Other Scripts

```bash
bun run build
bun run preview
bun run test
bun run test:watch
bun run lint
bun run deploy
```

## Configuration Notes

- Application settings are primarily defined in `public/settings.yaml`
- Map, overlay, and terrain providers are documented in [tech-doc/README_PROVIDERS.md](tech-doc/README_PROVIDERS.md)
- Widget registration is defined in `public/widgets.yaml`
- PWA behavior is configured through `vite.config.ts` and `public/service-worker-pwa.js`
- Static version metadata is stored in `public/version.json` and `public/build.json`

## Dependencies

The root dependency documentation has been synchronized with the current `package.json`:

- Full package inventory: [tech-doc/README_DEPENDENCIES.md](tech-doc/README_DEPENDENCIES.md)
- Build and runtime commands: [package.json](package.json)

## Contributing

Contributions are welcome under the same AGPL terms as the repository.

- Contribution terms: [CONTRIBUTOR_LICENSE_AGREEMENT.md](CONTRIBUTOR_LICENSE_AGREEMENT.md)

For contribution questions: `contact@lgs1920.fr`

## License

This project is licensed under the **GNU Affero General Public License v3.0 or later**.

- See [LICENSE.md](LICENSE.md) for the full license text
- See [LICENSES.md](LICENSES.md) for the repository licensing model summary

Copyright © 2026 LGS1920

## Sponsors

This project welcomes sponsors who want to help support its continued development, hosting, maintenance, and the cartographic data and services that power it. If your organization would like to become a sponsor, your contribution will help keep the studio sustainable and allow the project to evolve over time.
