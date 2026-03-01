/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-01
 * Last modified: 2026-03-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 ******************************************************************************/

import { MapPOIContent }              from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOIEditContent }          from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { ToggleStateIcon }         from '@Components/ToggleStateIcon'
import { POI_STARTER_TYPE, POI_TMP_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import { faSquare, faSquareCheck } from '@fortawesome/pro-regular-svg-icons'
import { SlDetails }                  from '@shoelace-style/shoelace/dist/react'
import { UIToast }                    from '@Utils/UIToast'
import classNames                     from 'classnames'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot }                from 'valtio'

const ICONS = {true: faSquareCheck, false: faSquare}

/**
 * Bulk selection toggle component using a sync snapshot for precise UI updates
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
 * Main wrapper for POI details, handling selection and engine focus
 */
const POIDetailsWrapper = ({id, $poi, classes, styles, preventDrawerClose}) => {
    const $pois = lgs.stores.main.components.pois
    const {current} = useSnapshot($pois, {sync: true})
    const {open: drawerOpen} = useSnapshot(lgs.stores.ui.drawers, {sync: true})

    const poi = useSnapshot($poi)
    const isCurrent = current === id
    const isGlobalDrawer = drawerOpen === POIS_EDITOR_DRAWER

    /**
     * Handles selection: stops current rotation and focuses camera on proxy object
     */
    const selectPOI = useCallback(async () => {
        $pois.current = id

        if ($poi) {
            $poi.animated = false
        }

        if (lgs.settings.ui.poi.focusOnEdit && isGlobalDrawer) {
            const $camera = lgs.stores.main.components.camera

            if (__.ui.cameraManager.isRotating()) {
                await __.ui.cameraManager.stopRotate()
                $poi?.stopAnimation?.()
            }

            __.ui.sceneManager.focus($poi, {
                target:  $poi,
                heading: $camera.position.heading,
                pitch:   $camera.position.pitch,
                roll:    $camera.position.roll,
                range:      5000,
                infinite:   false,
                rpm:        lgs.settings.ui.poi.rpm,
                rotations:  1,
                rotate:     lgs.settings.ui.poi.rotate,
                panoramic:  false,
                flyingTime: 2,
            })

            if (lgs.settings.ui.poi.rotate) {
                $poi?.startAnimation?.()
            }
        }

        const element = document.getElementById(`edit-map-poi-${id}`)
        element?.scrollIntoView({behavior: 'smooth', block: 'start'})
    }, [id, isGlobalDrawer, $pois, $poi])

    const handleSummaryClick = useCallback((event) => {
        event.preventDefault()
        event.stopPropagation()
        if (current === id) {
            $pois.current = false
            return
        }
        selectPOI()
    }, [current, id, selectPOI, $pois])

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
            data-poi-id={id}
            style={styles}
            open={isCurrent}
            small
            onSlAfterHide={preventDrawerClose}
        >
            <div slot="summary" onClick={handleSummaryClick}>
                <div className="map-poi-summary-content">
                    <MapPOIContent poi={id} useInMenu={true}/>
                    <span>{poi.title}</span>
                </div>
            </div>
            {editContent}
        </SlDetails>
    )
}

export const MapPOIListItem = memo(({id}) => {
    const $pois = lgs.stores.main.components.pois
    const DEFAULT_POI_BG = lgs.colors.poiDefaultBackground

    const $poi = $pois.list.get(id)
    const poi = useSnapshot($poi || {})

    const toggleBulk = useCallback(
        state => $pois.bulkList.set(id, state),
        [id, $pois.bulkList],
    )

    const preventDrawerClose = useCallback(event => {
        event.stopPropagation()
        event.preventDefault()
    }, [])

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
    }, [poi.id, poi.bgColor, poi.color, DEFAULT_POI_BG])

    const classes = useMemo(
        () => classNames('edit-map-poi-item', {
            'map-poi-starter': poi.type === POI_STARTER_TYPE,
            'map-poi-temp':    poi.type === POI_TMP_TYPE,
            'map-poi-hidden':  !poi.visible,
        }),
        [poi.type, poi.visible],
    )

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
                $poi={$poi}
                classes={classes}
                styles={styles}
                preventDrawerClose={preventDrawerClose}
            />
        </div>
    )
}, (prev, next) => prev.id === next.id)

MapPOIListItem.displayName = 'MapPOIListItem'