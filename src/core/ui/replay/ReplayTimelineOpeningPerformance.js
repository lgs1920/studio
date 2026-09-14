/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayTimelineOpeningPerformance.js
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

const PERFORMANCE_QUERY_PARAMETER = 'lgs-timeline-opening-perf'
const PERFORMANCE_GLOBAL_KEY = '__lgsReplayTimelineOpeningPerformance'
const PERFORMANCE_CONTROLS_KEY = '__lgsReplayTimelineOpeningPerformanceControls'

const now = () => globalThis.performance?.now?.() ?? Date.now()

const isEnabled = () => (
    globalThis.__lgsReplayTimelineOpeningPerformanceEnabled === true
    || globalThis.location?.search?.includes(`${PERFORMANCE_QUERY_PARAMETER}=1`)
)

const createState = () => ({
    events: [],
    startedAt: now(),
})

const getState = () => {
    if (!isEnabled()) return null
    if (!globalThis[PERFORMANCE_GLOBAL_KEY]) globalThis[PERFORMANCE_GLOBAL_KEY] = createState()
    return globalThis[PERFORMANCE_GLOBAL_KEY]
}

const addEvent = (event = {}) => {
    const state = getState()
    if (!state) return
    state.events.push(Object.assign({atMs: now() - state.startedAt}, event))
}

/**
 * Start an opening measurement.
 *
 * @param {string} stage - Measurement stage.
 * @returns {{stage: string, startedAt: number}|null} Measurement token.
 */
export const startReplayTimelineOpeningMeasurement = stage => {
    if (!getState()) return null
    return {stage, startedAt: now()}
}

/**
 * Finish an opening measurement.
 *
 * @param {{stage: string, startedAt: number}|null} measurement - Measurement token.
 * @param {Object} [details] - Additional table columns.
 * @returns {void}
 */
export const finishReplayTimelineOpeningMeasurement = (measurement, details = {}) => {
    if (!measurement) return
    addEvent(Object.assign({
        stage: measurement.stage,
        durationMs: now() - measurement.startedAt,
    }, details))
}

/**
 * Record an instantaneous opening event.
 *
 * @param {string} stage - Event stage.
 * @param {Object} [details] - Additional table columns.
 * @returns {void}
 */
export const recordReplayTimelineOpeningEvent = (stage, details = {}) => {
    if (!getState()) return
    addEvent(Object.assign({stage}, details))
}

/**
 * Print the collected opening events as a browser console table.
 *
 * @returns {Array} Table rows.
 */
export const printReplayTimelineOpeningTable = () => {
    const state = getState()
    if (!state) return []
    const rows = state.events.map((event, index) => Object.assign({index}, event, {
        durationMs: Number.isFinite(event.durationMs) ? Number(event.durationMs.toFixed(2)) : undefined,
        atMs: Number.isFinite(event.atMs) ? Number(event.atMs.toFixed(2)) : undefined,
    }))
    globalThis.console?.table?.(rows)
    return rows
}

/**
 * Enable opening measurements from the browser console.
 *
 * @returns {Object|null} Initialized performance state.
 */
export const enableReplayTimelineOpeningPerformance = () => {
    globalThis.__lgsReplayTimelineOpeningPerformanceEnabled = true
    return getState()
}

/**
 * Reset opening measurements.
 *
 * @returns {Object|null} Fresh performance state when enabled.
 */
export const resetReplayTimelineOpeningPerformance = () => {
    delete globalThis[PERFORMANCE_GLOBAL_KEY]
    return getState()
}

globalThis[PERFORMANCE_CONTROLS_KEY] ??= {
    enable: enableReplayTimelineOpeningPerformance,
    reset: resetReplayTimelineOpeningPerformance,
    table: printReplayTimelineOpeningTable,
}

if (isEnabled()) getState()
