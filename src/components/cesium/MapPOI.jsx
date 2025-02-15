import { SECOND }                                         from '@Core/constants'
import { POIUtils }                                       from '@Utils/cesium/POIUtils'
import { SceneUtils }                                     from '@Utils/cesium/SceneUtils'
import { UIUtils }                                        from '@Utils/UIUtils'
import { ELEVATION_UNITS }                                from '@Utils/UnitUtils'
import classNames                                         from 'classnames'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import Timeout                                            from 'smart-timeout'
import { useSnapshot }                                    from 'valtio'
import { TextValueUI }                                    from '../TextValueUI/TextValueUI'

export const MapPOI = memo(({point: pointId}) => {
    const snap = useSnapshot(lgs.mainProxy.components.pois.list)
    const point = snap.get(pointId) // Récupère les informations du POI

    if (!point || !point.latitude || !point.longitude) {
        return null
    }

    const poi = useRef(null)
    const [pixels, setPixels] = useState({x: 0, y: 0})
    const inner = useRef(null)

    // Callback pour calculer les pixels
    const getPixelsCoordinates = useCallback(() => {

        // Check if the point is front ofterrain
        lgs.mainProxy.components.pois.list.get(point.id).frontOfTerrain = POIUtils.isPointVisible(point.coordinates)
        // If so, we have some settings
        if (lgs.mainProxy.components.pois.list.get(point.id).frontOfTerrain) {
            // translate coordinates to pixels
            const coordinates = SceneUtils.getPixelsCoordinates(point.coordinates)
            if (coordinates) {
                setPixels((prev) =>
                              prev.x !== coordinates.x || prev.y !== coordinates.y ? coordinates : prev,
                )
            }
            // Set visibility, scale, flag mode
            Object.assign(
                lgs.mainProxy.components.pois.list.get(point.id),
                POIUtils.adaptScaleToDistance(point.coordinates),
            )
        }

    }, [point, snap])

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
        lgs.mainProxy.components.pois.current = false
        if (event) {
            __.ui.sceneManager.propagateEventToCanvas(event)
        }
    }

    const handleContextMenu = (event) => {
        event.preventDefault()
        if (!__.ui.cameraManager.isRotating()) {
            lgs.mainProxy.components.pois.context.visible = true
            lgs.mainProxy.components.pois.current = point
            __.ui.sceneManager.propagateEventToCanvas(event)
        }
    }

    // Composant pour le contenu du POI
    const POIContent = ({point}) => {
        return (
            <div className="poi-on-map">
                <div
                    className="poi-on-map-inner"
                    ref={inner}
                    onContextMenu={handleContextMenu}
                    onPointerLeave={() => {
                        Timeout.set(
                            lgs.mainProxy.components.pois.context.timer,
                            hideMenu,
                            0.8 * SECOND,
                        )
                    }}
                >
                    {!point.showFlag && (
                        <>
                            <h3>{point.title ?? 'Point Of Interest'}</h3>
                            {point.scale > 0.6 && (
                                <div className="poi-full-coordinates">
                                    {!point.simulatedHeight && (
                                        <TextValueUI
                                            className="poi-elevation"
                                            text={'Elevation: '}
                                            value={point.height}
                                            format={'%d'}
                                            units={ELEVATION_UNITS}
                                        />
                                    )}
                                    {point.simulatedHeight && <span>&nbsp</span>}
                                    <div className="poi-coordinates">
                                        <span>
                                            {UIUtils.toDMS(point.latitude)},{' '}
                                            {UIUtils.toDMS(point.longitude)}
                                        </span>
                                        <br/>
                                        <span>
                                            [{sprintf('%.5f', point.latitude)},{' '}
                                            {sprintf('%.5f', point.longitude)}]
                                        </span>
                                        <br/>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {point.showFlag && <div className="flag-as-triangle">&nbsp</div>}
                </div>
                <div className="poi-on-map-marker"></div>
            </div>
        )
    }
    return (
        <>
            {pixels && (
                <div
                    className={classNames(
                        'poi-on-map-wrapper',
                        'lgs-slide-in-from-top-bounced',
                        point?.showFlag ? 'show-flag' : '',
                    )}
                    ref={poi}
                    id={point.id}
                    style={{
                        bottom:                     window.innerHeight - pixels.y,
                        left:                       pixels.x,
                        transform:                  `scale(${point?.scale ?? 1})`,
                        transformOrigin:            'left bottom',
                        '--lgs-poi-color':          point.color ?? lgs.settings.ui.poi.defaultColor,
                        '--lgs-poi-gradient-color': __.ui.ui.hexToRGBA(
                            point.color ?? lgs.settings.ui.poi.defaultColor,
                            'rgba',
                            0.3,
                        ),
                    }}
                    onPointerMove={__.ui.sceneManager.propagateEventToCanvas}
                    onPointerDown={hideMenu}
                    onPointerUp={hideMenu}
                    onWheel={hideMenu}
                >
                    {point.withinScreenLimits && point.frontOfTerrain && point.visible &&
                        <POIContent point={point}/>
                    }
                </div>
            )}
        </>
    )
})

