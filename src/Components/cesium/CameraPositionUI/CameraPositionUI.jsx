import './style.css'

import { faAngle, faCompass, faMountains, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon }                          from '@fortawesome/react-fontawesome'
import { SlAnimation, SlButton, SlTooltip }         from '@shoelace-style/shoelace/dist/react'
import { forwardRef }                               from 'react'
import { useCesium }                                from 'resium'
import { useSnapshot }                              from 'valtio'
import { CameraUtils }                              from '../../../Utils/cesium/CameraUtils'
import { FA2SL }                                    from '../../../Utils/FA2SL'
import { TextValueUI }                              from '../../UI/TextValueUI/TextValueUI.jsx'


export const CameraPositionUI = forwardRef(function CameraPositionUI(props, ref) {
    vt3d.viewer = useCesium().viewer

    const cameraStore = vt3d.mainProxy.components.camera
    const cameraSnap = useSnapshot(cameraStore)

    const toggle = () => {
        // Update camera info
        if (!cameraStore.show) {
            cameraStore.show = !cameraStore.show
            CameraUtils.updatePosition(vt3d?.camera).then(data => {
                if (data !== undefined) {
                    cameraStore.position = data
                }
            })
            return
        }
        cameraStore.show = false

    }


    return (
        <div id="camera-position" className={'ui-element transparent'} ref={ref}>
            <SlTooltip content="Show real time camera information">
                <SlButton size="small" onClick={toggle}><FontAwesomeIcon icon={faVideo} slot={'prefix'}/></SlButton>
            </SlTooltip>
            {cameraSnap.show &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={cameraSnap.show}
                             onSlFinish={() => toggle()}>
                    <div className={'ui-element'} ref={ref} open={cameraSnap.show}>
                        <sl-icon library="fa" name={FA2SL.set(faCompass)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.longitude.toFixed(5)}
                                     id={'camera-longitude'}
                                     text={'Lon:'}/>
                        <TextValueUI value={cameraSnap.position.latitude.toFixed(5)}
                                     id={'camera-latitude'}
                                     text={'Lat:'}/>
                        <sl-icon library="fa" name={FA2SL.set(faAngle)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.heading.toFixed()}
                                     id={'camera-heading'} text={'Heading:'} unit={'°'}/>
                        <TextValueUI value={(cameraSnap.position.pitch).toFixed()}
                                     id={'camera-pitch'} text={'Pitch:'} unit={'°'}/>
                        <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.altitude.toFixed()}
                                     id={'camera-altitude'}
                                     unit={'m'}/>
                    </div>
                </SlAnimation>
            }
        </div>
    )

})

