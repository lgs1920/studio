import './style.css'
import { faLocationDot }         from '@fortawesome/pro-regular-svg-icons'
import { SlCard }                from '@shoelace-style/shoelace/dist/react'
import * as Cesium               from 'cesium'
import { forwardRef, useEffect } from 'react'
import { useSnapshot }           from 'valtio'
import { SECOND }                from '../../../../Utils/AppUtils'
import { FA2SL }                 from '../../../../Utils/FA2SL'
import { TextValueUI }           from '../../TextValueUI/TextValueUI'

export const MouseCoordinates = forwardRef(function MouseCoordinates(props, ref) {

    const coordinatesStore = vt3d.mainProxy.components.mouseCoordinates
    const coordinatesSnap = useSnapshot(coordinatesStore)
    coordinatesStore.show = false

    let mouseCoordinatesInfo
    useEffect(() => {
        mouseCoordinatesInfo = document.getElementById('mouse-coordinates-info-container')
    })


    const showCoordinates = (movement) => {
        /**
         * Manage a delay of 3 seconds, then hidesthe popup
         *
         * @type {number}
         */
        const DELAY = 3 // seconds
        let remaining = DELAY
        let timer
        const offset = 5
        const autoRemove = () => {
            remaining--
            if (remaining < 0) {
                clearInterval(timer)
                remaining = DELAY
                coordinatesStore.show = false
                mouseCoordinatesInfo.style.left = `-9999px`
            }
        }
        const position = movement.position ?? movement.endPosition
        const cartesian = vt3d.viewer.camera.pickEllipsoid(position, vt3d.viewer.scene.globe.ellipsoid)

        if (cartesian) {
            coordinatesStore.show = true
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            coordinatesStore.longitude = Cesium.Math.toDegrees(cartographic.longitude)
            coordinatesStore.latitude = Cesium.Math.toDegrees(cartographic.latitude)

            let {x, y} = Cesium.SceneTransforms.wgs84ToWindowCoordinates(vt3d.viewer.scene, cartesian)

            // Recalculate position:

            if (mouseCoordinatesInfo !== undefined) {
                const width  = mouseCoordinatesInfo.offsetWidth,
                      height = mouseCoordinatesInfo.offsetHeight

                // When right side of the box goes too far...
                if ((x + width) > document.documentElement.clientWidth + offset) {
                    x = document.documentElement.clientWidth - width - 2 * offset
                }
                // When bottom side of the box goes too far...
                if ((y + height) > document.documentElement.clientHeight + offset) {
                    y = document.documentElement.clientHeight - height - 2 * offset
                }

                mouseCoordinatesInfo.style.top = `${y + offset}px`
                mouseCoordinatesInfo.style.left = `${x + offset}px`
                timer = setInterval(autoRemove, SECOND)
            }


        }
    }

    // Show coordinates on Click
    new Cesium.ScreenSpaceEventHandler(vt3d.canvas).setInputAction(showCoordinates, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    return (<>
            <div id="mouse-coordinates-info-container">
                <SlCard>
                    <div id={'mouse-coordinates-info'}>
                        <div>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faLocationDot)}></sl-icon>
                        </div>
                        <div>
                            <TextValueUI value={coordinatesSnap.longitude.toFixed(5)}
                                         id={'cursor-longitude'}
                                         text={'Lon:'}/>
                            <TextValueUI value={coordinatesSnap.latitude.toFixed(5)}
                                         id={'cursor-latitude'}
                                         text={'Lat:'}/>
                        </div>
                    </div>
                </SlCard>
            </div>
        </>


    )
})

