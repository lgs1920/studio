/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-04-28
 * Last modified: 2025-04-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { POI_SIZES }     from '@Core/constants'
import { icon, library } from '@fortawesome/fontawesome-svg-core'
import { faLocationDot } from '@fortawesome/pro-regular-svg-icons'
import { faLocationPin } from '@fortawesome/pro-solid-svg-icons'

import { Canvg, Property } from 'canvg'
import {
    Cartesian2, Cartesian3, Cartographic, HeightReference, HorizontalOrigin, JulianDate, NearFarScalar, VerticalOrigin,
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


export class POIUtils {


    /**
     * Returns the appropriate entity container based on POI track status.
     *
     * @param poi {MapPOI|object}- Point of Interest object
     *
     * For MapPOI objects attached to a journey, parent contains the track id,
     *          but we need to get the associated DataSource because
     *          a GeoJsonDataSource is not an EntityCollection (bug or feature?)
     * For globals MapPOI, parent is null, the container is viewer.entities.
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
        if (poi.parent) {
            let file
            switch ((poi.parent.match(/#/g) || []).length) {
                case 1: { // Journey
                    const [name, type] = poi.parent.split('#')
                    file = `${name}#${type}`
                    break
                }
                default: { // Track
                    const [track, name, type, slug] = poi.parent.split('#')
                    file = `${name}#${type}`
                }
            }
            const custom = lgs.viewer.dataSources.getByName(file)
            return custom?.[0].entities ?? null
        }
        return lgs.viewer.entities
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
     * Toggles the visibility of a Point of Interest (POI) entity.
     * Finds the entity in its container and updates its visibility state
     * based on the POI's visible property.
     *
     * @param {Object} poi - The Point of Interest object containing id and visible properties
     * @returns {boolean} - True if visibility was successfully changed, false otherwise
     */
    static toggleVisibility = (poi) => {
        // Check if POI is valid
        if (!poi || !poi.id) {
            console.warn('Cannot toggle visibility: Invalid POI object')
            return false
        }

        // Get the entity container for the POI
        const entities = POIUtils.getEntityContainer(poi)
        if (!entities) {
            console.warn(`No entity container found for POI: ${poi.id}`)
            return false
        }

        // Find and update the entity
        const entity = entities.getById(poi.id)
        if (!entity) {
            console.warn(`Entity not found for POI: ${poi.id}`)
            return false
        }

        // Update visibility state
        entity.show = poi.visible
        lgs.viewer.scene.requestRender()
        return true
    }

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
     *
     * @returns {Promise<void>} Resolves when the POI has been successfully drawn or updated in the scene.
     */
    static draw = async (poi, parentVisibility = true) => {

        const width = poi.expanded ? POI_SIZES.expanded.width : POI_SIZES.reduced.width
        const height = poi.expanded ? POI_SIZES.expanded.height : POI_SIZES.reduced.height
        const arrow = {width: POI_SIZES.arrow.width, height: POI_SIZES.arrow.height, content: ''}

        let options = {
            name:                     poi.name,
            id:                       poi.id,
            position:                 Cartesian3.fromDegrees(poi.longitude, poi.latitude, poi.simulatedHeight ?? poi.height),
            show:                     poi.visible,
            disableDepthTestDistance: __.ui.sceneManager.is2D ? 0 : 1.2742018E7, // Diameter of Earth
        }

        const billboard = {
            heightReference:  __.ui.sceneManager.noRelief() ? HeightReference.NONE : HeightReference.CLAMP_TO_GROUND,
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin:   VerticalOrigin.BOTTOM,
            show:             true,
            image:            poi.image,
            width:            width,
            height:           ((height + arrow.height) / width) * width,
            scale:            1,
            scaleByDistance:  new NearFarScalar(10000.0, 1.0, 20000.0, 0),
            pixelOffset:      new Cartesian2(0, 0), // TODO X offset will change of expanded
        }

        const container = POIUtils.getEntityContainer(poi)
        if (!container) {
            return
        }
        await POIUtils.remove(poi) // TODO replace only image

        await container.add({...options, billboard: billboard})
        lgs.viewer.scene.requestRender()

    }

    static useOnlyFontAwesome = (poi) => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        const image = POIUtils.useFontAwesome(poi)
        const ratio = image.height / image.width
        canvas.width = poi.size * (ratio > 1 ? 1 : ratio)
        canvas.height = poi.size * (ratio > 1 ? ratio : 1)
        const v = Canvg.fromString(context, POIUtils.useFontAwesome(poi).html)
        v.start()
        return canvas
    }

    static useFontAwesome = (marker) => {
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
    static setPOIVisibility = (poi, visibility) => {
        return visibility ? poi?.visible : false
    }

    static adaptScaleToDistance = (point, scaler = {
        distanceThreshold: lgs.settings.ui.poi.distanceThreshold,
        minScaleFlag:      lgs.settings.ui.poi.minScaleFlag,
        minScale:          lgs.settings.ui.poi.minScale,
    }) => {
        const distance = POIUtils.distanceFromCamera(point)
        const scale = Math.max(scaler.minScale, Math.min(1 / (distance / scaler.distanceThreshold), 1))
        const tooFar = scale <= scaler.minScale
        const flagVisible = !tooFar && scale <= scaler.minScaleFlag
        return {
            scale:          scale,
            showFlag:       flagVisible,
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

        if (lgs.mainProxy.components.camera.position.longitude && lgs.mainProxy.components.camera.position.latitude && lgs.mainProxy.components.camera.position.height) {
            const cameraPosition = Cartesian3.fromDegrees(
                lgs.mainProxy.components.camera.position.longitude,
                lgs.mainProxy.components.camera.position.latitude,
                lgs.mainProxy.components.camera.position.height,
            )
            return Cartesian3.distance(cartesian, cameraPosition)
        }
        else {
            return 0
        }
    }

    static almostEquals = (start, end, tolerance = 0.5) => {
        return Cartographic.equalsEpsilon(Cartographic.fromDegrees(start.longitude, start.latitude), Cartographic.fromDegrees(end.longitude, end.latitude), tolerance)
    }

    //


}