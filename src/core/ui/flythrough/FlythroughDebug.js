/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughDebug.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-27
 * Last modified: 2026-05-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const DEBUG_QUERY_PARAM = 'ftDebug'
const DEBUG_LOG_INTERVAL_MS = 1000
const DEBUG_FLAG_CHECK_INTERVAL_MS = 500

const now = () => globalThis.performance?.now?.() ?? Date.now()

const asFiniteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const fixed = (value, digits = 2) => {
    const number = asFiniteNumber(value)
    return number === null ? null : Number(number.toFixed(digits))
}

const readDebugFlag = () => {
    try {
        if (globalThis.__FT_DEBUG__ === true || globalThis.__FT_DEBUG__ === '1') {
            return true
        }

        const params = new URLSearchParams(globalThis.location?.search ?? '')
        if (params.get(DEBUG_QUERY_PARAM) === '1' || params.get(DEBUG_QUERY_PARAM) === 'true') {
            return true
        }

        const stored = globalThis.localStorage?.getItem?.(DEBUG_QUERY_PARAM)
        return stored === '1' || stored === 'true'
    }
    catch {
        return false
    }
}

let enabledCache = null
let enabledCacheAt = 0
let snapshotInstalled = false

const createIntervalCounters = () => ({
    playbackTicks:     0,
    rendererUpdates:   0,
    geometryUpdates:   0,
    cameraUpdates:     0,
    maxTickMs:         0,
    maxProgressDelta:  0,
    maxDistanceDelta:  0,
    maxRendererTimeMs: 0,
})

const createState = () => ({
    startedAt:      now(),
    lastLogAt:      0,
    lastPlaybackAt: null,
    lastProgress:   null,
    lastDistance:   null,
    interval:       createIntervalCounters(),
    totals:         createIntervalCounters(),
    last:           {
        lifecycle: null,
        playback:  null,
        renderer:  null,
        camera:    null,
    },
})

let state = createState()

const snapshot = () => ({
    ...state,
    interval: {...state.interval},
    totals:   {...state.totals},
    last:     {...state.last},
})

const installSnapshotGetter = () => {
    if (snapshotInstalled) {
        return
    }

    try {
        globalThis.__ftDebugSnapshot = snapshot
        snapshotInstalled = true
    }
    catch {
        // Debug mode must never affect the application.
    }
}

export const isFlythroughDebugEnabled = () => {
    const current = now()
    if (enabledCache !== null && current - enabledCacheAt < DEBUG_FLAG_CHECK_INTERVAL_MS) {
        return enabledCache
    }

    enabledCache = readDebugFlag()
    enabledCacheAt = current
    if (enabledCache) {
        installSnapshotGetter()
    }

    return enabledCache
}

const increment = (key, amount = 1) => {
    state.interval[key] += amount
    state.totals[key] += amount
}

const updateMax = (key, value) => {
    const number = asFiniteNumber(value)
    if (number === null) {
        return
    }

    state.interval[key] = Math.max(state.interval[key], number)
    state.totals[key] = Math.max(state.totals[key], number)
}

const recordLifecycle = (event, payload, timestamp) => {
    state.last.lifecycle = {
        event,
        at:       timestamp,
        progress: asFiniteNumber(payload.progress),
        distance: asFiniteNumber(payload.distance),
    }
}

const recordPlayback = (payload, timestamp) => {
    increment('playbackTicks')

    if (state.lastPlaybackAt !== null) {
        updateMax('maxTickMs', timestamp - state.lastPlaybackAt)
    }
    state.lastPlaybackAt = timestamp

    const progress = asFiniteNumber(payload.progress)
    if (progress !== null && state.lastProgress !== null) {
        updateMax('maxProgressDelta', Math.abs(progress - state.lastProgress))
    }
    state.lastProgress = progress

    const distance = asFiniteNumber(payload.distance)
    if (distance !== null && state.lastDistance !== null) {
        updateMax('maxDistanceDelta', Math.abs(distance - state.lastDistance))
    }
    state.lastDistance = distance

    state.last.playback = {
        progress,
        distance,
        elapsedMs:  asFiniteNumber(payload.elapsedMs),
        duration:   asFiniteNumber(payload.duration),
        reachedEnd: Boolean(payload.reachedEnd),
    }
}

const recordRenderer = payload => {
    increment('rendererUpdates')
    if (payload.geometryUpdated) {
        increment('geometryUpdates')
    }
    updateMax('maxRendererTimeMs', payload.durationMs)

    state.last.renderer = {
        durationMs:        asFiniteNumber(payload.durationMs),
        geometryUpdated:   Boolean(payload.geometryUpdated),
        progress:          asFiniteNumber(payload.progress),
        distance:          asFiniteNumber(payload.distance),
        completedPoints:   asFiniteNumber(payload.completedPoints),
        remainingPoints:   asFiniteNumber(payload.remainingPoints),
        lineEntities:      asFiniteNumber(payload.lineEntities),
        smoothedGuideSize: asFiniteNumber(payload.smoothedGuideSize),
        cursorShown:       payload.cursorShown ?? null,
        sourceShown:       payload.sourceShown ?? null,
    }
}

const recordCamera = payload => {
    increment('cameraUpdates')
    state.last.camera = {
        markerMode:       payload.markerMode ?? null,
        cameraMode:       payload.cameraMode ?? null,
        action:           payload.action ?? null,
        progress:         asFiniteNumber(payload.progress),
        distance:         asFiniteNumber(payload.distance),
        guideProgress:    asFiniteNumber(payload.guideProgress),
        guideSize:        asFiniteNumber(payload.guideSize),
        trackedEntityId:  payload.trackedEntityId ?? null,
        outsideTolerance: payload.outsideTolerance ?? null,
        flightActive:     payload.flightActive ?? null,
        keepNorth:        payload.keepNorth ?? null,
        headingDeg:       asFiniteNumber(payload.headingDeg),
        pitchDeg:         asFiniteNumber(payload.pitchDeg),
        cameraHeight:     asFiniteNumber(payload.cameraHeight),
    }
}

const logState = (timestamp, {force = false} = {}) => {
    if (!force && timestamp - state.lastLogAt < DEBUG_LOG_INTERVAL_MS) {
        return
    }

    const elapsedMs = Math.max(1, timestamp - (state.lastLogAt || state.startedAt))
    const row = {
        t:                fixed((timestamp - state.startedAt) / 1000, 1),
        event:            state.last.lifecycle?.event ?? null,
        progress:         fixed(state.last.playback?.progress, 5),
        distanceM:        fixed(state.last.playback?.distance, 1),
        ticks:            state.interval.playbackTicks,
        avgTickMs:        fixed(state.interval.playbackTicks > 0 ? elapsedMs / state.interval.playbackTicks : null, 1),
        maxTickMs:        fixed(state.interval.maxTickMs, 1),
        maxProgressDelta: fixed(state.interval.maxProgressDelta, 6),
        maxDistanceDelta: fixed(state.interval.maxDistanceDelta, 2),
        renderer:         state.interval.rendererUpdates,
        rendererMaxMs:    fixed(state.interval.maxRendererTimeMs, 2),
        geometry:         state.interval.geometryUpdates,
        donePts:          state.last.renderer?.completedPoints ?? null,
        remainingPts:     state.last.renderer?.remainingPoints ?? null,
        lines:            state.last.renderer?.lineEntities ?? null,
        guidePts:         state.last.camera?.guideSize ?? state.last.renderer?.smoothedGuideSize ?? null,
        markerMode:       state.last.camera?.markerMode ?? null,
        cameraAction:     state.last.camera?.action ?? null,
        trackedEntity:    state.last.camera?.trackedEntityId ?? null,
        outsideZone:      state.last.camera?.outsideTolerance ?? null,
        flightActive:     state.last.camera?.flightActive ?? null,
        cameraHeight:     fixed(state.last.camera?.cameraHeight, 1),
    }

    if (typeof console.table === 'function') {
        console.table([row])
    }
    else {
        console.info('[FlythroughDebug]', row)
    }

    state.lastLogAt = timestamp
    state.interval = createIntervalCounters()
}

export const recordFlythroughDebug = (event, payload = {}) => {
    if (!isFlythroughDebugEnabled()) {
        return
    }

    const timestamp = now()
    if (event === 'flythrough:start') {
        state = createState()
        installSnapshotGetter()
        console.info('[FlythroughDebug] enabled. Snapshot: window.__ftDebugSnapshot()')
    }

    if (event.startsWith('flythrough:')) {
        recordLifecycle(event, payload, timestamp)
    }
    else if (event === 'playback:update') {
        recordPlayback(payload, timestamp)
    }
    else if (event === 'renderer:update') {
        recordRenderer(payload)
    }
    else if (event === 'camera:update') {
        recordCamera(payload)
    }

    logState(timestamp, {
        force: payload.forceLog || event === 'flythrough:stop' || event === 'flythrough:end',
    })
}

