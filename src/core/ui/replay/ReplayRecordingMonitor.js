/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayRecordingMonitor.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Shared state for the transient Replay export monitor.
 */

const listeners = new Set()

export const REPLAY_DEFERRED_EXPORT_READY_EVENT = 'lgs-replay-deferred-export-ready'
export const REPLAY_DEFERRED_EXPORT_CANCEL_EVENT = 'lgs-replay-deferred-export-cancel'

let state = {
    active: false,
    mode: null,
    phase: null,
    progress: 0,
    frameIndex: null,
    frameCount: null,
    processedFrames: 0,
    elapsedMillis: 0,
    estimatedRemainingMillis: null,
    videoDurationMillis: null,
    size: 0,
    paused: false,
    frameCanvas: null,
    frameVersion: 0,
}

let snapshot = state
let monitorPreviewCanvas = null
let publishedFrameCanvas = null

const hasFiniteNumber = value => value !== null && value !== undefined && Number.isFinite(Number(value))

/**
 * Recognize canvases created by the main window or another same-origin window.
 *
 * @param {HTMLCanvasElement|null} element - Candidate canvas.
 * @returns {boolean} Whether the value exposes a canvas node and context.
 */
const isCanvasElement = element => element?.nodeName === 'CANVAS'
                                  && typeof element.getContext === 'function'

const notify = () => {
    snapshot = {...state}
    listeners.forEach(listener => listener())
}

/**
 * Subscribe to monitor state changes.
 *
 * @param {Function} listener - State change callback.
 * @returns {Function} Unsubscribe callback.
 */
export const subscribeReplayRecordingMonitor = listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/**
 * Return the latest monitor state snapshot.
 *
 * @returns {Object} Immutable-by-convention monitor snapshot.
 */
export const getReplayRecordingMonitorSnapshot = () => snapshot

/**
 * Connect the live monitor preview canvas to synchronous frame publication.
 *
 * The export reuses its source canvas for the next frame immediately after
 * publication, so a React effect can otherwise copy an intermediate cleared
 * frame. Copying while the composed frame is still current keeps the preview
 * stable and lets it advance at the export frame cadence.
 *
 * @param {HTMLCanvasElement|null} canvas - Visible inline or Picture-in-Picture canvas.
 * @returns {Function} Disconnect callback.
 */
export const connectReplayRecordingMonitorPreview = canvas => {
    monitorPreviewCanvas = isCanvasElement(canvas) ? canvas : null
    if (monitorPreviewCanvas && isCanvasElement(state.frameCanvas)) {
        copyReplayMonitorFrame(state.frameCanvas, monitorPreviewCanvas)
    }

    return () => {
        if (monitorPreviewCanvas === canvas) {
            monitorPreviewCanvas = null
        }
    }
}

/**
 * Copy a fully composed export frame into the stable visible monitor surface.
 *
 * @param {HTMLCanvasElement} source - Current composed frame.
 * @param {HTMLCanvasElement} target - Monitor preview canvas.
 * @returns {void}
 */
const copyReplayMonitorFrame = (source, target) => {
    if (!source || !target) {
        return
    }

    if (target.width !== source.width || target.height !== source.height) {
        target.width = source.width
        target.height = source.height
    }

    target.getContext('2d', {alpha: false})?.drawImage(source, 0, 0, source.width, source.height)
}

/**
 * Preserve the latest composed frame independently of the exporter's reused canvas.
 *
 * @param {HTMLCanvasElement} source - Current composed export frame.
 * @returns {HTMLCanvasElement} Stable copy of the composed frame.
 */
const snapshotReplayMonitorFrame = source => {
    if (!publishedFrameCanvas) {
        publishedFrameCanvas = document.createElement('canvas')
    }

    copyReplayMonitorFrame(source, publishedFrameCanvas)
    return publishedFrameCanvas
}

/**
 * Start a monitor lifecycle for a Replay export.
 *
 * @param {Object} options - Monitor mode and optional frame metadata.
 * @returns {Object} Current monitor snapshot.
 */
export const startReplayRecordingMonitor = ({
    mode = 'hq',
    frameCount = null,
    videoDurationMillis = null,
} = {}) => {
    state = {
        ...state,
        active: true,
        mode,
        phase: 'preparing',
        progress: 0,
        frameIndex: null,
        frameCount,
        processedFrames: 0,
        elapsedMillis: 0,
        estimatedRemainingMillis: null,
        videoDurationMillis: hasFiniteNumber(videoDurationMillis)
                             ? Math.max(0, Number(videoDurationMillis))
                             : null,
        size: 0,
        paused: false,
        frameCanvas: null,
        frameVersion: state.frameVersion + 1,
    }
    notify()
    return snapshot
}

/**
 * Publish one composed frame from the recording pipeline.
 *
 * @param {Object} frame - Composed canvas and frame metadata.
 * @returns {Object} Current monitor snapshot.
 */
export const publishReplayRecordingMonitorFrame = ({
    canvas = null,
    mode = null,
    phase = null,
    progress = null,
    frameIndex = null,
    frameCount = null,
    processedFrames = null,
} = {}) => {
    if (!isCanvasElement(canvas)) {
        return snapshot
    }

    const frameCanvas = snapshotReplayMonitorFrame(canvas)
    copyReplayMonitorFrame(frameCanvas, monitorPreviewCanvas)

    state = {
        ...state,
        active: true,
        mode: mode ?? state.mode,
        phase: phase ?? state.phase,
        progress: hasFiniteNumber(progress) ? Math.max(0, Math.min(1, Number(progress))) : state.progress,
        frameIndex: hasFiniteNumber(frameIndex) ? Number(frameIndex) : state.frameIndex,
        frameCount: hasFiniteNumber(frameCount) ? Number(frameCount) : state.frameCount,
        processedFrames: hasFiniteNumber(processedFrames) ? Number(processedFrames) : state.processedFrames,
        frameCanvas,
        frameVersion: state.frameVersion + 1,
    }
    notify()
    return snapshot
}

/**
 * Update export progress and metrics without replacing its frame.
 *
 * @param {Object} metrics - Runtime phase, progress, and encoder metrics.
 * @returns {Object} Current monitor snapshot.
 */
export const updateReplayRecordingMonitor = ({
    mode = null,
    phase = null,
    progress = null,
    frameIndex = null,
    frameCount = null,
    processedFrames = null,
    elapsedMillis = null,
    estimatedRemainingMillis = null,
    videoDurationMillis = null,
    size = null,
    paused = null,
} = {}) => {
    state = {
        ...state,
        active: true,
        mode: mode ?? state.mode,
        phase: phase ?? state.phase,
        progress: hasFiniteNumber(progress) ? Math.max(0, Math.min(1, Number(progress))) : state.progress,
        frameIndex: hasFiniteNumber(frameIndex) ? Number(frameIndex) : state.frameIndex,
        frameCount: hasFiniteNumber(frameCount) ? Number(frameCount) : state.frameCount,
        processedFrames: hasFiniteNumber(processedFrames) ? Number(processedFrames) : state.processedFrames,
        elapsedMillis: hasFiniteNumber(elapsedMillis) ? Math.max(0, Number(elapsedMillis)) : state.elapsedMillis,
        estimatedRemainingMillis: hasFiniteNumber(estimatedRemainingMillis)
                                  ? Math.max(0, Number(estimatedRemainingMillis))
                                  : state.estimatedRemainingMillis,
        videoDurationMillis: hasFiniteNumber(videoDurationMillis)
                             ? Math.max(0, Number(videoDurationMillis))
                             : state.videoDurationMillis,
        size: hasFiniteNumber(size) ? Math.max(0, Number(size)) : state.size,
        paused: typeof paused === 'boolean' ? paused : state.paused,
    }
    notify()
    return snapshot
}

/**
 * Stop the monitor and release its frame reference.
 *
 * @returns {Object} Inactive monitor snapshot.
 */
export const stopReplayRecordingMonitor = () => {
    state = {
        ...state,
        active: false,
        mode: null,
        phase: null,
        estimatedRemainingMillis: null,
        videoDurationMillis: null,
        frameCanvas: null,
        frameVersion: state.frameVersion + 1,
    }
    notify()
    return snapshot
}
