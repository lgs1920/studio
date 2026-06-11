/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
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

import { NameValueUnit }                           from '@Components/DataDisplay/NameValueUnit'
import { DateTimeDisplay }                         from '@Components/DateTimeDisplay'
import { stylePOIDuotoneIcon }                     from '@Components/MainUI/MapPOI/duotoneIconUtils'
import { openPOIEditor }                           from '@Components/MainUI/MapPOI/openPOIEditor'
import { ICONS_PATH }                              from '@Core/constants'
import { MapPOI }                                  from '@Core/MapPOI'
import { normalizeFlythroughPOISettings }          from '@Core/ui/flythrough/FlythroughPOISettings'
import { ELEVATION_UNITS }                         from '@Utils/UnitUtils'
import { WaIcon }                                  from '@web.awesome.me/webawesome-pro/dist/react'
import { snapdom }                                 from '@zumer/snapdom'
import classNames                                  from 'classnames'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { proxy, useSnapshot }                      from 'valtio'
import './style.css'

const EMPTY_FLYTHROUGH_PROXY = proxy({nearbyPois: []})

/**
 * Renders the content of a Point of Interest (POI) for the map canvas or UI lists.
 */
export const MapPOIContent = ({poi, useInMenu = false, style}) => {
    const _poiContent = useRef(null)
    const _icon = useRef(null)
    const _renderRequestId = useRef(0)

    const unitSystem = useSnapshot(lgs.settings.unitSystem)
    const coordinateSystem = useSnapshot(lgs.settings.coordinateSystem)

    const $pois = lgs.stores.main.components.pois
    const poisSnap = useSnapshot($pois)
    const flythrough = useSnapshot(lgs.stores?.flythrough ?? EMPTY_FLYTHROUGH_PROXY)


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
    const flythroughEntry = Array.isArray(flythrough.nearbyPois)
        ? flythrough.nearbyPois.find(entry => entry?.poi?.id === point?.id)
        : null
    const flythroughActive = Boolean(flythrough.active || flythrough.playing || flythrough.paused)
    const flythroughSettings = normalizeFlythroughPOISettings(point?.flythrough)
    const hideFlythroughField = key => flythroughActive && flythroughEntry && flythroughSettings.hiddenFields[key] === true

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
        if (useInMenu || !point?.visible || !pointId) {
            return
        }

        const renderRequestId = ++_renderRequestId.current
        __.requestAnimationFrame(() => {
            try {
                if (renderRequestId !== _renderRequestId.current || !$pois.list.get(pointId)) {
                    return
                }

                const scale = 2
                const ratio = window.devicePixelRatio || 1

                snapdom(_poiContent.current, {scale}).then(snap =>
                                                               snap.toCanvas().then(canvas => {
                                                                   const currentPoint = $pois.list.get(pointId)
                                                                   if (renderRequestId !== _renderRequestId.current
                                                                       || !currentPoint
                                                                       || !currentPoint.visible) {
                                                                       return
                                                                   }

                                                                   const mapPOI = new MapPOI(currentPoint)
                                                                   mapPOI.image = {
                                                                       src:    canvas.toDataURL(),
                                                                       width:  canvas.width / scale / ratio,
                                                                       height: canvas.height / scale / ratio,
                                                                   }
                                                                   mapPOI.pixelOffset = {
                                                                       x: currentPoint.expanded ? -13 : 0,
                                                                       y: 0,
                                                                   }
                                                                   mapPOI.utils.draw(mapPOI)
                                                               }),
                )
            }
            catch (error) {
                console.error('Error rendering POI to canvas:', error)
            }
        })
    }, [useInMenu, point?.visible, pointId, $pois.list])

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
                  point?.height,
                  point?.location,
                  point?.longitude,
                  point?.latitude,
                  point?.type,
                  point?.visible,
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

    return (
        <div
            className={classNames(
                'poi-icon-wrapper',
                (!point?.expanded || useInMenu) && 'poi-shrinked',
                !point?.expanded && 'lgs--location-pin',
                useInMenu && 'used-in-menu',
            )}
            style={{
                '--lgs-poi-background-color': point?.bgColor ?? lgs.colors.poiDefaultBackground,
                '--lgs-poi-border-color':     point?.color ?? lgs.colors.poiDefault,
                '--lgs-poi-color':            point?.color ?? lgs.colors.poiDefault,
                ...style,
            }}
        >
            <div className="poi-card" ref={_poiContent}>
                <div className="poi-card-inner">
                    <div className="poi-card-inner-background"/>

                    {point?.expanded && !useInMenu ? (
                        <>
                            <h3>{point.title ?? 'Point Of Interest'}</h3>
                            {point.location && !hideFlythroughField('location') && (
                                <div className="poi-location" title={point.location}>
                                    <WaIcon name="location-dot"
                                            variant="regular"
                                            onWaLoad={renderToCanvasAfterIconLoad}
                                    />
                                    <span>{point.location}</span>
                                </div>
                            )}

                            {!hideFlythroughField('category') && (
                                <div className="poi-location" title={point.location}>
                                    <WaIcon name={iconName}
                                            variant="regular"
                                            src={point?.visible && isSvgIcon ? `${ICONS_PATH}/${iconName}` : ''}
                                            onWaLoad={renderToCanvasAfterIconLoad}
                                    />
                                    <span>{point.category}</span>
                                </div>
                            )}


                            <div className="poi-full-coordinates">
                                {point.height > 0 && point.height !== point.simulatedHeight && !hideFlythroughField('altitude') && (
                                    <NameValueUnit
                                        className="poi-elevation"
                                        text={'Altitude:'}
                                        value={point.height.toFixed()}
                                        format="%d"
                                        units={ELEVATION_UNITS}
                                    />
                                )}
                                {!hideFlythroughField('coordinates') && (
                                    <div className="poi-coordinates">
                                        <span>
                                            {__.convert(point.latitude).to(coordinateSystem.current)},{' '}
                                            {__.convert(point.longitude).to(coordinateSystem.current)}
                                        </span>
                                    </div>
                                )}
                                {point.time && (
                                    <div className="poi-time">
                                        <DateTimeDisplay value={point.time}/>
                                    </div>
                                )}
                            </div>
                        </>
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
            </div>
        </div>
    )
}
