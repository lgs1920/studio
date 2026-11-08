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
 * Last modified: 2026-11-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Runtime descriptor used to reproduce the interactive Cesium scene in an
 * isolated replay render host.
 */

import {POIUtils} from '@Utils/cesium/POIUtils'
import {getTrackRenderContent} from '@Utils/cesium/trackRenderSmoothing'
import {normalizeTrackRenderStyle} from '@Utils/cesium/trackRenderStyle'
import {getJourneyReplayHideOtherJourneys} from '@Core/ui/JourneyVisibility'

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

/** Read a Cesium property while retaining plain values used by test fixtures. */
const readReplayEntityProperty = property => typeof property?.getValue === 'function'
    ? property.getValue()
    : property

/** Clone plain application data before retaining it for one deterministic export. */
const cloneReplayApplicationData = value => {
    try {
        return JSON.parse(JSON.stringify(value))
    }
    catch {
        return null
    }
}

/** Freeze a cloned application-data tree without freezing live Cesium providers. */
const freezeReplayApplicationData = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value
    }
    const prototype = Object.getPrototypeOf(value)
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
        return value
    }

    Object.values(value).forEach(freezeReplayApplicationData)
    return Object.freeze(value)
}

/** Capture constant billboard display values without retaining live graphics properties. */
const captureReplayPOIBillboard = entity => {
    const billboard = entity?.billboard
    if (!billboard) {
        return null
    }

    const properties = [
        'width', 'height', 'scale', 'horizontalOrigin', 'verticalOrigin', 'heightReference',
        'disableDepthTestDistance', 'rotation', 'alignedAxis', 'color', 'sizeInMeters',
        'scaleByDistance', 'translucencyByDistance', 'distanceDisplayCondition', 'eyeOffset',
    ]
    const result = Object.fromEntries(properties.flatMap(property => {
        const value = readReplayEntityProperty(billboard[property])
        return value === undefined || value === null || typeof value === 'function'
            ? []
            : [[property, value?.clone?.() ?? value]]
    }))
    const pixelOffset = readReplayEntityProperty(billboard.pixelOffset)
    if (Number.isFinite(Number(pixelOffset?.x)) && Number.isFinite(Number(pixelOffset?.y))) {
        result.pixelOffset = {x: Number(pixelOffset.x), y: Number(pixelOffset.y)}
    }

    return result
}

/** Snapshot visible Studio POI models without carrying live Cesium entities across contexts. */
const captureReplayPOIDescriptors = viewer => {
    const poiList = globalThis.__?.ui?.poiManager?.list
        ?? globalThis.lgs?.stores?.main?.components?.pois?.list
    const values = typeof poiList?.values === 'function' ? Array.from(poiList.values()) : []

    return values.flatMap(poi => {
        const model = cloneReplayApplicationData(poi)
        if (!model?.id || !Number.isFinite(Number(model.longitude)) || !Number.isFinite(Number(model.latitude))) {
            return []
        }

        const entity = POIUtils.getEntityContainer(poi, viewer)?.getById?.(poi.id)
        const sourceImage = readReplayEntityProperty(entity?.billboard?.image) ?? poi.image?.src
        if (sourceImage !== undefined && sourceImage !== null) {
            model.image = {
                ...(model.image ?? {}),
                src: sourceImage,
                width: model.image?.width ?? readReplayEntityProperty(entity?.billboard?.width) ?? sourceImage.width,
                height: model.image?.height ?? readReplayEntityProperty(entity?.billboard?.height) ?? sourceImage.height,
            }
        }
        const entityVisible = POIUtils.isPOIVisibleOnMap(
            poi,
            entity ? readReplayEntityProperty(entity.show) !== false : poi.visible !== false,
        )

        return [Object.freeze({
            poi: freezeReplayApplicationData(model),
            visible: entityVisible,
            dataSourceName: POIUtils.getDataSourceName(poi),
            billboard: freezeReplayApplicationData(captureReplayPOIBillboard(entity)),
        })]
    })
}

/** Snapshot currently visible non-Replay tracks outside the journey animated by Replay. */
const captureReplayBackgroundTracks = (viewer, replayJourney) => {
    const journeys = globalThis.lgs?.journeys
    const journeyValues = typeof journeys?.values === 'function' ? Array.from(journeys.values()) : []
    const hideOtherJourneys = getJourneyReplayHideOtherJourneys()

    return journeyValues.flatMap(journey => {
        if (!journey?.slug || journey.slug === replayJourney?.slug
            || journey.visible === false
            || (hideOtherJourneys && journey.slug !== replayJourney?.slug)) {
            return []
        }

        return Array.from(journey.tracks?.values?.() ?? []).flatMap(track => {
            if (!track?.slug || track.visible === false) {
                return []
            }

            const source = viewer?.dataSources?.getByName?.(track.slug)?.[0]
            if (!source || source.show === false || !track.content?.geometry) {
                return []
            }

            const content = cloneReplayApplicationData(getTrackRenderContent(track, {forRender: true}))
            if (!content?.geometry) {
                return []
            }

            return [Object.freeze({
                slug: track.slug,
                name: track.title ?? track.slug,
                content: freezeReplayApplicationData(content),
                style: freezeReplayApplicationData(normalizeTrackRenderStyle(track.renderStyle, {
                    color: track.color,
                    thickness: track.thickness,
                })),
            })]
        })
    })
}

/** Return the visible non-POI entity IDs owned by a Cesium collection. */
const visibleNonPOIEntityIds = (collection, knownPOIIds) => (collection?.values ?? [])
    .filter(entity => readReplayEntityProperty(entity?.show) !== false && !knownPOIIds.has(`${entity?.id ?? ''}`))
    .map(entity => `${entity?.id ?? entity?.name ?? entity?.constructor?.name ?? 'unknown entity'}`)

/** Identify visible scene objects that cannot be reconstructed from Studio data. */
const findReplaySceneCompatibilityLimitations = (
    viewer,
    base3dDefinition,
    additional3dDefinition,
    environment,
    poiDescriptors,
    trackDescriptors,
    replayJourney,
) => {
    const scene = viewer?.scene
    const supportedTilesets = new Set([
        base3dDefinition ? globalThis.lgs?.base3dTileset : null,
        additional3dDefinition ? globalThis.lgs?.theTiles3DLayer : null,
    ].filter(Boolean))
    const knownPOIIds = new Set(poiDescriptors.map(({poi}) => `${poi.id}`))
    const knownTrackSlugs = new Set(
        Array.from(globalThis.lgs?.journeys?.values?.() ?? [])
            .flatMap(journey => Array.from(journey?.tracks?.values?.() ?? []))
            .map(track => `${track?.slug ?? ''}`)
            .filter(Boolean),
    )
    const replayTrackSlugs = new Set(Array.from(replayJourney?.tracks?.values?.() ?? []).map(track => `${track?.slug ?? ''}`))
    const capturedTrackSlugs = new Set(trackDescriptors.map(({slug}) => `${slug}`))
    const hideOtherJourneys = getJourneyReplayHideOtherJourneys()
    const excludedTrackSlugs = new Set(
        Array.from(globalThis.lgs?.journeys?.values?.() ?? []).flatMap(journey => (
            Array.from(journey?.tracks?.values?.() ?? [])
                .filter(track => journey?.slug === replayJourney?.slug
                    || journey?.visible === false
                    || track?.visible === false
                    || (hideOtherJourneys && journey?.slug !== replayJourney?.slug))
                .map(track => `${track?.slug ?? ''}`)
        )),
    )
    const limitations = []
    const unsupportedPrimitives = []
    // Cesium adds one EntityCluster per DataSource to scene.primitives; the isolated
    // CesiumWidget creates fresh clusters for the reconstructed export data sources.
    const generatedEntityPrimitiveNames = new Set([
        'BillboardCollection',
        'EntityCluster',
        'LabelCollection',
        'PointPrimitiveCollection',
    ])

    const inspectPrimitive = primitive => {
        if (!primitive || primitive.show === false || supportedTilesets.has(primitive)) {
            return
        }

        const type = primitive.constructor?.name ?? 'Cesium primitive'
        if (generatedEntityPrimitiveNames.has(type)) {
            return
        }
        if (type === 'PrimitiveCollection') {
            const children = replaySceneCollectionValues(primitive)
            if (children.length > 0 && children.every(child => generatedEntityPrimitiveNames.has(child?.constructor?.name))) {
                return
            }
            children.forEach(inspectPrimitive)
            return
        }

        unsupportedPrimitives.push(`${type}${primitive.id ? ` (${primitive.id})` : ''}`)
    }

    replaySceneCollectionValues(scene?.primitives).forEach(inspectPrimitive)
    if (unsupportedPrimitives.length > 0) {
        limitations.push(`required visible Cesium primitive(s) cannot be reconstructed: ${unsupportedPrimitives.join(', ')}`)
    }

    const knownDataSourceNames = new Set([
        ...journeySourceNames(),
        ...knownTrackSlugs,
    ])
    const unsupportedDataSources = replaySceneCollectionValues(viewer?.dataSources).flatMap(dataSource => {
        if (!dataSource || dataSource.show === false || `${dataSource.name ?? ''}`.startsWith('replay#')) {
            return []
        }
        const name = `${dataSource.name ?? ''}`
        if (knownTrackSlugs.has(name)) {
            if (capturedTrackSlugs.has(name) || replayTrackSlugs.has(name) || excludedTrackSlugs.has(name)) {
                return []
            }
        }
        else if (journeySourceNames().includes(name)) {
            const entityIds = visibleNonPOIEntityIds(dataSource.entities, knownPOIIds)
            return entityIds.length > 0
                ? [`${name} [${entityIds.join(', ')}]`]
                : []
        }
        else if (!knownDataSourceNames.has(name)) {
            const entityIds = visibleNonPOIEntityIds(dataSource.entities, knownPOIIds)
            return entityIds.length > 0
                ? [`${name || dataSource.constructor?.name || 'unnamed data source'} [${entityIds.join(', ')}]`]
                : []
        }
        const entityIds = visibleNonPOIEntityIds(dataSource.entities, knownPOIIds)
        return entityIds.length > 0
            ? [`${name || dataSource.constructor?.name || 'unnamed data source'} [${entityIds.join(', ')}]`]
            : []
    })
    if (unsupportedDataSources.length > 0) {
        limitations.push(`required visible Cesium data source(s) cannot be reconstructed: ${unsupportedDataSources.join('; ')}`)
    }

    const unsupportedViewerEntities = visibleNonPOIEntityIds(viewer?.entities, knownPOIIds)
    if (unsupportedViewerEntities.length > 0) {
        limitations.push(`required visible viewer entity/entities cannot be reconstructed: ${unsupportedViewerEntities.join(', ')}`)
    }
    if (!environment.supported.skyBox) {
        limitations.push('a sky box with non-URL or context-owned image sources')
    }
    if (!environment.supported.light) {
        limitations.push('a custom Cesium light type')
    }

    return limitations
}

/** Resolve the source names used for journey-owned POI data sources. */
const journeySourceNames = () => {
    const journeys = globalThis.lgs?.journeys
    const values = typeof journeys?.values === 'function' ? Array.from(journeys.values()) : []
    return values.map(journey => `${journey.slug ?? ''}`).filter(Boolean)
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
    additional3dDefinition = globalThis.lgs?.stores?.main?.theTiles3DLayer ?? null,
    journey = globalThis.lgs?.stores?.main?.theJourney ?? globalThis.lgs?.theJourney ?? null,
} = {}) => {
    const scene = viewer?.scene
    if (!viewer || !scene) {
        return null
    }
    const environment = captureReplaySceneEnvironment(scene)
    const poiDescriptors = captureReplayPOIDescriptors(viewer)
    const trackDescriptors = captureReplayBackgroundTracks(viewer, journey)
    const capturedBase3dDefinition = freezeReplayApplicationData(cloneReplayApplicationData(base3dDefinition))
    const additional3dDefinitions = additional3dDefinition
        ? [freezeReplayApplicationData(cloneReplayApplicationData(additional3dDefinition))].filter(Boolean)
        : []

    return {
        version: REPLAY_SCENE_DESCRIPTOR_VERSION,
        sceneMode: scene.mode,
        mapProjection: scene.mapProjection ?? null,
        terrainProvider: viewer.terrainProvider ?? scene.globe?.terrainProvider ?? null,
        imageryLayers: replaySceneCollectionValues(viewer.imageryLayers)
            .map(captureReplayImageryLayerDescriptor)
            .filter(Boolean),
        base3dDefinition: capturedBase3dDefinition,
        additional3dDefinitions,
        poiDescriptors,
        trackDescriptors,
        compatibilityLimitations: findReplaySceneCompatibilityLimitations(
            viewer,
            capturedBase3dDefinition,
            additional3dDefinitions[0] ?? null,
            environment,
            poiDescriptors,
            trackDescriptors,
            journey,
        ),
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
