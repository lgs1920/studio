# Issue — Backend Weekly Count API

Status: implemented and superseded by
[`WEEKLY-COUNT-API-SPEC.md`](WEEKLY-COUNT-API-SPEC.md)

This historical issue describes the initial flat seven-day proposal. Backend
now implements a broader time-zone-aware aggregate API with daily, weekly,
monthly, yearly, and lifetime reads.

## Context

This issue implements the backend side of the weekly count API described in [WEEKLY-COUNT-API-SPEC.md](WEEKLY-COUNT-API-SPEC.md).

## Goal

Add a file-backed `/count` API that keeps a rolling 7-day snapshot of:

- video draft exports
- video HQ exports
- journey loads
- total visits
- unique visits

The implementation must use a single JSON file, not a database, and it must serialize concurrent mutations through a queue.

## Scope

- add `GET /count/`
- add `POST /count/visit/:ip`
- add `POST /count/journey`
- add `POST /count/video/draft`
- add `POST /count/video/hq`
- keep compatibility aliases where required by the spec
- store the snapshot in one JSON file under the backend home directory
- reset the window automatically after 7 days
- recover safely from missing or corrupted JSON
- update the backend README with the new API and storage behavior

## Functional rules

- `visits` increments on every successful app visit event
- `uniqueVisits` increments only once per IP within the active 7-day window
- `journeys` increments when a journey is successfully loaded in the app
- `videoDrafts` increments when the draft video blob is successfully produced
- `videoHq` increments when the HQ export successfully completes
- `GET /count/` returns counts only, not the raw IP map

## Concurrency and storage rules

- all read-modify-write operations must go through one FIFO queue
- the queue must prevent concurrent file corruption in a single backend process
- writes must be atomic
- the file contains one active window only
- the implementation must not introduce a database dependency

## Acceptance criteria

- `GET /count/` returns the current snapshot as JSON
- each increment endpoint updates the right counter
- unique visit tracking works across repeated calls from the same IP
- the window resets when the stored snapshot is older than 7 days
- invalid JSON does not crash the server
- parallel requests do not corrupt the counter file

## Tests required

- route test for the read endpoint
- route tests for each increment endpoint
- reset test for expired windows
- unique visit test
- concurrency test for queued writes
- corrupted-file recovery test

## Out of scope

- dashboards or UI for displaying counters
- historical analytics beyond the current 7-day window
- multi-process shared locking
- persisting raw visitor IPs in the public response
