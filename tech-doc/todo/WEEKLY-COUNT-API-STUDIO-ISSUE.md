# Issue — Studio Count API Calls

## Context

This issue implements the studio-side instrumentation for the weekly count API described in [WEEKLY-COUNT-API-SPEC.md](WEEKLY-COUNT-API-SPEC.md).

## Goal

Call the backend count endpoints at the right lifecycle points without blocking the user flow.

## Scope

- send one visit call after a successful backend ping during bootstrap
- send one journey call after a journey is successfully loaded
- send one draft call when a draft video blob is produced
- send one HQ call when the HQ export successfully completes
- keep the calls fire-and-forget
- ignore counting failures after optional debug logging
- avoid storing counter state in IndexedDB, Valtio, or local storage

## Required hooks

| Event | Suggested hook | Endpoint |
|---|---|---|
| Successful app bootstrap | `AppUtils.init()` after backend ping succeeds | `POST /count/visit/:ip` |
| Successful journey load | `TrackUtils.loadJourneyFromFile()` when `JOURNEY_OK` is returned | `POST /count/journey` |
| Draft video created | `VideoRecordingScreenArea` draft success path | `POST /count/video/draft` |
| HQ export completed | `VideoDownloadAndShareDialog.startHqExport()` after the export resolves successfully | `POST /count/video/hq` |

## Behavioral rules

- do not block UI transitions on count requests
- do not surface count failures to the user
- avoid duplicate calls if a flow can re-enter
- keep the instrumentation isolated from persistence logic

## Acceptance criteria

- the app sends a visit request once per successful bootstrap session
- successful journey loads increment the journey counter
- successful draft recording increments the draft counter
- successful HQ export increments the HQ counter
- failed count requests do not affect the app flow

## Tests required

- bootstrap test for the visit call
- journey load test for the journey call
- draft success test for the draft call
- HQ export success test for the HQ call
- failure-path test proving count errors are ignored by the UI

## Out of scope

- displaying analytics in the UI
- storing count state locally
- retry logic beyond best-effort fire-and-forget requests
