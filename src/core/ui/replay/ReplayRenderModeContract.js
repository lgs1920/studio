/**
 * Shared visual contract for Draft and HQ replay rendering.
 */

export const REPLAY_RENDER_MODE_DRAFT = 'draft'
export const REPLAY_RENDER_MODE_HQ = 'hq'
export const REPLAY_RENDER_MODE_CONTRACT_VERSION = 1

const finiteNumber = (value, fallback = null) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const cloneValue = value => {
    if (value === null || value === undefined) {
        return value ?? null
    }

    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value)
        }
        catch {
            // Fall through to the JSON clone for plain replay data.
        }
    }

    return JSON.parse(JSON.stringify(value))
}

const normalizeDimensions = dimensions => {
    if (!dimensions) {
        return null
    }

    return {
        width:  Math.max(2, Math.round(Number(dimensions.width) || 0)),
        height: Math.max(2, Math.round(Number(dimensions.height) || 0)),
    }
}

const normalizeCropRect = cropRect => {
    if (!cropRect) {
        return null
    }

    return {
        left:   Math.round(Number(cropRect.left ?? cropRect.x) || 0),
        top:    Math.round(Number(cropRect.top ?? cropRect.y) || 0),
        width:  Math.max(0, Math.round(Number(cropRect.width) || 0)),
        height: Math.max(0, Math.round(Number(cropRect.height) || 0)),
    }
}

const normalizeRenderSpec = renderSpec => {
    if (!renderSpec) {
        return null
    }

    return {
        fps:              finiteNumber(renderSpec.fps),
        qualityIndex:     finiteNumber(renderSpec.qualityIndex),
        captureMode:      renderSpec.captureMode ?? null,
        cropRect:         normalizeCropRect(renderSpec.cropRect),
        composerClip:     cloneValue(renderSpec.composerClip),
        dimensions:       normalizeDimensions(renderSpec.dimensions),
        outputDpr:        finiteNumber(renderSpec.outputDpr),
        nativeDimensions: normalizeDimensions(renderSpec.nativeDimensions),
        pixelBudget:      finiteNumber(renderSpec.pixelBudget),
    }
}

const normalizeOverlayIds = overlayIds => [...new Set((overlayIds ?? []).map(id => `${id}`))]
    .filter(Boolean)
    .sort()

const cloneCameraState = cameraState => {
    if (!cameraState || typeof cameraState !== 'object') {
        return null
    }

    return {
        destination: {...(cameraState.destination ?? {})},
        orientation: {...(cameraState.orientation ?? {})},
        altitude: cameraState.altitude ?? null,
    }
}

/**
 * Normalize the public render mode value.
 *
 * @param {string} mode - Requested replay render mode.
 * @returns {string} The normalized render mode.
 */
export const normalizeReplayRenderMode = mode => mode === REPLAY_RENDER_MODE_HQ
    ? REPLAY_RENDER_MODE_HQ
    : REPLAY_RENDER_MODE_DRAFT

/**
 * Build the shared visual contract consumed by Draft and HQ.
 *
 * Scheduling and encoding remain outside this object. The output profile is
 * kept separate from the render mode so resolution changes do not alter the
 * meaning of Draft or HQ.
 *
 * @param {Object} options - Contract inputs.
 * @returns {Object} Shared replay render contract.
 */
export const createReplayRenderModeContract = ({
                                                   renderMode = REPLAY_RENDER_MODE_DRAFT,
                                                   logicalFrame = null,
                                                   cameraPose = null,
                                                   trackPath = null,
                                                   initialCameraState = null,
                                                   renderSpec = null,
                                                   visibleOverlayIds = [],
                                                   outputProfile = null,
                                               } = {}) => {
    const mode = normalizeReplayRenderMode(renderMode)
    return {
        version: REPLAY_RENDER_MODE_CONTRACT_VERSION,
        renderMode: mode,
        logicalFrame: cloneValue(logicalFrame),
        cameraPose: cloneValue(cameraPose ?? logicalFrame?.cameraPose),
        trackPath: cloneValue(trackPath),
        initialCameraState: cloneCameraState(initialCameraState),
        renderSpec: normalizeRenderSpec(renderSpec),
        visibleOverlayIds: normalizeOverlayIds(visibleOverlayIds),
        outputProfile: cloneValue(outputProfile),
        scheduling: {
            realtime:    mode === REPLAY_RENDER_MODE_DRAFT,
            frameByFrame: mode === REPLAY_RENDER_MODE_HQ,
        },
    }
}

/**
 * Build the immutable context key used to reuse or invalidate a warm HQ plan.
 *
 * @param {Object} options - Replay and render context inputs.
 * @returns {Object} Normalized context and serialized key.
 */
export const createReplayRenderContext = ({
                                                renderMode = REPLAY_RENDER_MODE_HQ,
                                                durationMillis = null,
                                                direction = 1,
                                                clipSignature = null,
                                                trackPathSignature = null,
                                                widgetSignature = '',
                                                initialCameraState = null,
                                                renderSpec = null,
                                                trackPath = null,
                                                visibleOverlayIds = [],
                                                recordingSync = false,
                                            } = {}) => {
    const contract = createReplayRenderModeContract({
        renderMode,
        initialCameraState,
        renderSpec,
        trackPath,
        visibleOverlayIds,
    })
    const context = {
        version:        REPLAY_RENDER_MODE_CONTRACT_VERSION,
        renderMode:     contract.renderMode,
        durationMillis: finiteNumber(durationMillis),
        direction:      Number(direction) < 0 ? -1 : 1,
        clipSignature:  clipSignature ?? null,
        trackPathSignature: trackPathSignature ?? null,
        widgetSignature: `${widgetSignature ?? ''}`,
        cameraState:    contract.initialCameraState,
        renderSpec:     contract.renderSpec,
        visibleOverlayIds: contract.visibleOverlayIds,
        recordingSync:   Boolean(recordingSync),
    }

    return {
        contract,
        context,
        contextKey: JSON.stringify(context),
    }
}
