/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-08
 * Last modified: 2025-12-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIContent }              from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOIEditContent }          from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { ToggleStateIcon }            from '@Components/ToggleStateIcon'
import { POI_STARTER_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import { faSquare, faSquareCheck }    from '@fortawesome/pro-regular-svg-icons'
import { SlDetails }                  from '@shoelace-style/shoelace/dist/react'
import { UIToast }                    from '@Utils/UIToast'
import classNames                     from 'classnames'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot }                from 'valtio'

const ICONS = {true: faSquareCheck, false: faSquare}

/**
 * Handles the reactivity of the bulk selection icon.
 * Reads only the bulkList snapshot to prevent MapPOIListItem from rendering
 * on every change to $pois (like current selection).
 *
 * @component
 * @param {Object} props
 * @param {string} props.id - POI unique identifier
 * @param {Function} props.toggleBulk - Callback to toggle bulk selection
 */
const POIBulkToggle = ({id, toggleBulk}) => {
    const {bulkList} = useSnapshot(lgs.stores.main.components.pois, {sync: true})
    const isBulkSelected = bulkList.get(id) ?? false

    return (
        <ToggleStateIcon
            initial={isBulkSelected}
            className="map-poi-bulk-indicator"
            icons={ICONS}
            onChange={toggleBulk}
            id={`bulk-map-poi-${id}`}
        />
    )
}

/**
 * Handles the SlDetails component, managing the open state based on the global
 * POI selection ($pois.current).
 * This component is NOT memoized and will only render if its specific snapshots change.
 * It contains the complex logic related to selection, camera focus, and editing content.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id - POI unique identifier
 * @param {Object} props.$poiProxy - Direct Valtio proxy of the POI (for mutations)
 * @param {string} props.classes - Dynamic classes
 * @param {Object} props.styles - Dynamic styles
 * @param {Function} props.preventDrawerClose - Callback to prevent drawer closure
 * @param {Object} props.poi - Snapshot of the POI object (for title/type/content)
 * @returns {JSX.Element}
 */
const POIDetailsWrapper = ({id, $poiProxy, classes, styles, preventDrawerClose, poi}) => {
    const $pois = lgs.stores.main.components.pois

    // Minimal reactive snapshots for selection and context
    const {current} = useSnapshot($pois, {sync: true})
    const {open: drawerOpen} = useSnapshot(lgs.stores.ui.drawers, {sync: true})

    const isCurrent = current === id
    const isGlobalDrawer = drawerOpen === POIS_EDITOR_DRAWER

    /** Select this POI – focus camera, scroll into view, update global current */
    const selectPOI = useCallback(async () => {
        if (current === id) {
            return
        }

        Object.assign($pois, {current: id})

        if ($poiProxy) {
            Object.assign($poiProxy, {animated: false})
        }


        const filteredStore = isGlobalDrawer ? $pois.filtered.global : $pois.filtered.journey
        const filteredPOI = filteredStore.get(id)

        // Camera focus + optional rotation when editing
        if (lgs.settings.ui.poi.focusOnEdit && isGlobalDrawer && __.ui.drawerManager.over) {
            const camera = lgs.mainProxy.components.camera

            if (__.ui.cameraManager.isRotating()) {
                await __.ui.cameraManager.stopRotate()
                filteredPOI?.stopAnimation?.()
            }

            __.ui.sceneManager.focus(filteredPOI, {
                target:     filteredPOI,
                heading:    camera.position.heading,
                pitch:      camera.position.pitch,
                roll:       camera.position.roll,
                range:      5000,
                infinite:   false,
                rpm:        lgs.settings.ui.poi.rpm,
                rotations:  1,
                rotate:     lgs.settings.ui.poi.rotate,
                panoramic:  false,
                flyingTime: 0,
            })

            if (lgs.settings.ui.poi.rotate) {
                filteredPOI?.startAnimation?.()
            }
        }

        // Smooth scroll to item
        const element = document.getElementById(`edit-map-poi-${id}`)
        element?.scrollIntoView({behavior: 'smooth', block: 'start'})
        element?.focus()
    }, [id, current, isGlobalDrawer, $pois, $poiProxy])

    /** Conditional rendering of the edit form (only when current) */
    const editContent = useMemo(() => {
        if (isCurrent) {
            return <MapPOIEditContent poi={id}/>
        }
        return null
    }, [isCurrent, id])


    return (
        <SlDetails
            className={classes}
            id={`edit-map-poi-${id}`}
            style={styles}
            open={isCurrent}
            small
            onSlShow={selectPOI}
            onSlAfterHide={preventDrawerClose}
        >
            <div slot="summary" onClick={selectPOI}>
                <div>
                    <MapPOIContent poi={id} useInMenu={true}/>
                    <span>{poi.title}</span>
                </div>
            </div>
            {editContent}
        </SlDetails>
    )
}


/**
 * Renders a single POI entry in the map POI list.
 * Highly optimised to prevent unnecessary re-renders when selection changes.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id      POI unique identifier
 * @param {string} [props.context] Optional context passed from parent (kept for future use)
 */
export const MapPOIListItem = memo(({id, context}) => {
                                       const $pois = lgs.stores.main.components.pois
                                       const DEFAULT_POI_BG = lgs.colors.poiDefaultBackground

                                       // Direct proxy to the POI object (reactive mutations)
                                       const $poiProxy = $pois.list.get(id)
                                       // Snapshot of the POI for rendering (immutable)
                                       const poi = useSnapshot($poiProxy || {})

                                       // REMOVED: useSnapshot($pois, {sync: true}) is no longer needed here,
                                       // because bulkList and current are now read in child components.

                                       /** Toggle bulk selection for this POI */
                                       const toggleBulk = useCallback(
                                           state => $pois.bulkList.set(id, state),
                                           [id],
                                       )

                                       /** Copy POI coordinates to clipboard */
                                       const copyCoordinates = useCallback(() => {
                                           __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() =>
                                                                                                     UIToast.success({
                                                                                                                         caption: poi.title,
                                                                                                                         text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                                                                                                                     }),
                                           )
                                       }, [poi])

                                       /** Prevent SlDetails hide event from bubbling and closing parent drawer */
                                       const preventDrawerClose = useCallback(event => {
                                           event.stopPropagation()
                                           event.preventDefault()
                                       }, [])

                                       /** Inline CSS variables based on POI colors */
                                       const styles = useMemo(() => {
                                           if (!poi.id) {
                                               return {}
                                           }
                                           const bg = poi.bgColor ?? DEFAULT_POI_BG
                                           return {
                                               '--map-poi-bg-header':    __.ui.ui.hexToRGBA(bg, 'rgba', 0.2),
                                               '--fa-primary-color':     poi.color,
                                               '--fa-secondary-color':   bg,
                                               '--fa-primary-opacity':   1,
                                               '--fa-secondary-opacity': 1,
                                           }
                                       }, [poi.id, poi.bgColor, poi.color])

                                       /** Dynamic class names */
                                       const classes = useMemo(
                                           () => classNames('edit-map-poi-item', {
                                               'map-poi-starter': poi.type === POI_STARTER_TYPE,
                                           }),
                                           [poi.type],
                                       )

                                       // Early exit if POI no longer exists
                                       if (!poi.id) {
                                           return null
                                       }

                                       return (
                                           <div className="edit-map-poi-item-wrapper">
                                               <POIBulkToggle
                                                   id={id}
                                                   toggleBulk={toggleBulk}
                                               />

                                               <POIDetailsWrapper
                                                   id={id}
                                                   $poiProxy={$poiProxy}
                                                   classes={classes}
                                                   styles={styles}
                                                   preventDrawerClose={preventDrawerClose}
                                                   poi={poi}
                                               />
                                           </div>
                                       )
                                   },
                                   // Custom comparison – re-render only when the POI id changes or props change
                                   (prev, next) => prev.id === next.id)

MapPOIListItem.displayName = 'MapPOIListItem'