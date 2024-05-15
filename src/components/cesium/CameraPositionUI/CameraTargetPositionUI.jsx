import './style.css'
import { TextValueUI } from '@Components/TextValueUI/TextValueUI.jsx'

import { faCompass, faCrosshairsSimple, faMountains }       from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation, SlButton, SlCard, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                            from '@Utils/FA2SL'
import { useCesium }                                        from 'resium'
import { useSnapshot }                                      from 'valtio'
import { meter, mile }                                      from '../../../Utils/UnitUtils'


export const CameraTargetPositionUI = (props) => {
    vt3d.viewer = useCesium().viewer

    const cameraStore = vt3d.mainProxy.components.camera
    const cameraSnap = useSnapshot(cameraStore)

    const toggle = () => {
        // Update camera info
        if (!cameraStore.showTarget) {
            cameraStore.showTarget = !cameraStore.showTarget
            // CameraUtils.updateCamera().then(data => {
            //     if (data !== undefined) {
            //         cameraStore.position = data
            //     }
            // })
            return
        }
        cameraStore.showTarget = false

    }
    return (
        <div id="camera-position">
            <SlTooltip placement={'right'} content="Target information">
                <SlButton size={'small'} className={'square-icon'} onClick={toggle}>
                    <SlIcon library="fa" name={FA2SL.set(faCrosshairsSimple)}></SlIcon>
                </SlButton>
            </SlTooltip>

            {cameraSnap.showTarget && cameraSnap.position.target !== undefined &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={cameraSnap.showTarget}
                             onSlFinish={() => toggle()}>
                    <SlCard id="camera-data-panel" open={cameraSnap.showTarget}>
                        <sl-icon library="fa" name={FA2SL.set(faCompass)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.target.longitude.toFixed(5)}
                                     id={'camera-longitude'}
                                     text={'Lon:'}/>
                        <TextValueUI value={cameraSnap.position.target.latitude.toFixed(5)}
                                     id={'camera-latitude'}
                                     text={'Lat:'}/>
                        <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.target.height.toFixed()}
                                     id={'camera-altitude'}
                                     units={[meter, mile]}/>
                    </SlCard>
                </SlAnimation>
            }
        </div>
    )

}

