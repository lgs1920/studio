import './style.css'
import { TextValueUI } from '@Components/TextValueUI/TextValueUI.jsx'

import { faAngle, faMountains, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation }                   from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                         from '@Utils/FA2SL'
import { forwardRef }                    from 'react'
import { useCesium }                     from 'resium'
import { proxy, useSnapshot }            from 'valtio'
import { meter, mile }                   from '../../../Utils/UnitUtils'


export const CameraPositionUI = forwardRef(function CameraPositionUI(props, ref) {
    lgs.viewer = useCesium().viewer

    const cameraUI = useSnapshot(lgs.mainProxy.components.camera)
    const ui = useSnapshot(proxy(lgs.configuration.ui))

    return (
        <>
            {ui.showCameraPosition &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={ui.showCameraPosition}>
                    <div className="camera-data-panel lgs-card on-map">
                        <sl-icon library="fa" name={FA2SL.set(faVideo)}></sl-icon>
                        <div>
                            <TextValueUI value={cameraUI.position.longitude?.toFixed(5)}
                                     className={'camera-longitude'}
                                     text={'Lon:'}/>
                            <TextValueUI value={cameraUI.position.latitude?.toFixed(5)}
                                     className={'camera-latitude'}
                                     text={'Lat:'}/>
                            <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                            <TextValueUI value={cameraUI.position?.height?.toFixed()}
                                         className={'camera-altitude'}
                                         units={[meter, mile]}/>
                        </div>
                        <div>
                            <sl-icon library="fa" name={FA2SL.set(faAngle)}></sl-icon>
                            <TextValueUI value={cameraUI.position.heading?.toFixed()}
                                     className={'camera-heading'} text={'Heading:'} units={'°'}/>
                            <TextValueUI value={(cameraUI.position?.pitch)?.toFixed()}
                                     className={'camera-pitch'} text={'Pitch:'} units={'°'}/>
                        </div>
                    </div>
                </SlAnimation>
            }
        </>
    )

})

