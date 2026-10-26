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
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                           from '@Components/DataDisplay/NameValueUnit'
import { DateTimeDisplay }                         from '@Components/DateTimeDisplay'
import { stylePOIDuotoneIcon }                     from '@Components/MainUI/MapPOI/duotoneIconUtils'
import { openPOIEditor }                           from '@Components/MainUI/MapPOI/openPOIEditor'
import { calculatePOIContentPixelOffset }          from '@Components/MainUI/MapPOI/poiCanvasGeometry'
import { ICONS_PATH }                              from '@Core/constants'
import { MapPOI }                                  from '@Core/MapPOI'
import {
    normalizePOIDisplaySettings, shouldDisplayPOIField,
}                                                   from '@Core/POIDisplaySettings'
import { normalizeJourneyReplayPOISettings }          from '@Core/ui/replay/JourneyReplayPOISettings'
import { ELEVATION_UNITS, UnitUtils }               from '@Utils/UnitUtils'
import { WaIcon }                                  from '@awesome.me/webawesome/dist/react'
import { snapdom }                                 from '@zumer/snapdom'
import classNames                                  from 'classnames'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { proxy, useSnapshot }                      from 'valtio'
import { createPOICanvasRenderQueue }              from '@Components/MainUI/MapPOI/poiCanvasRenderQueue'
import './style.css'

const EMPTY_REPLAY_PROXY = proxy({nearbyPois: []})
const queuePOICanvasRender = createPOICanvasRenderQueue(2)
const MAX_POI_CANVAS_SIDE = 4096
const MAX_POI_CANVAS_PIXELS = 8_388_608
const POI_EXPANDED_LEADER_ANGLES = [-45, 0, 45]

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
 * Renders the content of a Point of Interest (POI) for the map canvas or UI lists.
 */
export const MapPOIContent = ({poi, useInMenu = false, style}) => {
    const _poiContent = useRef(null)
    const _icon = useRef(null)
    const _leaderSpace = useRef(null)
    const _renderRequestId = useRef(0)

    const unitSystem = useSnapshot(lgs.settings.unitSystem)
    const coordinateSystem = useSnapshot(lgs.settings.coordinateSystem)

    const $pois = lgs.stores.main.components.pois
    const poisSnap = useSnapshot($pois)
    const replay = useSnapshot(lgs.stores?.replay ?? EMPTY_REPLAY_PROXY)


    /** * Direct reactive access to the point from the snapshot.
     */
    const point = useMemo(() => poisSnap.list.get(poi), [poisSnap.list, poi])
    const pointId = point?.id
    const pointParent = point?.parent
    const pointType = point?.type
    const pointLongitude = point?.longitude
    const pointLatitude = point?.latitude
    const pointLocation = point?.location
    const pointCountryCode = point?.countryCode
    const replayEntry = Array.isArray(replay.nearbyPois)
        ? replay.nearbyPois.find(entry => entry?.poi?.id === point?.id)
        : null
    const replayActive = Boolean(replay.active || replay.playing || replay.paused)
    const displaySettings = normalizePOIDisplaySettings(point?.display)
    const replaySettings = normalizeJourneyReplayPOISettings(point?.replay)
    const replayMasked = replayActive && replaySettings.visible === false
    const hiddenBecauseTooClose = point?.tooClose === true
    const hideJourneyReplayField = key => replayActive && replayEntry && replaySettings.hiddenFields[key] === true
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
    const formattedTitleAltitude = displayTitleAltitudeValue
        ? UnitUtils.formatMetric(titleAltitude, {units: ELEVATION_UNITS, format: '%d'}).full
        : ''
    const displayDateTimeValue = Boolean(point?.time && displayDateTime)
    const displayCoordinateDetails = displayAltitudeValue || displayCoordinates || displayDateTimeValue

    const iconName = point?.categoryIcon(point?.category)
    const isSvgIcon = iconName?.endsWith('.svg')

    /** Handles drawer opening for editing */
    const handleEditor = useCallback(async (event, entity) => {
        if (useInMenu || !point) {
            return
        }
        __.ui.contextMenu.hide()
        await openPOIEditor(entity)
    }, [useInMenu, point])

    /** Global POI menu trigger */
    const openContextMenu = useCallback((event) => {
        if (useInMenu || !pointId) {
            return
        }

        const position = event.position ?? event.endPosition
        if (!position) {
            return
        }

        const contextMenu = lgs.stores.ui.contextMenu
        contextMenu.type = 'poi'
        contextMenu.visible = true
        contextMenu.position = {x: position.x, y: position.y}
        contextMenu.targetId = point
    }, [useInMenu, point, pointId])

    const handlePOIClick = useCallback(() => {
        if (useInMenu || !point?.id) {
            return
        }

        void __.ui.poiManager.updatePOI(point.id, {expanded: !point.expanded})
    }, [useInMenu, point])

    const addEventListeners = useCallback((poiId) => {
        __.canvasEvents.onClick(handlePOIClick, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onTap(handlePOIClick, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onDoubleClick(handleEditor, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onDoubleTap(handleEditor, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onRightClick(openContextMenu, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onLongTap(openContextMenu, {entity: poiId, preventLowerPriority: true})
    }, [handleEditor, handlePOIClick, openContextMenu])

    const removeEventListeners = useCallback((poiId) => {
        __.canvasEvents.removeAllListenersByEntity(poiId)
    }, [])

    useEffect(() => {
        if (useInMenu || !pointId || !__.ui.poiManager?.ensurePOILocation) {
            return
        }

        void __.ui.poiManager.ensurePOILocation(pointId)
    }, [
                  useInMenu,
                  pointId,
                  pointParent,
                  pointType,
                  pointLongitude,
                  pointLatitude,
                  pointLocation,
                  pointCountryCode,
              ])

    /** Synchronizes DOM content to map canvas */
    const renderToCanvas = useCallback(() => {
        if (useInMenu || !point?.visible || replayMasked || hiddenBecauseTooClose || !pointId) {
            return
        }

        const renderRequestId = ++_renderRequestId.current
        __.requestAnimationFrame(() => {
            queuePOICanvasRender(_poiContent, async () => {
                const isCurrentRender = () => renderRequestId === _renderRequestId.current
                    && Boolean($pois.list.get(pointId))

                if (!isCurrentRender()) {
                    return
                }

                const scale = 2
                const ratio = window.devicePixelRatio || 1
                const element = _poiContent.current
                if (!element) {
                    return
                }

                try {
                    assertPOICanvasDimensions(element, scale, ratio)
                    const snap = await snapdom(element, {scale})
                    const canvas = await snap.toCanvas()
                    const currentPoint = $pois.list.get(pointId)
                    if (!isCurrentRender()
                        || !currentPoint?.visible
                        || currentPoint.tooClose === true) {
                        return
                    }

                    const mapPOI = new MapPOI(currentPoint)
                    const width = canvas.width / scale / ratio
                    const height = canvas.height / scale / ratio
                    mapPOI.image = {
                        // Cesium accepts canvases directly; a data URL needlessly copies the pixel buffer.
                        src:    canvas,
                        width,
                        height,
                    }
                    mapPOI.pixelOffset = calculatePOIContentPixelOffset(element, width, height)
                    await mapPOI.utils.draw(mapPOI)
                }
                catch (error) {
                    console.error(`Error rendering POI ${pointId} to canvas:`, error)
                }
            })
        })
    }, [useInMenu, point?.visible, replayMasked, hiddenBecauseTooClose, pointId, $pois.list])

    useEffect(() => {
        if (useInMenu || !pointId || (point?.visible !== false && !replayMasked && !hiddenBecauseTooClose)) {
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
    }, [useInMenu, pointId, point?.visible, replayMasked, hiddenBecauseTooClose, $pois.list])

    const renderToCanvasAfterIconLoad = useCallback((event = null) => {
        const icon = event?.target ?? _icon.current

        stylePOIDuotoneIcon(icon)
            .catch(error => console.error('Error styling POI icon:', error))
            .finally(renderToCanvas)
    }, [renderToCanvas])

    useEffect(() => {
        if (useInMenu || !pointId) {
            return
        }

        const renderRequestRef = _renderRequestId
        const observer = new MutationObserver(renderToCanvas)
        if (_poiContent.current) {
            observer.observe(_poiContent.current, {
                childList: true,
                attributes: true,
                characterData: true,
                subtree:   true,
            })
        }

        addEventListeners(poi)
        renderToCanvas()

        return () => {
            renderRequestRef.current++
            observer.disconnect()
            removeEventListeners(poi)
        }
    }, [
                  useInMenu,
                  pointId,
                  point?.title,
                  point?.category,
                  point?.expanded,
                  point?.color,
                  point?.bgColor,
                  point?.pill,
                  point?.noBackground,
                  point?.height,
                  point?.simulatedHeight,
                  point?.location,
                  point?.display?.category,
                  point?.display?.titleCategoryIcon,
                  point?.display?.titleAltitude,
                  point?.display?.maxWidth,
                  point?.display?.location,
                  point?.display?.altitude,
                  point?.display?.coordinates,
                  point?.display?.dateTime,
                  point?.longitude,
                  point?.latitude,
                  point?.type,
                  point?.visible,
                  point?.tooClose,
                  replayActive,
                  replayEntry?.poi?.id,
                  replaySettings.visible,
                  replaySettings.animated,
                  replaySettings.hiddenFields.location,
                  replaySettings.hiddenFields.category,
                  replaySettings.hiddenFields.altitude,
                  replaySettings.hiddenFields.coordinates,
                  unitSystem,
                  coordinateSystem,
                  renderToCanvas,
                  addEventListeners,
                  removeEventListeners,
                  poi,
              ])

    useEffect(() => {
        if (useInMenu || point?.expanded || !_icon.current) {
            return
        }

        let cancelled = false
        stylePOIDuotoneIcon(_icon.current)
            .catch(error => console.error('Error styling POI icon:', error))
            .finally(() => {
                if (!cancelled) {
                    renderToCanvas()
                }
            })

        return () => {
            cancelled = true
        }
    }, [useInMenu, point?.expanded, iconName, isSvgIcon, point?.visible, renderToCanvas])

    useEffect(() => {
        const leaderSpace = _leaderSpace.current
        if (!pointId || !point?.expanded || useInMenu || !leaderSpace) {
            return
        }

        const angleIndex = Math.floor(Math.random() * POI_EXPANDED_LEADER_ANGLES.length)
        const angle = POI_EXPANDED_LEADER_ANGLES[angleIndex]
        const radians = angle * Math.PI / 180

        leaderSpace.style.setProperty('--poi-expanded-leader-angle', `${angle}deg`)
        // CSS positive rotation leans left in screen coordinates, so its lower endpoint uses -sin(angle).
        leaderSpace.style.setProperty('--poi-expanded-leader-x', `${-Math.sin(radians)}rem`)
        leaderSpace.style.setProperty('--poi-expanded-leader-y', `${Math.cos(radians)}rem`)
        // Capture only after the random anchor geometry is set so canvas and billboard offsets agree.
        renderToCanvas()
    }, [pointId, point?.expanded, useInMenu, renderToCanvas])

    return (
        <div
            className={classNames(
                'poi-icon-wrapper',
                (!point?.expanded || useInMenu) && 'poi-shrinked',
                !point?.expanded && 'lgs--location-pin',
                useInMenu && 'used-in-menu',
            )}
            style={{
                '--lgs-poi-background-color': point?.noBackground ? 'transparent' : point?.bgColor ?? lgs.colors.poiDefaultBackground,
                '--lgs-poi-border-color':     point?.color ?? lgs.colors.poiDefault,
                '--lgs-poi-color':            point?.color ?? lgs.colors.poiDefault,
                ...(point?.expanded && !useInMenu
                    ? {'--poi-expanded-dimension': `${displaySettings.maxWidth}px`}
                    : {}),
                ...style,
            }}
        >
            <div
                className={classNames('poi-card', point?.expanded && !useInMenu && 'poi-card--expanded')}
                ref={_poiContent}
            >
                <div className={classNames(
                    'poi-card-inner',
                    point?.expanded && !useInMenu && point?.pill !== false && 'poi-card-inner--pill',
                    point?.noBackground && 'poi-card-inner--no-background',
                )}>
                    <div className="poi-card-inner-background"/>

                    {point?.expanded && !useInMenu ? (
                        <div className={classNames(
            data-poi-canvas-source={!useInMenu ? pointId : undefined}
                            'poi-card-content',
                            !(point.location && displayLocation) && !displayCategory && !displayCoordinateDetails
                            && 'poi-card-content--title-only',
                        )}>
                            <div className="poi-title">
                                {displayTitleCategoryIcon && (
                                    <WaIcon
                                        name={isSvgIcon ? '' : iconName}
                                        src={isSvgIcon ? `${ICONS_PATH}/${iconName}` : ''}
                                        className="poi-category-title-icon"
                                        variant="regular"
                                        onWaLoad={renderToCanvasAfterIconLoad}
                                    />
                                )}
                                <h3>
                                    {point.title ?? 'Point Of Interest'}
                                    {formattedTitleAltitude && ` (${formattedTitleAltitude})`}
                                </h3>
                            </div>
                            {point.location && displayLocation && (
                                <div className="poi-location" title={point.location}>
                                    <WaIcon name="location-dot"
                                            variant="regular"
                                            onWaLoad={renderToCanvasAfterIconLoad}
                                    />
                                    <span>{point.location}</span>
                                </div>
                            )}

                            {point.category && displayCategory && (
                                <div className="poi-location" title={point.location}>
                                    <WaIcon
                                        name={isSvgIcon ? '' : iconName}
                                        src={isSvgIcon ? `${ICONS_PATH}/${iconName}` : ''}
                                        variant="regular"
                                        onWaLoad={renderToCanvasAfterIconLoad}
                                    />
                                    <span>{point.category}</span>
                                </div>
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
                            ref={_icon}
                             key={point?.category}
                            name={point?.visible ? (!isSvgIcon ? iconName : '') : 'mask'}
                            src={point?.visible && isSvgIcon ? `${ICONS_PATH}/${iconName}` : ''}
                            className="poi-as-flag poi-duotone-icon"
                            variant="regular"
                            family="duotone"
                            onWaLoad={renderToCanvasAfterIconLoad}
                        />
                     )}
                </div>
                {point?.expanded && !useInMenu && (
                    <div
                        className="poi-expanded-leader-space"
                        aria-hidden="true"
                        ref={_leaderSpace}
                    >
                        <span className="poi-expanded-leader"/>
                        <span className="poi-geographic-anchor"/>
                    </div>
                )}
            </div>
        </div>
    )
}
