# Journey Settings README

This note summarizes the `Journey` settings that matter for metrics, profile cleaning, and rendering.

## What the profiles do

`Journey` settings are organized by activity profile:

- `trek`
- `trail`
- `bike`
- `ski-touring`

Each profile defines how a track is cleaned before its metrics are aggregated. The same journey can therefore be evaluated differently depending on the activity.

Example:

- a 5 km/h segment may be normal for `bike`
- the same segment may be suspicious for `trek`

That is why the thresholds are per activity.

## Main thresholds

The thresholds currently exposed in `Journey Statistics` are:

- `maxSpeed`: rejects impossible GPS spikes
- `maxClimbRate`: rejects impossible positive vertical rates
- `maxDescentRate`: rejects impossible negative vertical rates
- `stopDuration`: minimum duration for a slow segment to count as idle time
- `stopSpeedLimit`: speed limit used with `stopDuration` to detect stops
- `minSegmentDuration`: minimum duration for a segment to be reliable for speed and pace
- `minSegmentDistance`: minimum distance for a segment to be reliable for speed and pace
- `maxPace`: rejects segments that are too slow for the selected activity
- `maxSpeedDelta`: rejects abrupt speed jumps between consecutive segments
- `maxAltitudeJump`: clips vertical spikes before altitude smoothing
- `altitudeSmoothingWindow`: median window used to smooth altitude before slope and profile metrics

## How the filtering works

The pipeline is:

1. compute raw segment values
2. reject obviously bad movement segments
3. clip altitude spikes
4. smooth altitude
5. compute track stats
6. aggregate track stats into journey stats

This keeps the source geometry untouched and only cleans derived data.

## Small examples

### 1. Short segment ignored for speed and pace

If `minSegmentDuration = 2 s` and `minSegmentDistance = 3 m`:

```text
Point A ---- 1 s / 1 m ---- Point B ---- 60 s / 120 m ---- Point C
```

The first segment is too short to be trusted for speed or pace.  
The second segment is kept.

### 2. Speed spike rejected

If `maxSpeed = 3.0 m/s` for `trek`:

```text
0 m/s   1.8 m/s   2.1 m/s   7.5 m/s
|-------|-------|-------|----------------X
```

The last jump is treated as a spike and ignored for extrema.

### 3. Abrupt speed change rejected

If `maxSpeedDelta = 2.0 m/s`:

```text
1.8 m/s ---- 2.0 m/s ---- 7.0 m/s
```

The last segment is too far from the previous moving speed and is excluded from speed/pace extrema.

### 4. Altitude spike clipped before smoothing

If `maxAltitudeJump = 10 m` and the raw altitude contains a spike:

```text
raw altitude:
100 --- 101 --- 152 --- 103 --- 104

after clipping:
100 --- 101 --- 104 --- 103 --- 104

after smoothing:
100 --- 101 --- 103 --- 103 --- 104
```

The spike is reduced before the profile is computed.

### 5. Altitude smoothing reduces noise

If `altitudeSmoothingWindow = 3`:

```text
raw:      100 --- 149 --- 101 --- 102 --- 100
smoothed: 100 --- 101 --- 102 --- 101 --- 100
```

The median window suppresses one-point noise without changing the overall shape too much.

## Activity examples

Typical tuning goals:

- `trek`: strict on spikes, tolerant on low speed, low altitude noise
- `trail`: similar to trek but slightly faster
- `bike`: higher speed tolerance, larger distance threshold
- `ski-touring`: higher speed and altitude variation tolerance

Concrete example:

```yaml
journey:
  activity:
    types:
      - id: trek
        minSegmentDuration: 2
        minSegmentDistance: 3
        maxAltitudeJump: 10
        altitudeSmoothingWindow: 3
        maxSpeed: 3.0
        maxPace: 0
        maxSpeedDelta: 0
        stopDuration: 60
        stopSpeedLimit: 0.2
```

For `bike`, the same shape usually needs looser values:

```yaml
      - id: bike
        minSegmentDuration: 2
        minSegmentDistance: 5
        maxAltitudeJump: 20
        altitudeSmoothingWindow: 3
        maxSpeed: 16.0
        maxSpeedDelta: 0
        stopDuration: 45
        stopSpeedLimit: 0.6
```

## What these settings affect

- Track metrics: speed, pace, moving time, elevation, slope, extrema
- Journey metrics: aggregated track statistics
- Journey Statistics UI: the activity editor exposes the same thresholds for per-profile tuning
- Profile rendering: altitude cleaning reduces noisy peaks in profile-based views

## Important rule

Keep raw geometry untouched. The settings should clean the derived metrics and the rendered profile, not rewrite the source track data.
