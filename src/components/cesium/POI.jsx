import { SECOND }                                   from '@Core/constants'
import { POIUtils }                                 from '@Utils/cesium/POIUtils'
import { SceneUtils }                               from '@Utils/cesium/SceneUtils'
import { UIUtils }                                  from '@Utils/UIUtils'
import { ELEVATION_UNITS }                          from '@Utils/UnitUtils'
import classNames                                   from 'classnames'
import { useCallback, useEffect, useRef, useState } from 'react'
import Timeout                                      from 'smart-timeout'
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
    const [color] = useState(_point.color ?? lgs.settings.ui.poi.defaultColor)
    const inner = useRef(null)

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
        lgs.mainProxy.components.pois.context.visible = true
        lgs.mainProxy.components.pois.current = point
        __.ui.sceneManager.propagateEventToCanvas(event)
    }
    const POIContent = ({point}) => {
        return (
            <div className="poi-on-map">
                {

                    <div className="poi-on-map-inner"
                         ref={inner}
                         onContextMenu={handleContextMenu}
                         onPointerLeave={() => {
                             Timeout.set(lgs.mainProxy.components.pois.context.timer, hideMenu, 0.8 * SECOND)
                         }}
                    >
                        {!point.showFlag &&
                            <><h3>{point.title ?? 'Point Of Interest'}</h3>
                                {point.scale > 0.6 &&
                                    <div className="poi-full-coordinates">
                                        {point.height > 0 && (
                                            <TextValueUI className="poi-elevation"
                                                         text={'Elevation: '}
                                                         value={point.height}
                                                         format={'%d'}
                                                         units={ELEVATION_UNITS}
                                            />
                                        )}
                                        {!point.height > 0 && (
                                            <span>&nbsp;</span>
                                        )}
                                        <div className="poi-coordinates">
                                            <span>{UIUtils.toDMS(point.latitude)}, {UIUtils.toDMS(point.longitude)}</span>
                                            <br/>
                                            <span>[{sprintf('%.5f', point.latitude)}, {sprintf('%.5f', point.longitude)}]</span>
                                            <br/>
                                        </div>
                                    </div>
                                }
                            </>
                        }
                        {point.showFlag &&
                            <div className="flag-as-triangle">&nbsp;</div>
                        }
                    </div>
                }
                <div className="poi-on-map-marker"></div>
            </div>
        )
    }

    return (
        <>
            {pixels &&
                <>
                    <div
                        className={classNames(
                            'poi-on-map-wrapper',
                            'lgs-slide-in-from-top-bounced',
                            _point?.showFlag ? 'show-flag' : '')
                        }
                        ref={poi}
                        id={_point.id}
                        style={{
                            bottom:                     window.innerHeight - pixels.y,
                            left:                       pixels.x,
                            transform:                  `scale(${_point?.scale ?? 1})`,
                            transformOrigin:            'left bottom',
                            '--lgs-poi-color':          color,
                            '--lgs-poi-gradient-color': __.ui.ui.hexToRGBA(color, 'rgba', 0.3),
                        }}
                        onPointerMove={__.ui.sceneManager.propagateEventToCanvas}
                        onPointerDown={hideMenu}
                        onPointerUp={hideMenu}
                        onWheel={hideMenu}>
                        {_point?.withinScreenLimits && _point?.frontOfTerrain && _point?.showPOI &&
                            <POIContent point={_point}/>
                        }
                    </div>

                </>
            }
        </>
    )
}
