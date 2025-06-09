/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-09
 * Last modified: 2025-06-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { NameValueUnit }                             from '@Components/DataDisplay/NameValueUnit'
import { FontAwesomeIcon }                           from '@Components/FontAwesomeIcon'
import { JOURNEY_EDITOR_DRAWER, POIS_EDITOR_DRAWER } from '@Core/constants'
import { UIToast }                                   from '@Utils/UIToast'
import { ELEVATION_UNITS }                           from '@Utils/UnitUtils'
import { snapdom }                                   from '@zumer/snapdom'
import classNames                                    from 'classnames'
import { DateTime }                                  from 'luxon'
import { memo, useEffect, useRef }                   from 'react'
import './style.css'
import { useSnapshot }                               from 'valtio'

/**
 * A React component that renders the content of a Point of Interest (POI) on the map.
 * Handles POI display, interactions, and rendering to canvas.
 *
 * @component
 * @param {Object} props - Component properties
 * @param {Object} props.poi - POI identifier
 * @returns {JSX.Element} Rendered POI content
 */
export const MapPOIContent = memo(({poi}) => {
    const inner = useRef(null)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const $point = $pois.list.get(poi)
    const point = useSnapshot($point)
    const _poiContent = useRef(null)
    let current = null

    /**
     * Get POI by id and set current poi.
     *
     * @param {string} id - The POI identifier
     * @return {Object} The current POI object
     */
    const getPOI = (id) => {
        const current = pois.list.get(id)
        $pois.current = id
        return current
    }

    /**
     * Toggle editor Handler
     *
     * For the same poi, it toggles the editor pane.
     *
     * When the editor is open on a poi and the user double clicks on another one,
     * the editor stays open but focuses on the new poi data.
     *
     * @param {Event} event - The event that triggered the handler
     * @param {string} entity - The POI entity identifier
     */
    const handleEditor = (event, entity) => {
        const current = pois.current
        const thePOI = getPOI(entity)
        if (thePOI.type) {
            if (__.ui.drawerManager.drawers.open && entity === current) {
                __.ui.drawerManager.close()
            }

            const drawer = thePOI.parent ? JOURNEY_EDITOR_DRAWER : POIS_EDITOR_DRAWER
            let same = true
            const tab = 'pois'
            if (thePOI.parent) {
                const newJourney = lgs.getJourneyByTrackSlug(thePOI.parent)

                if (newJourney.slug !== lgs.theJourney.slug) {
                    // it is a different journey
                    newJourney.addToContext()
                    newJourney.addToEditor()
                }
                const newTrack = lgs.getTrackBySlug(thePOI.parent)
                same = newTrack.slug === lgs.theTrack.slug
                if (!same) {
                    // It is a different track
                    newTrack.addToContext()
                    newTrack.addToEditor()
                }
            }

            //  Clicking on a different journey or track always open the drawer
            //  Clicking on the same toggles the drawer
            if (same) {
                __.ui.drawerManager.toggle(drawer, {
                    action: 'edit-current',
                    entity: entity,
                    tab:    tab,
                })
            }
            else {
                __.ui.drawerManager.open(drawer, {
                    action: 'edit-current',
                    entity: entity,
                    tab:    tab,
                })
            }

            lgs.stores.journeyEditor.tabs.journey[tab] = true


        }
        else {
            UIToast.warning({
                                caption: `You can not edit this POI.`,
                                text:    `It is a temporary POI. Use ${'Save As POI'} in the context menu then you will be able to.`,
                            })
        }
    }

    /**
     * Show context menu for the selected poi.
     *
     * @param {Event} event - The event that triggered the handler
     * @param {string} entity - The POI entity identifier
     */
    const handleContextMenu = (event, entity) => {
        const poi = getPOI(entity)
        if (poi && !__.ui.cameraManager.isRotating()
            || (__.ui.cameraManager.isRotating()
                &&
                (pois.current === false || pois.current.id === poi.id)
            )) {
            __.app.hooksContextMenu(event)
            $pois.context.visible = true
        }
    }

    /**
     * Handles click events on the POI.
     * Toggles the expanded state of the POI.
     *
     * @param {Event} event - The click event
     * @param {string} entity - The POI entity identifier
     */
    const handleClick = (event, entity) => {
        const poi = getPOI(entity)
        Object.assign($pois.list.get(entity), {
            expanded: !poi.expanded,
        })
    }

    /**
     * Handles mouse over events on the POI.
     * Expands the POI if it's not already expanded.
     *
     * @param {Event} event - The mouse over event
     * @param {string} entity - The POI entity identifier
     * @param {Object} options - Additional options
     * @param {Object} data - Additional data
     */
    const handleMouseOver = (event, entity, options, data) => {
        const poi = getPOI(entity)
        if (!poi.expanded) {
            Object.assign($pois.list.get(entity), {
                expanded:            true,
                isMouseOverExpanded: true,
            })
        }
    }

    /**
     * Handles mouse out events on the POI.
     * Collapses the POI if it was expanded due to mouse over.
     *
     * @param {Event} event - The mouse out event
     * @param {string} entity - The POI entity identifier
     * @param {Object} options - Additional options
     * @param {Object} data - Additional data
     */
    const handleMouseOut = (event, entity, options, data) => {
        const poi = getPOI(entity)
        if (poi.expanded && poi.isMouseOverExpanded) {
            Object.assign($pois.list.get(entity), {
                expanded:            false,
                isMouseOverExpanded: false,
            })
        }
    }


    /**
     *
     */
    const addPOIEventListeners = poi => {

        // Toggles POI size on click
        __.canvasEvents.onClick(handleClick, {entity: poi.id})
        __.canvasEvents.onTap(handleClick, {entity: poi.id})

        // Open editor on Double Click/double tap
        __.canvasEvents.onDoubleClick(handleEditor, {entity: poi.id, preventLowerPriority: true})
        __.canvasEvents.onDoubleTap(handleEditor, {entity: poi.id, preventLowerPriority: true})

        // Open contextual menu on Right Click/long tap
        __.canvasEvents.onRightClick(handleContextMenu, {entity: poi.id, preventLowerPriority: true})
        __.canvasEvents.onLongTap(handleContextMenu, {entity: poi.id, preventLowerPriority: true})

        // TODO FIX
        // __.canvasEvents.onMouseOver(handleMouseOver, {entity: poi.id, preventLowerPriority: true})
        // __.canvasEvents.onMouseOut(handleMouseOut, {entity: poi.id, preventLowerPriority: true})
    }

    /**
     * Removes event listeners for a MapPOI
     * @param {MapPOI} poi - MapPOI instance to remove listeners for
     */
    const removePOIEventListeners = poi => {
        __.canvasEvents.removeAllListenersByEntity(poi.id)
    }

    useEffect(() => {
        const renderToCanvas = async () => {
            if (!_poiContent.current) {
                return
            }
            try {
                const scale = 2
                const ratio = window.devicePixelRatio || 1
                snapdom(_poiContent.current, {scale: scale}).then(snap => {
                    snap.toCanvas().then(canvas => {
                        $point.image = {
                            src: canvas.toDataURL('image/png'),
                            width:  canvas.width / scale / ratio,
                            height: canvas.height / scale / ratio,
                        }
                        $point.pixelOffset = {
                            x: point.expanded ? -13 : 0, // equiv of --poi-delta-x defined in ./style.css
                            y: 0,
                        }
                        point.draw()
                        lgs.scene.requestRender()
                    })
                })
            }
            catch (error) {
                console.error('Error occurred during the conversion POI', error)
            }

        }
        renderToCanvas()
        addPOIEventListeners(point)


        return () => {
            removePOIEventListeners(point)
            // point.remove() //TODO remove DOM elements and ref
        }
    }, [
                  point.title,
                  point.icon,
                  point.expanded,
                  point.color,
                  point.bgColor,
                  point.height,
                  point.longitude,
                  point.latitude,
                  point.type,
              ])

    return (
        <div className={classNames(
            'poi-on-map-wrapper',
            (point?.showFlag || !point?.expanded) && !point?.over ? 'poi-shrinked' : '',
        )}
             id={point.id}
             style={{
                 '--lgs-poi-background-color': point.bgColor ?? lgs.colors.poiDefaultBackground,
                 '--lgs-poi-border-color':     point.color ?? lgs.colors.poiDefault,
                 '--lgs-poi-color':            point.color ?? lgs.colors.poiDefault,
             }}
        >
            <div className="poi-on-map" ref={_poiContent}>
                <div className="poi-on-map-inner" ref={inner} id={`poi-inner-${point?.id}`}>
                    <div className="poi-on-map-triangle-down"/>
                    <div className="poi-on-map-inner-background"/>
                    {(point.expanded || (!point.expanded && point.over)) && !point.showFlag &&
                        <>
                            <h3> {point.title ?? 'Point Of Interest'}</h3>
                            {/* //   {point.scale >= 0 && ( */}
                            <div className="poi-full-coordinates">
                                {point.height && point.height > 0 && point.height !== point.simulatedHeight ? (
                                    <NameValueUnit
                                        className="poi-elevation"
                                        text={'Altitude: '}
                                        value={point.height.toFixed()}
                                        format={'%d'}
                                        units={ELEVATION_UNITS}
                                    />
                                ) : (
                                    <div></div> // Ligne vide
                                )}

                                <div className="poi-coordinates">
                                        <span>
                                          {__.convert(point.latitude).to(lgs.settings.coordinateSystem.current)},
                                            &nbsp;
                                            {__.convert(point.longitude).to(lgs.settings.coordinateSystem.current)}
                                        </span>

                                </div>

                                {point.time && (
                                    <div className="poi-time">
                                        {DateTime.fromISO(point.time).toLocaleString(DateTime.DATE_SIMPLE)} - {DateTime.fromISO(point.time).toLocaleString(DateTime.TIME_SIMPLE)}
                                    </div>
                                )}
                            </div>
                            {/* // )} */}
                        </>
                    }
                    {(point.showFlag || (!point.expanded && !point.over)) && (
                        <FontAwesomeIcon icon={point.icon} className="poi-as-flag"/>
                    )}
                </div>

                {(point.expanded || (!point.expanded && point.over)) && !point.showFlag &&
                    <div className="poi-icons">
                        <FontAwesomeIcon icon={point.icon} className="poi-as-flag"/>
                    </div>
                }
            </div>
        </div>
    )
})