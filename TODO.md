
### replay expert

- Improve the Expert Replay drawer by reusing the settings behavior from Simple mode.

### Replay

Validate 4K, 60 FPS, and related export configurations.

P0 — Fix Automatic so it selects the next lower standard tier for the chosen format without enlarging crops below the minimum. Add portrait cases at 1300, 1800, and 2200 pixels, plus equivalent landscape, square, and custom cases.
P1 — Align crop units by converting the CSS rectangle to drawing-buffer pixels or by performing all projection in a consistent CSS viewport. Add tests at DPR 1, 1.5, and 2 with an offset crop.
P1 — Remove the silent composition fallback or make it blocking. It must preserve the crop and overlays, or stop export with a visible error.
P1 — Strengthen Strict readiness to retain tile and imagery failure events around the final render and reject the frame when readiness fails, including races between loading and post-render.
P1 — Align the timeline, sample duration, and track duration. Add a test that reads timestamps and MP4 duration, especially when the timeline length is exactly divisible by the interval.
P1 — Complete browser validation for all nine combinations, checking WebGL dimensions, the composition canvas, and MP4 metadata, then repeat the measurements on older GPU hardware. Also add a context-loss scenario and verify resource cleanup.
P2 — Clarify Automatic by stating that FPS and encoding quality affect its budget, or remove those dependencies if the mode is intended to be independent. Persist and display the readiness setting explicitly in Standard mode.
