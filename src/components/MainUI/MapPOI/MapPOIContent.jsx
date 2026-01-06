/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                             from '@Components/DataDisplay/NameValueUnit'
import { FontAwesomeIcon }                                                 from '@Components/FontAwesomeIcon'
import { JOURNEY_EDITOR_DRAWER, POI_TMP_TYPE, POIS_EDITOR_DRAWER, SECOND } from '@Core/constants'
import { MapPOI }                                                          from '@Core/MapPOI'
import { Utils }                                   from '@Editor/Utils'
import { faMask }                                  from '@fortawesome/pro-solid-svg-icons'
import { UIToast }                                   from '@Utils/UIToast'
import { ELEVATION_UNITS }                           from '@Utils/UnitUtils'
import { snapdom }                                   from '@zumer/snapdom'
import classNames                                    from 'classnames'
import { DateTime }                                  from 'luxon'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                               from 'valtio'
import './style.css'

/**
 * React component rendering a Point of Interest (POI) content on the map.
 * Supports both map display and menu/list usage with optimized rendering paths.
 *
 * @component
 * @param {Object} props
 * @param {string} props.poi - POI identifier
 * @param {boolean} [props.useInMenu=false] - Disable canvas rendering and interactions when used in menus
 * @param {string} [props.category] - When provided, renders only the category icon (menu mode)
 * @param {Object} [props.style] - Inline styles for the icon
 * @param {string} [props.slot] - Slot attribute for web-component usage
 * @returns {JSX.Element}
 */
export const MapPOIContent = ({poi, useInMenu = false, category = null, style, slot}) => {
    // refs for DOM elements used in canvas rendering
    const _poiContent = useRef(null)
    const _icon = useRef(null)

    // global reactive settings
    const unitSystem = useSnapshot(lgs.settings.unitSystem)
    const coordinateSystem = useSnapshot(lgs.settings.coordinateSystem)

    // force menu mode when category is provided
    const isMenuMode = useInMenu || !!category

    // POI data access - only when not in menu/category mode
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const $point = $pois.list.get(poi)
    const point = pois.list.get(poi)

    const $contextMenu = lgs.stores.ui.contextMenu
    $contextMenu.type = 'poi'

    /** retrieve current POI snapshot */
    const currentPOI = useMemo(() => {
        if (isMenuMode || !pois?.list) {
            return null
        }
        return pois.list.get(poi)
    }, [isMenuMode, pois?.list, poi, $pois])

    /** open/close POI editor drawer with journey/track context handling */
    const handleEditor = useCallback(async (event, entity) => {

        if (isMenuMode) {
            return
        }
        const thePOI = currentPOI

        const alreadyOpen = __.ui.drawerManager.drawers.open
        const samePOI = entity === pois.current

        if (alreadyOpen && samePOI) {
            __.ui.drawerManager.close()
            return
        }

        const drawer = thePOI.parent ? JOURNEY_EDITOR_DRAWER : POIS_EDITOR_DRAWER
        const tab = 'tab-pois'

        if (thePOI.parent) {
            const newJourney = lgs.getJourneyByTrackSlug(thePOI.parent)
            const sameJourney = newJourney?.slug === lgs.theJourney.slug

            if (!sameJourney) {
                await Utils.updateJourneyEditor(newJourney.slug, {focus: false})
            }
            else {
                const newTrack = lgs.getTrackBySlug(thePOI.parent)
                const sameTrack = newTrack?.slug === lgs.theTrack.slug
                if (newTrack && !sameTrack) {
                    newTrack.addToContext()
                    newTrack.addToEditor()
                }
            }
        }

        __.ui.drawerManager.open(drawer, {
            action: 'edit-current',
            entity,
            tab,
        })
    }, [isMenuMode, currentPOI, pois?.current])

    /** show POI context menu on right-click/long-tap */
    const handleContextMenu = useCallback((event, entity) => {
        if (isMenuMode) {
            return
        }
        $contextMenu.visible = true
        $contextMenu.position = {x: event.position.x, y: event.position.y}
        $contextMenu.targetId = currentPOI
    }, [isMenuMode, currentPOI])

    /** toggle expanded/collapsed state on click/tap */
    const handleClick = useCallback(async (event, entity) => {
        if (isMenuMode || !currentPOI) {
            return
        }
        await __.ui.poiManager.updatePOI(entity, {expanded: !currentPOI.expanded})
    }, [isMenuMode, currentPOI?.expanded])

    /** expand on mouse over */
    const handleMouseOver = useCallback(async (event, entity) => {
        if (isMenuMode || !currentPOI || currentPOI.expanded) {
            return
        }
        await __.ui.poiManager.updatePOI(entity, {expanded: true, isMouseOverExpanded: true})
    }, [isMenuMode, currentPOI?.expanded])

    /** collapse on mouse out only if expanded by mouse over */
    const handleMouseOut = useCallback(async (event, entity) => {
        if (isMenuMode || !currentPOI?.expanded || !currentPOI.isMouseOverExpanded) {
            return
        }
        await __.ui.poiManager.updatePOI(entity, {expanded: false, isMouseOverExpanded: false})
    }, [isMenuMode, currentPOI?.expanded, currentPOI?.isMouseOverExpanded])

    /** register all canvas event listeners for the POI */
    const addEventListeners = useCallback((poiId) => {
        __.canvasEvents.onClick(handleClick, {entity: poiId})
        __.canvasEvents.onTap(handleClick, {entity: poiId})
        __.canvasEvents.onDoubleClick(handleEditor, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onDoubleTap(handleEditor, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onRightClick(handleContextMenu, {entity: poiId, preventLowerPriority: true})
        __.canvasEvents.onLongTap(handleContextMenu, {entity: poiId, preventLowerPriority: true})
        // TODO: fix mouse over/out when ready
        // __.canvasEvents.onMouseOver(handleMouseOver, { entity: poiId, preventLowerPriority: true })
        // __.canvasEvents.onMouseOut(handleMouseOut, { entity: poiId, preventLowerPriority: true })
    }, [handleClick, handleEditor, handleContextMenu])

    /** remove all listeners for the POI */
    const removeEventListeners = useCallback((poiId) => {
        __.canvasEvents.removeAllListenersByEntity(poiId)
    }, [])

    /** render POI content to canvas and update MapPOI instance */
    const renderToCanvas = useCallback(() => {
        if (isMenuMode || !$point?.visible) {
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
    }, [isMenuMode, $point?.visible, point?.expanded])

    // canvas rendering + event listeners + mutation observer (only for map usage)
    useEffect(() => {
        if (isMenuMode || !point) {
            return
        }

        const observer = new MutationObserver(renderToCanvas)
        if (_poiContent.current) {
            observer.observe(_poiContent.current, {
                childList:  true,
                attributes: true,
                characterData: true,
                subtree:    true,
            })
        }

        addEventListeners(poi)
        renderToCanvas()

        return () => {
            observer.disconnect()
            removeEventListeners(poi)
        }
    }, [
                  isMenuMode,
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

    // menu/category only icon rendering
    if (category) {
        return (
            <div className="poi-icon-wrapper poi-shrinked used-in-menu" {...(slot && {slot})}>
                <div className="poi-card" ref={_poiContent}>
                    <div className="poi-card-inner" ref={useRef(null)} style={style}>
                        <div className="poi-card-inner-background"/>
                        <FontAwesomeIcon
                            ref={_icon}
                            key={category}
                            icon={MapPOI.categoryIcon(category)}
                            className="poi-as-flag"
                            style={style}
                        />
                    </div>
                </div>
            </div>
        )
    }

    // full map POI rendering
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
                         <FontAwesomeIcon
                             key={point?.category}
                             icon={point?.visible ? point.categoryIcon(point.category) : faMask}
                             className="poi-as-flag"
                             ref={_icon}
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
