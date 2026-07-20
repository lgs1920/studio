---
name: performance-rendering
description: Diagnose and improve LGS1920 React, Cesium, widget, map, Replay, and video rendering performance without changing visible behavior.
---

# Performance Rendering

Use when rendering is slow, memory grows, Replay drops frames, or export takes too long. Measure first using existing tests, logs, browser profiling, and Cesium lifecycle knowledge.

Workflow:

1. Identify whether the bottleneck is React rerendering, Valtio subscriptions, Cesium primitives, DOM layout, image capture, or network.
2. Reduce subscription scope and keep derived calculations outside render when stable.
3. Reuse or dispose Cesium entities, event handlers, timers, observers, and canvas resources.
4. Keep dynamic widget updates bounded during Replay and preserve stable static composition.
5. Avoid premature memoization that hides stale state or complicates cleanup.
6. Add a regression test or measurable acceptance criterion for the optimized path.

Never trade correctness, cleanup, or capture fidelity for an unmeasured optimization.
