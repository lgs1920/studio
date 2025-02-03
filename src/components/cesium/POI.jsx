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

    if (point.simulatedHeight) {
        point.height = undefined
    }

    const poi = useRef(null)
    const [_point, updatePoint] = useState(point)
    const [pixels, setPixels] = useState({x: 0, y: 0})
    const animationFrameId = useRef(null)
    const [color] = useState(_point.color ?? lgs.settings.ui.poi.defaultColor)

    // lgs.viewer.zoomTo(lgs.viewer.entities)

    const getPixelsCoordinates = useCallback(() => {
        const tmp = {}

        tmp.frontOfTerrain = POIUtils.isPointVisible(_point)

        if (tmp.frontOfTerrain) {
            const coordinates = SceneUtils.getPixelsCoordinates(_point)
            if (coordinates) {
                setPixels(coordinates)
            }

            const {scale, flagVisible, visible} = POIUtils.adaptScaleToDistance(_point)
            tmp.scale = scale
            tmp.showFlag = flagVisible
            tmp.showPOI = visible
        }
        if (Object.keys(tmp).some(attribute => _point[attribute] !== tmp[attribute])) {
            updatePoint(__.ui.poiManager.update(poi.current.id, tmp))
        }
        point = _point


    }, [_point])


    useEffect(() => {
        lgs.scene.preRender.addEventListener(getPixelsCoordinates)

        return () => {
            lgs.scene.preRender.removeEventListener(getPixelsCoordinates)
        }
    }, [])

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
                        '--lgs-poi-color':          color,
                        '--lgs-poi-gradient-color': __.ui.ui.hexToRGBA(color, 'rgba', 0.3),
                    }}
                >
                    {_point?.withinScreenLimits && _point?.frontOfTerrain && _point?.showPOI &&
                        <div className="poi-on-map">
                            {!_point.showFlag &&
                                <div className="poi-on-map-inner">
                                    <h3>{_point.title}</h3>
                                    <div className="poi-full-coordinates">
                                        {_point.height && (
                                            <TextValueUI className="poi-elevation"
                                                text={'Elevation: '}
                                                value={_point.height}
                                                format={'%d'}
                                                units={ELEVATION_UNITS}
                                            />
                                        )}
                                        {!_point.height && (
                                            <span>&nbsp;</span>
                                        )}
                                        <div className="poi-coordinates">
                                            <span>{UIUtils.toDMS(_point.latitude)}, {UIUtils.toDMS(_point.longitude)}</span>
                                            <br/>
                                            <span>[{sprintf('%.5f', _point.latitude)}, {sprintf('%.4f', _point.longitude)}]</span>
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
