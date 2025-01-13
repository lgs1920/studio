import { SceneUtils }                               from '@Utils/cesium/SceneUtils'
import { ELEVATION_UNITS }                          from '@Utils/UnitUtils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                              from 'valtio'
import { UIUtils }                                  from '../../Utils/UIUtils'
import { TextValueUI }                              from '../TextValueUI/TextValueUI'

export const POI = ({point}) => {
    const poi = useRef(null)
    const isVisible = useSnapshot(lgs.mainProxy.components.poi.entries)

    const [pixels, setPixels] = useState({x: 0, y: 0})

    const getPixelsCoordinates = useCallback(() => {
        const coordinates = SceneUtils.getPixelsCoordinates(point)
        if (coordinates) {
            setPixels(coordinates)
        }
    }, [point])

    useEffect(() => {
        window.addEventListener('resize', getPixelsCoordinates)
        lgs.camera.changed.addEventListener(getPixelsCoordinates)
        getPixelsCoordinates() // Initial call to set coordinates

        return () => {
            window.removeEventListener('resize', getPixelsCoordinates)
            lgs.camera.changed.removeEventListener(getPixelsCoordinates)
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
    }, [])


    return (
        <>
            {pixels &&
                <div
                    className="poi-on-map-wrapper lgs-slide-in-from-top-bounced"
                    ref={poi}
                    style={{
                        bottom: window.innerHeight - pixels.y,
                        left:   pixels.x,
                    }}
                >
                    {isVisible.get(poi.current) &&
                        <div className="poi-on-map">
                            <div className="poi-on-map-inner">
                                <h3>{point.title}</h3>
                                <div className="poi-full-coordinates">
                                    {point.elevation && (
                                        <TextValueUI
                                            text={'Elevation: '}
                                            value={point.elevation}
                                            format={'%d'}
                                            units={ELEVATION_UNITS}
                                        />
                                    )}
                                    <div className="poi-coordinates">
                                        <span>{UIUtils.toDMS(point.latitude)}, {UIUtils.toDMS(point.longitude)}</span>
                                        <br/>
                                        <span>[{point.latitude}, {point.longitude}]</span>
                                        <br/>
                                    </div>
                                </div>
                            </div>
                            <div className="poi-on-map-marker"></div>
                        </div>
                    }
                </div>
            }
        </>
    )
}
