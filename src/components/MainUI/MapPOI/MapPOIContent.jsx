/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-02-16
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                           from '@Components/DataDisplay/NameValueUnit'
import { DateTimeDisplay }                         from '@Components/DateTimeDisplay'
import { stylePOIDuotoneIcon }                     from '@Components/MainUI/MapPOI/duotoneIconUtils'
import {
    calculatePOICanvasCapturePadding, calculatePOIContentPixelOffset, calculatePOIStickEdgeOffset, measurePOICanvasOverflow,
}                                                   from '@Components/MainUI/MapPOI/poiCanvasGeometry'
import {
    clearPOIHoverPreview, completePOIHoverPreviewRender, isPOIHoverPreviewActive,
    isPOIHoverPreviewTransitionActive,
} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'
import {poiCaptureSurfaceStore, usePOICaptureSurface} from '@Components/MainUI/MapPOI/poiCaptureSurfaceStore'
import { ICONS_PATH, WIDGET_SYSTEM_FONT_STACK }     from '@Core/constants'
import { MapPOI }                                  from '@Core/MapPOI'
import { poiPerformance }                           from '@Core/ui/POIPerformance'
import { POIUtils }                                from '@Utils/cesium/POIUtils'
import { poiCanvasImageCache }                      from '@Components/MainUI/MapPOI/poiCanvasImageCache'
import {getPOICanvasRenderPriority} from '@Components/MainUI/MapPOI/poiCanvasRenderPriority'
import {
    normalizePOIDisplaySettings,
    POI_DISPLAY_DEFAULT_FONT_FAMILY,
    POI_DISPLAY_DEFAULT_WIDGET_ROTATION,
    POI_DISPLAY_DEFAULT_STICK_ANGLE,
    POI_DISPLAY_DEFAULT_STICK_HORIZONTAL_POSITION,
    POI_DISPLAY_DEFAULT_STICK_LENGTH,
    POI_DISPLAY_DEFAULT_STICK_POSITION,
    POI_DISPLAY_STICK_ANCHOR_POSITIONS,
    POI_DISPLAY_DEFAULT_STYLE,
    resolvePOIStickAngle,
    shouldDisplayPOIField,
}                                                   from '@Core/POIDisplaySettings'
import {
    normalizeJourneyReplayPOISettings, resolveReplayPOIPresentation,
} from '@Core/ui/replay/JourneyReplayPOISettings'
import {useReplayPOISelector} from '@Components/MainUI/MapPOI/replayPOISelectorStore'
import { ELEVATION_UNITS, UnitUtils }               from '@Utils/UnitUtils'
import { WaIcon, WaTooltip }                       from '@awesome.me/webawesome/dist/react'
import { snapdom }                                 from '@zumer/snapdom'
import classNames                                  from 'classnames'
import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { proxy, useSnapshot }                      from 'valtio'
import { createPOICanvasRenderQueue }              from '@Components/MainUI/MapPOI/poiCanvasRenderQueue'
import './style.css'

const EMPTY_REPLAY_PROXY = proxy({nearbyPois: []})
const queuePOICanvasRender = createPOICanvasRenderQueue(2)
const MAX_POI_CANVAS_SIDE = 4096
const MAX_POI_CANVAS_PIXELS = 8_388_608
const assertPOICanvasDimensions = (element, scale, ratio) => {
    const bounds = element.getBoundingClientRect()
    const width = Math.max(bounds.width, element.scrollWidth, element.offsetWidth)
    const height = Math.max(bounds.height, element.scrollHeight, element.offsetHeight)
    const pixelWidth = Math.ceil(width * scale * ratio)
    const pixelHeight = Math.ceil(height * scale * ratio)

    if (!Number.isFinite(pixelWidth) || !Number.isFinite(pixelHeight)
        || pixelWidth <= 0 || pixelHeight <= 0
        || pixelWidth > MAX_POI_CANVAS_SIDE || pixelHeight > MAX_POI_CANVAS_SIDE
        || pixelWidth * pixelHeight > MAX_POI_CANVAS_PIXELS) {
        throw new RangeError(`POI canvas dimensions exceed the safe limit (${pixelWidth} × ${pixelHeight})`)
    }
}

/**
 * @typedef {Object} MapPOIContentProps
 * @property {string} poi - ID of the POI to display.
 * @property {boolean} [useInMenu=false] - Render the compact menu version.
 * @property {boolean} [domPreview=false] - Render a transient DOM preview without map event handlers.
 * @property {boolean} [collapsedPreview=false] - Render a transient collapsed DOM preview without map event handlers.
 * @property {boolean} [managedCaptureSurface=false] - Let the map capture scheduler mount this POI's DOM surface on demand.
 * @property {object} [style] - Additional styles for the POI content wrapper.
 */

/**
 * Renders the content of a Point of Interest (POI) for the map canvas or UI lists.
 *
 * @param {MapPOIContentProps} props - POI content options.
 * @returns {import('react').ReactNode} The POI content.
 */
export const MapPOIContent = memo(({poi, useInMenu = false, domPreview = false, collapsedPreview = false,
    managedCaptureSurface = false, style}) => {
    poiPerformance.record('react.render')
    const rawTooltipId = useId()
    const tooltipIdPrefix = `map-poi-content-${rawTooltipId.replace(/:/g, '')}`
    const _poiIconWrapper = useRef(null)
    const _poiContent = useRef(null)
    const _poiCanvasCaptureSurface = useRef(null)
    const _poiCanvasCache = useRef(null)
    const _activeCapture = useRef(null)
    const _appearanceRevision = useRef(0)
    const _lastScheduledVisualSignature = useRef(null)
    const _renderRequestId = useRef(0)
    const _previousExpanded = useRef(null)
    const _iconLoadRenderTimer = useRef(null)

    const $pois = lgs.stores.main.components.pois
    const $point = $pois.list.get(poi) ?? EMPTY_REPLAY_PROXY
    const point = useSnapshot($point)
    const replay = useSnapshot(lgs.stores?.replay ?? EMPTY_REPLAY_PROXY)
    const isEmbedded = useInMenu || domPreview || collapsedPreview
    const captureSurfaceGranted = usePOICaptureSurface(managedCaptureSurface ? poi : null)
    const captureSurfaceActive = !managedCaptureSurface || isEmbedded || captureSurfaceGranted
    const isExpanded = !useInMenu && !collapsedPreview && (domPreview || point?.expanded === true)
    const pointId = point?.id
    const pointParent = point?.parent
    const pointType = point?.type
    const pointLongitude = point?.longitude
    const pointLatitude = point?.latitude
    const pointLocation = point?.location
    const pointCountryCode = point?.countryCode
    const replayNearbyPOI = useReplayPOISelector('nearby', pointId)
    const replayAnimatedPOI = useReplayPOISelector('animated', pointId)
    const unitSystem = useSnapshot(lgs.settings.unitSystem)
    const coordinateSystem = useSnapshot(lgs.settings.coordinateSystem)
    const presentation = resolveReplayPOIPresentation(point, {replay, animatedPOI: replayAnimatedPOI})
    const replayActive = presentation.active
    // Read optional settings directly so Valtio subscribes when a field is first added.
    const selectedStyle = point?.display?.style
    const selectedStickHorizontalPosition = point?.display?.stickHorizontalPosition
    const displaySettings = normalizePOIDisplaySettings(point?.display)
    const configuredStickAngle = displaySettings.stickAngle ?? POI_DISPLAY_DEFAULT_STICK_ANGLE
    const widgetRotation = displaySettings.widgetRotation ?? POI_DISPLAY_DEFAULT_WIDGET_ROTATION
    const stickPosition = displaySettings.stickPosition ?? POI_DISPLAY_DEFAULT_STICK_POSITION
    const horizontalStick = stickPosition === 'left' || stickPosition === 'right'
    const selectedAnchorPosition = Number(selectedStickHorizontalPosition)
    const stickHorizontalPosition = POI_DISPLAY_STICK_ANCHOR_POSITIONS.includes(selectedAnchorPosition)
        ? selectedAnchorPosition
        : displaySettings.stickHorizontalPosition ?? POI_DISPLAY_DEFAULT_STICK_HORIZONTAL_POSITION
    const poiStyle = selectedStyle ?? displaySettings.style ?? POI_DISPLAY_DEFAULT_STYLE
    const leaderAngle = resolvePOIStickAngle(configuredStickAngle, pointId)
    const leaderLength = displaySettings.stickLength ?? POI_DISPLAY_DEFAULT_STICK_LENGTH
    const leaderAngleRadians = leaderAngle * Math.PI / 180
    const leaderOffsetX = horizontalStick
        ? Math.cos(leaderAngleRadians) * leaderLength
        : (stickPosition === 'above' ? 1 : -1) * Math.sin(leaderAngleRadians) * leaderLength
    const leaderOffsetY = horizontalStick
        ? Math.sin(leaderAngleRadians) * leaderLength
        : Math.cos(leaderAngleRadians) * leaderLength
    const leaderCaptureBleed = horizontalStick ? Math.abs(leaderOffsetY) : Math.abs(leaderOffsetX)

    useEffect(() => {
        if (!captureSurfaceActive) {
            return undefined
        }
        return poiPerformance.mountContent()
    }, [captureSurfaceActive])

    const fontFamily = displaySettings.fontFamily ?? POI_DISPLAY_DEFAULT_FONT_FAMILY
    const replaySettings = normalizeJourneyReplayPOISettings(point?.replay)
    const replayMasked = !presentation.visible
    const replayAnimationActive = presentation.animationActive
    const iconVisible = isEmbedded ? point?.visible : presentation.visible
    const hiddenBecauseTooClose = point?.tooClose === true
    const hideJourneyReplayField = key => replayActive && replayNearbyPOI && replaySettings.hiddenFields[key] === true
    const displayCategory = shouldDisplayPOIField('category', displaySettings, replayActive)
        && !hideJourneyReplayField('category')
    const displayTitleCategoryIcon = shouldDisplayPOIField('titleCategoryIcon', displaySettings, replayActive)
        && !hideJourneyReplayField('category')
    const displayLocation = shouldDisplayPOIField('location', displaySettings, replayActive)
        && !hideJourneyReplayField('location')
    const displayAltitude = shouldDisplayPOIField('altitude', displaySettings, replayActive)
        && !hideJourneyReplayField('altitude')
    const displayTitleAltitude = shouldDisplayPOIField('titleAltitude', displaySettings, replayActive)
        && !hideJourneyReplayField('altitude')
    const displayCoordinates = shouldDisplayPOIField('coordinates', displaySettings, replayActive)
        && !hideJourneyReplayField('coordinates')
    const displayDateTime = shouldDisplayPOIField('dateTime', displaySettings, replayActive)
    const displayAltitudeValue = point?.height > 0 && point.height !== point.simulatedHeight && displayAltitude
    const explicitTitleAltitude = Number(point?.height)
    const simulatedTitleAltitude = Number(point?.simulatedHeight)
    const titleAltitude = Number.isFinite(explicitTitleAltitude) && explicitTitleAltitude > 0
        ? explicitTitleAltitude
        : simulatedTitleAltitude
    const displayTitleAltitudeValue = Number.isFinite(titleAltitude) && titleAltitude > 0 && displayTitleAltitude
    const displayHeightContent = displayAltitudeValue || displayTitleAltitudeValue
    const formattedTitleAltitude = displayTitleAltitudeValue
        ? UnitUtils.formatMetric(titleAltitude, {units: ELEVATION_UNITS, format: '%d'}).full
        : ''
    const displayDateTimeValue = Boolean(point?.time && displayDateTime)
    const displayCoordinateDetails = displayAltitudeValue || displayCoordinates || displayDateTimeValue
    const hasVisibleDetailsBelowTitle = Boolean(
        (pointLocation && displayLocation)
        || (point?.category && displayCategory)
        || displayCoordinateDetails,
    )
    const isTitleOnly = !hasVisibleDetailsBelowTitle

    const iconName = point?.categoryIcon(point?.category)
    const isSvgIcon = iconName?.endsWith('.svg')

    const cardExpanded = point?.expanded === true
    const poiVisualSignature = JSON.stringify([
        pointType,
        cardExpanded,
        cardExpanded ? point?.title : null,
        cardExpanded && displayCategory ? point?.category : null,
        ICONS_PATH,
        iconName,
        isSvgIcon,
        iconVisible,
        point?.visible,
        point?.color ?? lgs.colors.poiDefault,
        point?.bgColor ?? lgs.colors.poiDefaultBackground,
        point?.background,
        cardExpanded ? poiStyle : null,
        [fontFamily, displaySettings.fontSize, displaySettings.bold, displaySettings.italic, widgetRotation],
        cardExpanded ? displaySettings : null,
        cardExpanded && pointLocation && displayLocation ? pointLocation : null,
        cardExpanded && displayAltitudeValue ? point?.height : null,
        cardExpanded && displayTitleAltitudeValue ? titleAltitude : null,
        cardExpanded && displayCoordinates ? [pointLatitude, pointLongitude] : null,
        cardExpanded && displayDateTimeValue ? [point?.time, point?.timeZone, pointLongitude, pointLatitude] : null,
        cardExpanded ? [displayCategory, displayTitleCategoryIcon, displayLocation, displayAltitude,
            displayTitleAltitude, displayCoordinates, displayDateTime, isTitleOnly] : null,
        cardExpanded ? [replayActive, replayAnimationActive, replaySettings.visible, replaySettings.hiddenFields] : null,
        cardExpanded ? unitSystem : null,
        cardExpanded ? coordinateSystem : null,
        lgs.colors.poiDefault,
        lgs.colors.poiDefaultBackground,
        globalThis.document?.documentElement?.className,
        globalThis.document?.body?.className,
        globalThis.document?.documentElement?.getAttribute('data-season-theme'),
        globalThis.document?.body?.getAttribute('data-on-map-theme'),
        style,
        cardExpanded ? [leaderAngle, leaderLength, leaderCaptureBleed] : null,
    ])

    useEffect(() => {
        if (isEmbedded || !pointId || !__.ui.poiManager?.ensurePOILocation) {
            return
        }

        void __.ui.poiManager.ensurePOILocation(pointId)
    }, [
                  isEmbedded,
                  pointId,
                  pointParent,
                  pointType,
                  pointLongitude,
                  pointLatitude,
                  pointLocation,
                  pointCountryCode,
              ])

    /** Synchronizes DOM content to map canvas */
    const renderToCanvas = useCallback((options = {}) => {
        const element = _poiCanvasCaptureSurface.current
        const card = _poiContent.current
        const captureSurface = _poiCanvasCaptureSurface.current
        const canCapture = !isEmbedded && !replayMasked && !hiddenBecauseTooClose && Boolean(pointId)
        if (!canCapture) {
            queuePOICanvasRender.cancel(_poiContent)
            if (managedCaptureSurface) {
                poiCaptureSurfaceStore.cancel(pointId)
            }
            if (_activeCapture.current?.requestId === _renderRequestId.current) {
                poiPerformance.record('capture.invalidated')
                poiPerformance.record('capture.invalidated.suppressed')
            }
            _renderRequestId.current++
            _activeCapture.current = null
            poiPerformance.record('capture.request.suppressed')
            return
        }
        const captureInputSignature = JSON.stringify([
            poiVisualSignature,
            globalThis.devicePixelRatio ?? 1,
            globalThis.document?.fonts?.status,
            _appearanceRevision.current,
        ])
        if (managedCaptureSurface && !isEmbedded && (!element || !card || !captureSurfaceActive)) {
            if (_lastScheduledVisualSignature.current !== captureInputSignature) {
                _lastScheduledVisualSignature.current = captureInputSignature
                poiCaptureSurfaceStore.request(pointId, {
                    priority: options?.priority === true,
                    allowOverflow: options?.priority === true,
                    getPriority: () => getPOICanvasRenderPriority(pointId),
                })
            }
            return
        }
        _lastScheduledVisualSignature.current = captureInputSignature

        const layoutSignature = [
            card?.offsetWidth,
            card?.offsetHeight,
            card?.scrollWidth,
            card?.scrollHeight,
            captureSurface?.scrollWidth,
            captureSurface?.scrollHeight,
            globalThis.devicePixelRatio ?? 1,
            globalThis.document?.fonts?.status,
        ]
        const visualSignature = `${JSON.stringify([poiVisualSignature, layoutSignature])}:${_appearanceRevision.current}`
        const reason = options?.reason ?? 'visual-state-effect'
        poiPerformance.record('capture.request')
        poiPerformance.record(`capture.request.${reason}`)
        if (_activeCapture.current?.signature === visualSignature
            && _activeCapture.current.requestId === _renderRequestId.current) {
            poiPerformance.record('capture.deduplicated')
            return
        }
        if (_activeCapture.current?.requestId === _renderRequestId.current) {
            poiPerformance.record('capture.invalidated')
            poiPerformance.record(`capture.invalidated.${reason}`)
        }

        // Invalidate pending captures even when this update masks the POI.
        const renderRequestId = ++_renderRequestId.current
        _activeCapture.current = {signature: visualSignature, requestId: renderRequestId}
        const expanded = point?.expanded === true
        let discardRecorded = false
        const isCaptureCurrent = () => {
            const currentPoint = $pois.list.get(pointId)
            const currentPresentation = resolveReplayPOIPresentation(currentPoint)
            return renderRequestId === _renderRequestId.current && Boolean(currentPoint)
                && (currentPoint.expanded === true) === expanded && currentPresentation.visible
                && currentPresentation.active === replayActive
                && currentPresentation.animationActive === replayAnimationActive
                && (!isPOIHoverPreviewActive(pointId) || isPOIHoverPreviewTransitionActive(pointId))
        }
        const isCurrentRender = phase => {
            const current = isCaptureCurrent()
            if (!current && !discardRecorded) {
                discardRecorded = true
                poiPerformance.record('capture.discarded')
                poiPerformance.record(`capture.discarded.${phase}`)
            }
            return current
        }

        const localCanvas = !managedCaptureSurface && _poiCanvasCache.current?.signature === visualSignature
            && _poiCanvasCache.current.surface === element && _poiCanvasCache.current.card === card
            ? _poiCanvasCache.current
            : null
        const cachedCanvas = element && card
            ? localCanvas ?? poiCanvasImageCache.get(visualSignature)
            : null
        if (cachedCanvas) {
            if (!isCurrentRender('immediate-cache-hit')) {
                _activeCapture.current = null
                if (managedCaptureSurface) {
                    poiCaptureSurfaceStore.release(pointId)
                }
                return
            }
            if (queuePOICanvasRender.cancel(_poiContent)) {
                poiPerformance.record('capture.queueCancelledByCache')
            }
            if (!managedCaptureSurface) {
                _poiCanvasCache.current = {
                    ...cachedCanvas,
                    signature: visualSignature,
                    surface: element,
                    card,
                }
            }
            poiPerformance.record('capture.queueBypassedForCache')
            void Promise.resolve()
                .then(async () => {
                    if (!isCurrentRender('before-cache-draw')) {
                        return
                    }
                    const currentPoint = $pois.list.get(pointId)
                    const mapPOI = new MapPOI(currentPoint)
                    mapPOI.image = {
                        src: cachedCanvas.canvas,
                        width: cachedCanvas.width,
                        height: cachedCanvas.height,
                    }
                    mapPOI.pixelOffset = cachedCanvas.pixelOffset
                    await mapPOI.utils.draw(mapPOI)
                    poiPerformance.record(localCanvas ? 'capture.cacheHit' : 'capture.sharedCacheHit')
                })
                .catch(error => console.error(`Error reusing POI ${pointId} canvas:`, error))
                .finally(() => {
                    if (isCaptureCurrent()) {
                        completePOIHoverPreviewRender(pointId)
                    }
                    if (_activeCapture.current?.requestId === renderRequestId) {
                        _activeCapture.current = null
                        if (managedCaptureSurface) {
                            poiCaptureSurfaceStore.release(pointId)
                        }
                    }
                })
            return
        }

        if (managedCaptureSurface && !replayActive) {
            const currentPoint = $pois.list.get(pointId)
            if (currentPoint) {
                void POIUtils.drawPlaceholder(currentPoint)
            }
        }

        const queuedAt = poiPerformance.start('capture.queueWait')
        const priorityCapture = options?.priority === true
        queuePOICanvasRender(_poiContent, async () => {
            poiPerformance.end('capture.queueWait', queuedAt)
            poiPerformance.record('capture.started')
            if (!isCurrentRender('before-snapdom')) {
                return
            }

            const scale = 2
            // SnapDOM's default DPR multiplies scale; cap output at 2 px/CSS px on every display.
            const ratio = 1
            const element = _poiCanvasCaptureSurface.current
            const card = _poiContent.current
            if (!element || !card) {
                completePOIHoverPreviewRender(pointId)
                return
            }

            const cachedCanvas = _poiCanvasCache.current
            const localCanvas = !managedCaptureSurface && cachedCanvas?.signature === visualSignature
                && cachedCanvas.surface === element && cachedCanvas.card === card
                ? cachedCanvas
                : null
            const sharedCanvas = localCanvas ?? poiCanvasImageCache.get(visualSignature)
            if (sharedCanvas) {
                const currentPoint = $pois.list.get(pointId)
                if (!currentPoint || !isCurrentRender('cache-hit')) {
                    return
                }
                if (!managedCaptureSurface) {
                    _poiCanvasCache.current = {
                        ...sharedCanvas,
                        signature: visualSignature,
                        surface: element,
                        card,
                    }
                }
                const sharedCacheState = poiCanvasImageCache.snapshot()
                poiPerformance.record('capture.sharedCacheEntries', sharedCacheState.entryCount)
                poiPerformance.record('capture.sharedCacheBytes', sharedCacheState.retainedBytes)
                try {
                    const mapPOI = new MapPOI(currentPoint)
                    mapPOI.image = {
                        src: sharedCanvas.canvas,
                        width: sharedCanvas.width,
                        height: sharedCanvas.height,
                    }
                    mapPOI.pixelOffset = sharedCanvas.pixelOffset
                    await mapPOI.utils.draw(mapPOI)
                    poiPerformance.record(localCanvas ? 'capture.cacheHit' : 'capture.sharedCacheHit')
                }
                catch (error) {
                    console.error(`Error reusing POI ${pointId} canvas:`, error)
                }
                completePOIHoverPreviewRender(pointId)
                return
            }
            poiPerformance.record('capture.cacheMiss')
            poiPerformance.record('capture.sharedCacheMiss')

            const originalDisplay = element.style.display
            const originalWidth = element.style.width
            const originalBoxSizing = element.style.boxSizing
            const originalPadding = element.style.padding
            let canvas
            let pixelOffset
            try {
                for (const icon of element.querySelectorAll('wa-icon')) {
                    await stylePOIDuotoneIcon(icon)
                }
                if (!isCurrentRender('after-icon-styling')) {
                    return
                }

                // Measure the layout SnapDOM will capture, including transformed descendants.
                element.style.display = 'block'
                element.style.width = 'max-content'
                element.style.boxSizing = 'content-box'
                element.style.padding = '0px'
                const cardStyle = window.getComputedStyle(card)
                const borderWidth = Number.parseFloat(cardStyle.getPropertyValue('--poi-border-width'))
                const openFrameLineWidth = Number.parseFloat(
                    cardStyle.getPropertyValue('--poi-open-frame-line-width'),
                )
                const slantedContentHeight = card.classList.contains('poi-card--style-slanted-banner')
                    ? card.querySelector('.poi-card-inner')?.getBoundingClientRect().height ?? 0
                    : 0
                const transformedCardBounds = card.getBoundingClientRect()
                const rotationBleed = Math.max(
                    0,
                    (transformedCardBounds.width - card.offsetWidth) / 2,
                    (transformedCardBounds.height - card.offsetHeight) / 2,
                )
                const leaderEndpointBleed = Number.isFinite(borderWidth)
                    ? Math.max(0, borderWidth * 1.5)
                    : 4.5
                const capturePadding = expanded ? calculatePOICanvasCapturePadding({
                    borderWidth: Number.isFinite(borderWidth) ? borderWidth : 3,
                    openFrameLineWidth: Number.isFinite(openFrameLineWidth) ? openFrameLineWidth : 0,
                    slantedContentHeight,
                    leaderBleed: leaderCaptureBleed,
                    rotationBleed,
                    leaderEndpointBleed,
                }) + measurePOICanvasOverflow(element) : 0

                // Expand only the rasterization root so SnapDOM includes transformed and external strokes.
                element.style.padding = `${capturePadding}px`
                assertPOICanvasDimensions(element, scale, ratio)
                const sharedCapture = await poiCanvasImageCache.getOrCreate(visualSignature, async () => {
                    const snapStartedAt = poiPerformance.start('capture.snapdom')
                    const snap = await snapdom(element, {scale, dpr: ratio, outerShadows: 'subtree'})
                    poiPerformance.end('capture.snapdom', snapStartedAt)
                    if (!isCurrentRender('after-snapdom')) {
                        return null
                    }
                    const canvasStartedAt = poiPerformance.start('capture.toCanvas')
                    const renderedCanvas = await snap.toCanvas()
                    poiPerformance.end('capture.toCanvas', canvasStartedAt)
                    poiPerformance.record('capture.canvasPixels', renderedCanvas.width * renderedCanvas.height)
                    poiPerformance.record('capture.canvasBytesEstimate', renderedCanvas.width * renderedCanvas.height * 4)
                    if (!isCurrentRender('after-to-canvas')) {
                        return null
                    }

                    const width = renderedCanvas.width / scale / ratio
                    const height = renderedCanvas.height / scale / ratio
                    return {
                        canvas: renderedCanvas,
                        width,
                        height,
                        pixelOffset: calculatePOIContentPixelOffset(element, width, height, snap.meta),
                    }
                })
                if (!sharedCapture.entry || !isCurrentRender('after-shared-capture')
                    || _poiCanvasCaptureSurface.current !== element || _poiContent.current !== card) {
                    return
                }
                canvas = sharedCapture.entry.canvas
                pixelOffset = sharedCapture.entry.pixelOffset
                if (sharedCapture.source === 'inflight') {
                    poiPerformance.record('capture.sharedInflightHit')
                }
            }
            catch (error) {
                console.error(`Error rendering POI ${pointId} to canvas:`, error)
                completePOIHoverPreviewRender(pointId)
                return
            }
            finally {
                element.style.display = originalDisplay
                element.style.width = originalWidth
                element.style.boxSizing = originalBoxSizing
                element.style.padding = originalPadding
            }

            const currentPoint = $pois.list.get(pointId)
            if (!canvas || !isCurrentRender('before-commit') || _poiCanvasCaptureSurface.current !== element
                || _poiContent.current !== card) {
                return
            }

            try {
                const mapPOI = new MapPOI(currentPoint)
                const cachedCanvas = poiCanvasImageCache.get(visualSignature)
                if (!cachedCanvas) {
                    poiPerformance.record('capture.sharedCacheRejected')
                }
                const width = cachedCanvas?.width ?? canvas.width / scale / ratio
                const height = cachedCanvas?.height ?? canvas.height / scale / ratio
                const sharedCanvas = cachedCanvas ?? {canvas, width, height, pixelOffset}
                const sharedCacheState = poiCanvasImageCache.snapshot()
                poiPerformance.record('capture.sharedCacheEntries', sharedCacheState.entryCount)
                poiPerformance.record('capture.sharedCacheBytes', sharedCacheState.retainedBytes)
                if (!managedCaptureSurface) {
                    _poiCanvasCache.current = {
                        signature: visualSignature,
                        surface: element,
                        card,
                        ...sharedCanvas,
                    }
                }
                mapPOI.image = {
                    // Cesium accepts canvases directly; a data URL needlessly copies the pixel buffer.
                    src:    canvas,
                    width,
                    height,
                }
                mapPOI.pixelOffset = pixelOffset
                await mapPOI.utils.draw(mapPOI)
                poiPerformance.record('capture.committed')
            }
            catch (error) {
                console.error(`Error rendering POI ${pointId} to canvas:`, error)
            }
            completePOIHoverPreviewRender(pointId)
        }, {
            priority: priorityCapture,
            allowOverflow: priorityCapture,
            getPriority: managedCaptureSurface ? () => getPOICanvasRenderPriority(pointId) : null,
            onSettled: () => {
                if (_activeCapture.current?.requestId === renderRequestId) {
                    _activeCapture.current = null
                    if (managedCaptureSurface) {
                        poiCaptureSurfaceStore.release(pointId)
                    }
                }
            },
            onSuperseded: () => {
                poiPerformance.record('capture.queueSuperseded')
                poiPerformance.record(`capture.queueSuperseded.${reason}`)
            },
            onCancelled: () => {
                poiPerformance.record('capture.queueCancelled')
            },
        })
    }, [captureSurfaceActive, isEmbedded, managedCaptureSurface, point?.expanded, replayActive, replayAnimationActive, replayMasked,
        hiddenBecauseTooClose, pointId, $pois.list, leaderCaptureBleed, poiVisualSignature])

    useEffect(() => {
        if (isEmbedded || !pointId) {
            return
        }

        const currentPoint = $pois.list.get(pointId)
        if (currentPoint) {
            POIUtils.updatePosition(currentPoint)
        }
    }, [isEmbedded, pointId, pointParent, pointLongitude, pointLatitude, point?.height, point?.simulatedHeight, $pois.list])

    const handlePOIIconLoad = useCallback((event) => {
        stylePOIDuotoneIcon(event?.target)
            .catch(error => console.error('Error styling POI icon:', error))
            .finally(() => {
                if (_iconLoadRenderTimer.current) {
                    clearTimeout(_iconLoadRenderTimer.current)
                }
                _iconLoadRenderTimer.current = setTimeout(() => {
                    _iconLoadRenderTimer.current = null
                    _appearanceRevision.current += 1
                    _poiCanvasCache.current = null
                    poiPerformance.record('capture.cacheInvalidated.iconLoad')
                    renderToCanvas({reason: 'icon-load'})
                }, 32)
            })
    }, [renderToCanvas])

    useEffect(() => () => {
        if (_iconLoadRenderTimer.current) {
            clearTimeout(_iconLoadRenderTimer.current)
        }
        queuePOICanvasRender.cancel(_poiContent)
        _poiCanvasCache.current = null
        _activeCapture.current = null
        if (managedCaptureSurface) {
            poiCaptureSurfaceStore.cancel(poi)
        }
    }, [managedCaptureSurface, poi])

    useLayoutEffect(() => {
        /** Align the stick endpoint with rounded or skewed visible POI outlines. */
        const updatePOIStickEdgeOffset = () => {
            const wrapper = _poiIconWrapper.current
            const card = _poiContent.current?.querySelector('.poi-card-inner')
            if (!wrapper || !card) {
                return false
            }

            const cardStyle = window.getComputedStyle(card)
            const edgeOffset = isExpanded && horizontalStick
                ? calculatePOIStickEdgeOffset({
                    style: poiStyle,
                    side: stickPosition,
                    width: card.offsetWidth,
                    height: card.offsetHeight,
                    position: stickHorizontalPosition,
                    borderRadius: Number.parseFloat(cardStyle.borderTopLeftRadius),
                })
                : 0
            const nextValue = `${edgeOffset}px`
            if (wrapper.style.getPropertyValue('--poi-expanded-leader-edge-offset') === nextValue) {
                return false
            }

            wrapper.style.setProperty('--poi-expanded-leader-edge-offset', nextValue)
            return true
        }

        updatePOIStickEdgeOffset()
        const card = _poiContent.current?.querySelector('.poi-card-inner')
        if (!card || typeof ResizeObserver === 'undefined') {
            return undefined
        }

        const previousCardSize = {width: card.offsetWidth, height: card.offsetHeight}
        const observer = new ResizeObserver(() => {
            poiPerformance.record('capture.resizeObserverCallbacks')
            const width = card.offsetWidth
            const height = card.offsetHeight
            const cardSizeChanged = width !== previousCardSize.width || height !== previousCardSize.height
            previousCardSize.width = width
            previousCardSize.height = height
            const edgeOffsetChanged = updatePOIStickEdgeOffset()
            if (cardSizeChanged) {
                poiPerformance.record('capture.resizeObserverSizeChanges')
            }
            if (edgeOffsetChanged) {
                poiPerformance.record('capture.resizeObserverEdgeOffsetChanges')
            }
            if ((cardSizeChanged || edgeOffsetChanged) && !isEmbedded) {
                _appearanceRevision.current += 1
                _poiCanvasCache.current = null
                poiPerformance.record('capture.cacheInvalidated.resize')
                renderToCanvas({reason: 'resize'})
            }
        })
        observer.observe(card)
        return () => observer.disconnect()
    }, [horizontalStick, isEmbedded, isExpanded, poiStyle, renderToCanvas, stickHorizontalPosition, stickPosition])

    useEffect(() => {
        if (isEmbedded || !pointId || (!replayMasked && !hiddenBecauseTooClose)) {
            return
        }

        const currentPoint = $pois.list.get(pointId)
        if (!currentPoint?.id) {
            return
        }

        const mapPOI = new MapPOI({
            ...currentPoint,
            visible: false,
        })
        void mapPOI.utils.draw(mapPOI)
    }, [isEmbedded, pointId, replayMasked, hiddenBecauseTooClose, $pois.list])

    useEffect(() => {
        if (isEmbedded || !pointId) {
            return
        }

        const expanded = point?.expanded === true
        const priority = _previousExpanded.current !== null && _previousExpanded.current !== expanded
        const reason = priority ? 'expanded-state' : 'visual-state-effect'
        _previousExpanded.current = expanded
        renderToCanvas({priority, reason})

        return () => {
            _renderRequestId.current++
        }
    }, [
                  isEmbedded,
                  pointId,
                  point?.title,
                  point?.category,
                  point?.expanded,
                  point?.color,
                  point?.bgColor,
                  point?.background,
                  point?.display?.style,
                  displayHeightContent ? point?.height : null,
                  displayHeightContent ? point?.simulatedHeight : null,
                  point?.location,
                  point?.time,
                  point?.timeZone,
                  iconName,
                  isSvgIcon,
                  point?.display?.category,
                  point?.display?.titleCategoryIcon,
                  point?.display?.titleAltitude,
                  point?.display?.maxWidth,
                  point?.display?.widgetRotation,
                  point?.display?.fontFamily,
                  point?.display?.fontSize,
                  point?.display?.bold,
                  point?.display?.italic,
                  point?.display?.stickAngle,
                  point?.display?.stickPosition,
                  point?.display?.stickHorizontalPosition,
                  point?.display?.stickLength,
                  point?.display?.location,
                  point?.display?.altitude,
                  point?.display?.coordinates,
                  point?.display?.dateTime,
                  displayCoordinates ? pointLongitude : null,
                  displayCoordinates ? pointLatitude : null,
                  point?.type,
                  point?.visible,
                  point?.tooClose,
                  replayActive,
                  replayNearbyPOI,
                  replaySettings.visible,
                  replaySettings.animated,
                  replaySettings.hiddenFields.location,
                  replaySettings.hiddenFields.category,
                  replaySettings.hiddenFields.altitude,
                  replaySettings.hiddenFields.coordinates,
                  displayCoordinates,
                  displayHeightContent,
                  captureSurfaceActive,
                  unitSystem,
                  coordinateSystem,
                  renderToCanvas,
                  poi,
              ])

    useEffect(() => () => clearPOIHoverPreview(pointId), [pointId])

    useEffect(() => {
        if (replayMasked || hiddenBecauseTooClose) {
            clearPOIHoverPreview(pointId)
        }
    }, [hiddenBecauseTooClose, pointId, replayMasked])

    if (!captureSurfaceActive) {
        return null
    }

    return (
        <div
            ref={_poiIconWrapper}
            className={classNames(
                'poi-icon-wrapper',
                (!isExpanded || useInMenu) && 'poi-shrinked',
                !isExpanded && 'lgs--location-pin',
                useInMenu && 'used-in-menu',
            )}
            data-poi-canvas-source={!isEmbedded ? pointId : undefined}
            style={{
                // Inline tokens apply saved POI typography, rotation, and connector geometry to the preview and map card.
                '--lgs-poi-background-color': point?.background === false
                    ? 'transparent'
                    : point?.bgColor ?? lgs.colors.poiDefaultBackground,
                '--lgs-poi-border-color':     point?.color ?? lgs.colors.poiDefault,
                '--lgs-poi-color':            point?.color ?? lgs.colors.poiDefault,
                '--poi-font-family':          fontFamily === 'System' ? WIDGET_SYSTEM_FONT_STACK : fontFamily,
                '--poi-font-size':            displaySettings.fontSize === undefined
                    ? 'var(--lgs-font-size)'
                    : `${displaySettings.fontSize}px`,
                '--poi-font-style': displaySettings.italic ? 'italic' : 'normal',
                '--poi-widget-rotation': `${widgetRotation}deg`,
                '--poi-expanded-leader-angle': `${leaderAngle}deg`,
                '--poi-expanded-leader-length': `${leaderLength}px`,
                '--poi-expanded-leader-x': `${leaderOffsetX}px`,
                '--poi-expanded-leader-y': `${leaderOffsetY}px`,
                // This offset moves side sticks from the card's layout edge onto its visible outline.
                '--poi-expanded-leader-edge-offset': '0px',
                // Keep the stick endpoint aligned to the selected point on the card edge.
                '--poi-expanded-leader-position': `${stickHorizontalPosition}%`,
                ...(typeof displaySettings.bold === 'boolean'
                    ? {'--poi-font-weight': displaySettings.bold ? 'bold' : 'normal'}
                    : {}),
                ...(isExpanded && !isEmbedded
                    ? {'--poi-expanded-dimension': `${displaySettings.maxWidth}px`}
                    : {}),
                ...style,
            }}
        >
            <div className="poi-canvas-capture-surface" ref={_poiCanvasCaptureSurface}>
                <div
                    className={classNames(
                        'poi-card',
                        isExpanded && !useInMenu && 'poi-card--expanded',
                        isExpanded && stickPosition === 'above' && 'poi-card--stick-above',
                        isExpanded && stickPosition === 'left' && 'poi-card--stick-left',
                        isExpanded && stickPosition === 'right' && 'poi-card--stick-right',
                        isExpanded && !useInMenu && `poi-card--style-${poiStyle}`,
                        isExpanded && !useInMenu && !horizontalStick && `poi-card--stick-horizontal-position-${stickHorizontalPosition}`,
                    )}
                    ref={_poiContent}
                >
                    {!isExpanded && !useInMenu && (
                        <svg className="poi-reduced-pin-shape" viewBox="0 0 100 112"
                             preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
                            <path
                                d="M 50 4 A 46 46 0 0 0 29 90.927 L 43 105 Q 50 111 57 105 L 71 90.927 A 46 46 0 0 0 50 4 Z"
                                fill="var(--lgs-poi-background-color)"
                                stroke="var(--lgs-poi-border-color)"
                                strokeWidth="8"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                    <div className={classNames(
                        'poi-card-inner',
                        isExpanded && !useInMenu && isTitleOnly && 'poi-card-inner--title-only',
                        isExpanded && !useInMenu && `poi-card-inner--style-${poiStyle}`,
                        point?.background === false && 'poi-card-inner--background-hidden',
                    )}>
                        <div className="poi-card-inner-background"/>

                        {isExpanded && !useInMenu ? (
                            <div className={classNames(
                                'poi-card-content',
                                isTitleOnly && 'poi-card-content--title-only',
                            )}>
                                <div className="poi-title">
                                    {displayTitleCategoryIcon && (
                                        <WaIcon
                                            name={isSvgIcon ? '' : iconName}
                                            src={isSvgIcon ? `${ICONS_PATH}/${iconName}` : ''}
                                            className="poi-category-title-icon"
                                            variant="regular"
                                            onWaLoad={handlePOIIconLoad}
                                        />
                                    )}
                                    <h3>
                                        {point.title ?? 'Point Of Interest'}
                                        {formattedTitleAltitude && ` (${formattedTitleAltitude})`}
                                    </h3>
                                </div>
                                {point.location && displayLocation && (
                                    <>
                                        <div className="poi-location" id={`${tooltipIdPrefix}-location`}>
                                            <WaIcon name="location-dot"
                                                    variant="regular"
                                                    onWaLoad={handlePOIIconLoad}
                                            />
                                            <span>{point.location}</span>
                                        </div>
                                        <WaTooltip for={`${tooltipIdPrefix}-location`}>{point.location}</WaTooltip>
                                    </>
                                )}

                                {point.category && displayCategory && (
                                    <>
                                        <div className="poi-location" id={`${tooltipIdPrefix}-category`}>
                                            <WaIcon
                                                name={isSvgIcon ? '' : iconName}
                                                src={isSvgIcon ? `${ICONS_PATH}/${iconName}` : ''}
                                                variant="regular"
                                                onWaLoad={handlePOIIconLoad}
                                            />
                                            <span>{point.category}</span>
                                        </div>
                                        <WaTooltip for={`${tooltipIdPrefix}-category`}>{point.location}</WaTooltip>
                                    </>
                                )}


                                {displayCoordinateDetails && (
                                    <div className="poi-full-coordinates">
                                    {displayAltitudeValue && (
                                        <NameValueUnit
                                            className="poi-elevation"
                                            text={'Altitude:'}
                                            value={point.height.toFixed()}
                                            format="%d"
                                            units={ELEVATION_UNITS}
                                        />
                                    )}
                                    {displayCoordinates && (
                                        <div className="poi-coordinates">
                                            <span>
                                                {__.convert(point.latitude).to(coordinateSystem.current)},{' '}
                                                {__.convert(point.longitude).to(coordinateSystem.current)}
                                            </span>
                                        </div>
                                    )}
                                    {displayDateTimeValue && (
                                        <div className="poi-time">
                                            <DateTimeDisplay
                                                value={point.time}
                                                timeZone={point.timeZone}
                                                longitude={point.longitude}
                                                latitude={point.latitude}
                                            />
                                        </div>
                                    )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <WaIcon
                                 key={point?.category}
                                name={iconVisible ? (!isSvgIcon ? iconName : '') : 'mask'}
                                src={iconVisible && isSvgIcon ? `${ICONS_PATH}/${iconName}` : ''}
                                className="poi-as-flag poi-duotone-icon"
                                variant="regular"
                                family="duotone"
                                onWaLoad={handlePOIIconLoad}
                            />
                         )}
                    </div>
                    {isExpanded && (!isEmbedded || domPreview) && (
                        <div
                            className="poi-expanded-leader-space"
                            aria-hidden="true"
                        >
                            <span className="poi-expanded-leader"/>
                            <span className="poi-geographic-anchor"/>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
})
