/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-23
 * Last modified: 2025-02-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { EditMapPOI }                                         from '@Components/MainUI/MapPOI/EditMapPOI'
import { POI_STARTER_TYPE, POI_TMP_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import { faMask }                                             from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon }                                    from '@fortawesome/react-fontawesome'
import { SlDetails }                                          from '@shoelace-style/shoelace/dist/react'
import { UIToast }                                            from '@Utils/UIToast'
import classNames                                             from 'classnames'
import { Fragment, useEffect, useRef }                        from 'react'
import { useSnapshot }                                        from 'valtio/index'

export const MapPOIList = () => {

    const poiList = useRef(null)
    const store = lgs.mainProxy.components.pois
    const pois = useSnapshot(store)
    const prefix = 'edit-map-poi-'
    const drawers = useSnapshot(lgs.mainProxy.drawers)

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

    useEffect(() => {
        __.ui.drawerManager.clean()
    }, [store.current.id])

    const selectPOI = async (event) => {
        if (window.isOK(event)) {
            const id = event.target.id.split(`${prefix}`)[1]
            if (drawers.open === POIS_EDITOR_DRAWER && drawers.action === 'edit-current' && store.current.id !== id) {
                store.current = pois.list.get(id)
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
                                   open={id === pois.current.id && drawers.action === 'edit-current'}
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

