# LGS1920 Studio

**A free, privacy-first studio for turning journeys into videos.**

LGS1920 Studio helps transform GPS journeys into visual stories on interactive Cesium maps. Prepare a Journey Replay, compose the scene with camera movement and on-map widgets, preview the result, and export it as an MP4 video. The same workspace also supports journey analysis, still images, and reports.

## Create journey videos

Video creation is at the heart of Studio. Journey Replay animates a route across the map and keeps the trace, camera, and selected visual elements synchronized. Prepare the map composition, preview the playback, and render a video for download or sharing.

- Import a journey and choose the route to present
- Frame the map and set up the camera for the journey
- Compose the scene with tracks, points of interest, and widgets
- Preview the Replay, then export the finished composition as an MP4
- Capture still images from the map and Replay composition

## Main capabilities

### Journeys and geospatial data

Import GPX, KML, and GeoJSON journeys, organize them into groups, and manage their tracks and points of interest. Export journey data in portable geospatial formats.

### Maps and journey analysis

Explore journeys in Cesium 2D and 3D views. Review distance, elevation, duration, speed, pace, and elevation profiles while navigating or focusing on points of interest.

### Visual composition

Customize track appearance and arrange map widgets for titles, credits, and journey information. Use the same composition in the interactive map, Replay preview, snapshots, and video output.

### Reports and snapshots

Alongside video exports, capture images and create journey reports in PDF or HTML formats.

## Privacy and local storage

Studio is designed to keep the workspace local. Journeys, groups, settings, and widget configuration are stored in the browser, and Replay video is rendered and encoded there. No Studio cloud account or remote project database is required for the core workflow. Exporting or sharing a project or video is initiated by the user.

Map and data providers may receive requests when their services are used. Their own privacy terms and usage limits apply.

## Free and open source

LGS1920 Studio is free to use and open source under the GNU Affero General Public License, version 3 or later. The application has no license fee; external map and data services may have separate terms or charges.

## Development

Install [Bun](https://bun.sh/), then install dependencies and start the development server:

```bash
bun install
bun run dev
```

Install the repository's Git hooks once after cloning:

```bash
bun run git:hooks:install
```

Common project checks:

```bash
bun run test
bun run lint
bun run typecheck
bun run build
```

## Documentation

- [Technical documentation index](tech-doc/README.md)
- [Journey Replay architecture](tech-doc/specs/replay-video/CORE-REPLAY-ARCHITECTURE.md)
- [Video export and media capture](tech-doc/specs/replay-video/CORE-SCREEN-MEDIA-RECORDER-RECORDER-README.md)
- [Local database architecture](tech-doc/specs/data/CORE-INTERNAL-DATABASE-ARCHITECTURE.md)
- [Map providers and layers](tech-doc/specs/cesium/HOW_TO_ADD_PROVIDERS_LAYERS.md)
- [Local map cache](tech-doc/specs/data/CORE-CACHE-README.md)
- [PWA behavior](tech-doc/specs/platform/PWA-README.md)
- [Bun commands](tech-doc/specs/delivery/HOW_TO_BUN_COMMANDS.md)
- [Dependency inventory](tech-doc/specs/delivery/README_DEPENDENCIES.md)

## Contributing

Contributions are welcome under the repository's AGPL terms. See the
[Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md). For questions, contact
studio@lgs1920.fr.

## License

See [LICENSE.md](LICENSE.md) for the license text and [LICENSES.md](LICENSES.md) for the repository's licensing model.
