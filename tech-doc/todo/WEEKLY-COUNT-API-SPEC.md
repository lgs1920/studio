# Technical Specification — Weekly Count API

## Status

Proposal pending validation before implementation.

## Objective

Add a lightweight usage counter for the LGS1920 backend and studio that keeps a single rolling 7-day snapshot of:

- video draft exports
- video HQ exports
- journey loads
- total visits
- unique visits

The implementation must use a simple JSON file, not a database, and it must remain safe under concurrent requests by serializing all read-modify-write operations through a queue.

## Scope

This specification covers two implementation issues:

1. a backend issue for the counting API and file-backed storage
2. a studio issue for the client-side calls that increment the counters at the right points in the app

It also covers the README update for the backend and the technical documentation update that links this spec from `tech-doc/todo/README.md`.

It does not cover:

- dashboards or UI for displaying the counters
- analytics history beyond the current 7-day window
- a database-backed implementation
- cross-process distributed locking
- exposing raw visitor IPs in the `GET` response

## Current state

The existing backend already exposes request-driven API routes such as `ping`, `versions`, `changelog`, `journey/import-url`, and `convert-video`.

The studio already has the lifecycle points needed for instrumentation:

- `AppUtils.init()` pings the backend during application bootstrap
- `TrackUtils.loadJourneyFromFile()` handles successful journey loads
- `VideoRecordingScreenArea.initializeRecorder()` prepares the live draft recording
- `VideoDownloadAndShareDialog.startHqExport()` starts the deferred HQ export flow

The browser persistence architecture described in `tech-doc/current/CORE-INTERNAL-DATABASE-ARCHITECTURE.md` remains unrelated to this feature. The counting API is backend-only and must not be added to the IndexedDB layer.

## Product requirements

### Counter semantics

- A visit increments the total visit counter every time the app successfully boots and reaches the backend.
- A unique visit increments only once per IP during the current 7-day window.
- A journey increments only when a journey is successfully loaded into the app.
- A draft video increments only when a draft video blob has been produced successfully.
- An HQ video increments only when the HQ export finishes successfully and yields a usable blob.

### Retention

- The backend keeps one active 7-day window only.
- No per-event history is retained.
- When the current window expires, the next successful counter operation resets the snapshot before applying the new mutation.

### Privacy

- The GET endpoint must return counts only.
- Raw visitor IPs may be used internally to compute the unique count, but they must not be returned in the public JSON payload.
- The backend must not trust arbitrary client-provided fields over request-derived IP data when a trusted request IP is available.

## Canonical API

The canonical base path is `/count`.

### Read snapshot

`GET /count/`

Alias:

- `GET /count`

Response body:

```json
{
  "windowStartedAt": "2026-07-24T08:00:00.000Z",
  "windowExpiresAt": "2026-07-31T08:00:00.000Z",
  "updatedAt": "2026-07-24T12:34:56.000Z",
  "counts": {
    "visits": 12,
    "uniqueVisits": 4,
    "journeys": 9,
    "videoDrafts": 6,
    "videoHq": 2
  }
}
```

### Increment visit

`POST /count/visit/:ip`

Alias that may be kept for compatibility with the requested route shape:

- `POST /count/visit/IP/:ip`

The backend should normalize the request IP from the connection or `X-Forwarded-For` when available. The path parameter can be used as a compatibility fallback, but it must not be the only trust anchor if a better request IP exists.

Behavior:

- increment `counts.visits`
- increment `counts.uniqueVisits` only when the normalized IP is not already present in the current window
- update the internal IP set timestamp for that window entry
- return the updated snapshot

### Increment journey load

`POST /count/journey`

Alias:

- `PUT /count/journey`

Behavior:

- increment `counts.journeys`
- return the updated snapshot

### Increment draft video

`POST /count/video/draft`

Alias:

- `PUT /count/video/draft`

Behavior:

- increment `counts.videoDrafts`
- return the updated snapshot

### Increment HQ video

`POST /count/video/hq`

Alias:

- `PUT /count/video/hq`

Behavior:

- increment `counts.videoHq`
- return the updated snapshot

## Backend storage model

The backend must use a single JSON file stored under the backend home directory, for example:

- `<backendHome>/data/count.json`

The exact location should follow the backend path helpers already used elsewhere in the server codebase.

Suggested file schema:

```json
{
  "schemaVersion": 1,
  "windowStartedAt": "2026-07-24T08:00:00.000Z",
  "windowExpiresAt": "2026-07-31T08:00:00.000Z",
  "updatedAt": "2026-07-24T12:34:56.000Z",
  "counts": {
    "visits": 12,
    "uniqueVisits": 4,
    "journeys": 9,
    "videoDrafts": 6,
    "videoHq": 2
  },
  "uniqueVisitors": {
    "203.0.113.10": "2026-07-24T11:22:33.000Z"
  }
}
```

Implementation notes:

- `uniqueVisitors` is internal state only
- the GET endpoint must omit the raw IP map
- if the file is missing, the backend must create a zeroed snapshot
- if the file is unreadable or corrupted, the backend must recover to a zeroed snapshot and keep the failure controlled
- writes should be atomic, using a temporary file and rename pattern

## Concurrency model

All count mutations must pass through one in-process FIFO queue.

The queue must serialize:

1. load current snapshot
2. reset expired window if needed
3. apply mutation
4. write the JSON file atomically
5. resolve the request with the updated snapshot

This queue is mandatory because the feature relies on a plain file and not on a database transaction.

Important constraint:

- the queue only protects a single backend process
- if the deployment ever becomes multi-process or multi-worker, this file-backed design must be revisited or replaced with shared locking

## Backend issue breakdown

### Issue 1 — Backend counting API

Deliverables:

- add the `/count` routes
- add the 7-day JSON snapshot storage
- serialize concurrent access through a queue
- return JSON snapshots from the read and write endpoints
- add backend tests for window reset, unique counting, and concurrent serialization
- update the backend README with endpoint summary, storage path, retention policy, and queue behavior

Acceptance criteria:

- `GET /count/` returns the current counts as JSON
- `POST /count/visit/:ip` increments both visit totals correctly
- journey, draft, and HQ increments are tracked independently
- expired windows reset cleanly
- invalid or corrupted JSON does not crash the server
- parallel requests do not corrupt the file or double-apply a single mutation

## Studio integration

The studio must send the counter requests without blocking the user flow and without surfacing counting failures to the UI.

### Instrumentation points

| Event | Suggested hook | Counter endpoint | Notes |
|---|---|---|---|
| Successful app bootstrap | `AppUtils.init()` after backend ping succeeds | `POST /count/visit/:ip` | Fire once per successful app session |
| Successful journey load | `TrackUtils.loadJourneyFromFile()` after `JOURNEY_OK` | `POST /count/journey` | Covers file import, sample loading, and other loaders that reuse the same helper |
| Draft video produced | `VideoDownloadAndShareDialog` stop-recording success path | `POST /count/video/draft` | Count only when a valid draft blob exists |
| HQ video produced | `VideoDownloadAndShareDialog.startHqExport()` after successful export resolution | `POST /count/video/hq` | Count only after the HQ blob is available |

### Studio behavior rules

- counter calls must be fire-and-forget
- failures must be ignored after optional debug logging
- the app must not wait for the counter endpoints before continuing its normal flow
- duplicate instrumentation must be avoided if the same flow can re-enter
- the client must not store the counting state in IndexedDB, Valtio, or local storage

### Studio issue breakdown

#### Issue 2 — Studio counter calls

Deliverables:

- add a small client helper for the `/count` endpoints
- call the visit endpoint once after a successful backend ping
- call the journey endpoint after successful journey load
- call the draft endpoint when a draft video is actually produced
- call the HQ endpoint when the HQ export successfully completes
- add tests that verify the calls are triggered at the correct lifecycle points and are ignored on failure

Acceptance criteria:

- visits are counted once per successful app bootstrap
- journey loads are counted only on success
- draft videos are counted only when the draft blob exists
- HQ videos are counted only when the export succeeds
- counting failures never block the app or show a user-facing error

## Tests and validation

### Backend

- route tests for each increment endpoint
- route test for `GET /count/`
- concurrency test for queued mutations
- reset test for expired windows
- corruption recovery test for invalid JSON

### Studio

- bootstrap test for the visit call
- journey import/load test for the journey call
- draft recording success test for the draft call
- HQ export success test for the HQ call
- negative tests proving failures do not bubble to the UI

## Documentation updates

The implementation work must update:

- backend README
- `tech-doc/todo/README.md`
- this spec if the contract changes during validation

