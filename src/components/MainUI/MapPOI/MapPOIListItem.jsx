/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
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

import { FontAwesomeIcon }                      from '@Components/FontAwesomeIcon'
import { MapPOIContent }                        from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOIEditContent }                    from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { ToggleStateIcon }                      from '@Components/ToggleStateIcon'
import { POI_STARTER_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import { faMask, faSquare, faSquareCheck }      from '@fortawesome/pro-regular-svg-icons'
import { SlDetails }                            from '@shoelace-style/shoelace/dist/react'
import { UIToast }                              from '@Utils/UIToast'
import classNames                               from 'classnames'
import { memo, useCallback, useMemo, useRef } from 'react'
import { useSnapshot }                          from 'valtio'

// Pre-defined icons - calculate once
const ICONS = {
    true:  faSquareCheck,
    false: faSquare,
}

/**
 * A memoized React component for displaying a single Point of Interest (POI) item in a list.
 * @param {Object} props - Component props
 * @param {string} props.id - The unique ID of the POI
 * @param {string} props.context - The context identifier
 * @returns {JSX.Element} The rendered POI list item
 */
export const MapPOIListItem = memo(({id}) => {
    const $pois = lgs.stores.main.components.pois
    // Pre-calculate default colors to avoid repeated access
    const DEFAULT_POI_BG = lgs.colors.poiDefaultBackground

    // Fix: Get the current value from the store snapshot, not directly from the primitive
    const pois = useSnapshot($pois, {sync: true})
    const current = pois.current  // Access current from the snapshot
    const {bulkList} = pois

    // Get the specific POI data
    const poi = useMemo(() => pois.list.get(id), [pois.list, id])
    // Get drawer state
    const drawerOpen = useSnapshot(lgs.stores.ui.drawers, {sync: true}).open

    // Cache refs to avoid recreation
    const bulkStateRef = useRef(bulkList.get(id) ?? false)

    // Memoize bulk list handler with stable dependency
    const handleBulkList = useCallback(
        (state) => {
            $pois.bulkList.set(id, state)
            bulkStateRef.current = state
        },
        [id, $pois.bulkList],
    )

    // Memoize copy coordinates handler
    const handleCopyCoordinates = useCallback(() => {
        __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() => {
            UIToast.success({
                                caption: poi.title,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }, [id, poi]) // Only depend on stable identifiers

    // Optimize the select POI handler with better dependency management
    const selectPOI = useCallback(async (event) => {
        if (!window.isOK(event)) {
            return
        }

        let thePOI = $pois.list.get(id)
        const needsNewSelection = current === false || current !== id

        if (needsNewSelection) {
            $pois.current = id

            // Update POI animation state
            thePOI = {
                ...thePOI,
                animated: false,
            }
            $pois.list.set(id, thePOI)

            // Get appropriate filtered POI based on drawer state
            const filteredPOI = drawerOpen === POIS_EDITOR_DRAWER
                                ? $pois.filtered.global.get(id)
                                : $pois.filtered.journey.get(id)

            // Handle focus and animation if needed
            if (lgs.settings.ui.poi.focusOnEdit && drawerOpen === POIS_EDITOR_DRAWER && __.ui.drawerManager.over) {
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
        }

        // Scroll to item - optimize DOM query
        const item = document.getElementById(`edit-map-poi-${id}`)
        if (item) {
            item.scrollIntoView({behavior: 'smooth', block: 'start'})
            item.focus()
        }
    }, [id, current, drawerOpen, $pois])

    // Memoize styles with better performance
    const styles = useMemo(() => {
        if (!poi) {
            return {}
        }

        const bgColor = poi.bgColor ?? DEFAULT_POI_BG
        return {
            '--map-poi-bg-header':    __.ui.ui.hexToRGBA(bgColor, 'rgba', 0.2),
            '--fa-primary-color':     poi.color,
            '--fa-secondary-color':   bgColor,
            '--fa-primary-opacity':   1,
            '--fa-secondary-opacity': 1,
        }
    }, [poi?.bgColor, poi?.color])

    // Memoize classes with fewer dependencies
    const classes = useMemo(() => {
        if (!poi) {
            return 'edit-map-poi-item'
        }

        return classNames('edit-map-poi-item', {
            'map-poi-starter': poi.type === POI_STARTER_TYPE,
        })
    }, [poi?.type])

    // Memoize bulk state to avoid unnecessary re-renders
    const bulkState = useMemo(() =>
                                  bulkList.get(id) ?? false,
                              [bulkList, id]
    )

    // Early return if POI doesn't exist
    if (!poi) {
        return null
    }

    return (
        <div className="edit-map-poi-item-wrapper">
            <ToggleStateIcon
                initial={bulkList.get(id) ?? false}
                className="map-poi-bulk-indicator"
                icons={ICONS}
                onChange={handleBulkList}
                id={`bulk-map-poi-${id}`}
            />
            <SlDetails
                className={classes}
                id={`edit-map-poi-${id}`}
                onSlAfterShow={selectPOI}
                open={current === id}
                small
                style={styles}
            >
                <div slot="summary">
                    <div>
                        <MapPOIContent poi={poi.id} useInMenu={true}/>
                        <span>{poi.title}</span>
                    </div>
                </div>
                {current === id && <MapPOIEditContent poi={poi}/>}
            </SlDetails>
        </div>
    )
}, (prevProps, nextProps) => {
    // Custom comparison function for better memoization
    return prevProps.id === nextProps.id && prevProps.context === nextProps.context
})

MapPOIListItem.displayName = 'MapPOIListItem'