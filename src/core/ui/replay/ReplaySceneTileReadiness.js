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
 * Wait for one Cesium post-render event or a short polling interval.
 *
 * @param {object|null} scene - Cesium scene.
 * @param {number} timeoutMs - Maximum wait duration.
 * @param {AbortSignal|null} signal - Optional cancellation signal.
 * @returns {Promise<void>} Promise resolved after a render opportunity.
 */
const waitForReplayPostRender = async (scene, timeoutMs, signal) => {
    if (signal?.aborted) {
        throw createAbortError()
    }

    const safeTimeoutMs = Math.max(0, Math.trunc(Number(timeoutMs) || 0))
    if (safeTimeoutMs === 0 || typeof scene?.postRender?.addEventListener !== 'function') {
        await new Promise(resolve => setTimeout(resolve, Math.min(DEFAULT_POLL_INTERVAL_MS, safeTimeoutMs)))
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
        const postRenderListener = subscribeToEvent(scene.postRender, resolveOnce)
        if (postRenderListener) {
            cleanup.push(postRenderListener)
        }

        if (signal) {
            const abortListener = () => rejectOnce(createAbortError())
            signal.addEventListener?.('abort', abortListener, {once: true})
            cleanup.push(() => signal.removeEventListener?.('abort', abortListener))
        }

        timeoutId = setTimeout(resolveOnce, safeTimeoutMs)
        scene.requestRender?.()
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
        scene?.requestRender?.()
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
 * @returns {Promise<boolean>} True when ready, false when the frame timeout expires.
 * @throws {Error} When tile loading fails or the wait is aborted.
 */
export const prepareReplaySceneTilesForCapture = async ({
                                                           scene = null,
                                                           maxMillis = 5000,
                                                           signal = null,
                                                       } = {}) => {
    if (!scene || signal?.aborted) {
        if (signal?.aborted) {
            throw createAbortError()
        }
        return true
    }

    const tilesetSettings = new Map()
    const prepareTilesets = () => prepareReplayTilesetsForCapture(getVisibleReplayTilesets(scene), tilesetSettings)
    const removePrepareListener = subscribeToEvent(scene.postRender, prepareTilesets)
    prepareTilesets()
    try {
        return await waitForReplaySceneTilesReady({scene, maxMillis, signal})
    }
    finally {
        removePrepareListener?.()
        restoreReplayTilesetSettings(tilesetSettings)
    }
}
