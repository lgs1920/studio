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
    const isCameraIdle = useRef(false)

    if (!point || !point.latitude || !point.longitude) {
        return null
    }

    const poi = useRef(null)
    const [pixels, setPixels] = useState({x: 0, y: 0})

    const getPixelsCoordinates = useCallback(async () => {

        __.ui.sceneManager.degreesToPixelsCoordinates(point.coordinates, false).then(coordinates => {
            if (!coordinates.visible) {
                return
            }

            store.get(point.id).frontOfTerrain = coordinates.visible
                                                 if (store.get(point.id).frontOfTerrain) {

                                                     // translate coordinates to pixels
                                                     setPixels((prev) =>
                                                                   prev.x !== coordinates.x || prev.y !== coordinates.y ? coordinates : prev,
                                                     )

                                                     // Set visibility, scale, flag mode, camera distance
                                                     Object.assign(
                                                         store.get(point.id),
                                                         POIUtils.adaptScaleToDistance(point.coordinates),
                                                     )
                                                     const poi = store.get(point.id)

                                                     const min = Math.min(...Array.from(store.values()).map(poi => poi.cameraDistance))
                                                     const max = Math.max(...Array.from(store.values()).map(poi => poi.cameraDistance))
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
                                             }, [point],
    )

    useEffect(() => {
        lgs.scene.postRender.addEventListener(getPixelsCoordinates)
        return () => {
            lgs.scene.postRender.removeEventListener(getPixelsCoordinates)
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
    }, [poi.current])

    // Camera idle detection using moveStart and moveEnd
    useEffect(() => {
        let animationFrameId // Store the animation frame ID

        const syncWithFPS = () => {
            getPixelsCoordinates() // Logic synchronized with FPS
            animationFrameId = requestAnimationFrame(syncWithFPS) // Request the next frame
        }

        const handleCameraMoveStart = () => {
            isCameraIdle.current = false // Camera is active
            console.log('Camera started moving')
            getPixelsCoordinates() // Initial update
            syncWithFPS() // Start synchronization
        }

        const handleCameraMoveEnd = () => {
            isCameraIdle.current = true // Camera is idle
            console.log('Camera stopped moving')
            if (animationFrameId) {
                getPixelsCoordinates() // Logic synchronized with FPS
                cancelAnimationFrame(animationFrameId) // Stop synchronization
            }
        }

        // Add event listeners
        lgs.scene.camera.moveStart.addEventListener(handleCameraMoveStart)
        lgs.scene.camera.moveEnd.addEventListener(handleCameraMoveEnd)

        // Cleanup listeners and cancel animation frame
        return () => {
            lgs.scene.camera.moveStart.removeEventListener(handleCameraMoveStart)
            lgs.scene.camera.moveEnd.removeEventListener(handleCameraMoveEnd)
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId)
            }
        }
    }, [getPixelsCoordinates])

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

