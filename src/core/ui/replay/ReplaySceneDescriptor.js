/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplaySceneDescriptor.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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

const REPLAY_GLOBE_ENVIRONMENT_PROPERTIES = [
    'show', 'depthTestAgainstTerrain', 'enableLighting', 'maximumScreenSpaceError', 'baseColor',
    'lambertDiffuseMultiplier', 'dynamicAtmosphereLighting', 'dynamicAtmosphereLightingFromSun',
    'showGroundAtmosphere', 'atmosphereLightIntensity', 'atmosphereRayleighCoefficient',
    'atmosphereMieCoefficient', 'atmosphereRayleighScaleHeight', 'atmosphereMieScaleHeight',
    'atmosphereMieAnisotropy', 'lightingFadeOutDistance', 'lightingFadeInDistance',
    'nightFadeOutDistance', 'nightFadeInDistance', 'showWaterEffect', 'shadows',
    'atmosphereHueShift', 'atmosphereSaturationShift', 'atmosphereBrightnessShift',
]
const REPLAY_FOG_ENVIRONMENT_PROPERTIES = [
    'enabled', 'renderable', 'density', 'heightScalar', 'maxHeight', 'visualDensityScalar',
    'screenSpaceErrorFactor', 'minimumBrightness', 'heightFalloff',
]
const REPLAY_SKY_ATMOSPHERE_PROPERTIES = [
    'show', 'perFragmentAtmosphere', 'atmosphereLightIntensity', 'atmosphereRayleighCoefficient',
    'atmosphereMieCoefficient', 'atmosphereRayleighScaleHeight', 'atmosphereMieScaleHeight',
    'atmosphereMieAnisotropy', 'hueShift', 'saturationShift', 'brightnessShift',
]

/** Capture serializable scene appearance values without retaining context-owned scene objects. */
const captureCesiumProperties = (source, properties) => Object.fromEntries(
    properties.flatMap(property => {
        const value = source?.[property]
        return value === undefined || typeof value === 'function'
            ? []
            : [[property, value?.clone?.() ?? value]]
    }),
)

const captureReplaySceneEnvironment = scene => {
    const sourceSkyBox = scene?.skyBox
    const skyBoxSources = sourceSkyBox?.sources ?? null
    const skyBoxSourceValues = skyBoxSources && typeof skyBoxSources === 'object'
        ? Object.values(skyBoxSources)
        : []
    const skyBoxSupported = !sourceSkyBox
        || (skyBoxSources !== null && skyBoxSourceValues.every(value => typeof value === 'string'))
    const light = scene?.light
    const lightType = light?.constructor?.name ?? null
    const lightSupported = lightType === 'SunLight' || lightType === 'DirectionalLight'

    return {
        supported: {
            skyBox: skyBoxSupported,
            light: !light || lightSupported,
        },
        shadows: scene?.shadows === true,
        backgroundColor: scene?.backgroundColor?.clone?.() ?? scene?.backgroundColor ?? null,
        globe: captureCesiumProperties(scene?.globe, REPLAY_GLOBE_ENVIRONMENT_PROPERTIES),
        fog: captureCesiumProperties(scene?.fog, REPLAY_FOG_ENVIRONMENT_PROPERTIES),
        skyAtmosphere: scene?.skyAtmosphere
            ? captureCesiumProperties(scene.skyAtmosphere, REPLAY_SKY_ATMOSPHERE_PROPERTIES)
            : {show: false},
        skyBox: skyBoxSupported && sourceSkyBox
            ? {sources: {...skyBoxSources}, show: sourceSkyBox.show !== false}
            : null,
        light: lightSupported
            ? {
                type: lightType,
                color: light.color?.clone?.() ?? light.color ?? null,
                intensity: Number.isFinite(Number(light.intensity)) ? Number(light.intensity) : null,
                direction: light.direction?.clone?.() ?? light.direction ?? null,
            }
            : null,
        verticalExaggeration: Number.isFinite(Number(scene?.verticalExaggeration))
            ? Number(scene.verticalExaggeration)
            : 1,
        verticalExaggerationRelativeHeight: Number.isFinite(Number(scene?.verticalExaggerationRelativeHeight))
            ? Number(scene.verticalExaggerationRelativeHeight)
            : 0,
    }
}

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
 * Identify viewer-owned content that the isolated Replay host cannot clone.
 *
 * @param {Object|null} viewer - Active Cesium viewer.
 * @param {Object|null} base3dDefinition - Configured base tileset definition.
 * @returns {Array<string>} Human-readable compatibility limitations.
 */
const findReplaySceneCompatibilityLimitations = (viewer, base3dDefinition, environment) => {
    const scene = viewer?.scene
    const primitives = replaySceneCollectionValues(scene?.primitives)
    const tilesets = primitives.filter(primitive => primitive?.root && Number.isFinite(Number(primitive.maximumScreenSpaceError)))
    const configuredTilesets = [
        globalThis.lgs?.base3dTileset,
        globalThis.lgs?.theTiles3DLayer,
    ].filter(tileset => tilesets.includes(tileset))
    const supportedBaseTileset = base3dDefinition
        ? configuredTilesets[0] ?? (tilesets.length === 1 ? tilesets[0] : null)
        : null
    const unsupportedPrimitiveCount = primitives.filter(primitive => primitive !== supportedBaseTileset).length
    const dataSources = replaySceneCollectionValues(viewer?.dataSources)
        .filter(dataSource => !`${dataSource?.name ?? ''}`.startsWith('replay#'))
    const entityCount = Array.isArray(viewer?.entities?.values) ? viewer.entities.values.length : 0
    const limitations = []

    if (unsupportedPrimitiveCount > 0) {
        limitations.push(`${unsupportedPrimitiveCount} additional Cesium scene primitive(s) or tileset(s)`)
    }
    if (dataSources.length > 0) {
        limitations.push(`${dataSources.length} non-Replay Cesium data source(s)`)
    }
    if (entityCount > 0) {
        limitations.push(`${entityCount} viewer-owned Cesium entit${entityCount === 1 ? 'y' : 'ies'}`)
    }
    if (!environment.supported.skyBox) {
        limitations.push('a sky box with non-URL or context-owned image sources')
    }
    if (!environment.supported.light) {
        limitations.push('a custom Cesium light type')
    }

    return limitations
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
 * Capture the active scene sources required by an isolated Replay export host.
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
    const environment = captureReplaySceneEnvironment(scene)

    return {
        version: REPLAY_SCENE_DESCRIPTOR_VERSION,
        sceneMode: scene.mode,
        mapProjection: scene.mapProjection ?? null,
        terrainProvider: viewer.terrainProvider ?? scene.globe?.terrainProvider ?? null,
        imageryLayers: replaySceneCollectionValues(viewer.imageryLayers)
            .map(captureReplayImageryLayerDescriptor)
            .filter(Boolean),
        base3dDefinition: base3dDefinition ?? null,
        compatibilityLimitations: findReplaySceneCompatibilityLimitations(viewer, base3dDefinition, environment),
        environment,
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
