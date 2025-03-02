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

    if (!point || !point.latitude || !point.longitude) {
        return null
    }

    const poi = useRef(null)
    const [pixels, setPixels] = useState({x: 0, y: 0})

    // Callback pour calculer les pixels
    const getPixelsCoordinates = useCallback(() => {

        // Check if the point is front of terrain
        lgs.mainProxy.components.pois.list.get(point.id).frontOfTerrain = POIUtils.isPointVisible(point.coordinates)
        // If so, we have some settings
        if (lgs.mainProxy.components.pois.list.get(point.id).frontOfTerrain) {
            // translate coordinates to pixels
            const coordinates = SceneUtils.getPixelsCoordinates(point.coordinates)
            if (coordinates) {
                setPixels((prev) =>
                              prev.x !== coordinates.x || prev.y !== coordinates.y ? coordinates : prev
                )
            }
            // Set visibility, scale, flag mode
            Object.assign(
                lgs.mainProxy.components.pois.list.get(point.id),
                POIUtils.adaptScaleToDistance(point.coordinates),
            )
        }

    }, [point])

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

    const expand = () => {
        if (!point.expanded && !point.showFlag) {
            Object.assign(
                store.get(point.id),
                {over: true},
            )
        }
    }

    const reduce = () => {
        Object.assign(
            store.get(point.id),
            {over: false},
        )
    }

    return (
        <>
            {pixels && (
                <div
                    className={classNames(
                        'poi-on-map-wrapper',
                        'lgs-slide-in-from-top-bounced',
                        (point?.showFlag || !point?.expanded) && !point?.over ? 'poi-shrinked' : '',
                    )}
                    ref={poi}
                    id={`${point.id}`}
                    style={{
                        bottom:                     window.innerHeight - pixels.y,
                        left:                       pixels.x,
                        transform:                  `scale(${point?.scale ?? 1})`,
                        transformOrigin:            'left bottom',
                        '--lgs-poi-color':          point.color ?? lgs.settings.poi.defaultColor,
                        '--lgs-poi-gradient-color': __.ui.ui.hexToRGBA(
                            point.color ?? lgs.settings.poi.defaultColor,
                            'rgba',
                            0.3,
                        ),
                    }}
                    onPointerMove={__.ui.sceneManager.propagateEventToCanvas}
                    onPointerEnter={expand}
                    onPointerLeave={reduce}

                    onWheel={hideMenu}
                >
                    {point.withinScreen && point.frontOfTerrain && point.visible && !point.tooFar &&
                        <MapPOIContent id={point.id} hide={hideMenu}/>
                    }
                </div>
            )}
        </>
    )
})

