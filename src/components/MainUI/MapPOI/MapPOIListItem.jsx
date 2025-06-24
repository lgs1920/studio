/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-23
 * Last modified: 2025-06-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIContent }                        from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOIEditMenu }                       from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { snapshot, useSnapshot }                from 'valtio'
import { FontAwesomeIcon }                      from '@Components/FontAwesomeIcon'
import { MapPOIEditContent }                    from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { ToggleStateIcon }                      from '@Components/ToggleStateIcon'
import { POIS_EDITOR_DRAWER, POI_STARTER_TYPE } from '@Core/constants'
import { faMask, faSquare, faSquareCheck }      from '@fortawesome/pro-regular-svg-icons'
import { SlDetails }                            from '@shoelace-style/shoelace/dist/react'
import { UIToast }                              from '@Utils/UIToast'
import classNames                               from 'classnames'

// Pre-defined icons
const ICONS = {
    true:  faSquareCheck,
    false: faSquare,
}

/**
 * A memoized React component for displaying a single Point of Interest (POI) item in a list.
 * @param {Object} props - Component props
 * @param {string} props.id - The unique ID of the POI
 * @param {Object} props.poi - The POI object
 * @returns {JSX.Element} The rendered POI list item
 */
export const MapPOIListItem = memo(({id, poi, context}) => {
    const $pois = lgs.stores.main.components.pois
    const current = useSnapshot($pois, {sync: true}).current
    const {bulkList} = useSnapshot($pois, {sync: true})

    const drawerOpen = useSnapshot(lgs.stores.main.drawers).open

    // Memoized bulk list handler
    const handleBulkList = useCallback(
        (state) => {
            $pois.bulkList.set(id, state)
        },
        [id, bulkList],
    )

    // Memoized copy coordinates handler
    const handleCopyCoordinates = useCallback(() => {
        __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() => {
            UIToast.success({
                                caption: `${poi.name}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }, [poi])

    // Memoized select POI handler
    const selectPOI = useCallback(async (event) => {
        if (window.isOK(event)) {
            let thePOI = $pois.list.get(id)
            let forceFocus = false

            if (current === false) {
                $pois.current = id
                forceFocus = true
            }

            if (current !== id || forceFocus) {
                $pois.current = id
                thePOI = {
                    ...thePOI,
                    animated: false,
                }
                $pois.list.set(id, thePOI)

                if (drawerOpen === POIS_EDITOR_DRAWER) {
                    thePOI = $pois.filtered.global.get(id)
                }
                else {
                    thePOI = $pois.filtered.journey.get(id)
                }

                if (lgs.settings.ui.poi.focusOnEdit && drawerOpen === POIS_EDITOR_DRAWER && __.ui.drawerManager.over) {
                    const camera = lgs.mainProxy.components.camera
                    if (__.ui.cameraManager.isRotating()) {
                        await __.ui.cameraManager.stopRotate()
                        thePOI.stopAnimation?.()
                    }
                    __.ui.sceneManager.focus(thePOI, {
                        target: thePOI,
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
                        thePOI.startAnimation?.()
                    }
                }
            }

            const item = document.getElementById(`edit-map-poi-${id}`)
            if (item) {
                item.scrollIntoView({behavior: 'smooth', block: 'start'})
                item.focus()
            }
        }
    }, [id])

    // Memoized styles
    const styles = useMemo(
        () => ({
            '--map-poi-bg-header':  __.ui.ui.hexToRGBA(poi.bgColor ?? lgs.colors.poiDefaultBackground, 'rgba', 0.2),
            '--fa-primary-color':   poi.color,
            '--fa-secondary-color': poi.bgColor,
            '--fa-primary-opacity':   1,
            '--fa-secondary-opacity': 1,
        }),
        [poi.bgColor, poi.color],
    )

    // Memoized classes
    const classes = useMemo(
        () =>
            classNames('edit-map-poi-item', {
                'map-poi-hidden':  !poi.visible,
                'map-poi-starter': poi.type === POI_STARTER_TYPE,
            }),
        [poi.visible, poi.type],
    )


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
                        {poi.title}
                    </div>
                    <span></span>
                </div>
                <MapPOIEditContent context={context} poi={poi}/>
            </SlDetails>
        </div>
    )
})