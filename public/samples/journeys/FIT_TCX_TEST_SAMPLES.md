# FIT and TCX test samples

These six direct download URLs are hosted on public web servers, not GitHub or raw Git URLs. They were checked on 2026-10-23 and returned HTTP 200 with the expected file contents. Download a file to test the local file picker, or paste its direct URL into the Journey URL field to test remote loading.

## FIT samples

| Sample | Activity and coverage | Download | Copyable URL for URL import |
| --- | --- | --- | --- |
| FileViewerHub | Synthetic 1 km run with 20 GPS points, heart rate, and cadence | [sample-activity.fit](https://fileviewerhub.com/samples/fit/sample-activity.fit) | `https://fileviewerhub.com/samples/fit/sample-activity.fit` |
| Garmin Forerunner 965 | Synthetic 5 km run with heart rate, GPS, power-meter, and developer fields | [garmin-forerunner-965.fit](https://slicelytics.com/assets/samples/garmin-forerunner-965.fit) | `https://slicelytics.com/assets/samples/garmin-forerunner-965.fit` |
| Garmin forum walking activity | Publicly shared walk with 424 GPS records; its session distance is zero, so it also checks missing-distance handling | [22738341612_ACTIVITY.fit](https://www.richardtherunner.com/miscfiles/22738341612_ACTIVITY.fit) | `https://www.richardtherunner.com/miscfiles/22738341612_ACTIVITY.fit` |

The FileViewerHub sample is described on its [FIT viewer page](https://fileviewerhub.com/fit-viewer). The Garmin Forerunner sample is described on the [Slicelytics sample page](https://slicelytics.com/use-cases/view-fit-files). The walking FIT is linked in this [Garmin forum post](https://forums.garmin.com/outdoor-recreation/outdoor-recreation/f/fenix-7-series/436071/fenix-7s-does-not-show-distance-or-pace-on-a-walk); it contains a real, publicly shared GPS track.

## TCX samples

| Sample | Activity and coverage | Download | Copyable URL for URL import |
| --- | --- | --- | --- |
| Garmin sample | Running activity with 260 trackpoints | [sample_file.tcx](https://developer.garmin.com/downloads/connect-api/sample_file.tcx) | `https://developer.garmin.com/downloads/connect-api/sample_file.tcx` |
| Apple Health workout | Running route with GPS, heart rate, distance, and lap summary | [sample-run.tcx](https://workoutdataexporter.web.app/assets/samples/sample-run.tcx) | `https://workoutdataexporter.web.app/assets/samples/sample-run.tcx` |
| GPSBabel bike sample | Biking activity with 1,812 GPS trackpoints | [bike.tcx](https://sources.debian.org/data/main/g/gpsbabel/1.10.0%2Bds-2/reference/track/bike.tcx) | `https://sources.debian.org/data/main/g/gpsbabel/1.10.0%2Bds-2/reference/track/bike.tcx` |

The Apple Health sample is described on its [sample page](https://workoutdataexporter.web.app/sample-apple-health-tcx-export). The bike file is a direct file download from the [Debian Sources file listing](https://sources.debian.org/src/gpsbabel/1.10.0%2Bds-2/reference/track/), rather than a Git URL.

## Studio regression cases

The local importer tests cover these additional cases:

- TCX with two bike laps, GPS coordinates, altitude, timestamps, heart rate, cadence, power, and an unknown vendor extension.
- TCX sport mapping to the running profile.
- TCX rejection when fewer than two usable GPS positions are present.
- FIT rejection when its file CRC is invalid.
- Loader handling of local FIT binary data, local TCX text, and remote FIT/TCX content. Remote loader tests use mocked server responses; they are not live URL tests.

The test cases are in `src/__tests__/ui/journey/sportslib-journey-importer.test.js` and `src/__tests__/integration/journey/journey-loader-samples.test.jsx`.
