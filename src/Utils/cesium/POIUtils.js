/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-03-01
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { icon, library } from '@fortawesome/fontawesome-svg-core'
import { faLocationDot } from '@fortawesome/pro-regular-svg-icons'
import { faLocationPin } from '@fortawesome/pro-solid-svg-icons'
import { GLOBAL_PARENT } from '@Core/constants'
import {
    isReplayPOIPresentationActive,
    resolveReplayPOIPresentation,
} from '@Core/ui/replay/JourneyReplayPOISettings'
import {
    POI_BILLBOARD_FAR_DISTANCE, POI_BILLBOARD_NEAR_DISTANCE,
} from '@Utils/cesium/POIBillboardScale'

import { Canvg, Property } from 'canvg'
import {
    BillboardGraphics, Cartesian2, Cartesian3, Cartographic, HeightReference, HorizontalOrigin, JulianDate,
    NearFarScalar, Property as CesiumProperty, VerticalOrigin,
}                          from 'cesium' // Pin Marker Type

// Pin Marker Type
export const PIN_ICON = 1
export const PIN_TEXT = 2
export const PIN_COLOR = 3
//Other paths
export const PIN_CIRCLE = 4
export const JUST_ICON = 5

export const POI_FLAG_START = 'start'
export const POI_FLAG_STOP = 'stop'
export const POI_FLAG = 'flag'
export const POI_STD = 'poi'
export const POI_MARKER = 'marker'
export const POI_PROFILER = 'profiler'

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/** Escape color strings before embedding them in a fallback SVG attribute. */
const escapeXMLAttribute = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

/** Resolve a Cesium property while allowing plain values from lightweight entity fixtures. */
const cesiumPropertyValue = (property, time) => typeof property?.getValue === 'function'
    ? CesiumProperty.getValueOrUndefined(property, time)
    : property

/** Compare a Cesium property value with a proposed constant graphics value. */
const cesiumPropertyMatches = (property, value, time) => {
    const currentValue = cesiumPropertyValue(property, time)
    if (currentValue === value) {
        return true
    }
    if (currentValue instanceof Cartesian2 && value instanceof Cartesian2) {
        return Cartesian2.equals(currentValue, value)
    }
    if (currentValue instanceof Cartesian3 && value instanceof Cartesian3) {
        return Cartesian3.equals(currentValue, value)
    }
    if (currentValue instanceof NearFarScalar && value instanceof NearFarScalar) {
        return NearFarScalar.equals(currentValue, value)
    }
    return false
}

/** Assign a billboard constant only when its resolved Cesium value changes. */
const assignBillboardPropertyIfChanged = (billboard, name, value, time) => {
    if (cesiumPropertyMatches(billboard[name], value, time)) {
        return false
    }

    billboard[name] = value
    return true
}

/**
 * Keep an existing terrain mask when an unrelated POI update requests visibility.
 * @param {Entity} entity - Existing Cesium POI entity.
 * @param {boolean} visible - Requested model visibility.
 * @param {JulianDate} time - Time used to resolve the current billboard property.
 * @returns {boolean} Whether the billboard is currently hidden by the terrain mask.
 */
const shouldPreserveTerrainOcclusion = (entity, visible, time) => Boolean(
    visible
    && !isReplayPOIPresentationActive()
    && entity?.show === true
    && entity.billboard
    && cesiumPropertyValue(entity.billboard.show, time) === false,
)

/**
 * Resolve the active hide-other-journeys policy, including Replay overrides.
 *
 * @returns {{enabled: boolean, currentJourneySlug: string|null}} Active POI visibility filter.
 */
const journeyPOIVisibilityFilter = () => {
    const lgs = globalThis.lgs
    const replay = lgs?.stores?.replay
    const replayActive = isReplayPOIPresentationActive(replay)
    const replaySettings = lgs?.settings?.ui?.replay
    let enabled = lgs?.settings?.journey?.hideOtherJourneys === true

    if (replayActive) {
        if (replaySettings?.userMode === 'basic') {
            enabled = true
        }
        else if (replaySettings?.inheritHideOtherJourneys === false) {
            enabled = replaySettings.hideOtherJourneys === true
        }
        else if (replaySettings?.userMode === 'expert' || replaySettings?.hideOtherJourneys === true) {
            enabled = true
        }
    }

    return {
        enabled,
        currentJourneySlug: (replayActive ? lgs?.stores?.main?.theJourney : null)?.slug ?? lgs?.theJourney?.slug ?? null,
    }
}

/**
 * Resolve the owning journey for a POI, including POIs attached to tracks.
 *
 * @param {object} poi - POI being rendered.
 * @returns {object|null} Owning journey, when available.
 */
const journeyForPOI = poi => globalThis.__?.ui?.poiManager?.getJourneyForPOI?.(poi)
    ?? globalThis.lgs?.getJourneyByTrackSlug?.(poi?.parent)
    ?? globalThis.lgs?.getJourneyBySlug?.(poi?.parent)


export class POIUtils {


    /** Request a map frame after updating a POI entity. */
    static requestRender = () => {
        const scene = globalThis.lgs?.viewer?.scene ?? globalThis.lgs?.scene
        scene?.requestRender?.()
    }

    /** Update only an existing POI entity's geographic position. */
    static updatePosition = poi => {
        if (!poi?.id || !globalThis.lgs?.viewer
            || !Number.isFinite(poi.longitude) || !Number.isFinite(poi.latitude)) {
            return false
        }

        const entity = POIUtils.getEntityContainer(poi)?.getById(poi.id)
        if (!entity) {
            return false
        }

        const position = Cartesian3.fromDegrees(
            poi.longitude,
            poi.latitude,
            poi.simulatedHeight ?? poi.height,
        )
        const currentPosition = cesiumPropertyValue(entity.position, JulianDate.now())
        if (Cartesian3.equals(currentPosition, position)) {
            return true
        }

        entity.position = position
        POIUtils.requestRender()
        return true
    }

    /** Draw a compact-style identity-preserving marker before the rich POI canvas is ready. */
    static drawPlaceholder = async (poi, iconSvg = null) => {
        if (!poi?.id || !Number.isFinite(poi.longitude) || !Number.isFinite(poi.latitude)) {
            return null
        }

        const container = POIUtils.getEntityContainer(poi)
        const existingEntity = container?.getById(poi.id)
        const currentTime = JulianDate.now()
        const existingImage = cesiumPropertyValue(existingEntity?.billboard?.image, currentTime)
        if (existingImage) {
            return existingEntity
        }

        const fill = poi.background === false
            ? 'none'
            : escapeXMLAttribute(poi.bgColor ?? globalThis.lgs?.colors?.poiDefaultBackground ?? '#ffffff')
        const stroke = escapeXMLAttribute(poi.borderColor ?? poi.color ?? globalThis.lgs?.colors?.poiDefault ?? '#000000')
        const iconColor = escapeXMLAttribute(poi.color ?? globalThis.lgs?.colors?.poiDefault ?? '#000000')
        let glyph = `<circle cx="50" cy="50" r="16" fill="${iconColor}"/>`
        if (iconSvg) {
            try {
                const iconDocument = new DOMParser().parseFromString(iconSvg, 'image/svg+xml')
                const iconElement = iconDocument.querySelector('svg')
                const viewBox = iconElement?.getAttribute('viewBox')
                if (iconElement && viewBox) {
                    glyph = `<svg x="27.5" y="27.5" width="45" height="45" viewBox="${escapeXMLAttribute(viewBox)}" preserveAspectRatio="xMidYMid meet">${iconElement.innerHTML}</svg>`
                }
            }
            catch {
                // Keep the compact marker visible if the current Web Awesome icon cannot be serialized.
            }
        }
        const placeholderWidth = 32
        const placeholderHeight = 38.4
        const pinTipOffset = placeholderHeight * (1 - 111 / 120)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${placeholderWidth}" height="${placeholderHeight}" viewBox="0 0 100 120"><path d="M 50 4 A 46 46 0 0 0 29 90.927 L 43 101 Q 50 107 57 101 L 71 90.927 A 46 46 0 0 0 50 4 Z" fill="${fill}" stroke="${stroke}" stroke-width="8" stroke-linejoin="round"/>${glyph}</svg>`
        return POIUtils.draw({
            ...poi,
            image: {
                src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
                width: placeholderWidth,
                height: placeholderHeight,
            },
            pixelOffset: {x: 0, y: pinTipOffset},
        }, true, {
            skipDuplicateCleanup: Boolean(existingEntity),
            verticalOrigin: VerticalOrigin.BOTTOM,
        })
    }


    /**
     * Returns the appropriate entity container based on POI track status.
     *
     * @param poi {MapPOI|object}- Point of Interest object
     *
     * For MapPOI objects attached to a journey, parent contains the track id,
     *          but we need to get the associated DataSource because
     *          a GeoJsonDataSource is not an EntityCollection (bug or feature?)
     * Global POIs use a null parent or the GLOBAL_PARENT sentinel and belong to viewer.entities.
     *
     *  parent is :
     *    - for a POI bound to a track
     *      track#<journey>#<track-slug> with journey = <journey-slug>#<file type>
     *    - for a POI bound to a journey
     *      <journey-slug>#<file type>
     *
     * @returns Entity container (DataSource or EntityCollection)
     */
    static getEntityContainer = (poi) => {
        if (poi.parent && poi.parent !== GLOBAL_PARENT) {
            let file
            switch ((poi.parent.match(/#/g) || []).length) {
                case 1: { // Journey
                    const [name, type] = poi.parent.split('#')
                    file = `${name}#${type}`
                    break
                }
                default: { // Track
                    const [, name, type] = poi.parent.split('#')
                    file = `${name}#${type}`
                }
            }
            const custom = lgs.viewer.dataSources.getByName(file)
            return custom?.[0]?.entities ?? null
        }
        return lgs.viewer.entities
    }

    /**
     * Remove duplicate POI entities from every collection except the target container.
     * @param {object} poi - POI whose duplicate entity instances should be removed.
     * @param {object} targetContainer - Entity collection that should retain the POI.
     * @returns {boolean} Whether any duplicate entity was removed.
     */
    static removeEntityFromOtherContainers = (poi, targetContainer) => {
        if (!poi?.id || !lgs.viewer) {
            return false
        }

        const dataSources = lgs.viewer.dataSources
        const dataSourceCount = Number(dataSources?.length) || 0
        let removed = false
        const removeFrom = entities => {
            if (!entities || entities === targetContainer || !entities.getById(poi.id)) {
                return
            }

            entities.removeById(poi.id)
            removed = true
        }

        removeFrom(lgs.viewer.entities)
        for (let index = 0; index < dataSourceCount; index += 1) {
            removeFrom(dataSources.get(index)?.entities)
        }
        return removed
    }


    /**
     * Sets and returns the appropriate icon based on the provided icon type.
     *
     * @param {string} [icon=''] - The icon type to determine the corresponding FontAwesome icon.
     *                             Defaults to an empty string.
     *
     * @returns {Object} - Returns the appropriate icon.
     */
    static setIcon = (icon = '') => {
        switch (icon) {
            case POI_FLAG_START:
            case POI_FLAG_STOP:
                return faLocationPin
            default:
                return faLocationDot

        }
    }

    /**
     * Update only an existing POI entity's effective visibility.
     * @param {Object} poi - POI model used to resolve Replay and journey filters.
     * @param {boolean} [visibility=poi.visible] - Requested presentation visibility.
     * @returns {boolean} Whether the POI entity exists and was processed.
     */
    static updateVisibility = (poi, visibility = poi?.visible) => {
        if (!poi || !poi.id) {
            console.warn('Cannot update POI visibility: Invalid POI object')
            return false
        }
        if (!globalThis.lgs?.viewer) {
            return false
        }

        const entities = POIUtils.getEntityContainer(poi)
        if (!entities) {
            console.warn(`No entity container found for POI: ${poi.id}`)
            return false
        }

        const entity = entities.getById(poi.id)
        if (!entity) {
            console.warn(`Entity not found for POI: ${poi.id}`)
            return false
        }

        const visible = POIUtils.setPOIVisibility(poi, visibility)
        const currentTime = JulianDate.now()
        const preserveTerrainOcclusion = shouldPreserveTerrainOcclusion(entity, visible, currentTime)
        let changed = false
        if (entity.show !== visible) {
            entity.show = visible
            changed = true
        }
        if (entity.billboard) {
            changed = assignBillboardPropertyIfChanged(
                entity.billboard,
                'show',
                preserveTerrainOcclusion ? false : visible,
                currentTime,
            ) || changed
        }
        if (changed) {
            POIUtils.requestRender()
        }
        return true
    }

    /**
     * Update an existing POI entity to match its model visibility.
     * @param {Object} poi - POI model containing the persisted visibility value.
     * @returns {boolean} Whether the POI entity exists and was processed.
     */
    static toggleVisibility = poi => POIUtils.updateVisibility(poi, poi?.visible)

    /**
     * Checks whether a given entity is within the current visible area of the camera.
     *
     * @param {Entity} entity - The Cesium entity to check.
     * @returns {boolean} - Returns true if the entity is within the camera's visible area, otherwise false.
     */
    isEntityInView = (entity) => {
        // Get the visible rectangle (bounding box) of the camera's current view
        const visibleRectangle = lgs.camera.computeViewRectangle(lgs.scene.globe.ellipsoid)

        if (!visibleRectangle) {
            return false // The camera is not pointing to a visible area
        }

        // Retrieve the current position of the entity
        const position = Property.getValueOrUndefined(entity.position, JulianDate.now())
        if (!position) {
            return false // The entity does not have a valid position
        }

        // Get geographic coordinates (longitude, latitude, height)
        const cartographicPosition = Cartographic.fromCartesian(position)

        // Check if the entity's position is within the visible rectangle of the camera
        return (
            cartographicPosition.longitude >= visibleRectangle.west &&
            cartographicPosition.longitude <= visibleRectangle.east &&
            cartographicPosition.latitude >= visibleRectangle.south &&
            cartographicPosition.latitude <= visibleRectangle.north
        )
    };

    /**
     * An asynchronous function responsible for drawing a Point of Interest (POI) on a map or scene.
     * This function creates and configures a visual representation of a POI,
     * based on input parameters.
     *
     * @param {Object} poi - The Point of Interest object containing necessary data to render.
     * @param {boolean} [parentVisibility=true] - Determines if the POI should be displayed based on its parent
     *     visibility.
     * @param {object} [options={}] - Optional entity drawing behavior.
     * @param {boolean} [options.skipDuplicateCleanup=false] - Skip scanning other entity containers for duplicates.
     * @param {VerticalOrigin} [options.verticalOrigin=VerticalOrigin.CENTER] - Billboard origin used for this draw.
     * @param {boolean} [options.clearImage=false] - Explicitly clear an existing billboard image and reset its geometry.
     *
     * @returns {Promise<Entity|null>} A promise that resolves to the created Cesium Entity, or null if no container is
     *     found.
     */
    static draw = async (poi, parentVisibility = true, {
        skipDuplicateCleanup = false,
        clearImage = false,
        verticalOrigin = VerticalOrigin.CENTER,
    } = {}) => {
        const hasImageUpdate = (poi.image !== undefined && poi.image !== null) || clearImage
        // Default dimensions if poi.image is undefined
        const width = clearImage ? 32 : poi.image?.width ?? 32
        const height = clearImage ? 32 : poi.image?.height ?? 32
        const visible = POIUtils.setPOIVisibility(poi, parentVisibility)
        const heightReference = __.ui.sceneManager.noRelief()
                                   ? HeightReference.NONE
                                   : HeightReference.CLAMP_TO_GROUND
        const scale = finiteNumber(poi.scale) ?? 1
        const scaleByDistance = new NearFarScalar(POI_BILLBOARD_NEAR_DISTANCE, 1.0, POI_BILLBOARD_FAR_DISTANCE, 0)

        // Base entity options
        const options = {
            name:                     poi.name,
            id:                       poi.id,
            position:                 Cartesian3.fromDegrees(poi.longitude, poi.latitude, poi.simulatedHeight ?? poi.height),
            show:                     visible,
        };

        // Billboard configuration
        const billboard = {
            image:           clearImage ? '' : poi.image?.src ?? '',
            width:           width,
            height:          height,
            scale:           scale,
            scaleByDistance: scaleByDistance,
            pixelOffset:     !clearImage && poi.pixelOffset
                ? new Cartesian2(poi.pixelOffset.x * scale, poi.pixelOffset.y * scale)
                : new Cartesian2(0, 0),
            pixelOffsetScaleByDistance: !clearImage && poi.pixelOffset ? scaleByDistance : undefined,
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin:  verticalOrigin,
            heightReference: heightReference,
            disableDepthTestDistance: 0,
            show:            visible,
        };

        // Get entity container
        const container = POIUtils.getEntityContainer(poi)
        if (!container) {
            return null
        }

        const removedFromOtherContainers = skipDuplicateCleanup
            ? false
            : POIUtils.removeEntityFromOtherContainers(poi, container)

        // Check for existing entity
        const entity = container.getById(poi.id)
        if (entity) {
            const currentTime = JulianDate.now()
            const preserveTerrainOcclusion = shouldPreserveTerrainOcclusion(entity, visible, currentTime)
            let changed = removedFromOtherContainers
            if (entity.name !== options.name) {
                entity.name = options.name
                changed = true
            }
            if (entity.show !== options.show) {
                entity.show = options.show
                changed = true
            }
            const currentPosition = cesiumPropertyValue(entity.position, currentTime)
            if (!Cartesian3.equals(currentPosition, options.position)) {
                entity.position = options.position
                changed = true
            }

            if (entity.billboard) {
                if (hasImageUpdate) {
                    changed = assignBillboardPropertyIfChanged(entity.billboard, 'image', billboard.image, currentTime) || changed
                    changed = assignBillboardPropertyIfChanged(entity.billboard, 'width', billboard.width, currentTime) || changed
                    changed = assignBillboardPropertyIfChanged(entity.billboard, 'height', billboard.height, currentTime) || changed
                    changed = assignBillboardPropertyIfChanged(entity.billboard, 'pixelOffset', billboard.pixelOffset, currentTime) || changed
                    changed = assignBillboardPropertyIfChanged(
                        entity.billboard,
                        'pixelOffsetScaleByDistance',
                        billboard.pixelOffsetScaleByDistance,
                        currentTime,
                    ) || changed
                }
                changed = assignBillboardPropertyIfChanged(entity.billboard, 'scale', billboard.scale, currentTime) || changed
                changed = assignBillboardPropertyIfChanged(entity.billboard, 'scaleByDistance', billboard.scaleByDistance, currentTime) || changed
                changed = assignBillboardPropertyIfChanged(entity.billboard, 'horizontalOrigin', billboard.horizontalOrigin, currentTime) || changed
                changed = assignBillboardPropertyIfChanged(entity.billboard, 'verticalOrigin', billboard.verticalOrigin, currentTime) || changed
                changed = assignBillboardPropertyIfChanged(entity.billboard, 'heightReference', billboard.heightReference, currentTime) || changed
                changed = assignBillboardPropertyIfChanged(entity.billboard, 'disableDepthTestDistance', billboard.disableDepthTestDistance, currentTime) || changed
                changed = assignBillboardPropertyIfChanged(
                    entity.billboard,
                    'show',
                    preserveTerrainOcclusion ? false : billboard.show,
                    currentTime,
                ) || changed
            }
            else {
                entity.billboard = new BillboardGraphics(billboard)
                changed = true
            }

            if (changed) {
                POIUtils.requestRender()
            }
        }
        else {
            // Create new entity
            container.add({...options, billboard: new BillboardGraphics(billboard)})
            POIUtils.requestRender()
        }

        return entity || container.getById(poi.id)
    }

    static useOnlyFontAwesome = (poi) => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        const image = POIUtils.renderFontAwesome(poi)
        const ratio = image.height / image.width
        canvas.width = poi.size * (ratio > 1 ? 1 : ratio)
        canvas.height = poi.size * (ratio > 1 ? ratio : 1)
        const v = Canvg.fromString(context, POIUtils.renderFontAwesome(poi).html)
        v.start()
        return canvas
    }

    /**
     * Processes a marker object to generate a customized Font Awesome SVG icon.
     *
     * @function renderFontAwesome
     * @param {Object} marker - The marker object containing icon and style properties.
     * @param {Object} marker.icon - The Font Awesome icon to be used.
     * @param {string} marker.foregroundColor - The color to apply to the icon paths.
     * @param {string} marker.backgroundColor - The background color of the marker.
     *                                          If equal to `lgs.POI_TRANSPARENT_COLOR`, no background is added.
     * @returns {Object} An object representing the processed SVG, including:
     *                   - `src` (string): Data URL encoding of the SVG.
     *                   - `html` (string): The SVG as raw HTML markup.
     *                   - `width` (number): The width of the SVG, derived from the viewBox.
     *                   - `height` (number): The height of the SVG, derived from the viewBox.
     */
    static renderFontAwesome = (marker) => {
        library.add(marker.icon)

        const html = icon(marker.icon).html[0]

        // Get SVG
        const svg = (new DOMParser()).parseFromString(html, 'image/svg+xml').querySelector('svg')
        // add foreground
        svg.querySelector('path').setAttribute('fill', marker.foregroundColor)

        if (marker.backgroundColor !== lgs.POI_TRANSPARENT_COLOR) {
            // add background
            const rectangle = document.createElement('rect')
            rectangle.setAttribute('rx', 10)
            rectangle.setAttribute('ry', 10)
            rectangle.setAttribute('width', '120%')
            rectangle.setAttribute('height', '120%')
            rectangle.setAttribute('fill', marker.backgroundColor)
            svg.insertBefore(rectangle, svg.firstChild)
        }

        return {
            src:   `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`,
            html:  svg.outerHTML,
            width: svg.viewBox.baseVal.width,
            height: svg.viewBox.baseVal.height,
        }
    }

    /**
     * Asynchronously removes the specified point of interest (POI) entity from its containing entity container, if it
     * exists.
     *
     * This function extracts the entity container corresponding to the given POI.
     * It then iterates through the entities in the container to remove the entity that matches the ID of the given
     * POI.
     *
     * @param {Object} poi - The point of interest object to be removed. It must contain an `id` property that uniquely
     *     identifies it.
     * @returns {Promise<void>} A promise that resolves when the removal operation is complete.
     */
    static remove = async (poi) => {
        const container = POIUtils.getEntityContainer(poi)
        if (container) {
            for (const entity of container.values) {
                if (entity.id === poi.id) {
                    container.remove(entity)
                }
            }
        }
    }

    /**
     * Manage POI visibility
     *
     * Whatever its visibility, we hide the POI, but we take into account th visibility status
     * when we show it (ie if it is marked a hidden, we do not show it)
     *
     * @param {POI} poi
     * @param {boolean} visibility
     *
     * @returns {boolean}
     *
     */
    static setPOIVisibility = (poi, visibility, {allowReplayAnimation = false} = {}) => {
        if (poi?.tooClose === true) {
            return false
        }

        const filter = journeyPOIVisibilityFilter()
        const owningJourney = journeyForPOI(poi)
        if (filter.enabled
            && filter.currentJourneySlug
            && owningJourney?.slug
            && owningJourney.slug !== filter.currentJourneySlug) {
            return false
        }

        return Boolean(visibility) && resolveReplayPOIPresentation(poi, {allowReplayAnimation}).visible
    }

    /** Return whether a POI can contribute pixels to the normal map view. */
    static isPOIVisibleOnMap = (poi, visibility = poi?.visible !== false) => {
        if (!poi?.id || !POIUtils.setPOIVisibility(poi, visibility)) {
            return false
        }

        const owningJourney = journeyForPOI(poi)
        if (owningJourney?.visible === false || owningJourney?.POIsVisible === false) {
            return false
        }

        const parentTrack = owningJourney?.tracks?.get?.(poi.parent)
        return parentTrack?.visible !== false
    }

    /**
     * Adjusts the scale of a point in 3D space based on its distance from the camera.
     * The function calculates the scale value such that it decreases with the distance,
     * within defined thresholds. It also provides information about whether a flag
     * should be shown and whether the point is too far from the camera.
     *
     * @param {Object} point - The 3D point for which the scale should be calculated.
     * @param {Object} [scaler] - Configuration object that defines scaling thresholds.
     * @param {number} [scaler.distanceThreshold] - The distance threshold at which scaling adjusts.
     * @param {boolean} [scaler.minScaleFlag] - A flag indicating if the scale is at the minimum flag level.
     * @param {number} [scaler.minScale] - The minimum scale value allowed for the point.
     * @returns {Object} An object containing the following properties:
     *   - {number} scale: The calculated scale for the point based on its distance.
     *   - {boolean} tooFar: Indicates whether the point is beyond the minimum scale threshold.
     *   - {number} cameraDistance: The distance of the point from the camera.
     */
    static adaptScaleToDistance = (point, scaler = {
        distanceThreshold: lgs.settings.ui.poi.distanceThreshold,
        minScaleFlag:      lgs.settings.ui.poi.minScaleFlag,
        minScale:          lgs.settings.ui.poi.minScale,
    }) => {
        const distance = POIUtils.distanceFromCamera(point)
        const scale = Math.max(scaler.minScale, Math.min(1 / (distance / scaler.distanceThreshold), 1))
        const tooFar = scale <= scaler.minScale
        return {
            scale:          scale,
            tooFar:         tooFar,
            cameraDistance: distance,
        }
    }


    /**
     * Calculates the distance from a given geographic point to the camera's current position.
     *
     * This function determines the distance between the provided point (converted into Cartesian
     * coordinates) and the camera's current position in Cartesian space. The point's height is
     * determined using either its simulated height, its actual height, or set to 0 if relief data
     * is not being used.
     *
     * @param {Object} point - The geographic point to measure the distance from the camera.
     *
     * @returns {number} The distance from the point to the camera in meters. If the camera's current
     *                   position is not specified, the function returns 0.
     */
    static distanceFromCamera = point => {
        const cartesian = Cartesian3.fromDegrees(point.longitude, point.latitude,
                                                 __.ui.sceneManager.noRelief() ? 0 : point.simulatedHeight ?? point.height)

        const cameraCoordinates = lgs.stores.main.components.camera.position
        if (Number.isFinite(cameraCoordinates.longitude)
            && Number.isFinite(cameraCoordinates.latitude)
            && Number.isFinite(cameraCoordinates.height)) {
            const cameraPosition = Cartesian3.fromDegrees(
                cameraCoordinates.longitude,
                cameraCoordinates.latitude,
                cameraCoordinates.height,
            )
            return Cartesian3.distance(cartesian, cameraPosition)
        }
        else {
            return 0
        }
    }

    /**
     * Compares two geographical coordinates and determines if they are approximately equal
     * within a specified tolerance level.
     *
     * The function uses Cartographic objects to represent the coordinates and relies on
     * the equalsEpsilon method to perform the comparison with an optional tolerance parameter.
     *
     * @param {Object} start - The starting geographical coordinate containing latitude and longitude.
     * @param {number} start.latitude - The latitude of the starting coordinate.
     * @param {number} start.longitude - The longitude of the starting coordinate.
     * @param {Object} end - The ending geographical coordinate containing latitude and longitude.
     * @param {number} end.latitude - The latitude of the ending coordinate.
     * @param {number} end.longitude - The longitude of the ending coordinate.
     * @param {number} [tolerance=0.5] - The optional tolerance level for comparison. Default is 0.5.
     * @returns {boolean} Returns true if the coordinates are approximately equal within the
     * specified tolerance, otherwise returns false.
     */
    static almostEquals = (start, end, tolerance = 0.5) => {
        return Cartographic.equalsEpsilon(Cartographic.fromDegrees(start.longitude, start.latitude), Cartographic.fromDegrees(end.longitude, end.latitude), tolerance)
    }

    //


}
