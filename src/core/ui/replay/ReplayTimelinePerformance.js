/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayTimelinePerformance.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-14
 * Last modified: 2026-09-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const PERFORMANCE_QUERY_PARAMETER = 'lgs-timeline-perf'
const PERFORMANCE_GLOBAL_KEY = '__lgsReplayTimelinePerformance'

const isReplayTimelinePerformanceEnabled = () => (
    globalThis.__lgsReplayTimelinePerformanceEnabled === true
    || globalThis.location?.search?.includes(`${PERFORMANCE_QUERY_PARAMETER}=1`)
)

const createMetric = () => ({count: 0, totalMs: 0, maxMs: 0})

const getPerformanceState = () => {
    if (!isReplayTimelinePerformanceEnabled()) return null
    if (!globalThis[PERFORMANCE_GLOBAL_KEY]) {
        globalThis[PERFORMANCE_GLOBAL_KEY] = {
            replayStoreCallbacks: createMetric(),
            currentTimeAssignments: createMetric(),
            ensureCurrentTimeVisibleCalls: createMetric(),
            ensureCurrentTimeVisibleScrolls: createMetric(),
            structuralRenders: createMetric(),
            dynamicDomUpdates: createMetric(),
            reactCommits: createMetric(),
        }
    }
    return globalThis[PERFORMANCE_GLOBAL_KEY]
}

/**
 * Record an occurrence of a Replay Timeline performance event.
 *
 * @param {string} name - Metric name.
 * @returns {void}
 */
export const recordReplayTimelineMetric = name => {
    const metric = getPerformanceState()?.[name]
    if (!metric) return
    metric.count += 1
}

/**
 * Record a measured Replay Timeline duration.
 *
 * @param {string} name - Metric name.
 * @param {number} durationMs - Measured duration in milliseconds.
 * @returns {void}
 */
export const recordReplayTimelineDuration = (name, durationMs) => {
    const metric = getPerformanceState()?.[name]
    const duration = Number(durationMs)
    if (!metric || !Number.isFinite(duration)) return
    metric.count += 1
    metric.totalMs += duration
    metric.maxMs = Math.max(metric.maxMs, duration)
}

/**
 * Read the current opt-in performance state.
 *
 * @returns {Object|null} Mutable metrics object, or null when disabled.
 */
export const getReplayTimelinePerformance = () => getPerformanceState()

/**
 * Return a high resolution timestamp when instrumentation is enabled.
 *
 * @returns {number|null} Timestamp suitable for duration measurement.
 */
export const startReplayTimelineMeasurement = () => {
    if (!isReplayTimelinePerformanceEnabled()) return null
    return globalThis.performance?.now?.() ?? Date.now()
}

/**
 * Finish a high resolution measurement.
 *
 * @param {string} name - Metric name.
 * @param {number|null} startedAt - Timestamp returned by the start helper.
 * @returns {void}
 */
export const finishReplayTimelineMeasurement = (name, startedAt) => {
    if (startedAt === null) return
    const now = globalThis.performance?.now?.() ?? Date.now()
    recordReplayTimelineDuration(name, now - startedAt)
}
