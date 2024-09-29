import './style.css'
import { TextValueUI } from '@Components/TextValueUI/TextValueUI.jsx'

import { faArrowsToCircle, faMountains } from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation }                   from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                         from '@Utils/FA2SL'
import { useCesium }                     from 'resium'
import { proxy, useSnapshot }            from 'valtio'
import { meter, mile }                   from '../../../Utils/UnitUtils'


export const CameraTargetPositionUI = (props) => {
    lgs.viewer = useCesium().viewer
    const cameraUI = useSnapshot(lgs.mainProxy.components.camera)
    const ui = useSnapshot(proxy(lgs.configuration.ui))

    const hasTarget = ()=> {
        return cameraUI.position.target
            && cameraUI.position.target.longitude
            && cameraUI.position.target.latitude
            && cameraUI.position.target.height
    }
    return (
        <>
            {ui.showCameraTargetPosition && hasTarget() &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={ui.showCameraTargetPosition}>
                    <div className="camera-data-panel lgs-card on-map">
                        <sl-icon library="fa" name={FA2SL.set(faArrowsToCircle)}></sl-icon>
                        <div>
                            <TextValueUI value={cameraUI.position.target.longitude.toFixed(5)}
                                     className={'camera-longitude'}
                                     text={'Lon:'}/>
                            <TextValueUI value={cameraUI.position.target.latitude.toFixed(5)}
                                     className={'camera-latitude'}
                                     text={'Lat:'}/>
                        <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                            <TextValueUI value={cameraUI.position.target.height.toFixed()}
                                     className={'camera-altitude'}
                                     units={[meter, mile]}/>
                        </div>
                    </div>
                </SlAnimation>
            }
        </>
    )

}

