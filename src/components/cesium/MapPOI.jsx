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

export const MapPOI = memo(({point: pointId}) => {

    const store = lgs.mainProxy.components.pois.list
    const snap = useSnapshot(store)
    const point = snap.get(pointId) // Récupère les informations du POI
    const viewable = useSnapshot(lgs.mainProxy.components.pois.visibleList)

    if (!point || !point.latitude || !point.longitude) {
        return null
    }

    const poi = useRef(null)
    const [pixels, setPixels] = useState({x: 0, y: 0})

    // Callback pour calculer les pixels
    const getPixelsCoordinates = useCallback(() => {

        // Check if the point is front of terrain
                                                 store.get(point.id).frontOfTerrain = POIUtils.isPointVisible(point.coordinates)
        // If so, we have some settings
                                                 if (store.get(point.id).frontOfTerrain) {
                                                     // translate coordinates to pixels
                                                     const coordinates = SceneUtils.getPixelsCoordinates(point.coordinates)
                                                     if (coordinates) {
                                                         setPixels((prev) =>
                                                                       prev.x !== coordinates.x || prev.y !== coordinates.y ? coordinates : prev,
                                                         )
                                                     }

                                                     // Set visibility, scale, flag mode, camera distance
                                                     Object.assign(
                                                         store.get(point.id),
                                                         POIUtils.adaptScaleToDistance(point.coordinates),
                                                     )
                                                     const poi = store.get(point.id)

                                                     const min = Math.min(...Array.from(store.values()).map(poi => poi.cameraDistance))
                                                     const max = Math.max(...Array.from(store.values()).map(poi => poi.cameraDistance))

                                                     if (min && max && poi.withinScreen && poi.frontOfTerrain && poi.visible && !poi.tooFar) {
                                                         lgs.mainProxy.components.pois.visibleList.set(poi.id, Math.round((max - poi.cameraDistance) / (max - min) * lgs.mainProxy.components.pois.visibleList.size)) + 1
                                                     }
                                                     else {
                                                         lgs.mainProxy.components.pois.visibleList.delete(poi.id)
                                                     }
                                                 }
                                             }

        , [point],
    )

    useEffect(() => {
        lgs.scene.preRender.addEventListener(getPixelsCoordinates)
        return () => {
            lgs.scene.preRender.removeEventListener(getPixelsCoordinates)
        }
    }, [getPixelsCoordinates])

    useEffect(() => {
        if (poi.current) {
            __.ui.poiManager.observer.observe(poi.current)
        }
        return () => {
            if (poi.current) {
                __.ui.poiManager.observer.unobserve(poi.current)
            }
        }
    })

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
                        (point?.showFlag || !point?.expanded) && !point?.over ? 'poi-shrinked' : '',
                    )}
                    ref={poi}
                    id={point.id}
                    style={{
                        bottom:                       window.innerHeight - pixels.y,
                        left:                         pixels.x,
                        transform:                    `translate( -50%,calc(-4 * var(--poi-border-width))) scale(${point?.scale ?? 1})`,
                        transformOrigin:              'center bottom',
                        '--lgs-poi-background-color': point.bgColor ?? lgs.colors.poiDefaultBackground,
                        '--lgs-poi-border-color':     point.color ?? lgs.colors.poiDefault,
                        '--lgs-poi-color':            point.color ?? lgs.colors.poiDefault,
                        zIndex: viewable.get(point.id),
                    }}
                    onPointerMove={__.ui.sceneManager.propagateEventToCanvas}
                    onWheel={hideMenu}
                >
                    {point.withinScreen && point.frontOfTerrain && point.visible && !point.tooFar &&
                        <MapPOIContent id={point.id} hide={hideMenu}/>
                    }
                </div>
            }
        </>
    )
})

