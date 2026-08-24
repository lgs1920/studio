/**
 * Shared state for the transient Draft and Replay HQ recording monitor.
 */

const listeners = new Set()

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

const hasFiniteNumber = value => value !== null && value !== undefined && Number.isFinite(Number(value))

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
 * Start a monitor lifecycle for Draft or HQ recording.
 *
 * @param {Object} options - Monitor mode and optional frame metadata.
 * @returns {Object} Current monitor snapshot.
 */
export const startReplayRecordingMonitor = ({
    mode = 'draft',
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
    if (!(canvas instanceof HTMLCanvasElement)) {
        return snapshot
    }

    state = {
        ...state,
        active: true,
        mode: mode ?? state.mode,
        phase: phase ?? state.phase,
        progress: hasFiniteNumber(progress) ? Math.max(0, Math.min(1, Number(progress))) : state.progress,
        frameIndex: hasFiniteNumber(frameIndex) ? Number(frameIndex) : state.frameIndex,
        frameCount: hasFiniteNumber(frameCount) ? Number(frameCount) : state.frameCount,
        processedFrames: hasFiniteNumber(processedFrames) ? Number(processedFrames) : state.processedFrames,
        frameCanvas: canvas,
        frameVersion: state.frameVersion + 1,
    }
    notify()
    return snapshot
}

/**
 * Update monitor progress and recorder metrics without replacing its frame.
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
