/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplaySceneTileReadiness.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const DEFAULT_POLL_INTERVAL_MS = 32
const DEFAULT_KNOWN_FOOTPRINT_RENDER_TIMEOUT_MS = 250
const DEFAULT_NEW_FOOTPRINT_READINESS_TIMEOUT_MS = 1000
const CAMERA_POSITION_QUANTIZATION_METERS = 50
const CAMERA_DIRECTION_QUANTIZATION = 0.05
export const DEFAULT_REPLAY_GLOBE_TILE_CACHE_SIZE = 512
const REPLAY_TILE_READINESS_POLICY_OFF = 'off'
const REPLAY_TILE_READINESS_POLICY_ADAPTIVE = 'adaptive'
const REPLAY_TILE_READINESS_POLICY_STRICT = 'strict'
const REPLAY_TILE_READINESS_POLICY_CUSTOM = 'custom'

/**
 * Normalize runtime tile readiness options without trusting persisted values.
 *
 * @param {object} options - Runtime readiness options.
 * @returns {object} Safe readiness options.
 */
export const normalizeReplaySceneTileReadinessOptions = ({
                                                              enabled = true,
                                                              policy = REPLAY_TILE_READINESS_POLICY_ADAPTIVE,
                                                              knownFootprintTimeoutMs = DEFAULT_KNOWN_FOOTPRINT_RENDER_TIMEOUT_MS,
                                                              movingTimeoutMs = DEFAULT_NEW_FOOTPRINT_READINESS_TIMEOUT_MS,
                                                              newFootprintReadinessTimeoutMs,
                                                              settledTimeoutMs = 5000,
                                                              prewarmEnabled = true,
                                                          } = {}) => {
    const policies = [
        REPLAY_TILE_READINESS_POLICY_OFF,
        REPLAY_TILE_READINESS_POLICY_ADAPTIVE,
        REPLAY_TILE_READINESS_POLICY_STRICT,
        REPLAY_TILE_READINESS_POLICY_CUSTOM,
    ]
    const safePolicy = policies.includes(policy) ? policy : REPLAY_TILE_READINESS_POLICY_ADAPTIVE
    const safeMovingTimeoutMs = newFootprintReadinessTimeoutMs ?? movingTimeoutMs
    const clampMillis = (value, fallback, maximum) => {
        const numeric = Number(value)
        const safeValue = Number.isFinite(numeric) ? numeric : fallback
        return Math.min(maximum, Math.max(0, Math.trunc(safeValue)))
    }

    return {
        enabled: enabled !== false,
        policy: safePolicy,
        knownFootprintTimeoutMs: clampMillis(knownFootprintTimeoutMs, DEFAULT_KNOWN_FOOTPRINT_RENDER_TIMEOUT_MS, 1000),
        movingTimeoutMs:         clampMillis(safeMovingTimeoutMs, DEFAULT_NEW_FOOTPRINT_READINESS_TIMEOUT_MS, 5000),
        settledTimeoutMs:        clampMillis(settledTimeoutMs, 5000, 10000),
        prewarmEnabled:          prewarmEnabled !== false,
    }
}

/**
 * Resolve the replay camera motion level from deterministic frame progress.
 *
 * @param {object} options - Current and previous frame data.
 * @returns {'slow'|'normal'|'fast'|'jump'} Motion level.
 */
export const resolveReplayTileSpeedLevel = ({
                                                 frame = null,
                                                 previousFrame = null,
                                                 sample = null,
                                                 previousSample = null,
                                             } = {}) => {
    if (!previousFrame && !previousSample) {
        return 'normal'
    }

    const currentProgress = Number(sample?.progress ?? frame?.progress)
    const previousProgress = Number(previousSample?.progress ?? previousFrame?.progress)
    const currentTime = Number(frame?.frameTimeMs)
    const previousTime = Number(previousFrame?.frameTimeMs)
    if (![currentProgress, previousProgress, currentTime, previousTime].every(Number.isFinite)) {
        return 'normal'
    }

    const elapsedSeconds = Math.max(0.001, Math.abs(currentTime - previousTime) / 1000)
    const progressPerSecond = Math.abs(currentProgress - previousProgress) / elapsedSeconds
    if (progressPerSecond >= 0.15) {
        return 'jump'
    }
    if (progressPerSecond >= 0.05) {
        return 'fast'
    }
    if (progressPerSecond < 0.015) {
        return 'slow'
    }
    return 'normal'
}

/**
 * Resolve one frame readiness budget from policy and camera motion.
 *
 * @param {object} options - Budget resolution options.
 * @returns {number} Maximum wait in milliseconds.
 */
const resolveReplayTileReadinessBudget = ({
                                               options,
                                               maxMillis,
                                               settled,
                                               speedLevel,
                                           }) => {
    const safeMaxMillis = Math.max(0, Math.trunc(Number(maxMillis) || 0))
    if (options.policy === REPLAY_TILE_READINESS_POLICY_STRICT) {
        return safeMaxMillis
    }

    const baseMillis = settled === true ? options.settledTimeoutMs : options.movingTimeoutMs
    if (settled === true) {
        return Math.min(safeMaxMillis, Math.max(0, baseMillis))
    }

    const multiplier = speedLevel === 'slow'
        ? 1.5
        : speedLevel === 'fast'
            ? 0.5
            : speedLevel === 'jump'
                ? 0.25
                : 1
    const adaptiveMillis = Math.round(baseMillis * multiplier)
    return Math.min(safeMaxMillis, Math.max(0, adaptiveMillis))
}

/**
 * Request one asynchronous Cesium render opportunity.
 *
 * @param {object|null} scene - Cesium scene.
 * @returns {void}
 */
const requestReplaySceneRender = scene => {
    scene?.requestRender?.()
}

/**
 * Quantize a finite camera value for short-lived footprint reuse.
 *
 * @param {number|null} value - Camera value.
 * @param {number} step - Quantization step.
 * @returns {number|null} Quantized value.
 */
const quantizeCameraValue = (value, step) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || !Number.isFinite(step) || step <= 0) {
        return null
    }

    return Math.round(numeric / step)
}

/**
 * Read a finite vector from a Cesium camera-like object.
 *
 * @param {object|null} vector - Cesium Cartesian-like vector.
 * @returns {Array<number>|null} Vector components.
 */
const readCameraVector = vector => {
    if (!vector || ![vector.x, vector.y, vector.z].every(value => Number.isFinite(Number(value)))) {
        return null
    }

    return [Number(vector.x), Number(vector.y), Number(vector.z)]
}

/**
 * Build a coarse key for the active Cesium camera footprint.
 *
 * The key is deliberately short-lived and conservative. It is not a tile ID
 * and must never replace Cesium's own view-based readiness state.
 *
 * @param {object|null} scene - Cesium scene.
 * @returns {string|null} Camera footprint key.
 */
const replayCameraFootprintKey = scene => {
    const camera = scene?.camera
    if (!camera) {
        return null
    }

    const position = readCameraVector(camera.positionWC ?? camera.position)
    const direction = readCameraVector(camera.directionWC ?? camera.direction)
    const up = readCameraVector(camera.upWC ?? camera.up)
    if (!position || !direction || !up) {
        return null
    }

    const frustum = camera.frustum ?? {}
    const perspectiveFov = Number(frustum.fov)
    const orthographicWidth = Number(frustum.width ?? (Number(frustum.right) - Number(frustum.left)))
    const orthographicHeight = Number(frustum.height ?? (Number(frustum.top) - Number(frustum.bottom)))
    const frustumScale = Number.isFinite(perspectiveFov)
        ? quantizeCameraValue(perspectiveFov, CAMERA_DIRECTION_QUANTIZATION)
        : quantizeCameraValue(orthographicWidth, CAMERA_POSITION_QUANTIZATION_METERS)
    const frustumAspect = Number.isFinite(perspectiveFov)
        ? quantizeCameraValue(Number.isFinite(Number(frustum.aspectRatio)) ? frustum.aspectRatio : 0, CAMERA_DIRECTION_QUANTIZATION)
        : quantizeCameraValue(orthographicHeight, CAMERA_POSITION_QUANTIZATION_METERS)
    const values = [
        scene.mode ?? scene.sceneMode ?? null,
        ...position.map(value => quantizeCameraValue(value, CAMERA_POSITION_QUANTIZATION_METERS)),
        ...direction.map(value => quantizeCameraValue(value, CAMERA_DIRECTION_QUANTIZATION)),
        ...up.map(value => quantizeCameraValue(value, CAMERA_DIRECTION_QUANTIZATION)),
        frustumScale,
        frustumAspect,
        quantizeCameraValue(frustum.near, CAMERA_POSITION_QUANTIZATION_METERS),
        quantizeCameraValue(frustum.far, CAMERA_POSITION_QUANTIZATION_METERS),
    ]

    return values.every(value => value !== null && value !== undefined)
        ? values.join(':')
        : null
}

/**
 * Create the standard cancellation error used by replay export waits.
 *
 * @returns {DOMException|Error} Abort error compatible with the current runtime.
 */
const createAbortError = () => {
    if (typeof DOMException === 'function') {
        return new DOMException('The HQ replay tile readiness wait was aborted.', 'AbortError')
    }

    const error = new Error('The HQ replay tile readiness wait was aborted.')
    error.name = 'AbortError'
    return error
}

/**
 * Read the values of a Cesium collection without depending on its concrete type.
 *
 * @param {object|null} collection - Cesium collection-like object.
 * @returns {Array<object>} Collection values.
 */
const collectionValues = collection => {
    if (Array.isArray(collection)) {
        return collection
    }

    const length = Number(collection?.length)
    if (!Number.isInteger(length) || length <= 0 || typeof collection?.get !== 'function') {
        return []
    }

    const values = []
    for (let index = 0; index < length; index += 1) {
        const value = collection.get(index)
        if (value) {
            values.push(value)
        }
    }

    return values
}

/**
 * Resolve visible 3D tilesets from the active scene primitive collection.
 *
 * @param {object|null} scene - Cesium scene.
 * @returns {Array<object>} Visible tileset-like primitives.
 */
export const getVisibleReplayTilesets = scene => {
    const candidates = [
        ...collectionValues(scene?.primitives),
        globalThis.lgs?.base3dTileset,
        globalThis.lgs?.theTiles3DLayer,
    ]
    return [...new Set(candidates)]
        .filter(primitive => primitive?.show !== false)
        .filter(primitive => typeof primitive?.tilesLoaded === 'boolean')
}

/**
 * Resolve visible imagery layers attached to a collection.
 *
 * @param {object|null} collection - Cesium imagery layer collection.
 * @returns {Array<object>} Visible imagery layers.
 */
const getVisibleImageryLayers = collection => collectionValues(collection)
    .filter(layer => layer?.show !== false)

/**
 * Resolve all visible imagery layers used by the globe and visible tilesets.
 *
 * @param {object|null} scene - Cesium scene.
 * @param {Array<object>} tilesets - Visible 3D tilesets.
 * @returns {Array<object>} Visible imagery layers.
 */
const getVisibleReplayImageryLayers = (scene, tilesets) => [
    ...getVisibleImageryLayers(scene?.globe?.imageryLayers),
    ...tilesets.flatMap(tileset => getVisibleImageryLayers(tileset?.imageryLayers)),
]

/**
 * Determine whether all currently requested scene tiles are ready.
 *
 * Cesium exposes the globe and 3D tileset readiness as view-based booleans.
 * They include the content needed by the current camera view, which is a
 * conservative readiness gate for a crop taken from that view.
 *
 * @param {object|null} scene - Cesium scene.
 * @param {Array<object>|null} [tilesets=null] - Visible tilesets.
 * @returns {boolean} Whether the current scene tile content is ready.
 */
export const areReplaySceneTilesReady = (scene, tilesets = null) => {
    if (!scene) {
        return true
    }

    const visibleTilesets = tilesets ?? getVisibleReplayTilesets(scene)
    const globeReady = scene.globe?.show === false || scene.globe?.tilesLoaded !== false
    const tilesetsReady = visibleTilesets.every(tileset => tileset.tilesLoaded !== false)
    return globeReady && tilesetsReady
}

/**
 * Subscribe to a Cesium event and return a cleanup callback.
 *
 * @param {object|null} event - Cesium event-like object.
 * @param {Function} listener - Event listener.
 * @returns {Function|null} Listener cleanup callback.
 */
const subscribeToEvent = (event, listener) => {
    if (typeof event?.addEventListener !== 'function') {
        return null
    }

    const removeListener = event.addEventListener(listener)
    if (typeof removeListener === 'function') {
        return removeListener
    }

    return () => event.removeEventListener?.(listener)
}

/**
 * Build a descriptive error from a Cesium tile or imagery failure event.
 *
 * @param {object|string|Error|null} failure - Cesium failure payload.
 * @param {string} source - Failure source label.
 * @returns {Error} Export failure error.
 */
const createTileFailureError = (failure, source) => {
    const message = failure instanceof Error
        ? failure.message
        : failure?.message
          ?? failure?.url
          ?? (typeof failure === 'string' ? failure : 'Unknown tile failure')
    return new Error(`HQ replay export could not load ${source}: ${message}`)
}

/**
 * Disable movement-related 3D Tiles request deferral for the current capture.
 *
 * @param {Array<object>} tilesets - Visible tilesets.
 * @param {Map<object,object>} settings - Saved tileset settings.
 * @returns {void}
 */
const prepareReplayTilesetsForCapture = (tilesets, settings) => {
    tilesets.forEach(tileset => {
        if (settings.has(tileset)) {
            return
        }

        const previous = {}
        if (typeof tileset.cullRequestsWhileMoving === 'boolean') {
            previous.cullRequestsWhileMoving = tileset.cullRequestsWhileMoving
            tileset.cullRequestsWhileMoving = false
        }
        if (typeof tileset.foveatedScreenSpaceError === 'boolean') {
            previous.foveatedScreenSpaceError = tileset.foveatedScreenSpaceError
            tileset.foveatedScreenSpaceError = false
        }
        if (typeof tileset.foveatedTimeDelay === 'number') {
            previous.foveatedTimeDelay = tileset.foveatedTimeDelay
            tileset.foveatedTimeDelay = 0
        }
        settings.set(tileset, previous)
    })
}

/**
 * Restore 3D Tiles request scheduling settings after the capture warm-up.
 *
 * @param {Map<object,object>} settings - Saved tileset settings.
 * @returns {void}
 */
const restoreReplayTilesetSettings = settings => {
    settings.forEach((previous, tileset) => {
        Object.entries(previous).forEach(([property, value]) => {
            tileset[property] = value
        })
    })
}

/**
 * Keep more 2D globe tiles resident for the duration of an HQ export.
 *
 * Cesium owns the actual tile cache. We only increase its retention window
 * while frames are traversed and restore the user's setting afterwards.
 *
 * @param {object|null} scene - Cesium scene.
 * @param {number} minimumTileCacheSize - Minimum number of terrain tiles to retain.
 * @returns {Function|null} Cleanup callback.
 */
export const prepareReplaySceneTileCache = (
    scene,
    minimumTileCacheSize = DEFAULT_REPLAY_GLOBE_TILE_CACHE_SIZE,
) => {
    const globe = scene?.globe
    const previousTileCacheSize = Number(globe?.tileCacheSize)
    const requestedTileCacheSize = Math.max(0, Math.trunc(Number(minimumTileCacheSize) || 0))
    if (!globe || !Number.isFinite(previousTileCacheSize) || requestedTileCacheSize <= previousTileCacheSize) {
        return null
    }

    globe.tileCacheSize = requestedTileCacheSize
    return () => {
        globe.tileCacheSize = previousTileCacheSize
    }
}

/**
 * Wait for one Cesium post-render event or a short polling interval.
 *
 * @param {object|null} scene - Cesium scene.
 * @param {number} timeoutMs - Maximum wait duration.
 * @param {AbortSignal|null} signal - Optional cancellation signal.
 * @returns {Promise<boolean>} Whether a post-render event was observed.
 */
const waitForReplayPostRender = async (scene, timeoutMs, signal) => {
    if (signal?.aborted) {
        throw createAbortError()
    }

    const safeTimeoutMs = Math.max(0, Math.trunc(Number(timeoutMs) || 0))
    if (safeTimeoutMs === 0 || typeof scene?.postRender?.addEventListener !== 'function') {
        await new Promise(resolve => setTimeout(resolve, Math.min(DEFAULT_POLL_INTERVAL_MS, safeTimeoutMs)))
        return false
    }

    return await new Promise((resolve, reject) => {
        let settled = false
        let timeoutId = null
        const cleanup = []
        const settle = callback => value => {
            if (settled) {
                return
            }

            settled = true
            if (timeoutId !== null) {
                clearTimeout(timeoutId)
            }
            cleanup.splice(0).forEach(removeListener => removeListener?.())
            callback(value)
        }
        const resolveOnce = settle(resolve)
        const rejectOnce = settle(reject)
        const postRenderListener = subscribeToEvent(scene.postRender, () => resolveOnce(true))
        if (postRenderListener) {
            cleanup.push(postRenderListener)
        }

        if (signal) {
            const abortListener = () => rejectOnce(createAbortError())
            signal.addEventListener?.('abort', abortListener, {once: true})
            cleanup.push(() => signal.removeEventListener?.('abort', abortListener))
        }

        timeoutId = setTimeout(() => resolveOnce(false), safeTimeoutMs)
        requestReplaySceneRender(scene)
    })
}

/**
 * Wait for a tile readiness event, post-render event, or polling interval.
 *
 * @param {object|null} scene - Cesium scene.
 * @param {Array<object>} tilesets - Visible 3D tilesets.
 * @param {Array<object>} imageryLayers - Visible imagery layers.
 * @param {number} timeoutMs - Maximum wait duration.
 * @param {AbortSignal|null} signal - Optional cancellation signal.
 * @returns {Promise<void>} Promise resolved after a readiness opportunity.
 */
const waitForReplayTileSignal = async (scene, tilesets, imageryLayers, timeoutMs, signal) => {
    if (signal?.aborted) {
        throw createAbortError()
    }

    const safeTimeoutMs = Math.max(0, Math.trunc(Number(timeoutMs) || 0))
    if (safeTimeoutMs === 0) {
        return
    }

    await new Promise((resolve, reject) => {
        let settled = false
        let timeoutId = null
        const cleanup = []
        const settle = callback => value => {
            if (settled) {
                return
            }

            settled = true
            if (timeoutId !== null) {
                clearTimeout(timeoutId)
            }
            cleanup.splice(0).forEach(removeListener => removeListener?.())
            callback(value)
        }
        const resolveOnce = settle(resolve)
        const rejectOnce = settle(reject)
        const addEventListener = (event, listener) => {
            const removeListener = subscribeToEvent(event, listener)
            if (removeListener) {
                cleanup.push(removeListener)
            }
        }

        addEventListener(scene?.postRender, resolveOnce)
        addEventListener(scene?.globe?.tileLoadProgressEvent, resolveOnce)
        tilesets.forEach(tileset => {
            addEventListener(tileset.loadProgress, resolveOnce)
            addEventListener(tileset.allTilesLoaded, resolveOnce)
            addEventListener(tileset.initialTilesLoaded, resolveOnce)
            addEventListener(tileset.tileLoad, resolveOnce)
            addEventListener(tileset.tileVisible, resolveOnce)
            addEventListener(tileset.tileFailed, failure => rejectOnce(createTileFailureError(failure, '3D tiles')))
        })
        imageryLayers.forEach(layer => {
            addEventListener(layer.errorEvent, failure => rejectOnce(createTileFailureError(failure, '2D imagery tiles')))
        })

        if (signal) {
            const abortListener = () => rejectOnce(createAbortError())
            signal.addEventListener?.('abort', abortListener, {once: true})
            cleanup.push(() => signal.removeEventListener?.('abort', abortListener))
        }

        timeoutId = setTimeout(resolveOnce, Math.min(DEFAULT_POLL_INTERVAL_MS, safeTimeoutMs))
        requestReplaySceneRender(scene)
    })
}

/**
 * Wait until the Cesium scene has loaded and rendered the current view tiles.
 *
 * The check covers the globe's 2D imagery/terrain queue and every visible 3D
 * tileset. A post-render boundary is required after readiness so the captured
 * canvas cannot observe tile content that is loaded but not yet displayed.
 *
 * @param {object} options - Readiness wait options.
 * @param {object|null} [options.scene=null] - Cesium scene.
 * @param {number} [options.maxMillis=5000] - Maximum wall-clock wait.
 * @param {AbortSignal|null} [options.signal=null] - Optional cancellation signal.
 * @returns {Promise<boolean>} True when ready, false when the frame timeout expires.
 * @throws {Error} When tile loading fails or the wait is aborted.
 */
export const waitForReplaySceneTilesReady = async ({
                                                       scene = null,
                                                       maxMillis = 5000,
                                                       signal = null,
                                                   } = {}) => {
    if (!scene) {
        return true
    }

    const safeMaxMillis = Math.max(0, Math.trunc(Number(maxMillis) || 0))
    const deadline = Date.now() + safeMaxMillis
    let tilesets = getVisibleReplayTilesets(scene)
    let imageryLayers = getVisibleReplayImageryLayers(scene, tilesets)

    if (!scene.globe && tilesets.length === 0) {
        return true
    }

    const refreshTileSources = () => {
        tilesets = getVisibleReplayTilesets(scene)
        imageryLayers = getVisibleReplayImageryLayers(scene, tilesets)
        return areReplaySceneTilesReady(scene, tilesets)
    }

    if (areReplaySceneTilesReady(scene, tilesets)) {
        await waitForReplayPostRender(scene, Math.max(0, deadline - Date.now()), signal)
        if (refreshTileSources()) {
            return true
        }
    }

    while (Date.now() <= deadline) {
        if (signal?.aborted) {
            throw createAbortError()
        }

        if (refreshTileSources()) {
            await waitForReplayPostRender(scene, Math.max(0, deadline - Date.now()), signal)
            if (refreshTileSources()) {
                return true
            }
            continue
        }

        const remainingMs = Math.max(0, deadline - Date.now())
        await waitForReplayTileSignal(scene, tilesets, imageryLayers, remainingMs, signal)
    }

    return false
}

/**
 * Prepare the current Cesium view for a capture without changing the camera.
 *
 * The exporter has already positioned the camera for the frame. Waiting on
 * that view avoids an extra crop render and prevents visible flicker.
 *
 * @param {object} options - Capture readiness options.
 * @param {object|null} [options.scene=null] - Cesium scene.
 * @param {number} [options.maxMillis=5000] - Maximum wall-clock wait.
 * @param {AbortSignal|null} [options.signal=null] - Optional cancellation signal.
 * @param {boolean} [options.disableMovementRequestDeferral=true] - Disable 3D request deferral for a new tileset source.
 * @returns {Promise<boolean>} True when ready, false when the frame timeout expires.
 * @throws {Error} When tile loading fails or the wait is aborted.
 */
export const prepareReplaySceneTilesForCapture = async ({
                                                           scene = null,
                                                           maxMillis = 5000,
                                                           signal = null,
                                                           disableMovementRequestDeferral = true,
                                                       } = {}) => {
    if (!scene || signal?.aborted) {
        if (signal?.aborted) {
            throw createAbortError()
        }
        return true
    }

    const tilesetSettings = new Map()
    const prepareTilesets = () => prepareReplayTilesetsForCapture(getVisibleReplayTilesets(scene), tilesetSettings)
    const removePrepareListener = disableMovementRequestDeferral === true
        ? subscribeToEvent(scene.postRender, prepareTilesets)
        : null
    if (disableMovementRequestDeferral === true) {
        prepareTilesets()
    }
    try {
        return await waitForReplaySceneTilesReady({scene, maxMillis, signal})
    }
    finally {
        removePrepareListener?.()
        restoreReplayTilesetSettings(tilesetSettings)
    }
}

/**
 * Create a short-lived readiness coordinator for one HQ export.
 *
 * The coordinator reuses successful camera footprints until Cesium reports
 * new pending work or cache eviction. It never changes Cesium's read-only
 * readiness properties and it still performs a render boundary before a
 * reused footprint is captured.
 *
 * @param {object|null} scene - Cesium scene.
 * @param {object} [options] - Coordinator options.
 * @param {number} [options.knownFootprintRenderTimeoutMs=250] - Render budget for a known footprint.
 * @param {number} [options.newFootprintReadinessTimeoutMs=1000] - Readiness budget for a moving camera footprint.
 * @returns {{prepareForCapture: Function, dispose: Function}|null} Readiness coordinator.
 */
export const createReplaySceneTileReadinessCoordinator = (
    scene,
    {
        knownFootprintRenderTimeoutMs = DEFAULT_KNOWN_FOOTPRINT_RENDER_TIMEOUT_MS,
        newFootprintReadinessTimeoutMs = DEFAULT_NEW_FOOTPRINT_READINESS_TIMEOUT_MS,
        enabled = true,
        policy = REPLAY_TILE_READINESS_POLICY_ADAPTIVE,
        movingTimeoutMs = undefined,
        settledTimeoutMs = 5000,
        prewarmEnabled = true,
    } = {},
) => {
    if (!scene) {
        return null
    }

    let disposed = false
    let invalidationVersion = 0
    let sourceTilesets = []
    let sourcesInitialized = false
    let sourceGeneration = 0
    let preparedSourceGeneration = null
    let sourceCleanup = []
    const readyFootprints = new Map()
    const readinessOptions = normalizeReplaySceneTileReadinessOptions({
                                                                          enabled,
                                                                          policy,
                                                                          knownFootprintTimeoutMs: knownFootprintRenderTimeoutMs,
                                                                          movingTimeoutMs,
                                                                          newFootprintReadinessTimeoutMs,
                                                                          settledTimeoutMs,
                                                                          prewarmEnabled,
                                                                      })

    const invalidate = () => {
        invalidationVersion += 1
    }

    const cleanupSources = () => {
        sourceCleanup.splice(0).forEach(removeListener => removeListener?.())
        sourceTilesets = []
        sourcesInitialized = false
    }

    const refreshSources = () => {
        const tilesets = getVisibleReplayTilesets(scene)
        if (sourcesInitialized
            && tilesets.length === sourceTilesets.length
            && tilesets.every((tileset, index) => tileset === sourceTilesets[index])) {
            return
        }

        cleanupSources()
        sourceTilesets = tilesets
        sourcesInitialized = true
        sourceGeneration += 1
        invalidate()

        const addListener = (event, listener) => {
            const removeListener = subscribeToEvent(event, listener)
            if (removeListener) {
                sourceCleanup.push(removeListener)
            }
        }

        addListener(scene.globe?.tileLoadProgressEvent, queueLength => {
            if (Number(queueLength) > 0) {
                invalidate()
            }
        })
        tilesets.forEach(tileset => {
            addListener(tileset.loadProgress, (pendingRequests = 0, processing = 0) => {
                if (Number(pendingRequests) > 0 || Number(processing) > 0) {
                    invalidate()
                }
            })
            addListener(tileset.tileUnload, invalidate)
            addListener(tileset.tileFailed, invalidate)
        })
    }

    const prepareForCapture = async ({
                                        maxMillis = 5000,
                                        signal = null,
                                        settled = false,
                                        speedLevel = 'normal',
                                    } = {}) => {
        if (disposed) {
            return false
        }

        if (readinessOptions.enabled === false || readinessOptions.policy === REPLAY_TILE_READINESS_POLICY_OFF) {
            return true
        }

        refreshSources()
        const footprintKey = replayCameraFootprintKey(scene)
        const knownVersion = footprintKey === null ? null : readyFootprints.get(footprintKey)
        const disableMovementRequestDeferral = preparedSourceGeneration !== sourceGeneration
        const safeKnownTimeout = readinessOptions.knownFootprintTimeoutMs
        const effectiveMaxMillis = resolveReplayTileReadinessBudget({
                                                                         options: readinessOptions,
                                                                         maxMillis,
                                                                         settled,
                                                                         speedLevel,
                                                                     })

        if (knownVersion === invalidationVersion) {
            const rendered = await waitForReplayPostRender(scene, safeKnownTimeout, signal)
            refreshSources()
            if (rendered && areReplaySceneTilesReady(scene)
                && replayCameraFootprintKey(scene) === footprintKey
                && readyFootprints.get(footprintKey) === invalidationVersion) {
                return true
            }
        }

        const ready = await prepareReplaySceneTilesForCapture({
            scene,
            maxMillis: effectiveMaxMillis,
            signal,
            disableMovementRequestDeferral,
        })
        preparedSourceGeneration = sourceGeneration
        refreshSources()
        if (ready) {
            const finalFootprintKey = replayCameraFootprintKey(scene)
            if (finalFootprintKey !== null) {
                readyFootprints.set(finalFootprintKey, invalidationVersion)
            }
        }
        return ready
    }

    const dispose = () => {
        if (disposed) {
            return
        }

        disposed = true
        cleanupSources()
        readyFootprints.clear()
    }

    refreshSources()
    return {
        prepareForCapture,
        dispose,
    }
}
