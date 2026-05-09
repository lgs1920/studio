/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    ADD_JOURNEY, CURRENT_JOURNEY, CURRENT_POI, CURRENT_STORE, CURRENT_TRACK, DEFAULT_2D_FOCUS_PITCH, DRAWING_FROM_DB,
    DRAWING_FROM_UI, FOCUS_ON_FEATURE, JOURNEY_EDITOR_DRAWER, NO_FOCUS, REFRESH_DRAWING, SCENE_MODE_2D,
}                                                      from '@Core/constants'
import { Journey }                                     from '@Core/Journey'
import {
    faRoute,
}                                                      from '@fortawesome/pro-solid-svg-icons'
import bbox                                            from '@turf/bbox'
import { default as centroid }                         from '@turf/centroid'
import { SceneUtils }                                  from '@Utils/cesium/SceneUtils'
import {
    getTrackRenderContent, trackRenderSmoothingKey,
}                                                      from '@Utils/cesium/trackRenderSmoothing'
import {
    getTrackDashPattern, normalizeTrackRenderStyle, TRACK_RENDER_WIDTH_UNITS,
}                                                      from '@Utils/cesium/trackRenderStyle'
import {
    BoundingSphere, Cartesian2, Cartesian3, Cartographic, Color as CColor, CustomDataSource, GeoJsonDataSource,
    HeightReference, HorizontalOrigin, Math as M, PolylineDashMaterialProperty, PolylineOutlineMaterialProperty,
    Rectangle, sampleTerrainMostDetailed, VerticalOrigin,
}                                                      from 'cesium'
import { UIToast }                                     from '../UIToast.js'
import { POI_FLAG, POI_FLAG_START, POI_STD, POIUtils } from './POIUtils'

export const FEATURE = 'Feature'
export const FEATURE_COLLECTION = 'FeatureCollection'
export const FEATURE_LINE_STRING = 'LineString'
export const FEATURE_MULTILINE_STRING = 'MultiLineString'
export const FEATURE_POINT = 'Point'

export const JOURNEY_KO = 0
export const JOURNEY_OK = 1
export const JOURNEY_EXISTS = 2
export const JOURNEY_WAITING = 3
export const JOURNEY_DENIED = 4

const TRACK_STYLE_ENTITY_MARKER = '#lgs-track-style#'
const TRACK_LOCATOR_MARKER_ENTITY_MARKER = '#lgs-track-locator-marker#'
const TRACK_LOCATOR_MARKER_TOOLTIP_CLASS = 'track-locator-marker-tooltip'
const TRACK_DISPLAY_MODES = Object.freeze({
    LOCATOR_MARKER: 'locator-marker',
    FAR:            'far',
    STYLE:          'style',
})
const TRACK_LOCATOR_MARKER_MIN_CAMERA_DISTANCE_METERS = 60000
const TRACK_FAR_LINE_MIN_CAMERA_DISTANCE_METERS = 25000
const TRACK_LOCATOR_MARKER_SIZE = 36
const TRACK_LOCATOR_MARKER_BORDER_WIDTH = 2
const TRACK_MIN_SCREEN_WIDTH = 1
const TRACK_MAX_SCREEN_WIDTH = 256
const TRACK_WIDTH_CHANGE_EPSILON = 0.25

const isTrackStyleEntity = entity => `${entity?.id ?? ''}`.includes(TRACK_STYLE_ENTITY_MARKER)
const isTrackLocatorMarkerEntity = entity => `${entity?.id ?? ''}`.includes(TRACK_LOCATOR_MARKER_ENTITY_MARKER)
const trackReferencePointCache = new WeakMap()
let trackLocatorMarkerTooltipElement = null
let activeTrackLocatorMarkerTooltipEntityId = null

const finiteColorChannel = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const normalizeColorChannel = value => {
    const channel = finiteColorChannel(value)
    if (channel === null) {
        return null
    }

    return channel > 1 ? Math.min(1, Math.max(0, channel / 255)) : Math.min(1, Math.max(0, channel))
}

const colorFromUnknown = (value, fallback = CColor.WHITE) => {
    const fallbackColor = fallback instanceof CColor ? fallback : CColor.WHITE

    if (value instanceof CColor) {
        return value
    }

    if (typeof value === 'string') {
        const color = value.trim()
        return color ? (CColor.fromCssColorString(color) ?? fallbackColor) : fallbackColor
    }

    if (value && typeof value.toCssColorString === 'function') {
        return colorFromUnknown(value.toCssColorString(), fallbackColor)
    }

    if (value && typeof value === 'object') {
        const red = normalizeColorChannel(value.red ?? value.r)
        const green = normalizeColorChannel(value.green ?? value.g)
        const blue = normalizeColorChannel(value.blue ?? value.b)
        const alpha = normalizeColorChannel(value.alpha ?? value.a ?? 1)

        if (red !== null && green !== null && blue !== null) {
            return new CColor(red, green, blue, alpha ?? 1)
        }
    }

    return fallbackColor
}

export const ALREADY_IMPORTED = {
    /** The file or resource is already present */
    caption: 'Already exists!',
    text:    'has already been imported. Please select another file.',
}

export const IMPORT_SUCCESS = {
    /** Confirmation of successful processing */
    caption: 'Import successful!',
    text:    'has been imported successfully.',
}

export const IMPORT_FAILED = {
    /** General failure notification */
    caption: 'Import failed!',
    text:    'has failed to import. Maybe the format is wrong!',
}
export const IMPORT_NOT_SUPPORTED = {
    /** General failure notification */
    caption: 'Invalid Format!',
    text:    'is not supported.',
}

export const IMPORT_LOADING_ERROR = {
    caption: 'Import failed!',
    text:    'An error occurred while loading',
}

export class TrackUtils {

    static MIMES = {
        gpx: ['application/gpx+xml', 'vnd.gpxsee.map+xml', 'application/octet-stream'],
        geojson: ['application/geo+json', 'application/json'],
        kml: ['vnd.google-earth.kml+xml'],
    }
    /**
     * Check if the current feature contains times and altitudes
     *
     * @return {Object} {hasAltitude: boolean, hasTime: boolean}
     */
    static checkIfDataContainsAltitudeOrTime = (feature => {
        let hasAltitude = true
        for (const coordinate of feature.geometry.coordinates) {
            if (coordinate.length === 2) {
                hasAltitude = false
                break
            }
        }
        return {
            hasAltitude: hasAltitude,
            hasTime:     feature.properties?.coordinateProperties?.times !== undefined,
        }
    })

    /**
     * Filter a list of files to import only new and valid ones.
     * Prevents re-testing already loaded files and handles errors individually.
     * * @param {Array} files List of files to process
     * @returns {Promise<Array>} The list of files that were successfully added
     */
    static bulkLoadJourneys = async (files) => {
        const successfulImports = []

        for (const file of files) {
            // Check existence by slug before processing to avoid overhead
            const slug = Journey.generateSlug(file.name)

            if (lgs.journeys.has(slug)) {
                UIToast.warning({
                                    caption: ALREADY_IMPORTED.caption,
                                    text:    `${file.name} ${ALREADY_IMPORTED.text}`,
                                })
                continue
            }

            const result = await TrackUtils.loadJourneyFromFile(file)
            if (result === JOURNEY_OK) {
                successfulImports.push(file)
            }
        }
        return successfulImports
    }

    /**
     * Process a single journey file
     *
     * @param {Object} journey {name, extension, content}
     * @return {Promise<number>} Result status
     */
    static loadJourneyFromFile = async (journey) => {
        const mainStore = lgs.stores.main
        mainStore.fullSize = false

        try {
            if (!journey) {
                return JOURNEY_KO
            }

            let theJourney = await Journey.create(journey.name, journey.extension, {
                content:     journey.content,
                allowRename: false,
            })

            // Final check on generated instance slug
            if (!lgs.journeys.has(theJourney.slug)) {
                theJourney.globalSettings()
                theJourney.extractMetrics()
                theJourney.addToContext()
                theJourney.addToEditor()

                const theTrack = lgs.theJourney.tracks.entries().next().value?.[1]
                theTrack?.addToContext()
                theTrack?.addToEditor()

                TrackUtils.setProfileVisibility(lgs.theJourney)

                await theJourney.persistToDatabase()
                await theJourney.saveOriginDataToDB()

                mainStore.canViewJourneyData = true
                await theJourney.draw({action: ADD_JOURNEY})

                await __.ui.cameraManager.stopRotate()
                __.ui.profiler.draw()

                return JOURNEY_OK
            }

            return JOURNEY_EXISTS

        }
        catch (error) {
            console.error('Import failed:', error)
            UIToast.error({
                              caption: IMPORT_FAILED.caption,
                              text:    `${journey.name} ${IMPORT_FAILED.text}`,
                          })
            return JOURNEY_KO
        }
    }

    /**
     * Prepare all the Datasources for the tacks and POIs drawings
     *
     * @param {Journey} journey
     * @return {Promise<void>}
     */
    static prepareDrawing = async journey => {
        const dataSources = []

        journey.tracks.forEach(track => {
            dataSources.push(
                lgs.viewer.dataSources.add(new GeoJsonDataSource(track.slug)))
        })

        dataSources.push(
            lgs.viewer.dataSources.add(new CustomDataSource(journey.slug)))

        await Promise.all(dataSources)
    }

    static getTrackRenderStyle = track => normalizeTrackRenderStyle(track?.renderStyle, {
        color:     track?.color,
        thickness: track?.thickness,
    })

    static cssColor = (value, fallback = CColor.WHITE) => colorFromUnknown(value, fallback)

    static createTrackMaterial = (style, color = style.color) => {
        if (style.dash.enabled) {
            return new PolylineDashMaterialProperty({
                                                        color:       TrackUtils.cssColor(style.dash.color ?? color),
                                                        gapColor:    TrackUtils.cssColor(style.dash.gapColor, CColor.TRANSPARENT),
                                                        dashLength:  style.dash.dashLength + style.dash.gapLength,
                                                        dashPattern: getTrackDashPattern(style.dash.dashLength, style.dash.gapLength),
                                                    })
        }

        return new PolylineOutlineMaterialProperty({
                                                       color:        TrackUtils.cssColor(color),
                                                       outlineWidth: 0,
                                                   })
    }

    static getTrackReferencePoint = track => {
        if (!track || typeof track !== 'object') {
            return null
        }

        const cached = trackReferencePointCache.get(track)
        if (cached?.content === track?.content) {
            return cached.referencePoint
        }

        try {
            const center = centroid(track.content)
            const coordinates = center?.geometry?.coordinates
            if (!Array.isArray(coordinates) || coordinates.length < 2) {
                trackReferencePointCache.set(track, {
                    content:        track?.content,
                    referencePoint: null,
                })
                return null
            }

            const referencePoint = {
                longitude: coordinates[0],
                latitude:  coordinates[1],
                height:    coordinates[2] ?? 0,
            }

            trackReferencePointCache.set(track, {
                content: track.content,
                referencePoint,
            })
            return referencePoint
        }
        catch {
            trackReferencePointCache.set(track, {
                content:        track?.content,
                referencePoint: null,
            })
            return null
        }
    }

    static getDrawingBufferSize = () => {
        const scene = lgs?.scene
        const canvas = scene?.canvas ?? lgs?.canvas

        return {
            width:  scene?.context?.drawingBufferWidth
                    ?? scene?.drawingBufferWidth
                    ?? canvas?.width
                    ?? canvas?.clientWidth
                    ?? 0,
            height: scene?.context?.drawingBufferHeight
                    ?? scene?.drawingBufferHeight
                    ?? canvas?.height
                    ?? canvas?.clientHeight
                    ?? 0,
        }
    }

    static getTrackReferenceCartesian = track => {
        const referencePoint = TrackUtils.getTrackReferencePoint(track)
        if (!referencePoint) {
            return null
        }

        return Cartesian3.fromDegrees(
            referencePoint.longitude,
            referencePoint.latitude,
            referencePoint.height ?? 0,
        )
    }

    static getViewerCenterCartesian = () => {
        const viewer = lgs?.viewer
        const scene = viewer?.scene
        const canvas = scene?.canvas
        const camera = viewer?.camera ?? lgs?.camera
        if (!scene || !canvas || !camera) {
            return null
        }

        const center = new Cartesian2(
            Math.round(canvas.clientWidth / 2),
            Math.round(canvas.clientHeight / 2),
        )
        const pickRay = camera.getPickRay?.(center)
        const globe = scene.globe
        let cartesian = pickRay ? globe?.pick?.(pickRay, scene) : null

        if (!cartesian) {
            cartesian = camera.pickEllipsoid?.(center, globe?.ellipsoid)
        }

        return cartesian ?? null
    }

    static meterWidthToPixelScaleAtCartesian = cartesian => {
        try {
            if (!cartesian || !lgs?.camera) {
                return 0
            }

            const {width, height} = TrackUtils.getDrawingBufferSize()
            if (!width || !height || typeof lgs.camera.getPixelSize !== 'function') {
                return 0
            }

            const metersPerPixel = lgs.camera.getPixelSize(
                new BoundingSphere(cartesian, 1),
                width,
                height,
            )
            const pixelPerMeter = Number.isFinite(metersPerPixel) && metersPerPixel > 0
                                  ? 1 / metersPerPixel
                                  : 0

            return pixelPerMeter
        }
        catch {
            return 0
        }
    }

    static getTrackReferencePixelScale = track => TrackUtils.meterWidthToPixelScaleAtCartesian(
        TrackUtils.getTrackReferenceCartesian(track),
    )

    static getViewerCenterPixelScale = () => TrackUtils.meterWidthToPixelScaleAtCartesian(
        TrackUtils.getViewerCenterCartesian(),
    )

    static meterWidthToPixelScale = track => Math.max(
        TrackUtils.getViewerCenterPixelScale(),
        TrackUtils.getTrackReferencePixelScale(track),
    )

    static normalizeTrackScreenWidth = (value, fallback = TRACK_MIN_SCREEN_WIDTH) => {
        const fallbackWidth = Number.isFinite(Number(fallback)) ? Number(fallback) : TRACK_MIN_SCREEN_WIDTH
        const width = Number(value)

        if (!Number.isFinite(width) || width <= 0) {
            return Math.min(TRACK_MAX_SCREEN_WIDTH, Math.max(TRACK_MIN_SCREEN_WIDTH, fallbackWidth))
        }

        return Math.min(TRACK_MAX_SCREEN_WIDTH, Math.max(TRACK_MIN_SCREEN_WIDTH, width))
    }

    static removeTrackWidthUpdater = source => {
        source.__lgsTrackWidthUpdater?.()
        source.__lgsTrackWidthUpdater = null
        source.__lgsTrackWidthState = null
    }

    static setPolylineWidth = (entity, width) => {
        if (!entity?.polyline) {
            return
        }

        if (typeof entity.polyline.width?.setValue === 'function') {
            entity.polyline.width.setValue(width)
            return
        }

        entity.polyline.width = width
    }

    static setPolylineVisibility = (entity, visible) => {
        if (!entity?.polyline) {
            return
        }

        if (typeof entity.polyline.show?.setValue === 'function') {
            entity.polyline.show.setValue(visible)
            return
        }

        entity.polyline.show = visible
    }

    static hasTrackWidthChanged = (previous, next) => previous === undefined
                                                    || Math.abs(previous - next) >= TRACK_WIDTH_CHANGE_EPSILON

    static getTrackLocatorMarkerEntityId = track => `${track?.slug ?? ''}${TRACK_LOCATOR_MARKER_ENTITY_MARKER}`

    static ensureTrackLocatorMarkerTooltipElement = () => {
        if (typeof document === 'undefined' || !document.body) {
            return null
        }

        if (trackLocatorMarkerTooltipElement && document.body.contains(trackLocatorMarkerTooltipElement)) {
            return trackLocatorMarkerTooltipElement
        }

        const element = document.createElement('div')
        element.className = `${TRACK_LOCATOR_MARKER_TOOLTIP_CLASS} lgs-one-line-card wa-theme-lgs1920-on-map small`
        element.hidden = true
        element.setAttribute('role', 'tooltip')
        element.setAttribute('aria-hidden', 'true')
        document.body.appendChild(element)
        trackLocatorMarkerTooltipElement = element
        return element
    }

    static getCanvasEventClientPosition = event => {
        if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
            return {x: event.clientX, y: event.clientY}
        }

        const canvasPosition = event?.endPosition ?? event?.position
        const canvas = lgs.viewer?.scene?.canvas
        if (!canvasPosition || !canvas) {
            return null
        }

        const rect = canvas.getBoundingClientRect()
        return {
            x: rect.left + canvasPosition.x,
            y: rect.top + canvasPosition.y,
        }
    }

    static positionTrackLocatorMarkerTooltip = event => {
        const tooltip = TrackUtils.ensureTrackLocatorMarkerTooltipElement()
        if (!tooltip || tooltip.hidden) {
            return
        }

        const position = TrackUtils.getCanvasEventClientPosition(event)
        if (!position) {
            return
        }

        const rect = tooltip.getBoundingClientRect()
        const offsetX = 12
        const offsetY = 10
        let left = position.x + offsetX
        let top = position.y - rect.height - offsetY

        if (top < 8) {
            top = position.y + offsetY
        }

        left = Math.min(Math.max(8, left), window.innerWidth - rect.width - 8)
        top = Math.min(Math.max(8, top), window.innerHeight - rect.height - 8)

        tooltip.style.left = `${left}px`
        tooltip.style.top = `${top}px`
    }

    static showTrackLocatorMarkerTooltip = (track, event) => {
        const tooltip = TrackUtils.ensureTrackLocatorMarkerTooltipElement()
        const journey = lgs.journeys.get(track.parent) ?? lgs.getJourneyByTrackSlug?.(track.slug)
        const label = journey?.title || track.title || 'Journey'
        if (!tooltip || !label) {
            return
        }

        activeTrackLocatorMarkerTooltipEntityId = TrackUtils.getTrackLocatorMarkerEntityId(track)
        tooltip.textContent = label
        tooltip.hidden = false
        tooltip.setAttribute('aria-hidden', 'false')
        TrackUtils.positionTrackLocatorMarkerTooltip(event)
    }

    static hideTrackLocatorMarkerTooltip = trackOrEntity => {
        const entityId = typeof trackOrEntity === 'string'
                         ? trackOrEntity
                         : TrackUtils.getTrackLocatorMarkerEntityId(trackOrEntity ?? {})

        if (entityId && activeTrackLocatorMarkerTooltipEntityId && entityId !== activeTrackLocatorMarkerTooltipEntityId) {
            return
        }

        activeTrackLocatorMarkerTooltipEntityId = null

        if (!trackLocatorMarkerTooltipElement) {
            return
        }

        trackLocatorMarkerTooltipElement.hidden = true
        trackLocatorMarkerTooltipElement.textContent = ''
        trackLocatorMarkerTooltipElement.setAttribute('aria-hidden', 'true')
    }

    static buildTrackLocatorMarkerImage = (color) => {
        const [iconWidth, iconHeight, , , pathData] = faRoute.icon
        const size = TRACK_LOCATOR_MARKER_SIZE
        const iconSize = size * 0.42
        const scale = Math.min(iconSize / iconWidth, iconSize / iconHeight)
        const x = (size - iconWidth * scale) / 2
        const y = (size - iconHeight * scale) / 2
        const routeColor = TrackUtils.cssColor(color).toCssColorString()
        const routes = (Array.isArray(pathData) ? pathData : [pathData])
                       .filter(Boolean)
                       .map(path => `<path d="${path}" fill="${routeColor}"/>`)
                       .join('')
        const backgroundColor = TrackUtils.cssColor(lgs.colors.poiDefaultBackground).withAlpha(0.6).toCssColorString()
        const borderColor = TrackUtils.cssColor(lgs.colors.poiDefault).toCssColorString()
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.42}" fill="${backgroundColor}" stroke="${borderColor}" stroke-width="${TRACK_LOCATOR_MARKER_BORDER_WIDTH}"/>
                <g transform="translate(${x} ${y}) scale(${scale})">${routes}</g>
            </svg>
        `.trim()

        return {
            src:    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
            width:  size,
            height: size,
        }
    }

    static getTrackDisplayDistanceThresholds = () => {
        return {
            locatorMarkerMinDistance: TRACK_LOCATOR_MARKER_MIN_CAMERA_DISTANCE_METERS,
            farLineMinDistance:       TRACK_FAR_LINE_MIN_CAMERA_DISTANCE_METERS,
        }
    }

    static getTrackDistanceScaleInfo = track => {
        const point = TrackUtils.getTrackReferencePoint(track)
        if (!point) {
            return {
                scale:                   1,
                shouldShowLocatorMarker: false,
                thresholds:              TrackUtils.getTrackDisplayDistanceThresholds(),
            }
        }

        const position = TrackUtils.getTrackReferenceCartesian(track)
        const cameraPosition = lgs.camera?.positionWC ?? lgs.camera?.position
        const distance = position && cameraPosition ? Cartesian3.distance(position, cameraPosition) : 0
        const minScale = lgs.settings.ui.poi.minScale
        const distanceThreshold = lgs.settings.ui.poi.distanceThreshold
        const scale = Math.max(minScale, Math.min(1 / (distance / distanceThreshold), 1))
        const thresholds = TrackUtils.getTrackDisplayDistanceThresholds()

        return {
            scale,
            cameraDistance:          distance,
            shouldShowLocatorMarker: distance >= thresholds.locatorMarkerMinDistance,
            shouldShowFarLine:       distance >= thresholds.farLineMinDistance && distance < thresholds.locatorMarkerMinDistance,
            thresholds,
        }
    }

    static resolveTrackDisplayMode = (track, scaleInfo = TrackUtils.getTrackDistanceScaleInfo(track)) => {
        if (scaleInfo.shouldShowLocatorMarker) {
            return TRACK_DISPLAY_MODES.LOCATOR_MARKER
        }

        if (scaleInfo.shouldShowFarLine) {
            return TRACK_DISPLAY_MODES.FAR
        }

        return TRACK_DISPLAY_MODES.STYLE
    }

    static resolveStyledTrackWidth = (style, metricWidth, fallbackWidth) => {
        const normalizedFallbackWidth = TrackUtils.normalizeTrackScreenWidth(fallbackWidth)

        if (style.widthUnit !== TRACK_RENDER_WIDTH_UNITS.METERS) {
            return normalizedFallbackWidth
        }

        const normalizedMetricWidth = TrackUtils.normalizeTrackScreenWidth(metricWidth, normalizedFallbackWidth)
        return normalizedMetricWidth > style.meterPixelThreshold
               ? normalizedMetricWidth
               : normalizedFallbackWidth
    }

    static removeTrackLocatorMarkerEntity = (source, trackOrSlug) => {
        const trackSlug = typeof trackOrSlug === 'string' ? trackOrSlug : trackOrSlug?.slug
        const entityId = TrackUtils.getTrackLocatorMarkerEntityId({slug: trackSlug})
        const entity = source?.entities?.getById?.(entityId)
        TrackUtils.hideTrackLocatorMarkerTooltip(entityId)

        if (entity) {
            source.entities.remove(entity)
        }

        __.canvasEvents?.removeAllListenersByEntity?.(entityId)
    }

    static setTrackAsCurrent = async (trackSlug, {focus = false, openEditor = false} = {}) => {
        const journey = lgs.getJourneyByTrackSlug(trackSlug)
        if (!journey) {
            return
        }

        const {Utils} = await import('@Editor/Utils')
        await Utils.updateJourneyEditor(journey.slug, {focus: false})

        const selectedTrack = lgs.getTrackBySlug(trackSlug)
        if (selectedTrack) {
            lgs.theJourneyEditorProxy.track = selectedTrack
            selectedTrack.addToContext()
            selectedTrack.addToEditor()
            Utils.renderTracksList()
            Utils.renderTrackSettings()
            await TrackUtils.saveCurrentTrackToDB(selectedTrack.slug)
        }

        if (focus && journey.visible) {
            if (__.ui.cameraManager.isRotating()) {
                await __.ui.cameraManager.stopRotate()
            }

            journey.focus({
                              action:      DRAWING_FROM_UI,
                              rotate:      lgs.settings.ui.camera.start.rotate.journey,
                              resetCamera: true,
                          })
        }

        if (openEditor) {
            __.ui.drawerManager.open(JOURNEY_EDITOR_DRAWER, {
                action:              'edit-current',
                entity:              journey.slug,
                tab:                 'tab-data',
                suppressFocusOnOpen: [journey.slug],
            })
        }
    }

    static registerTrackLocatorMarkerEvents = track => {
        const entityId = TrackUtils.getTrackLocatorMarkerEntityId(track)
        __.canvasEvents?.removeAllListenersByEntity?.(entityId)
        __.canvasEvents?.onMouseEnter?.((event) => {
            TrackUtils.showTrackLocatorMarkerTooltip(track, event)
        }, {
            entity: entityId,
        })
        __.canvasEvents?.onMouseMove?.((event) => {
            TrackUtils.positionTrackLocatorMarkerTooltip(event)
        }, {
            entity: entityId,
        })
        __.canvasEvents?.onMouseLeave?.(() => {
            TrackUtils.hideTrackLocatorMarkerTooltip(track)
        }, {
            entity: entityId,
        })
        __.canvasEvents?.onClick?.(() => {
            TrackUtils.hideTrackLocatorMarkerTooltip(track)
            void TrackUtils.setTrackAsCurrent(track.slug, {focus: true})
        }, {
            entity:               entityId,
            preventLowerPriority: true,
        })
        __.canvasEvents?.onTap?.(() => {
            TrackUtils.hideTrackLocatorMarkerTooltip(track)
            void TrackUtils.setTrackAsCurrent(track.slug, {focus: true})
        }, {
            entity:               entityId,
            preventLowerPriority: true,
        })
        __.canvasEvents?.onDoubleClick?.(() => {
            TrackUtils.hideTrackLocatorMarkerTooltip(track)
            void TrackUtils.setTrackAsCurrent(track.slug, {openEditor: true})
        }, {
            entity:               entityId,
            preventLowerPriority: true,
        })
        __.canvasEvents?.onDoubleTap?.(() => {
            TrackUtils.hideTrackLocatorMarkerTooltip(track)
            void TrackUtils.setTrackAsCurrent(track.slug, {openEditor: true})
        }, {
            entity:               entityId,
            preventLowerPriority: true,
        })
    }

    static ensureTrackLocatorMarkerEntity = (source, track, style) => {
        const entityId = TrackUtils.getTrackLocatorMarkerEntityId(track)
        const position = TrackUtils.getTrackReferenceCartesian(track)
        if (!position) {
            return null
        }

        const image = TrackUtils.buildTrackLocatorMarkerImage(style.color)
        const existing = source.entities.getById(entityId)
        const options = {
            image:                    image.src,
            width:                    image.width,
            height:                   image.height,
            heightReference:          __.ui.sceneManager.noRelief() ? HeightReference.NONE : HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: __.ui.sceneManager.is2D ? 0 : 1.2742018E7,
            horizontalOrigin:         HorizontalOrigin.CENTER,
            verticalOrigin:           VerticalOrigin.CENTER,
        }

        if (existing?.billboard) {
            existing.position = position
            existing.billboard.image = options.image
            existing.billboard.width = options.width
            existing.billboard.height = options.height
            existing.billboard.heightReference = options.heightReference
            existing.billboard.disableDepthTestDistance = options.disableDepthTestDistance
            existing.billboard.horizontalOrigin = options.horizontalOrigin
            existing.billboard.verticalOrigin = options.verticalOrigin
            existing.show = true
        }
        else {
            source.entities.add({
                id:        entityId,
                name:      track.title,
                position,
                show:      true,
                billboard: options,
            })
        }

        TrackUtils.registerTrackLocatorMarkerEvents(track)
        return source.entities.getById(entityId)
    }

    static installTrackWidthUpdater = (source, track, style, entities) => {
        TrackUtils.removeTrackWidthUpdater(source)
        source.__lgsTrackWidthState = {}

        const updateDisplay = (force = false) => {
            const pixelsPerMeter = TrackUtils.meterWidthToPixelScale(track)
            const scaleInfo = TrackUtils.getTrackDistanceScaleInfo(track)
            const mainMetricWidth = pixelsPerMeter * style.meterWidth
            const mainStyledWidth = TrackUtils.resolveStyledTrackWidth(
                style,
                mainMetricWidth,
                style.farPixelWidth,
            )
            const underlayStyledWidth = TrackUtils.resolveStyledTrackWidth(
                style,
                pixelsPerMeter * style.underlay.meterWidth,
                style.underlay.pixelWidth,
            )
            const displayMode = TrackUtils.resolveTrackDisplayMode(track, scaleInfo)
            const state = source.__lgsTrackWidthState ?? {}
            let changed = false

            if (force || state.displayMode !== displayMode) {
                const showStyled = displayMode === TRACK_DISPLAY_MODES.STYLE
                const showFar = displayMode === TRACK_DISPLAY_MODES.FAR
                entities.main.forEach(entity => TrackUtils.setPolylineVisibility(entity, showStyled))
                entities.underlay.forEach(entity => TrackUtils.setPolylineVisibility(entity, showStyled))
                entities.far.forEach(entity => TrackUtils.setPolylineVisibility(entity, showFar))

                if (displayMode === TRACK_DISPLAY_MODES.LOCATOR_MARKER) {
                    TrackUtils.ensureTrackLocatorMarkerEntity(source, track, style)
                }
                else {
                    TrackUtils.removeTrackLocatorMarkerEntity(source, track)
                }

                state.displayMode = displayMode
                changed = true
            }

            if (displayMode === TRACK_DISPLAY_MODES.STYLE) {
                if (force || TrackUtils.hasTrackWidthChanged(state.mainWidth, mainStyledWidth)) {
                    entities.main.forEach(entity => TrackUtils.setPolylineWidth(entity, mainStyledWidth))
                    state.mainWidth = mainStyledWidth
                    changed = true
                }

                if (style.underlay.enabled && (force || TrackUtils.hasTrackWidthChanged(state.underlayWidth, underlayStyledWidth))) {
                    entities.underlay.forEach(entity => TrackUtils.setPolylineWidth(entity, underlayStyledWidth))
                    state.underlayWidth = underlayStyledWidth
                    changed = true
                }
            }
            else if (displayMode === TRACK_DISPLAY_MODES.FAR && (force || TrackUtils.hasTrackWidthChanged(state.farWidth, style.farPixelWidth))) {
                entities.far.forEach(entity => TrackUtils.setPolylineWidth(entity, style.farPixelWidth))
                state.farWidth = style.farPixelWidth
                changed = true
            }

            source.__lgsTrackWidthState = state
            if (changed) {
                lgs.scene.requestRender()
            }
        }

        updateDisplay(true)

        let frameId = null
        const scheduleUpdate = () => {
            if (frameId !== null) {
                return
            }

            frameId = requestAnimationFrame(() => {
                frameId = null
                updateDisplay()
            })
        }
        const removeMoveEndListener = lgs.camera.moveEnd?.addEventListener?.(() => updateDisplay())
        const removeChangedListener = lgs.camera.changed.addEventListener(scheduleUpdate)
        const canvas = lgs.viewer?.scene?.canvas
        const handleWheel = () => scheduleUpdate()
        canvas?.addEventListener?.('wheel', handleWheel, {passive: true})
        source.__lgsTrackWidthUpdater = () => {
            removeMoveEndListener?.()
            removeChangedListener?.()
            canvas?.removeEventListener?.('wheel', handleWheel)
            if (frameId !== null) {
                cancelAnimationFrame(frameId)
                frameId = null
            }
        }
    }

    static removeTrackStyleEntities = source => {
        TrackUtils.removeTrackWidthUpdater(source)
        source.entities.values
              .filter(entity => isTrackStyleEntity(entity) || isTrackLocatorMarkerEntity(entity))
              .forEach(entity => {
                  if (isTrackLocatorMarkerEntity(entity)) {
                      TrackUtils.hideTrackLocatorMarkerTooltip(entity.id)
                      __.canvasEvents?.removeAllListenersByEntity?.(entity.id)
                  }
                  source.entities.remove(entity)
              })
    }

    static applyTrackRenderStyle = (source, track) => {
        const style = TrackUtils.getTrackRenderStyle(track)
        TrackUtils.removeTrackStyleEntities(source)

        const baseEntities = source.entities.values.filter(entity => entity.polyline && !isTrackStyleEntity(entity))
        const mainMaterial = TrackUtils.createTrackMaterial(style)
        const entities = {
            main:     [],
            underlay: [],
            far:      [],
        }
        const farMaterial = TrackUtils.createTrackMaterial({
            ...style,
            dash: {
                ...style.dash,
                enabled: false,
            },
        })

        baseEntities.forEach(entity => {
            const positions = entity.polyline.positions
            TrackUtils.setPolylineVisibility(entity, false)

            if (style.underlay.enabled) {
                entities.underlay.push(
                    source.entities.add({
                                            id:       `${entity.id}${TRACK_STYLE_ENTITY_MARKER}underlay`,
                                            polyline: {
                                                positions,
                                                clampToGround: true,
                                                material:      TrackUtils.createTrackMaterial({
                                                                                                  ...style,
                                                                                                  dash: {
                                                                                                      ...style.dash,
                                                                                                      enabled: false,
                                                                                                  },
                                                                                              },
                                                                                              style.underlay.color),
                                                zIndex:        10,
                                            },
                    }),
                )
            }

            entities.far.push(
                source.entities.add({
                                        id:       `${entity.id}${TRACK_STYLE_ENTITY_MARKER}far`,
                                        polyline: {
                                            positions,
                                            clampToGround: true,
                                            material:      farMaterial,
                                            zIndex:        15,
                                        },
                                    }),
            )

            entities.main.push(
                source.entities.add({
                                        id:       `${entity.id}${TRACK_STYLE_ENTITY_MARKER}main`,
                                        polyline: {
                                            positions,
                                            clampToGround: true,
                                            material:      mainMaterial,
                                            zIndex:        20,
                                        },
                }),
            )
        })

        TrackUtils.installTrackWidthUpdater(source, track, style, entities)
    }

    /**
     * Show the Track on the map
     *
     * @param {Track} track
     * @param {Object} options
     */
    static draw = async (track, {action = DRAWING_FROM_UI, forcedToHide = false}) => {
        const source = lgs.viewer.dataSources.getByName(track.slug)[0]
        if (!source) {
            return
        }

        switch (action) {
            case DRAWING_FROM_DB:
            case ADD_JOURNEY:
            case REFRESH_DRAWING:
            case DRAWING_FROM_UI: {
                const smoothingKey = trackRenderSmoothingKey(track)
                const needsGeometryLoad = [DRAWING_FROM_DB, ADD_JOURNEY].includes(action)
                                          || source.entities.values.length === 0
                                          || source.__lgsRenderSmoothingKey !== smoothingKey
                if (needsGeometryLoad) {
                    await source.load(getTrackRenderContent(track), {
                        clampToGround: true,
                        name:          track.title,
                    })
                    source.__lgsRenderSmoothingKey = smoothingKey
                }
                TrackUtils.applyTrackRenderStyle(source, track)
                break
            }
        }
        source.show = forcedToHide ? false : track.visible
        if (!source.show) {
            TrackUtils.removeTrackWidthUpdater(source)
            TrackUtils.removeTrackLocatorMarkerEntity(source, track)
        }
        lgs.viewer.scene.requestRender()
    }

    /**
     * Focus on a journey or track
     */
    static focus = async ({
                              action = 0,
                              journey = null,
                              track = null,
                              showBbox = false,
                              resetCamera = false,
                          }) => {

        if (track === null) {
            if (journey === null) {
                journey = lgs.theJourney
            }
            track = journey.tracks.values().next().value
        }
        else {
            journey = lgs.journeys.get(track.parent)
        }

        const trackBbox = TrackUtils.extendBbox(bbox(track.content), 0)
        let rectangle = Rectangle.fromDegrees(trackBbox[0], trackBbox[1], trackBbox[2], trackBbox[3])

        if (journey.camera === null || resetCamera) {
            const destination = lgs.camera.getRectangleCameraCoordinates(rectangle)
            const cartographic = Cartographic.fromCartesian(destination)
            const center = centroid(track.content.geometry.coordinates)

            let position
            switch (lgs.settings.scene.mode.value) {
                case SCENE_MODE_2D.value:
                    position = {
                        longitude: center.geometry.coordinates[0],
                        latitude:  center.geometry.coordinates[1],
                    }
                    break
                default:
                    position = {
                        longitude: M.toDegrees(cartographic.longitude),
                        latitude:  M.toDegrees(cartographic.latitude),
                    }
            }
            position.pitch = DEFAULT_2D_FOCUS_PITCH
            position.height = M.toDegrees(cartographic.height)

            __.ui.cameraManager.settings = {
                position: position,
                target: {
                    longitude: center.geometry.coordinates[0],
                    latitude:  center.geometry.coordinates[1],
                    height:    cartographic.height,
                },
            }
            journey.camera = __.ui.cameraManager.settings
        }
        else {
            __.ui.cameraManager.settings = (action === DRAWING_FROM_UI || action === DRAWING_FROM_DB) ? journey.cameraOrigin : journey.camera
        }

        SceneUtils.focusOnJourney(trackBbox)

        if (showBbox) {
            const id = `BBox#${track.slug}`
            if (lgs.viewer.entities.getById(id)) {
                lgs.viewer.entities.removeById(id)
            }
            lgs.viewer.entities.add({
                                        id:        id,
                                        name:      id,
                                        rectangle: {
                                            coordinates: rectangle,
                                            material: CColor.WHITE.withAlpha(0.2),
                                        },
                                    })
        }
    }


    /**
     * Filters an array of objects using custom predicates.
     *
     * from https://gist.github.com/jherax/f11d669ba286f21b7a2dcff69621eb72
     *
     * @param  array {Array}   the array to filter
     * @param  filters {Object}  an object with the filter criteria
     * @return {Array}
     */
    static filterArray = (array, filters) => {
        const filterKeys = Object.keys(filters)
        return array.filter(item => {
            // validates all filter criteria
            return filterKeys.every(key => {
                // ignores non-function predicates
                if (typeof filters[key] !== 'function') {
                    return true
                }
                return filters[key](item[key])
            })
        })
    }

    /**
     * Aggregate Geo Json data for metrics
     */
    static prepareDataForMetrics = async function () {
        const dataExtract = []
        const type = this.content.geometry.type
        if (this.content.type === FEATURE && [FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING].includes(type)) {
            const segments = type === FEATURE_LINE_STRING
                             ? [this.content.geometry.coordinates]
                             : this.content.geometry.coordinates
            segments.forEach(() => {
                const newLine = []
                dataExtract.push(newLine)
            })
        }
        return dataExtract
    }

    /**
     * Get elevation from Cesium Terrain
     */
    static getElevationFromTerrain = async (coordinates) => {
        const positions = []
        let multi = true
        if (!Array.isArray(coordinates)) {
            multi = false
            coordinates = [coordinates]
        }

        coordinates.forEach(point => {
            positions.push(Cartographic.fromDegrees(point.longitude, point.latitude))
        })

        const altitude = []
        const temp = await sampleTerrainMostDetailed(lgs.viewer.terrainProvider, positions)
        temp.forEach(coordinate => {
            altitude.push(coordinate.height)
        })

        return multi ? altitude : altitude[0]
    }

    /**
     * Search datasource by entity id
     */
    static getDataSourceNameByEntityId = (entityId) => {
        for (let i = 0; i < lgs.viewer.dataSources.length; i++) {
            const item = lgs.viewer.dataSources.get(i)
            for (let j = 0; j < item.entities.values.length; j++) {
                const child = item.entities.values[j]
                if (child.id === entityId) {
                    return item
                }
            }
        }
        return undefined
    }

    static getDescription(feature) {
        return feature?.properties?.desc ?? undefined
    }

    /**
     * Initialize state from DB
     */
    static readAllFromDB = async () => {
        const journeys = await Journey.readAllFromDB()

        if (journeys.length === 0) {
            lgs.stores.main.readyForTheShow = true
            lgs.theJourney = null
            lgs.theTrack = null
            lgs.thePOI = null
            return
        }

        journeys.forEach(journey => {
            journey.cameraOrigin = journey.camera
        })

        let currentJourneyName = await lgs.db.lgs1920.get(CURRENT_JOURNEY, CURRENT_STORE)
        const tmp = journeys.filter(value => value.slug === currentJourneyName)
        const currentJourney = (tmp.length > 0) ? tmp[0] : journeys[0]

        if (currentJourney) {
            lgs.theJourney = currentJourney
            lgs.stores.main.readyForTheShow = true
            await TrackUtils.setTheTrack()
        }

        journeys.forEach(journey => {
            lgs.saveJourneyInContext(journey)
        })

        lgs.theJourney.addToContext()
        lgs.theJourney.addToEditor()
        lgs.theTrack?.addToContext()
        lgs.theTrack?.addToEditor()

        TrackUtils.setProfileVisibility(lgs.theJourney)

        for (const journey of journeys) {
            await journey.prepareDrawing()
        }

        const items = []
        lgs.journeys.forEach(journey => {
            items.push(journey.draw({
                                        action: DRAWING_FROM_DB,
                                        mode:   journey.slug === currentJourney.slug ? FOCUS_ON_FEATURE : NO_FOCUS,
                                    }))
        })
        await Promise.all(items)

        __.ui.cameraManager.settings = lgs.theJourney.cameraOrigin
    }

    static setTheTrack = async (fromDB = true) => {
        if (lgs.theJourney.tracks.size === 0) {
            lgs.theTrack = null
            return
        }

        let currentTrack = null
        if (fromDB) {
            currentTrack = await lgs.db.lgs1920.get(CURRENT_TRACK, CURRENT_STORE)
        }

        if (currentTrack && lgs.theJourney.tracks.has(currentTrack)) {
            lgs.theTrack = lgs.theJourney.tracks.get(currentTrack)
        }
        else {
            try {
                lgs.theTrack = lgs.theJourney.tracks.values().next().value ?? null
            }
            catch {
                lgs.theTrack = null
            }
        }
        lgs.theTrack?.addToEditor()
    }

    static getDataSourcesByName(name, strict = false) {
        if (strict) {
            return lgs.viewer.dataSources.getByName(name)
        }

        const dataSources = []
        for (let i = 0; i < lgs.viewer.dataSources.length; i++) {
            const item = lgs.viewer.dataSources.get(i)
            if (item.name.includes(name)) {
                dataSources.push(item)
            }
        }
        return dataSources
    }

    static saveCurrentJourneyToDB = async current => {
        await lgs.db.lgs1920.put(CURRENT_JOURNEY, current.slug, CURRENT_STORE)
    }

    static saveCurrentTrackToDB = async current => {
        await lgs.db.lgs1920.put(CURRENT_TRACK, current, CURRENT_STORE)
    }

    static saveCurrentPOIToDB = async current => {
        await lgs.db.lgs1920.put(CURRENT_POI, current, CURRENT_STORE)
    }

    static updatePOIsVisibility = (journey, visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug, true)[0]?.entities.values.forEach(entity => {
            if (entity.id.startsWith(POI_STD)) {
                entity.show = POIUtils.setPOIVisibility(__.ui.poiManager.get(entity.id), visibility)
            }
        })
    }

    static updateFlagsVisibility = (journey, track, type = 'start', visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug, true)[0]?.entities.values.forEach(entity => {
            const current = TrackUtils.getTrackFromEntityId(journey, entity.id)
            if (entity.id.startsWith(POI_FLAG) && entity.id.endsWith(type) && current?.slug === track.slug) {
                entity.show = POIUtils.setPOIVisibility(
                    track.flags[entity.id.endsWith(POI_FLAG_START) ? 'start' : 'stop'], visibility,
                )
            }
        })
    }

    static updateJourneyVisibility = (journey, visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug).forEach(dataSource => {
            if (dataSource.name === journey.slug) {
                dataSource.show = visibility
            }
            else {
                dataSource.show = visibility ? journey.tracks.get(dataSource.name).visible : false
            }
        })
    }

    static getTrackFromEntityId = (journey, entityId) => {
        for (const track of journey.tracks.values()) {
            if (entityId.includes(track.slug.split('#')[2])) {
                return track
            }
        }
    }

    static updateTrackVisibility = (journey, track, visibility) => {
        TrackUtils.getDataSourcesByName(track.slug).forEach(dataSource => {
            dataSource.show = visibility ? journey.tracks.get(dataSource.name).visible : false
        })
    }

    static setProfileVisibility(journey) {
        lgs.stores.main.canViewProfile =
            lgs.settings.widgets['profile-widget'].configuration.default.show &&
            journey !== undefined &&
            journey !== null &&
            journey.visible &&
            lgs.stores.main.canViewJourneyData &&
            Array.from(journey.tracks.values()).every(track => track.hasAltitude)
    }

    static removeAllTracks = (slug) => {
        const dataSources = TrackUtils.getDataSourcesByName(slug)
        dataSources.forEach(dataSource => {
            lgs.viewer.dataSources.remove(dataSource)
        })
        lgs.viewer.scene.requestRender()
    }
}
