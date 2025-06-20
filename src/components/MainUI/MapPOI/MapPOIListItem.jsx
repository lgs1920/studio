/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-20
 * Last modified: 2025-06-20
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
    const pois = useSnapshot($pois)
    const drawers = useSnapshot(lgs.mainProxy.drawers)

    // Stabilize poi object
    const thePOI = useMemo(() => pois.list.get(id) || poi, [id, poi, pois.list])

    console.log(thePOI.title)
    // Memoized bulk list handler
    const handleBulkList = useCallback(
        (state) => {
            $pois.bulkList.set(id, state)
        },
        [id, $pois.bulkList],
    )

    // Memoized copy coordinates handler
    const handleCopyCoordinates = useCallback(() => {
        __.ui.poiManager.copyCoordinatesToClipboard(thePOI).then(() => {
            UIToast.success({
                                caption: `${thePOI.name}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }, [thePOI])

    // Memoized select POI handler
    const selectPOI = useCallback(async (event) => {
        if (window.isOK(event)) {
            let current = $pois.list.get(id)
            let forceFocus = false

            if (pois.current === false) {
                $pois.current = id
                forceFocus = true
            }

            if (pois.current !== id || forceFocus) {
                $pois.current = id
                current = {
                    ...current,
                    animated: false,
                }
                $pois.list.set(id, current)

                if (drawers.open === POIS_EDITOR_DRAWER) {
                    current = $pois.filtered.global.get(id)
                }
                else {
                    current = $pois.filtered.journey.get(id)
                }

                if (lgs.settings.ui.poi.focusOnEdit && drawers.open === POIS_EDITOR_DRAWER && __.ui.drawerManager.over) {
                    const camera = lgs.mainProxy.components.camera
                    if (__.ui.cameraManager.isRotating()) {
                        await __.ui.cameraManager.stopRotate()
                        current.stopAnimation?.()
                    }
                    __.ui.sceneManager.focus(current, {
                        target:     current,
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
                        current.startAnimation?.()
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
            '--map-poi-bg-header':  __.ui.ui.hexToRGBA(thePOI.bgColor ?? lgs.colors.poiDefaultBackground, 'rgba', 0.2),
            '--fa-primary-color':   thePOI.color,
            '--fa-secondary-color': thePOI.bgColor,
            '--fa-primary-opacity':   1,
            '--fa-secondary-opacity': 1,
        }),
        [thePOI.bgColor, thePOI.color],
    )

    // Memoized classes
    const classes = useMemo(
        () =>
            classNames('edit-map-poi-item', {
                'map-poi-hidden':  !thePOI.visible,
                'map-poi-starter': thePOI.type === POI_STARTER_TYPE,
            }),
        [thePOI.visible, thePOI.type],
    )


    return (
        <div className="edit-map-poi-item-wrapper">
            <ToggleStateIcon
                initial={pois.bulkList.get(id)}
                className="map-poi-bulk-indicator"
                icons={ICONS}
                onChange={handleBulkList}
                id={`bulk-map-poi-${id}`}
            />
            <SlDetails
                className={classes}
                id={`edit-map-poi-${id}`}
                onSlAfterShow={selectPOI}
                open={pois.current === id}
                small
                style={styles}
            >
                <div slot="summary">
                    <div>
                        <MapPOIContent poi={thePOI.id} useInMenu={true}/>
                        {thePOI.title}
                    </div>
                    <span></span>
                </div>
                <MapPOIEditContent context={context} poi={thePOI}/>
            </SlDetails>
        </div>
    )
})