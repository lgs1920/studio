import { POIUtils }                                 from '@Utils/cesium/POIUtils'
import { SceneUtils }                               from '@Utils/cesium/SceneUtils'
import { UIUtils }                                  from '@Utils/UIUtils'
import { ELEVATION_UNITS }                          from '@Utils/UnitUtils'
import classNames                                   from 'classnames'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TextValueUI }                              from '../TextValueUI/TextValueUI'


export const POI = ({point}) => {

    if (point === undefined) {
        return null
    }

    const poi = useRef(null)
    const [_point, updatePoint] = useState(point)

    const [pixels, setPixels] = useState({x: 0, y: 0})

    const getPixelsCoordinates = useCallback(() => {
        const tmp = {}
        tmp.frontOfTerrain = POIUtils.isPointVisible(point)

        if (tmp.frontOfTerrain) {
            const coordinates = SceneUtils.getPixelsCoordinates(point)
            if (coordinates) {
                setPixels(coordinates)
            }

            const {scale, flagVisible, visible} = POIUtils.adaptScaleToDistance(point)
            tmp.scale = scale
            tmp.showFlag = flagVisible
            tmp.showPOI = visible

            if (Object.keys(tmp).some(attribute => point[attribute] !== tmp[attribute])) {
                updatePoint(__.ui.poiManager.update(poi.current.id, tmp))
                point = _point
            }
        }

    }, [])

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
                    className={classNames(
                        'poi-on-map-wrapper',
                        'lgs-slide-in-from-top-bounced',
                        _point?.showFlag ? 'show-flag' : '')
                    }
                    ref={poi}
                    id={_point.id}
                    style={{
                        bottom:            window.innerHeight - pixels.y,
                        left:              pixels.x,
                        transform:         `scale(${_point?.scale ?? 1})`,
                        transformOrigin:   'left bottom',
                        '--lgs-poi-color': _point.color ?? lgs.settings.ui.poi.defaultColor,
                    }}
                >
                    {_point?.withinScreenLimits && _point?.frontOfTerrain && _point?.showPOI &&
                        <div className="poi-on-map">
                            {!_point.showFlag &&
                                <div className="poi-on-map-inner">
                                    <h3>{_point.title}</h3>
                                    <div className="poi-full-coordinates">
                                        {_point.elevation && (
                                            <TextValueUI
                                                text={'Elevation: '}
                                                value={_point.elevation}
                                                format={'%d'}
                                                units={ELEVATION_UNITS}
                                            />
                                        )}
                                        <div className="poi-coordinates">
                                            <span>{UIUtils.toDMS(_point.latitude)}, {UIUtils.toDMS(_point.longitude)}</span>
                                            <br/>
                                            <span>[{_point.latitude}, {_point.longitude}]</span>
                                            <br/>
                                        </div>
                                    </div>
                                </div>
                            }
                            {_point.showFlag &&
                                <div className="flag-as-triangle"></div>
                            }
                            <div className="poi-on-map-marker"></div>
                        </div>
                    }
                </div>
            }
        </>
    )
}
