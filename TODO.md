
### Fix Path follow-up requests

- Verify whether the Fix Path widget's dimensions and position persist after it is closed and reopened.
- Review mispositioned resize handles on some widgets and determine whether corner handles would improve their placement.

### Replay and POI follow-up requests

- Improve the Expert Replay drawer by reusing the settings behavior from Simple mode.
- Investigate why a trace remains visible in Replay when its duration is zero.
- Investigate why moving an expanded POI does not work.
- Verify POI animation behavior during Replay transitions in both all-hidden and all-shown visibility modes.
- Test the end-of-Replay dialog when the video is lost and clarify the expected user choice.
- Investigate why a Replay failure at the end restarts playback from the beginning and loses the video.
- Investigate why a POI added to the current Journey is sometimes omitted from Replay animation until the application is restarted.

- Recent changes prevent editing POIs outside the current Journey's proximity set. Keep the default list limited to Journey-associated POIs, but allow editing any POI and append it to the displayed list. Do not add an edited POI to the Journey's proximity set when it is outside that set.
- Investigate why a Journey's POIs are sometimes not displayed after focusing the Journey; this may be related to earlier POI changes.
- Investigate and fix the Fix Path selection issue.
