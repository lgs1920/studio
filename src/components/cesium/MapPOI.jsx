/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-17
 * Last modified: 2025-06-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIContent }                                  from '@Components/MainUI/MapPOI/MapPOIContent'
import { POIUtils }                                       from '@Utils/cesium/POIUtils'
import classNames                                         from 'classnames'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                    from 'valtio'

export const MapPOI = memo(({point}) => {

    const $list = lgs.mainProxy.components.pois.list
    const list = useSnapshot($list)
    const thePOI = list.get(point) // Récupère les informations du POI
    const viewable = useSnapshot(lgs.mainProxy.components.pois.visibleList)

    if (!thePOI || !thePOI.latitude || !thePOI.longitude) {
        return null
    }

    const _poi = useRef(null)

    const hideMenu = (event) => {
        lgs.mainProxy.components.pois.context.visible = false
        if (event) {
            __.ui.sceneManager.propagateEventToCanvas(event)
        }
    }
    return (
        <>
            {pixels &&
                <div
                    className={classNames(
                        'poi-on-map-wrapper',
                        'lgs-slide-in-from-top-bounced',
                        thePOI?.expanded ? 'poi-shrinked' : '',
                    )}
                    ref={_poi}
                    id={thePOI.id}
                    style={{
                        bottom:                       window.innerHeight - pixels.y,
                        left:                         pixels.x,
                        transform:                    `translate( -50%,calc(-4 * var(--poi-border-width))) scale(${thePOI?.scale ?? 1})`,
                        transformOrigin:              'center bottom',
                        '--lgs-poi-background-color': thePOI.bgColor ?? lgs.colors.poiDefaultBackground,
                        '--lgs-poi-border-color':     thePOI.color ?? lgs.colors.poiDefault,
                        '--lgs-poi-color':            thePOI.color ?? lgs.colors.poiDefault,
                        zIndex:                       viewable.get(thePOI.id),
                    }}
                    onPointerMove={__.ui.sceneManager.propagateEventToCanvas}
                    onWheel={hideMenu}
                >
                    {thePOI.withinScreen && thePOI.frontOfTerrain && thePOI.visible && !thePOI.tooFar &&
                        <MapPOIContent id={thePOI.id} hide={hideMenu}/>
                    }
                </div>
            }
        </>
    )
})

