# Count API and Public Statistics

Status: implemented across Studio, Backend, and Site

Date reviewed: 2026-08-24

## Purpose

The count system records anonymous Studio usage events, stores aggregate counts
in Backend, and publishes read-only statistics through Site. It tracks:

- Studio visits;
- successfully loaded journeys;
- successfully produced Draft videos;
- successfully produced HQ videos.

The current implementation does not expose or retain a unique-visitor metric.
The original rolling seven-day and IP-based proposal was superseded by
time-zone-aware calendar aggregates.

## Studio producer

`src/Utils/CountApi.js` sends best-effort event requests to Backend:

- `POST /count/visit` once per application session;
- `POST /count/journey` after each successful journey load;
- `POST /count/video/draft` after successful Draft production;
- `POST /count/video/hq` after successful HQ production.

Each request includes the browser IANA time zone when available. Requests omit
credentials, use keep-alive delivery, do not block the user flow, and return a
controlled failure result instead of surfacing counting failures in the UI.

## Backend authority

Backend owns the event store and every aggregate. `CountResource` registers the
mutation and read routes, `CountController` validates requests, and `CountStore`
serializes persistence and aggregation.

### Mutation routes

- `POST /count/visit`
- `POST /count/journey`
- `POST /count/video/draft`
- `POST /count/video/hq`

### Read routes

- `GET /count`
- `GET /count/:item`
- `GET /count/:item/:period`
- `GET /count/daily` and `GET /count/daily/:date`
- `GET /count/weekly` and `GET /count/weekly/:week`
- `GET /count/monthly` and `GET /count/monthly/:month`
- `GET /count/yearly` and `GET /count/yearly/:year`

Current period routes accept an optional `timeZone` query parameter. Explicit
keys use `dd-mm-yyyy`, `yyyy-Www`, `mm-yy`, and `yyyy` formats.

The complete snapshot contains lifetime totals plus daily, weekly, monthly, and
yearly aggregate maps. Video values are separated into `draft` and `hq`.

## Site consumer

Site exposes localized English and French statistics pages. The page requests:

- lifetime totals;
- today and yesterday;
- this week;
- this month and the previous month;
- this year.

The browser time zone is forwarded to Backend. Partial request failures are
represented as a partial page state, and the page supports manual and periodic
refresh without caching count responses.

## Validation evidence

- Studio: `src/__tests__/unit/data/count-api.test.js`
- Backend: `tests/count.test.js`
- Site: `tests/stats.test.js`

The original implementation issue documents are retained beside this document
as historical delivery records. They are not the current API contract.
