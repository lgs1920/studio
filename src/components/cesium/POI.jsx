import { ELEVATION_UNITS }     from '@Utils/UnitUtils'
import { Cartesian3 }          from 'cesium'
import { useEffect, useState } from 'react'
import { UIUtils }             from '../../Utils/UIUtils'
import { TextValueUI }         from '../TextValueUI/TextValueUI'

export const POI = ({point}) => {
    const [pixels, setPixels] = useState({x: 0, y: 0})

    useEffect(() => {
        const getPixelsCoordinates = () => {

            const coordinates = lgs.scene.cartesianToCanvasCoordinates(
                __.ui.sceneManager.noRelief()
                ? Cartesian3.fromDegrees(point.longitude, point.latitude, 0)
                : Cartesian3.fromDegrees(point.longitude, point.latitude, point.elevation),
            )
            setPixels(coordinates)
        }
        getPixelsCoordinates()
        window.addEventListener('resize', getPixelsCoordinates)
        lgs.camera.changed.addEventListener(getPixelsCoordinates)
        lgs.camera.moveEnd.addEventListener(getPixelsCoordinates)

        return () => {
            window.removeEventListener('resize', getPixelsCoordinates)
            lgs.camera.changed.removeEventListener(getPixelsCoordinates)
            lgs.camera.moveEnd.removeEventListener(getPixelsCoordinates)
        }

    }, [])

    return (
        <>
            {pixels &&
                <div className={'poi-on-map lgs-slide-in-from-top-bounced'}
                     style={{bottom: `${window.innerHeight - pixels.y}px`, left: `${pixels.x}px`}}>
                    <div className="poi-on-map-inner">
                        <h3>{point.title}</h3>
                        <div className="poi-full-coordinates">
                            {point.elevation &&
                                <TextValueUI text={'Elevation: '} value={point.elevation} format={'%d'}
                                             units={ELEVATION_UNITS}/>
                            }
                            <div className="poi-coordinates">
                                <span>{UIUtils.toDMS(point.latitude)}, {UIUtils.toDMS(point.longitude)}</span><br/>
                                <span>[{point.latitude}, {point.longitude}]</span><br/>
                            </div>
                        </div>
                    </div>
                    <div className="poi-on-map-marker"></div>
                </div>
            }
        </>
    )
}