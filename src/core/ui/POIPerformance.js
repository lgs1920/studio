/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIPerformance.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-31
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const MAX_METRICS = 64
const MAX_SAMPLES_PER_METRIC = 256
const now = () => globalThis.performance?.now?.() ?? Date.now()

/** Create a bounded POI diagnostic collector that is disabled by default. */
export const createPOIPerformanceCollector = ({enabled = false, clock = now} = {}) => {
    const metrics = new Map()
    let mountedContentCount = 0

    /** Record a numeric sample without retaining event payloads or unbounded history. */
    const record = (name, value = 1) => {
        if (!enabled || typeof name !== 'string' || !Number.isFinite(value)) {
            return
        }
        let metric = metrics.get(name)
        if (!metric) {
            if (metrics.size >= MAX_METRICS) {
                return
            }
            metric = {count: 0, total: 0, max: -Infinity, samples: [], sampleCursor: 0}
            metrics.set(name, metric)
        }
        metric.count += 1
        metric.total += value
        metric.max = Math.max(metric.max, value)
        if (metric.samples.length < MAX_SAMPLES_PER_METRIC) {
            metric.samples.push(value)
        }
        else {
            metric.samples[metric.sampleCursor] = value
            metric.sampleCursor = (metric.sampleCursor + 1) % MAX_SAMPLES_PER_METRIC
        }
    }

    /** Start a timer whose completion adds one duration sample. */
    const start = name => enabled ? clock() : null
    const end = (name, startedAt) => {
        if (enabled && Number.isFinite(startedAt)) {
            record(name, Math.max(0, clock() - startedAt))
        }
    }

    /** Track currently mounted rich POI content surfaces. */
    const mountContent = () => {
        if (!enabled) {
            return () => {}
        }
        mountedContentCount += 1
        return () => {
            mountedContentCount = Math.max(0, mountedContentCount - 1)
        }
    }

    /** Return a serializable aggregate snapshot, including bounded timing percentiles. */
    const snapshot = () => ({
        enabled,
        mountedContentCount,
        metrics: Object.fromEntries(Array.from(metrics, ([name, metric]) => {
            const sorted = [...metric.samples].sort((left, right) => left - right)
            const percentile = fraction => sorted.length
                ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
                : null
            return [name, {
                count: metric.count,
                total: metric.total,
                average: metric.count ? metric.total / metric.count : 0,
                max: metric.max,
                p50: percentile(0.5),
                p95: percentile(0.95),
                retainedSamples: metric.samples.length,
            }]
        })),
    })

    /** Clear aggregate state at the beginning of a separate profiling run. */
    const reset = () => {
        metrics.clear()
    }

    return {enabled, record, start, end, mountContent, snapshot, reset}
}

const enabledByQuery = (() => {
    try {
        return new URLSearchParams(globalThis.location?.search ?? '').get('poiPerf') === '1'
    }
    catch {
        return false
    }
})()

/** Session-only diagnostics enabled explicitly with ?poiPerf=1. */
export const poiPerformance = createPOIPerformanceCollector({enabled: enabledByQuery})

if (enabledByQuery && typeof globalThis === 'object') {
    globalThis.__lgsPoiPerformance = {
        snapshot: poiPerformance.snapshot,
        reset: poiPerformance.reset,
    }
}
