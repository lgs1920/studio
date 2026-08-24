/**
 * Runtime descriptor used to reproduce the interactive Cesium scene in an
 * isolated replay render host.
 */

export const REPLAY_SCENE_DESCRIPTOR_VERSION = 1

const REPLAY_IMAGERY_DISPLAY_PROPERTIES = [
    'alpha',
    'brightness',
    'contrast',
    'hue',
    'saturation',
    'gamma',
    'show',
    'splitDirection',
    'dayAlpha',
    'nightAlpha',
    'minimumTerrainLevel',
    'maximumTerrainLevel',
]

/**
 * Read every item from a Cesium collection without retaining the collection.
 *
 * @param {Object|null} collection - Cesium collection-like object.
 * @returns {Array<*>} Collection values.
 */
const replaySceneCollectionValues = collection => {
    const length = Number(collection?.length)
    if (!Number.isInteger(length) || length <= 0 || typeof collection?.get !== 'function') {
        return []
    }

    return Array.from({length}, (_value, index) => collection.get(index))
}

/**
 * Capture display settings for one imagery layer while reusing its provider.
 *
 * Imagery providers are request sources and may be reused by separate layer
 * instances. The live ImageryLayer itself is never shared between scenes.
 *
 * @param {Object|null} layer - Live Cesium imagery layer.
 * @returns {Object|null} Runtime layer descriptor.
 */
const captureReplayImageryLayerDescriptor = layer => {
    if (!layer?.imageryProvider) {
        return null
    }

    const display = {}
    REPLAY_IMAGERY_DISPLAY_PROPERTIES.forEach(property => {
        const value = layer[property]
        if (value !== undefined && typeof value !== 'function') {
            display[property] = value
        }
    })
    return {
        imageryProvider: layer.imageryProvider,
        display,
    }
}

/**
 * Capture the active scene sources required by an isolated HQ replay host.
 *
 * @param {Object} options - Source viewer and active 3D layer definition.
 * @returns {Object|null} Runtime scene descriptor.
 */
export const captureReplaySceneDescriptor = ({
    viewer = globalThis.lgs?.viewer ?? null,
    base3dDefinition = globalThis.lgs?.stores?.main?.theBase3DLayer ?? null,
} = {}) => {
    const scene = viewer?.scene
    if (!viewer || !scene) {
        return null
    }

    return {
        version: REPLAY_SCENE_DESCRIPTOR_VERSION,
        sceneMode: scene.mode,
        mapProjection: scene.mapProjection ?? null,
        terrainProvider: viewer.terrainProvider ?? scene.globe?.terrainProvider ?? null,
        imageryLayers: replaySceneCollectionValues(viewer.imageryLayers)
            .map(captureReplayImageryLayerDescriptor)
            .filter(Boolean),
        base3dDefinition: base3dDefinition ?? null,
        environment: {
            shadows: scene.shadows === true,
            backgroundColor: scene.backgroundColor?.clone?.() ?? scene.backgroundColor ?? null,
            globe: {
                show: scene.globe?.show !== false,
                depthTestAgainstTerrain: scene.globe?.depthTestAgainstTerrain === true,
                enableLighting: scene.globe?.enableLighting === true,
                baseColor: scene.globe?.baseColor?.clone?.() ?? scene.globe?.baseColor ?? null,
            },
            fog: {
                enabled: scene.fog?.enabled !== false,
                renderable: scene.fog?.renderable !== false,
                density: scene.fog?.density ?? null,
            },
        },
    }
}

/**
 * Apply captured imagery display settings to a new layer instance.
 *
 * @param {Object|null} layer - Destination Cesium imagery layer.
 * @param {Object|null} descriptor - Runtime imagery descriptor.
 * @returns {Object|null} Configured layer.
 */
export const applyReplayImageryLayerDescriptor = (layer, descriptor) => {
    if (!layer || !descriptor) {
        return null
    }

    Object.entries(descriptor.display ?? {}).forEach(([property, value]) => {
        if (property in layer) {
            layer[property] = value
        }
    })
    return layer
}
