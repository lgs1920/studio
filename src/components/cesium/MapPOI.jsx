/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-03-02
 * Last modified: 2025-02-28
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIContent }                                  from '@Components/MainUI/MapPOI/MapPOIContent'
import { POIUtils }                                       from '@Utils/cesium/POIUtils'
import { SceneUtils }                                     from '@Utils/cesium/SceneUtils'
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
    const [pixels, setPixels] = useState({x: 0, y: 0})

    const getPixelsCoordinates = useCallback(async () => {

                                                 __.ui.sceneManager.degreesToPixelsCoordinates(thePOI.coordinates, false).then(coordinates => {
            if (!coordinates.visible) {
                return
            }

                                                     $list.get(thePOI.id).frontOfTerrain = coordinates.visible
                                                     if ($list.get(thePOI.id).frontOfTerrain) {

                                                     // translate coordinates to pixels
                                                     setPixels((prev) =>
                                                                   prev.x !== coordinates.x || prev.y !== coordinates.y ? coordinates : prev,
                                                     )

                                                     // Set visibility, scale, flag mode, camera distance
                                                     Object.assign(
                                                         $list.get(thePOI.id),
                                                         POIUtils.adaptScaleToDistance(thePOI.coordinates),
                                                     )
                                                         const poi = $list.get(thePOI.id)

                                                         const min = Math.min(...Array.from($list.values()).map(poi => poi.cameraDistance))
                                                         const max = Math.max(...Array.from($list.values()).map(poi => poi.cameraDistance))
                                                     let zIndex = 1
                                                     if (min !== max) { // several POIs
                                                         zIndex = Math.round((max - poi.cameraDistance) / (max - min) * lgs.mainProxy.components.pois.visibleList.size) + 1
                                                     }
                                                     if (min && max && poi.withinScreen && poi.visible && !poi.tooFar) {
                                                         lgs.mainProxy.components.pois.visibleList.set(poi.id, zIndex)
                                                     }
                                                     else {
                                                         lgs.mainProxy.components.pois.visibleList.delete(poi.id)
                                                     }
                                                 }

        })
                                             }, [thePOI],
    )

    useEffect(() => {
        lgs.scene.postRender.addEventListener(getPixelsCoordinates)
        return () => {
            lgs.scene.postRender.removeEventListener(getPixelsCoordinates)
        }
    }, [getPixelsCoordinates])

    useEffect(() => {
        if (_poi.current) {
            __.ui.poiManager.observer.observe(_poi.current)
        }
        return () => {
            if (_poi.current) {
                __.ui.poiManager.observer.unobserve(_poi.current)
            }
        }
    }, [_poi.current])

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
                        (thePOI?.showFlag || !thePOI?.expanded) && !thePOI?.over ? 'poi-shrinked' : '',
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

