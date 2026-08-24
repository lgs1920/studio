/**
 * Serializable authoring snapshot consumed by replay planning.
 */

export const REPLAY_DEFINITION_VERSION = 1

/**
 * Clone plain replay definition data.
 *
 * @param {*} value - Plain value to clone.
 * @returns {*} Cloned value or null.
 */
const cloneReplayDefinitionValue = value => {
    if (value === null || value === undefined) {
        return value ?? null
    }

    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value)
        }
        catch {
            // JSON remains the compatibility fallback for plain definition data.
        }
    }

    const serialized = JSON.stringify(value)
    return serialized === undefined ? null : JSON.parse(serialized)
}

/**
 * Produce a compact deterministic hash for small replay metadata.
 *
 * This hash is not used for security. Large route coordinates must be
 * represented by a lightweight revision or runtime segment signature before
 * reaching this function.
 *
 * @param {*} value - Small serializable metadata value.
 * @returns {string} Compact unsigned hash.
 */
export const replayContractHash = value => {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? null)
    let hash = 2166136261
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(36)
}

/**
 * Normalize visible overlay identifiers for deterministic plan comparison.
 *
 * @param {Array} overlayIds - Overlay identifiers.
 * @returns {Array<string>} Sorted unique identifiers.
 */
const normalizeOverlayIds = overlayIds => [...new Set((overlayIds ?? []).map(id => `${id}`))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))

/**
 * Create a versioned replay definition without renderer or runtime objects.
 *
 * @param {Object} options - Definition inputs.
 * @returns {Object} Serializable replay definition.
 */
export const createReplayDefinition = ({
    id = null,
    journeyId = null,
    journeyRevision = null,
    direction = 1,
    timeline = null,
    cameraDefinition = null,
    renderSpec = null,
    crop = null,
    visibleOverlayIds = [],
    outputProfile = null,
    trackPathDescriptor = null,
    qualityPolicy = null,
    source = 'replay',
} = {}) => {
    const normalizedDirection = Number(direction) < 0 ? -1 : 1
    const normalizedOverlayIds = normalizeOverlayIds(visibleOverlayIds)
    const identityPayload = {
        version: REPLAY_DEFINITION_VERSION,
        journeyId: journeyId ?? null,
        journeyRevision: journeyRevision ?? null,
        direction: normalizedDirection,
        timeline: {
            durationMillis: Number(timeline?.durationMillis) || 0,
            fps: Number(timeline?.fps) || 0,
            clipSignature: timeline?.clipSignature ?? null,
        },
        cameraDefinition: cameraDefinition ?? null,
        renderSpec: renderSpec ?? null,
        crop: crop ?? null,
        visibleOverlayIds: normalizedOverlayIds,
        outputProfile: outputProfile ?? null,
        trackPathSignature: trackPathDescriptor?.signature ?? null,
        qualityPolicy: qualityPolicy ?? null,
        source,
    }

    return {
        version: REPLAY_DEFINITION_VERSION,
        id: id ?? `replay-definition-${replayContractHash(identityPayload)}`,
        journeyId: journeyId ?? null,
        journeyRevision: journeyRevision ?? null,
        direction: normalizedDirection,
        timeline: cloneReplayDefinitionValue(timeline),
        cameraDefinition: cloneReplayDefinitionValue(cameraDefinition),
        renderSpec: cloneReplayDefinitionValue(renderSpec),
        crop: cloneReplayDefinitionValue(crop),
        visibleOverlayIds: normalizedOverlayIds,
        outputProfile: cloneReplayDefinitionValue(outputProfile),
        trackPathDescriptor: cloneReplayDefinitionValue(trackPathDescriptor),
        qualityPolicy: cloneReplayDefinitionValue(qualityPolicy),
        source: source ?? 'replay',
    }
}
