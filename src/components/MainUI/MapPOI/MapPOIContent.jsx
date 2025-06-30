/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { NameValueUnit }                             from '@Components/DataDisplay/NameValueUnit'
import { FontAwesomeIcon }                           from '@Components/FontAwesomeIcon'
import { JOURNEY_EDITOR_DRAWER, POIS_EDITOR_DRAWER } from '@Core/constants'
import { MapPOI }                                    from '@Core/MapPOI'
import { UIToast }                                   from '@Utils/UIToast'
import { ELEVATION_UNITS }                           from '@Utils/UnitUtils'
import { snapdom }                                   from '@zumer/snapdom'
import classNames                                    from 'classnames'
import { DateTime }                                  from 'luxon'
import { useEffect, useRef }                         from 'react'
import './style.css'
import { useSnapshot }                               from 'valtio'
import { faMask } from '@fortawesome/pro-solid-svg-icons'

/**
 * A React component that renders the content of a Point of Interest (POI) on the map.
 * Handles POI display, interactions, and rendering to canvas.
 *
 * @component
 * @param {Object} props - Component properties
 * @param {string} props.poi - POI identifier used to lookup POI data from the store
 * @param {boolean} [props.useInMenu=false] - Whether the component is being used within a menu context.
 *                                           When true, disables canvas rendering and event listeners
 *                                           to optimize performance for menu/list usage
 * @returns {JSX.Element} Rendered POI content with interactive elements
 *
 * @example
 * // Basic usage with default settings (for map display)
 * <MapPOIContent poi="poi-123" />
 *
 * @example
 * // Usage in a menu/list context (optimized rendering)
 * <MapPOIContent poi="poi-456" useInMenu={true} />
 *
 */
export const MapPOIContent = ({poi, useInMenu = false, category = null, style, slot}) => {


    // Component refs for DOM manipulation and canvas rendering
    const inner = useRef(null)
    const _poiContent = useRef(null)
    const _icon = useRef(null)

    if (category) {
        useInMenu = true
    }

    // Store references and reactive state - only when category is not defined
    const $pois = !category ? lgs.stores.main.components.pois : null
    const pois = !category ? useSnapshot($pois) : null
    const $point = !category ? $pois?.list?.get(poi) : null
    const point = !category && $point ? useSnapshot($point) : null

    /**
     * Retrieves POI by ID and sets it as the current POI in the store.
     * Only used when category is not defined.
     */
    const getPOI = (id) => {
        if (category) {
            return null
        }
        const current = pois.list.get(id)
        $pois.current = id
        return current
    }

    /**
     * Toggles the editor drawer for POI editing.
     *
     * Behavior:
     * - For the same POI: toggles the editor pane open/closed
     * - For different POI: keeps editor open but switches to new POI data
     * - Handles journey/track context switching when POI belongs to different journey/track
     *
     * @param {Event} event - The event that triggered the handler
     * @param {string} entity - The POI identifier
     */
    const handleEditor = (event, entity) => {
        const current = pois.current
        const thePOI = getPOI(entity)

        if (thePOI.type) {
            // Toggle drawer if clicking on same POI while drawer is open
            if (__.ui.drawerManager.drawers.open && entity === current) {
                __.ui.drawerManager.close()
            }

            const drawer = thePOI.parent ? JOURNEY_EDITOR_DRAWER : POIS_EDITOR_DRAWER
            let sameJourney = true
            let sameTrack = true
            const tab = 'tab-pois'

            // Handle journey/track context switching for POIs with parent
            if (thePOI.parent) {
                const newJourney = lgs.getJourneyByTrackSlug(thePOI.parent)
                sameJourney = newJourney && newJourney.slug === lgs.theJourney.slug

                if (!sameJourney) {
                    // Switch to different journey
                    newJourney.addToContext()
                    newJourney.addToEditor()
                }
                else {
                    const newTrack = lgs.getTrackBySlug(thePOI.parent)
                    sameTrack = newTrack && newTrack.slug === lgs.theTrack.slug
                    if (newTrack && !sameTrack) {
                        // Switch to different track within same journey
                        newTrack.addToContext()
                        newTrack.addToEditor()
                    }
                }
            }

            // Open drawer based on context change
            if (!sameJourney) {
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
        }
        else {
            // Show warning for temporary POIs that cannot be edited
            UIToast.warning({
                                caption: `You can not edit this POI.`,
                                text:    `It is a temporary POI. Use ${'Save As POI'} in the context menu then you will be able to.`,
                            })
        }
    }

    /**
     * Displays the context menu for the selected POI.
     * Only shows menu if camera is not rotating or if POI is current selection.
     *
     * @param {Event} event - The event that triggered the handler (right-click/long-tap)
     * @param {string} entity - The POI entity identifier
     */
    const handleContextMenu = (event, entity) => {
        const poi = getPOI(entity)

        // Check if context menu should be shown based on camera state
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
     * Toggles the expanded state of the POI between compact and detailed view.
     *
     * @param {Event} event - The click event
     * @param {string} entity - The POI entity identifier
     */
    const handleClick = (event, entity) => {
        const poi = getPOI(entity)
        __.ui.poiManager.updatePOI(entity, {
            expanded: !poi.expanded,
        })
    }

    /**
     * Handles mouse over events on the POI.
     * Expands the POI to show detailed information if not already expanded.
     *
     * @param {Event} event - The mouse over event
     * @param {string} entity - The POI entity identifier
     * @param {Object} options - Additional event options
     * @param {Object} data - Additional event data
     */
    const handleMouseOver = (event, entity, options, data) => {
        const poi = getPOI(entity)
        if (!poi.expanded) {
            __.ui.poiManager.updatePOI(entity, {
                expanded:            true,
                isMouseOverExpanded: true, // Flag to track expansion source
            })
        }
    }

    /**
     * Handles mouse out events on the POI.
     * Collapses the POI if it was expanded due to mouse over (not manual expansion).
     *
     * @param {Event} event - The mouse out event
     * @param {string} entity - The POI entity identifier
     * @param {Object} options - Additional event options
     * @param {Object} data - Additional event data
     */
    const handleMouseOut = (event, entity, options, data) => {
        const poi = getPOI(entity)
        // Only collapse if expansion was caused by mouse over
        if (poi.expanded && poi.isMouseOverExpanded) {
            __.ui.poiManager.updatePOI(entity, {
                expanded:            false,
                isMouseOverExpanded: false,
            })
        }
    }

    /**
     * Registers event listeners for POI interactions.
     * Sets up click, double-click, context menu, and mouse over/out handlers.
     *
     * @param {Object} poi - POI object containing id and other properties
     */
    const addPOIEventListeners = poi => {
        // Toggle POI size on single click/tap
        __.canvasEvents.onClick(handleClick, {entity: poi.id})
        __.canvasEvents.onTap(handleClick, {entity: poi.id})

        // Open editor on double click/double tap
        __.canvasEvents.onDoubleClick(handleEditor, {entity: poi.id, preventLowerPriority: true})
        __.canvasEvents.onDoubleTap(handleEditor, {entity: poi.id, preventLowerPriority: true})

        // Open contextual menu on right click/long tap
        __.canvasEvents.onRightClick(handleContextMenu, {entity: poi.id, preventLowerPriority: true})
        __.canvasEvents.onLongTap(handleContextMenu, {entity: poi.id, preventLowerPriority: true})

        // TODO: Fix mouse over/out events
        // __.canvasEvents.onMouseOver(handleMouseOver, {entity: poi.id, preventLowerPriority: true})
        // __.canvasEvents.onMouseOut(handleMouseOut, {entity: poi.id, preventLowerPriority: true})
    }

    /**
     * Removes all event listeners for a POI.
     * Used in cleanup to prevent memory leaks and orphaned event handlers.
     *
     * @param {Object} poi - POI object containing id for listener removal
     */
    const removePOIEventListeners = poi => {
        __.canvasEvents.removeAllListenersByEntity(poi.id)
    }


    /**
     * Renders the POI content to a canvas and updates the MapPOI
     */
    const renderToCanvas = () => {
        if (!$point.visible && !useInMenu) {
            return
        }

        // Double requestAnimationFrame pour s'assurer que le DOM est stable
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    const scale = 2
                    const ratio = window.devicePixelRatio || 1

                    snapdom(_poiContent.current, {scale: scale}).then(snap => {
                        snap.toCanvas().then(async canvas => {
                            const thePOI = new MapPOI($point)

                            thePOI.image = {
                                src:    canvas.toDataURL(),
                                width:  canvas.width / scale / ratio,
                                height: canvas.height / scale / ratio,
                            }
                            thePOI.pixelOffset = {
                                x: point.expanded ? -13 : 0,
                                y: 0,
                            }
                            await thePOI.utils.draw(thePOI)
                        })
                    })
                }
                catch (error) {
                    console.error('Error in renderToCanvas:', error)
                }
            })
        })
    }

    /**
     * Effect hook to handle canvas rendering and event listeners using MutationObserver
     * Only runs when category is not defined
     */
    useEffect(() => {
        if (useInMenu || category) {
            return
        }

        // Ne pas appeler renderToCanvas immédiatement
        // requestAnimationFrame(renderToCanvas)

        // Set up MutationObserver to monitor changes to _poiContent
        const observer = new MutationObserver(() => {
            renderToCanvas() // Le délai est maintenant dans renderToCanvas
        });

        if (_poiContent.current) {
            observer.observe(_poiContent.current, {
                childList:     true,
                attributes:    true,
                characterData: true,
                subtree:       true,
            })
        }

        // Add event listeners
        addPOIEventListeners(point)

        // Premier rendu avec délai
        renderToCanvas()

        // Cleanup: Disconnect observer and remove event listeners
        return () => {
            observer.disconnect()
            removePOIEventListeners(point)
        }
    }, [
                  category ? null : point?.title,
                  category ? null : point?.category,
                  category ? null : point?.expanded,
                  category ? null : point?.color,
                  category ? null : point?.bgColor,
                  category ? null : point?.height,
                  category ? null : point?.longitude,
                  category ? null : point?.latitude,
                  category ? null : point?.type,
        category, point?.visible,
              ])

    // When category is defined, render only the icon
    if (category) {
        return (
            <div className={classNames(
                'poi-icon-wrapper',
                'poi-shrinked',
                'used-in-menu',
            )} {...(slot && {slot: slot})}>

            <div className="poi-card" ref={_poiContent}>
                    <div className="poi-card-inner" ref={inner} style={style}>
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

    // Original rendering logic when category is not defined
    return (
        <div className={classNames(
            'poi-icon-wrapper',
            (!point?.expanded || useInMenu) ? 'poi-shrinked' : '',
            useInMenu ? 'used-in-menu' : '',
        )}
             style={{
                 '--lgs-poi-background-color': point.bgColor ?? lgs.colors.poiDefaultBackground,
                 '--lgs-poi-border-color':     point.color ?? lgs.colors.poiDefault,
                 '--lgs-poi-color':            point.color ?? lgs.colors.poiDefault,
             }}
        >

            <div className="poi-card" ref={_poiContent}>
                <div className="poi-card-inner" ref={inner}>
                    {!useInMenu &&
                        <div className="poi-card-triangle-down"/>
                    }
                    <div className="poi-card-inner-background"/>

                    {point.expanded && !useInMenu ? (
                        <>
                            <h3>{point.title ?? 'Point Of Interest'}</h3>
                            <div className="poi-full-coordinates">
                                {point.height && point.height > 0 && point.height !== point.simulatedHeight ? (
                                    <NameValueUnit
                                        className="poi-elevation"
                                        text={'Altitude: '}
                                        value={point.height.toFixed()}
                                        format={'%d'}
                                        units={ELEVATION_UNITS}
                                    />
                                ) : null}

                                <div className="poi-coordinates">
                                    <span>
                                      {__.convert(point.latitude).to(lgs.settings.coordinateSystem.current)},{' '}
                                        {__.convert(point.longitude).to(lgs.settings.coordinateSystem.current)}
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
                             key={point.category}
                             icon={point?.visible ? point.categoryIcon(point.category) : faMask}
                             className="poi-as-flag"
                             ref={_icon}
                         />
                     )}
                </div>

                {point.expanded && !useInMenu &&
                    <div className="poi-menu-icons">
                        <MapPOIContent poi={point.id} useInMenu={true}/>
                    </div>
                }
            </div>

        </div>
    )
}