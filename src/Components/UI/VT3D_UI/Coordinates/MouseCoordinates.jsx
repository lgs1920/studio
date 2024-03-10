import './style.css'
import { faLocationDot }         from '@fortawesome/pro-regular-svg-icons'
import { SlCard }                from '@shoelace-style/shoelace/dist/react'
import { forwardRef, useEffect } from 'react'
import { useSnapshot }           from 'valtio'
import { MouseUtils }            from '../../../../Utils/cesium/MouseUtils'
import { FA2SL }                 from '../../../../Utils/FA2SL'
import { TextValueUI }           from '../../TextValueUI/TextValueUI'

export const MouseCoordinates = forwardRef(function MouseCoordinates(props, ref) {

    const coordinatesStore = vt3d.mainProxy.components.mouseCoordinates
    const coordinatesSnap = useSnapshot(coordinatesStore)
    coordinatesStore.show = false

    useEffect(() => {
        MouseUtils.mouseCoordinatesInfo = document.getElementById('mouse-coordinates-info-container')
    })


    // Add events
    vt3d.mouseEventHandler.onClick = MouseUtils.showCoordinates
    vt3d.mouseEventHandler.onRightClick = MouseUtils.showCoordinates

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

