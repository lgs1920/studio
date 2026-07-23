# Journey Import Formats Specification

**Status:** Proposed  
**Target milestone:** `1.1.0`  
**Baseline:** `1.0.0`  
**Scope:** Local FIT/TCX file import, Strava activity import, and metadata preservation

## Executive summary

LGS1920 Studio can support Garmin FIT and Strava-originated activities, but these are two different product features:

1. **FIT file import** is a local binary-file parser. It is compatible with Garmin exports and with original FIT files exported from Strava.
2. **Strava import** is an authenticated provider integration. It must use Strava OAuth and a server-side exchange; it is not equivalent to accepting a public Strava URL.

The recommended implementation order is:

1. Add local `.fit` import using Garmin's official JavaScript FIT SDK.
2. Add local `.tcx` import because TCX preserves heart rate, cadence, and power in common Strava exports.
3. Add an optional Strava connector that imports activity metadata and streams through the API. Keep the connector independent from the local file parser.

This fits the existing architecture: the loader already accepts GPX/KML/GeoJSON/JSON, `Journey` already normalizes supported inputs into GeoJSON, and metrics already expose `global`, `user`, `external`, and `points` buckets.

## Current baseline

The current importer is intentionally format-oriented:

- `JourneyLoaderUI` validates the extension against `.geojson`, `.json`, `.kml`, and `.gpx`.
- `FileUtils.readFileAsTextAsync()` assumes that the selected file is text.
- `TrackUtils.loadJourneyFromFile()` passes `{name, extension, content}` to `Journey.create()`.
- `Journey.getGeoJson()` parses GPX/KML/XML or JSON and converts the result to GeoJSON.
- `Track` stores the normalized GeoJSON feature and computes metrics from its coordinates.
- IndexedDB stores the serialized `Journey` and `Track` objects.
- The existing remote URL endpoint is designed around a readable text file and should not be reused as an authenticated Strava integration.

The current model is already suitable for richer imports, but the import contract must become binary-safe and must distinguish normalized geometry from source-specific observations.

## Product decisions

### In scope

- Import Garmin FIT Activity and Course files from a local file picker or drop zone.
- Import TCX Activity/Course files from a local file picker or drop zone.
- Import original FIT files exported from Strava.
- Preserve supported sensor and activity metadata without making it required for map rendering.
- Optionally import a Strava activity through OAuth in a later phase.
- Keep imported journeys editable, replayable, reportable, and exportable as GPX/GeoJSON.

### Out of scope for the first implementation

- Garmin Connect OAuth or Garmin cloud synchronization.
- Uploading or editing activities on Strava.
- Full FIT round-trip export.
- Reconstructing every vendor-specific developer field in the UI.
- Treating health data such as heart rate as public map data by default.
- Importing an arbitrary Strava page URL without authentication.

## Format capability assessment

| Source / format | Geometry | Time | Elevation | Sensor data | Recommended handling |
|---|---:|---:|---:|---:|---|
| GPX | Yes | Often | Often | Limited | Keep current path |
| GeoJSON/KML | Yes | Usually no | Optional | No | Keep current path |
| TCX | Yes | Yes | Yes | HR/cadence/power often available | Add XML adapter |
| FIT Activity | Yes | Yes | Yes | Rich sensor, lap, event, device data | Add binary adapter |
| FIT Course | Usually route/course points | Optional | Optional | Workout/course metadata | Import as route-like journey; mark missing observations |
| Strava API | Via streams | Yes | Via altitude stream | Depends on requested streams | Add provider adapter |

Strava is therefore a source/provider, not a file format. A Strava activity may be exported as GPX or TCX, and its original upload is often FIT. The local FIT adapter should work without knowing that the file came from Strava.

## Proposed normalized import contract

Replace the text-only loader payload with a binary-safe envelope:

```js
{
  name: 'activity-name',
  extension: 'fit',
  source: {
    kind: 'local-file', // local-file | strava-api | remote-url | sample
    provider: 'garmin', // garmin | strava | null
    providerActivityId: null,
  },
  content: ArrayBuffer,
  originalFile: {
    name: 'activity.fit',
    size: 123456,
    mime: 'application/octet-stream',
    sha256: 'optional-content-hash',
  },
}
```

Text formats may continue to use a string `content` value, but all adapters should accept `ArrayBuffer` or `Uint8Array`. The adapter, not the UI, owns format detection and validation.

### Adapter interface

```js
{
  id: 'fit',
  extensions: ['fit'],
  mimeTypes: ['application/fit', 'application/octet-stream'],
  canParse(input): boolean,
  parse(input, options): Promise<NormalizedJourneyImport>,
}
```

`NormalizedJourneyImport` should contain:

```js
{
  title,
  description,
  activity,
  geometry: GeoJSON.FeatureCollection,
  observations: {
    points: [],
    laps: [],
    sessions: [],
    events: [],
  },
  externalMetrics: {},
  sourceMetadata: {},
  warnings: [],
}
```

### Import pipeline

All import sources must follow the same pipeline after source acquisition:

```text
source acquisition
  -> size/type/signature validation
  -> source adapter
  -> normalized records
  -> geometry builder
  -> observation and external-metric builder
  -> Journey / Track creation
  -> computed metrics extraction
  -> duplicate check
  -> IndexedDB persistence
  -> Cesium drawing and Replay availability
```

The adapter must be deterministic and side-effect free. It must not access `lgs`, IndexedDB, Cesium, or the UI. This keeps FIT and TCX parsing testable in Node/Vitest and allows the Strava adapter to be tested against recorded API fixtures.

### Source detection

Extension filtering is only a UX optimization. The importer must also inspect the content:

- FIT: validate the 12/14-byte header and `.FIT` signature before decoding;
- XML: inspect the root namespace/local name and route to GPX, KML, or TCX;
- JSON: parse safely, then validate GeoJSON shape;
- Strava API: validate the provider response schema before normalization.

The UI must never trust a browser-provided MIME type. A renamed or incorrectly typed file should produce a format-specific error rather than an opaque parser exception.

### Normalized record model

Every adapter should emit records using the following internal shape:

```js
{
  timestamp: 'ISO-8601 string or null',
  latitude: 45.123,
  longitude: 6.123,
  altitudeMeters: 1234.5,
  distanceMeters: 456.7,
  speedMetersPerSecond: 2.8,
  heartRateBpm: 145,
  cadenceRpm: 80,
  powerWatts: 210,
  temperatureCelsius: 18,
  gradePercent: 4.2,
  sourceIndex: 42,
  sourceMessage: 'record',
}
```

Only `timestamp`, `latitude`, and `longitude` are required to create a timed GPS point. All other fields are nullable. Values must retain their original units in the normalized layer; conversion to display units belongs to the existing unit utilities.

### Geometry segmentation rules

- Start a new segment when the source explicitly signals a session/lap boundary and the boundary represents a discontinuity.
- Start a new segment when two valid GPS points are separated by more than the configured maximum time gap.
- Do not create a segment for a missing sensor value alone.
- Do not interpolate positions, altitude, or sensor values during import.
- Preserve source order when timestamps are absent.
- Sort only records with reliable timestamps; retain a warning when records were reordered.
- Reject the import when no segment contains at least two valid positions.

## Detailed adapter specifications

### FIT adapter (`#388`)

#### Input types

- FIT Activity (`file_id.type = activity`): one or more recorded sessions and sensor records.
- FIT Course (`file_id.type = course`): route geometry and course points, usually without live observations.
- FIT Workout: not a journey by default; report as unsupported unless a future workout-to-route feature is explicitly enabled.

#### Decoder requirements

- Use the official Garmin JavaScript SDK where licensing and bundle size are acceptable.
- Decode from `ArrayBuffer` / `Uint8Array`, never from a UTF-8 string.
- Call `isFIT`, integrity validation, and decoder read methods in that order.
- Keep decoder callbacks bounded; reject files that exceed configured record/session limits.
- Ignore unknown native messages and preserve recognized developer fields as opaque metadata.
- Capture decoder warnings without aborting a file that still has usable GPS geometry.

#### FIT-specific behavior

- Use `record.position_lat` / `record.position_long` semicircle conversion supplied by the SDK.
- Convert FIT epoch timestamps through the SDK, not hand-written epoch arithmetic.
- Prefer `session` totals for imported external metrics and `record` samples for point observations.
- Use `timer_time` for moving duration when available and `total_timer_time` / elapsed time for total duration.
- Treat invalid FIT sentinel values as null.
- Keep manufacturer, product, serial number, device name, sport, sub-sport, and file creation time in `sourceMetadata`.
- For multi-session files, create separate tracks only when sessions have distinct GPS sequences; otherwise merge chronologically and retain session boundaries.

#### FIT acceptance examples

- Garmin walking activity with GPS, altitude, heart rate, and cadence.
- Garmin cycling activity with power and developer fields.
- Strava “Export Original” FIT file.
- FIT file with valid header but CRC failure.
- FIT course with positions but no `record` messages.
- FIT activity with pause/resume events and missing heart rate.

### TCX adapter

#### Input types

- Training Center XML `Activity` containing one or more `Lap` elements.
- TCX `Courses` containing route points.
- Strava-exported TCX with vendor extensions.

#### Parser requirements

- Parse XML with `DOMParser` and reject parser errors.
- Match elements by namespace URI and local name; do not rely on a single vendor prefix.
- Read all trackpoints, including multiple `Track` elements within a lap.
- Preserve `DistanceMeters` as an observation but calculate authoritative geometry distance using the existing metric pipeline.
- Read sensor fields from standard nodes and known extension paths without failing on unknown extensions.
- Report the number of skipped trackpoints and the reason for each category of skip.

#### TCX acceptance examples

- TCX with GPS and altitude only.
- TCX with heart rate, cadence, and power extensions.
- TCX with multiple laps and pause gaps.
- TCX with an indoor activity and no GPS; reject as a journey unless a future non-map activity mode exists.

### Strava activity adapter

The Strava adapter is not a file parser. It converts API activity details and streams into normalized records.

#### Required API flow

1. List the authenticated athlete's activities with pagination and date filters.
2. Let the user select one activity; do not import an entire account silently.
3. Fetch the detailed activity.
4. Request only the streams needed for the selected import mode.
5. Normalize available streams by shared index/time alignment.
6. Import geometry and external metrics, with warnings for absent streams.

#### API behavior

- Handle pagination, 401 refresh, 403 scope denial, 404 deleted/private activity, 429 rate limit, and 5xx retryable failures.
- Use exponential backoff only for safe GET requests and respect provider retry headers.
- Cache the selected activity response only for the current import operation unless the user enables provider sync.
- Store the Strava activity ID and start timestamp as the stable source identity.
- Do not infer privacy-zone points that are intentionally absent.

#### Import modes

| Mode | Geometry | External metrics | Sensor point observations |
|---|---:|---:|---:|
| Geometry only | Yes | Basic activity summary | No |
| Activity metrics | Yes | Distance, duration, elevation, calories, speed | No |
| Full available streams | Yes | All available summary metrics | HR/cadence/power/temp/grade |

The default should be **Activity metrics**, with **Full available streams** requiring explicit consent because the data may be health-related.

## Metrics reconciliation

The application currently computes metrics from the normalized track. Imported source metrics may differ because providers apply pause handling, map matching, smoothing, privacy clipping, or device-specific calculations.

The following rules apply:

1. `metrics.global` remains the Studio-computed value used by Replay and existing reports.
2. `metrics.external` stores the provider/device value with a `source` and `importedAt` field.
3. The UI may show both values and a difference indicator.
4. No automatic overwrite is allowed unless a future explicit “use imported totals” setting is introduced.
5. Source metrics without a compatible unit or timestamp basis must be retained as raw metadata only.

For each external metric, store provenance:

```js
{
  value: 1234.5,
  unit: 'm',
  source: 'fit.session.total_distance',
  confidence: 'source-reported',
}
```

## Duplicate identity

Duplicate detection must use more than the display filename:

- Local files: SHA-256 content hash when available, otherwise normalized filename plus size and first timestamp.
- Strava: provider name plus athlete identity plus activity ID.
- FIT from Strava and the same local FIT file: keep the provider identity when known, but do not assume a local file is Strava-originated solely from FIT metadata.

When a duplicate is detected, the UI should offer “Cancel”, “Import as copy”, or “Replace existing” only after a future replacement workflow is designed. The first implementation should keep the current safe behavior: do not import duplicates.

## Issue breakdown

The implementation is tracked as the following issues:

- [#388 — Garmin FIT loader](https://github.com/lgs1920/studio/issues/388): binary local import, FIT validation, Activity/Course decoding, and FIT metadata.
- [#391 — TCX journey loader](https://github.com/lgs1920/studio/issues/391): local XML parsing, sensor extensions, and TCX normalization.
- [#392 — Import Strava activities from API streams](https://github.com/lgs1920/studio/issues/392): activity selection, API streams, provider identity, and normalized import.
- [#393 — Add Strava OAuth authentication](https://github.com/lgs1920/studio/issues/393): OAuth authorization, token lifecycle, revocation, and the dependency on [#372](https://github.com/lgs1920/studio/issues/372).

Each implementation issue must link back to this document and must keep the adapter, persistence, UI, security, and test requirements in scope.

## Issue dependencies and ownership

The issues are related, but they do not represent the same feature. The main distinction is between **source acquisition**, **provider authentication**, and **journey normalization**.

```text
                    ┌──────────────────────────────┐
                    │ #385 Cloud File Manager       │
                    │ remote file discovery/fetch   │
                    └──────────────┬───────────────┘
                                   │ provides binary/text files
                                   ▼
                    ┌──────────────────────────────┐
                    │ Shared import pipeline        │
                    │ validation → adapter → Journey│
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    │                              │
                    ▼                              ▼
          ┌──────────────────┐           ┌──────────────────────┐
          │ #388 FIT loader  │           │ #391 TCX loader      │
          │ local/remote FIT │           │ local/remote TCX     │
          └──────────────────┘           └──────────────────────┘

                    ┌──────────────────────────────┐
                    │ #393 Strava OAuth            │
                    │ auth, tokens, revocation     │
                    └──────────────┬───────────────┘
                                   │ authenticated API access
                                   ▼
                    ┌──────────────────────────────┐
                    │ #392 Strava activity import │
                    │ activity list + API streams │
                    └──────────────────────────────┘
```

### #385 — Cloud File Manager

`#385` owns generic remote-file acquisition and cloud-provider UX. It should provide a file-like result to the shared import pipeline, including filename, extension, MIME type, size, source provider, and binary-safe content. It should not contain FIT, TCX, or Strava-specific parsing logic.

Potential consumers are:

- `#388` for remote Garmin or Strava-exported FIT files;
- `#391` for remote TCX files;
- the existing GPX/KML/GeoJSON/JSON importers.

`#385` is therefore an optional upstream dependency for remote-file import, but not a prerequisite for local FIT/TCX support.

### #388 — Garmin FIT loader

`#388` owns the FIT decoder, FIT validation, FIT Activity/Course mapping, source metadata, observations, and external metrics. It can be delivered independently for local files. Remote FIT support becomes available when `#385` can return binary-safe file content.

### #391 — TCX journey loader

`#391` owns TCX XML parsing and normalization. Like `#388`, it should work locally first and consume `#385` only for remote files. It shares the normalized record contract and persistence model with FIT.

### #393 — Strava OAuth

`#393` is the authentication dependency for direct Strava API access. It owns authorization-code flow, scopes, callback validation, token storage, refresh, disconnect, revocation, and deauthorization handling. It is related to [#372 — Add Cloud access](https://github.com/lgs1920/studio/issues/372).

`#393` is not required for importing a local FIT file exported from Strava. It is required before `#392` can list or import activities directly from Strava.

### #392 — Strava activity import

`#392` owns Strava-specific activity discovery and stream normalization. It depends on `#393` for authenticated API access, but it should reuse the same normalized Journey import contract as `#388` and `#391`.

It should not depend on `#385` for the normal API flow. A Strava activity is not a remote file-manager item: it is a provider resource composed of activity metadata and multiple aligned streams. `#385` is relevant only if a future workflow allows users to download a Strava-exported FIT/TCX file and route it through the generic cloud-file path.

### Recommended implementation order

1. Shared binary-safe import contract and adapter registry.
2. `#388` local FIT loader.
3. `#391` local TCX loader.
4. `#385` cloud file acquisition integration with the shared import pipeline.
5. `#393` Strava OAuth and token lifecycle.
6. `#392` Strava activity listing, stream retrieval, and normalization.

This order keeps local imports useful offline, allows `#385` to remain format-agnostic, and prevents the Strava API integration from being incorrectly modeled as a generic file download.

## Testing strategy

### Unit tests

- header/signature and CRC validation;
- FIT timestamp, semicircle position, sentinel, unit, and developer-field handling;
- TCX namespace and extension parsing;
- stream alignment with missing values;
- segmentation and gap handling;
- metric reconciliation and source provenance;
- duplicate identity generation;
- backward-compatible Journey/Track deserialization.

### Integration tests

- local picker and drop zone for binary FIT files;
- batch import with mixed GPX, TCX, and FIT files;
- failed file does not prevent later files from importing;
- imported journey is persisted, reloaded, drawn, replayed, and exported;
- Strava activity selection and cancellation;
- expired OAuth access token refresh;
- provider deauthorization and disconnect.

### Fixture policy

Fixtures must be synthetic or legally redistributable. Do not commit personal activity files or raw health data. A fixture manifest should record format, file type, expected track count, expected point count range, expected available streams, and expected warnings.

The existing `Journey` constructor can then receive normalized geometry plus `metrics.external`, while the source metadata and observations are persisted as new optional fields.

## Data mapping

### Core geometry

For FIT and TCX record points:

- longitude and latitude become GeoJSON coordinate positions;
- altitude becomes coordinate index `2` when valid;
- timestamps become `feature.properties.coordinateProperties.times`;
- invalid coordinates are discarded with a warning;
- records are ordered by timestamp when timestamps are present;
- pauses and gaps are not silently interpolated;
- multiple sessions/laps may become multiple LineString features when there is a meaningful discontinuity.

The normalized output must remain consumable by the current `Journey.getTracksFromGeoJson()` and replay sampler.

### FIT mapping

The first FIT implementation must support these message families:

- `file_id`: file type, manufacturer, product, creation time;
- `activity`: activity timestamp, type, event, event type;
- `session`: sport, sub-sport, start time, elapsed time, timer time, distance, ascent/descent, calories, average/max speed, average/max heart rate, average/max cadence, average/max power;
- `lap`: lap boundaries and lap metrics;
- `record`: timestamp, position, altitude, distance, speed, heart rate, cadence, power, temperature, grade when available;
- `event`: timer/pause/resume/lap markers where available;
- developer fields: preserve as opaque source metadata unless explicitly mapped and validated.

FIT files must be checked with the SDK's file signature/integrity mechanisms before decoding. Unknown messages and fields must not make a valid file fail import.

### TCX mapping

The TCX adapter should parse `Activities`, `Activity`, `Lap`, and `Trackpoint` elements, including:

- `Time`;
- `Position/LatitudeDegrees` and `LongitudeDegrees`;
- `AltitudeMeters`;
- `DistanceMeters`;
- `HeartRateBpm`;
- `Cadence`;
- `Power` when present in an extension;
- activity sport and lap totals.

Namespace handling must be local-name based or namespace-aware. TCX producers commonly add vendor extensions, so unknown extension nodes should be ignored safely and optionally preserved in `sourceMetadata`.

### Strava mapping

The Strava connector should request the least privilege required:

- `activity:read` for activities visible to Everyone and Followers;
- `activity:read_all` only when the user explicitly enables private-activity access.

The connector should list activities, let the user choose one, then request the detailed activity and the required streams. At minimum, request time, distance, latlng, altitude, velocity, heartrate, cadence, watts, temperature, and grade when available. Missing streams are normal and must not fail the import.

Strava API data should be converted to the same normalized import contract as FIT/TCX. Provider identifiers must be retained in source metadata so that duplicate detection is stable even when the display title changes.

The connector must not put a Strava client secret or refresh token in browser code. OAuth callback, token exchange, refresh, revocation, and provider requests belong in the backend. The browser receives only a short-lived application session or an import result.

## Persistence model

Add optional fields without breaking existing IndexedDB records:

```js
journey.source = {
  kind: 'local-file',
  provider: 'garmin',
  providerActivityId: null,
  originalFilename: 'activity.fit',
  format: 'fit',
  importedAt: 'ISO-8601 timestamp',
  contentHash: null,
}

journey.metrics.external = {
  source: 'fit',
  distance: null,
  duration: null,
  movingDuration: null,
  calories: null,
  heartRate: {average: null, maximum: null},
  cadence: {average: null, maximum: null},
  power: {average: null, maximum: null},
  temperature: {average: null, minimum: null, maximum: null},
}

track.observations = {
  points: [],
  laps: [],
  events: [],
}
```

Computed metrics remain authoritative for geometry-derived values. External values are displayed as imported measurements and must never silently overwrite computed distance, duration, elevation, or speed. The UI should show the source when values differ.

The default report/export path should omit sensitive sensor observations unless the user explicitly selects “include activity sensor data”. GPX/GeoJSON exports should preserve geometry and supported timestamps, not attempt to encode FIT-only fields into an undocumented extension.

## UI changes

Update the existing journey loader as follows:

- accepted formats: `GPX, KML, JSON, GeoJSON, TCX, FIT`;
- use `file.arrayBuffer()` for FIT and `file.text()` for XML/JSON;
- display a format-specific validation result before import;
- show warnings such as “GPS track available; heart-rate stream unavailable”;
- show imported source/provider and duplicate status;
- keep batch import behavior;
- add a separate “Connect Strava” action rather than disguising OAuth as a URL import;
- add a consent step explaining that activity data may contain health-related sensor data;
- allow the user to choose “geometry only” or “geometry + activity metrics” for FIT/TCX imports.

The existing public URL importer may be extended to fetch a public `.fit` file only after its backend response becomes binary-safe. It must not be used to fetch private Strava activity pages.

## Architecture and implementation plan

### Phase 1 — local FIT import

1. Add the official Garmin FIT JavaScript SDK or a reviewed equivalent.
2. Add `src/Utils/importers/` with a registry and `FitJourneyImporter`.
3. Change `JourneyLoaderUI` validation and file reading to support binary content.
4. Extend `TrackUtils.loadJourneyFromFile()` to call the adapter registry.
5. Normalize FIT records to GeoJSON plus external observations.
6. Persist source metadata and imported metrics with backward-compatible defaults.
7. Add fixtures for Activity, Course, missing-GPS, paused, multi-lap, and developer-field files.

### Phase 2 — local TCX import

1. Add `TcxJourneyImporter` using the browser DOM parser.
2. Reuse the same record-to-GeoJSON and observation normalizer as FIT.
3. Add Strava TCX fixtures and verify heart rate, cadence, and power extensions.

### Phase 3 — Strava connector

1. Register an application and configure callback domains per environment.
2. Implement backend OAuth endpoints and encrypted/short-lived token handling.
3. Add provider activity listing, selection, details, and streams requests.
4. Return a normalized import envelope to the browser.
5. Persist provider activity IDs and support explicit disconnect/revoke.
6. Add webhook handling for deauthorization if accounts remain connected.

Garmin Connect API integration should remain a separate project. FIT file import already covers Garmin-originated files without imposing a cloud-account dependency.

## Error handling and security

Import failures should be typed and user-readable:

- invalid extension;
- invalid FIT signature;
- FIT integrity/CRC failure;
- malformed XML;
- no usable GPS points;
- unsupported FIT file type;
- provider authorization denied;
- provider rate limit;
- provider activity unavailable/private;
- duplicate provider activity.

Security requirements:

- never expose Strava client secrets or refresh tokens to the frontend;
- do not log raw FIT/TCX content or health observations;
- cap file size and decoded record count before allocating large arrays;
- validate numeric ranges for coordinates, timestamps, altitude, heart rate, cadence, and power;
- retain only the minimum provider scopes;
- support disconnect and token revocation;
- keep local file imports functional offline.

## Acceptance criteria

- A valid Garmin FIT Activity file imports from the local picker and drop zone.
- An original FIT file exported from Strava imports without any Strava connection.
- A FIT file with no GPS data is rejected with a clear message and is not stored as a journey.
- A FIT file with GPS but no heart-rate stream imports as geometry and reports a warning.
- FIT timestamps and altitude are available to Replay and elevation profiles.
- TCX imports preserve time, position, altitude, heart rate, cadence, and power when present.
- Existing GPX/KML/GeoJSON/JSON imports and remote text imports remain unchanged.
- Computed metrics and external provider metrics remain distinguishable.
- Reimporting the same local file or provider activity is detected deterministically.
- No OAuth secret, refresh token, or raw sensor payload is exposed in browser logs.
- Existing IndexedDB journeys deserialize correctly after the schema change.
- Unit, fixture, loader UI, persistence, replay, and export tests pass.

## Recommendation

Implement local FIT first. It delivers the largest user value with the smallest product and compliance surface: users can export from Garmin Connect or Strava and import directly into the existing local-first workflow. Add TCX next for richer but still file-based sensor data. Treat direct Strava access as an optional integration requiring its own OAuth, privacy, rate-limit, revocation, and backend lifecycle.

## References

- [Garmin FIT SDK](https://developer.garmin.com/fit/)
- [Garmin FIT file types](https://developer.garmin.com/fit/file-types/)
- [Garmin FIT activity files](https://developer.garmin.com/fit/file-types/activity/)
- [Garmin FIT integrity checks](https://developer.garmin.com/fit/cookbook/isfit-checkintegrity-read/)
- [Strava authentication](https://developers.strava.com/docs/authentication/)
- [Strava API reference](https://developers.strava.com/docs/reference/)
- [Strava export formats](https://support.strava.com/hc/en-us/articles/216918437-Exporting-your-Data-and-Bulk-Export)
