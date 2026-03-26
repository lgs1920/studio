/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-26
 * Last modified: 2026-03-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                             from '@Components/DataDisplay/NameValueUnit'
import { applyPOIDuotoneIconStyles }                             from '@Components/MainUI/MapPOI/duotoneIconUtils'
import { ICONS_PATH, JOURNEY_EDITOR_DRAWER, POIS_EDITOR_DRAWER } from '@Core/constants'
import { MapPOI }                                                  from '@Core/MapPOI'
import { Utils }                                                   from '@Editor/Utils'
import { ELEVATION_UNITS }                           from '@Utils/UnitUtils'
import { WaIcon }                                                from '@web.awesome.me/webawesome-pro/dist/react'
import { snapdom }                                   from '@zumer/snapdom'
import classNames                                    from 'classnames'
import { DateTime }                                  from 'luxon'
import { useCallback, useEffect, useMemo, useRef }                 from 'react'
import { useSnapshot }                               from 'valtio'
import './style.css'

/**
 * Renders the content of a Point of Interest (POI) for the map canvas or UI lists.
 */
export const MapPOIContent = ({poi, useInMenu = false, style}) => {
    const _poiContent = useRef(null)
    const _icon = useRef(null)

    const unitSystem = useSnapshot(lgs.settings.unitSystem)
    const coordinateSystem = useSnapshot(lgs.settings.coordinateSystem)

    const $pois = lgs.stores.main.components.pois
    const poisSnap = useSnapshot($pois)


    /** * Direct reactive access to the point from the snapshot.
     */
    const point = useMemo(() => poisSnap.list.get(poi), [poisSnap.list, poi])
    const $point = $pois.list.get(poi)

    const $contextMenu = lgs.stores.ui.contextMenu
    const iconName = point?.categoryIcon(point?.category)
    const isSvgIcon = iconName?.endsWith('.svg')

    /** Handles drawer opening for editing */
    const handleEditor = useCallback(async (event, entity) => {
        if (useInMenu || !point) {
            return
        }

        const alreadyOpen = __.ui.drawerManager.drawers.open
        const samePOI = entity === poisSnap.current

        if (alreadyOpen && samePOI) {
            __.ui.drawerManager.close()
            return
        }

        const drawer = point.parent ? JOURNEY_EDITOR_DRAWER : POIS_EDITOR_DRAWER
        const tab = 'tab-pois'

        if (point.parent) {
            const newJourney = lgs.getJourneyByTrackSlug(point.parent)
            const sameJourney = newJourney?.slug === lgs.theJourney.slug

            if (!sameJourney) {
                await Utils.updateJourneyEditor(newJourney.slug, {focus: false})
            }
            else {
                const newTrack = lgs.getTrackBySlug(point.parent)
                if (newTrack && newTrack.slug !== lgs.theTrack.slug) {
                    newTrack.addToContext()
                    newTrack.addToEditor()
                }
            }
        }

        __.ui.drawerManager.open(drawer, {action: 'edit-current', entity, tab})
    }, [useInMenu, point, poisSnap.current])

    /** Context menu trigger */
    const handleContextMenu = useCallback((event) => {
        if (useInMenu || !point) {
            return
        }

        $contextMenu.type = 'poi'
        $contextMenu.visible = true
        $contextMenu.position = {x: event.position.x, y: event.position.y}
        $contextMenu.targetId = point
    }, [useInMenu, point, $contextMenu])

    /** Toggle expanded state */
    const handleClick = useCallback(async (event, entity) => {
        if (useInMenu || !point) {
            return
        }
        await __.ui.poiManager.updatePOI(entity, {expanded: !point.expanded})
    }, [useInMenu, point])

    const addEventListeners = useCallback((poiId) => {
        __.canvasEvents.onClick(handleClick, {entity: poiId})
        __.canvasEvents.onTap(handleClick, {entity: poiId})
        __.canvasEvents.onDoubleClick(handleEditor, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onDoubleTap(handleEditor, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onRightClick(handleContextMenu, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onLongTap(handleContextMenu, {entity: poiId, preventLowerPriority: true})
    }, [handleClick, handleEditor, handleContextMenu])

    const removeEventListeners = useCallback((poiId) => {
        __.canvasEvents.removeAllListenersByEntity(poiId)
    }, [])

    /** Synchronizes DOM content to map canvas */
    const renderToCanvas = useCallback(() => {
        if (useInMenu || !point?.visible || !$point) {
            return
        }

        __.requestAnimationFrame(() => {
            try {
                const scale = 2
                const ratio = window.devicePixelRatio || 1

                snapdom(_poiContent.current, {scale}).then(snap =>
                                                               snap.toCanvas().then(canvas => {
                                                                   const mapPOI = new MapPOI($point)
                                                                   mapPOI.image = {
                                                                       src:    canvas.toDataURL(),
                                                                       width:  canvas.width / scale / ratio,
                                                                       height: canvas.height / scale / ratio,
                                                                   }
                                                                   mapPOI.pixelOffset = {
                                                                       x: point.expanded ? -13 : 0,
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
    }, [useInMenu, point?.visible, point?.expanded, $point])

    useEffect(() => {
        if (useInMenu || !point) {
            return
        }

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
            observer.disconnect()
            removeEventListeners(poi)
        }
    }, [
                  useInMenu,
                  point?.title,
                  point?.category,
                  point?.expanded,
                  point?.color,
                  point?.bgColor,
                  point?.height,
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

    return (
        <div
            className={classNames(
                'poi-icon-wrapper',
                (!point?.expanded || useInMenu) && 'poi-shrinked',
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
                    {!useInMenu && <div className="poi-card-triangle-down"/>}
                    <div className="poi-card-inner-background"/>

                    {point?.expanded && !useInMenu ? (
                        <>
                            <h3>{point.title ?? 'Point Of Interest'}</h3>
                            <div className="poi-full-coordinates">
                                {point.height > 0 && point.height !== point.simulatedHeight && (
                                    <NameValueUnit
                                        className="poi-elevation"
                                        text="Altitude: "
                                        value={point.height.toFixed()}
                                        format="%d"
                                        units={ELEVATION_UNITS}
                                    />
                                )}
                                <div className="poi-coordinates">
                                    <span>
                                        {__.convert(point.latitude).to(coordinateSystem.current)},{' '}
                                        {__.convert(point.longitude).to(coordinateSystem.current)}
                                    </span>
                                </div>
                                {point.time && (
                                    <div className="poi-time">
                                        {DateTime.fromISO(point.time).toLocaleString(DateTime.DATE_SIMPLE)} -{' '}
                                        {DateTime.fromISO(point.time).toLocaleString(DateTime.TIME_SIMPLE)}
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
                            onWaLoad={applyPOIDuotoneIconStyles}
                         />
                     )}
                </div>

                {point?.expanded && !useInMenu && (
                    <div className="poi-menu-icons">
                        <MapPOIContent poi={point.id} useInMenu={true}/>
                    </div>
                )}
            </div>
        </div>
    )
}