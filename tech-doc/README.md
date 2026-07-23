# Technical Documentation

This directory centralizes the repository technical documentation. Paths mirror the original source tree when a document belongs to a specific module.

Implementation-document status is organized into two directories:

- [Current](current/): specifications and architecture describing the implemented behavior.
- [TODO](todo/): proposed, pending-validation, or future implementation work.

## Repository

- [Dependencies](README_DEPENDENCIES.md)
- [Providers](README_PROVIDERS.md)
- [Provider list](PROVIDERS-LIST.md)
- [Sync guide](SYNC-GUIDE.md)
- [Journey settings memo](JOURNEY_SETTINGS_MEMO.md)

## Deployment

- [Deployment](deployment/README.md)

## Core

- [Events](src/core/events/README.md)
- [Elevation design](src/core/Elevation/design.md)
- [Cache](src/core/cache/README.md)
- [Internal database architecture](current/src/core/db/INTERNAL_DATABASE_ARCHITECTURE.md)
- [LocalDB API reference](src/core/db/README.md)
- [Panels](src/core/ui/panels/README.md)
- [Context menu](src/core/ui/context-menu/README.md)
- [Drone camera path architecture](current/src/core/ui/camera/DRONE_CAMERA_PATH_ARCHITECTURE.md)

## Replay And Video

- [Replay core](src/core/ui/replay/README-REPLAY.md)
- [Replay video architecture](todo/src/core/ui/replay/REPLAY_VIDEO_ARCHITECTURE.md)
- [JourneyReplay component notes](src/components/JourneyReplay/README-REPLAY.md)
- [Screen media recorder](src/core/ui/screen-media-recorder/recorder/README.md)
- [Canvas overlay composer](src/core/ui/screen-media-recorder/composer/README.md)

## Widgets

- [Widget manager](src/core/ui/widget-manager/README.md)
- [Widget to canvas](src/core/ui/widget-manager/widget-2-canvas/README.md)
- [Dynamic widget renderer](src/core/ui/widget-manager/dynamic-render/README.md)
- [CSS assets](src/assets/README-CSS.md)

## Components

- [Tunnel](src/components/Tunnel/README.md)
- [Ion token technical notes](src/components/Settings/application/profile/ion-token-technical.md)

## Assets And Libraries

- [EventEmitter](src/assets/libs/EventEmitter/README.md)
- [Flags assets](public/assets/images/flags/README.md)
- [Logo assets](public/assets/logo/README.md)

## Current implementation documentation

- [Replay camera tracking zones](current/REPLAY_CAMERA_TRACKING_ZONES.md)
- [Journey replay/video issues](current/JOURNEY_REPLAY_VIDEO_ISSUES.md)
- [Internal database architecture](current/src/core/db/INTERNAL_DATABASE_ARCHITECTURE.md)
- [Drone camera path architecture](current/src/core/ui/camera/DRONE_CAMERA_PATH_ARCHITECTURE.md)

## Implementation TODO documentation

- [Cloud sync](todo/CLOUD-SYNC-TODO.md)
- [HQ 4K video export](todo/HQ_4K_VIDEO_EXPORT_SPEC.md)
- [Journey import formats](todo/JOURNEY_IMPORT_FORMATS_SPEC.md)
- [Translation notes](todo/Translate.md)
- [Drone camera 3D path editor](todo/src/core/ui/camera/DRONE_CAMERA_3D_PATH_EDITOR_SPEC.md)
- [Replay track timeline editor](todo/src/core/ui/replay/REPLAY_TRACK_TIMELINE_EDITOR_EVOLUTION.md)
- [Cesium Ion layers](todo/src/components/cesium/ion-layers-spec.md)
- [Tracks editor](todo/src/components/TracksEditor/spec.md)
- [Profile TODO](todo/src/components/Profile/TODO.md)
- [Main UI TODO](todo/src/components/MainUI/TODO.md)
- [Arrow widget](todo/ARROW_WIDGET_SPEC.md)
- [Video widget](todo/VIDEO_WIDGET_SPEC.md)
- [Replay video architecture](todo/src/core/ui/replay/REPLAY_VIDEO_ARCHITECTURE.md)
