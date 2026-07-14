# LGS1920 Studio

LGS1920 Studio is a web-based geospatial editor built to load, inspect, edit, and present journeys, tracks, and points
of interest on top of a Cesium scene. The application is centered on local-first editing, rich camera workflows, and
media capture for map storytelling.

## Current Scope

The repository already contains the main product surface used by the studio:

- Journey, track, and POI management
- Journey group management
- GeoJSON, KML, and GPX import
- Cesium-based 2D / 3D / Columbus scene navigation
- Journey and POI focus workflows
- Live orbit rotation and panorama controls
- Camera interaction hints and an exportable shortcuts reference panel for app, map, and widget controls
- Elevation-aware metrics and profile widgets
- Widget rendering, placement, ordering, reduction, locking, and export-aware capture
- Geocoding tools and coordinate utilities
- Video recording and image snapshot workflows
- IndexedDB persistence for editor state and loaded content
- PWA support and offline-friendly caching

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

### Journey Reports

- Export journeys as GPX or GeoJSON, including associated POIs while excluding generated start / end system markers
- Export journeys as PDF reports or HTML reports packaged as ZIP archives
- Include journey metadata, description, statistics, dates, elevation profile, POI tables, coordinates, and altitude data
- Generate 2D overview maps and 3D Cesium map captures for the four cardinal orientations
- Add POI badges, start / end markers, walking direction markers

### App Platform

- Local browser persistence with IndexedDB
- Settings and widget configuration from YAML files in `public/`
- Shared shortcut catalog displayed in the information drawer, with PDF export
- PWA service worker and version-aware caching

## Technology Stack

This README only highlights the main runtime pieces. The complete dependency inventory lives in
[README_DEPENDENCIES.md](README_DEPENDENCIES.md).

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
- `deployment/`: deployment-related documentation and helpers

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
- Map, overlay, and terrain providers are documented in [README_PROVIDERS.md](README_PROVIDERS.md)
- Widget registration is defined in `public/widgets.yaml`
- PWA behavior is configured through `vite.config.ts` and `public/service-worker-pwa.js`
- Static version metadata is stored in `public/version.json` and `public/build.json`

## Dependencies

The root dependency documentation has been synchronized with the current `package.json`:

- Full package inventory: [README_DEPENDENCIES.md](README_DEPENDENCIES.md)
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
