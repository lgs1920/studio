# Replay HQ camera follower — 2026-07-21

- Fixed deterministic HQ camera following for navigation and dynamic corrections by using the corrected Cesium up vector.
- Applied the same 1.5-second camera response to navigation and dynamic replay corrections.
- Kept the narrow tracking zone at 22% and documented the logical export clock and camera ownership rules.
- Added regression coverage for navigation and dynamic HQ camera frames.
