### Replay export duration regression

Investigate why the same Replay video now takes more than 10 minutes to export instead of about 4 minutes at the same quality. Sampling changes may be involved, but this has not been confirmed.

### Fix Path follow-up requests

- Verify whether the Fix Path widget's dimensions and position persist after it is closed and reopened.
- Review mispositioned resize handles on some widgets and determine whether corner handles would improve their placement.

### Replay and POI follow-up requests

- Improve the Expert Replay drawer by reusing the settings behavior from Simple mode.
- Investigate why a trace remains visible in Replay when its duration is zero.
- Investigate why moving an expanded POI does not work.
- Verify POI animation behavior during Replay transitions in both all-hidden and all-shown visibility modes.
- Test the end-of-Replay dialog when the video is lost and clarify the expected user choice.
- Verify whether a two-second display duration corresponds to two seconds of Replay time.
- Investigate why a Replay failure at the end restarts playback from the beginning and loses the video.
