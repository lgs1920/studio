/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 *
 * File: MapPOIList.jsx
 * Path: /home/christian/devs/assets/lgs1920/studio/src/components/MainUI/MapPOI/MapPOIList.jsx
 *
 * Author : Christian Denat
 * email: christian.denat@orange.fr
 *
 * Created on: 2025-02-22
 * Last modified: 2025-02-22
 *
 *
 * Copyright © 2025 LGS1920
 *
 ******************************************************************************/

import { EditMapPOI }                     from '@Components/MainUI/MapPOI/EditMapPOI'
import { POI_STARTER_TYPE, POI_TMP_TYPE } from '@Core/constants'
import { faMask }                         from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon }                from '@fortawesome/react-fontawesome'
import { SlDetails }                      from '@shoelace-style/shoelace/dist/react'
import { UIToast }                        from '@Utils/UIToast'
import classNames                         from 'classnames'
import { Fragment, useEffect, useRef }    from 'react'
import { snapshot, useSnapshot }          from 'valtio/index'

export const MapPOIList = () => {

    const poiList = useRef(null)
    const store = lgs.mainProxy.components.pois
    const pois = useSnapshot(store)
    const prefix = 'edit-map-poi-'

    const handleCopyCoordinates = (poi) => {
        __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() => {
            UIToast.success({
                                caption: `${poi.name}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }
    useEffect(() => {
        __.ui.ui.initDetailsGroup(poiList.current)
    }, [])

    const selectPOI = async (event) => {
        if (window.isOK(event)) {
            const id = event.target.id.split(`${prefix}`)[1]
            store.current = pois.list.get(id)
            const camera = snapshot(lgs.mainProxy.components.camera)
            if (__.ui.cameraManager.isRotating()) {
                await __.ui.cameraManager.stopRotate()
            }
            else if (lgs.settings.ui.poi.focusOnEdit) {
                __.ui.sceneManager.focus(pois.list.get(id), {
                    heading:    camera.position.heading,
                    pitch:      camera.position.pitch,
                    roll:       camera.position.roll,
                    range:      5000,
                    infinite:   true,
                    rotate:     false,
                    panoramic:  false,
                    flyingTime: 0,
                })
            }
        }
    }

    return (
        <div id={'edit-map-poi-list'} ref={poiList}>
            {Array.from(pois.list.entries()).map(([id, poi]) => (
                <Fragment key={`${prefix}${id}`}>
                    {poi.type !== POI_TMP_TYPE &&
                        <SlDetails className={classNames(
                            `edit-map-poi-item`,
                            poi.visible ? undefined : 'map-poi-hidden',
                            poi.type === POI_STARTER_TYPE ? 'map-poi-starter' : undefined,
                        )}
                                   id={`${prefix}${id}`}

                                   onSlAfterShow={selectPOI}
                                   small
                                   style={{'--map-poi-bg-header': __.ui.ui.hexToRGBA(poi.color, 'rgba', 0.2)}}>
                            <div slot="summary">
                                       <span>
                                       <FontAwesomeIcon icon={poi.visible ? poi.icon : faMask} style={{
                                           '--fa-secondary-color':   poi.color,
                                           '--fa-secondary-opacity': 1,
                                       }}/>
                                           {poi.title}
                                       </span>
                                <span>
                                       [{sprintf('%.5f, %.5f', poi.latitude, poi.longitude)}]
                        </span>
                            </div>
                            <EditMapPOI poi={poi}/>
                        </SlDetails>
                    }
                </Fragment>
            ))
            }


        </div>
    )
}

