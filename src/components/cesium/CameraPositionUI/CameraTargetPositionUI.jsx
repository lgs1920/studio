import './style.css'
import { TextValueUI } from '@Components/TextValueUI/TextValueUI.jsx'

import { faCompass, faCrosshairsSimple, faMountains }       from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation, SlButton, SlCard, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                            from '@Utils/FA2SL'
import { useCesium }                                        from 'resium'
import { useSnapshot } from 'valtio'
import { meter, mile } from '../../../Utils/UnitUtils'


export const CameraTargetPositionUI = (props) => {
    lgs.viewer = useCesium().viewer

    const cameraStore = lgs.mainProxy.components.camera
    const cameraSnap = useSnapshot(cameraStore)

    const toggle = () => {
        // Update camera info
        if (!cameraStore.showTarget) {
            cameraStore.showTarget = !cameraStore.showTarget
            cameraStore.position = __.ui.camera.get()
            return
        }
        cameraStore.showTarget = false
    }

    const hasTarget = ()=> {
        return cameraSnap.position.target
            && cameraSnap.position.target.longitude
            && cameraSnap.position.target.latitude
            && cameraSnap.position.target.height
    }
    return (
        <div className="camera-position">
            <SlTooltip hoist placement={'right'} content="Target information">
                <SlButton size={'small'} className={'square-icon'} onClick={toggle}>
                    <SlIcon library="fa" name={FA2SL.set(faCrosshairsSimple)}></SlIcon>
                </SlButton>
            </SlTooltip>

            {cameraSnap.showTarget && hasTarget() &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={cameraSnap.showTarget}
                             onSlFinish={toggle}>
                    <SlCard className="camera-data-panel" open={cameraSnap.showTarget}>
                        <sl-icon library="fa" name={FA2SL.set(faCompass)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.target.longitude.toFixed(5)}
                                     className={'camera-longitude'}
                                     text={'Lon:'}/>
                        <TextValueUI value={cameraSnap.position.target.latitude.toFixed(5)}
                                     className={'camera-latitude'}
                                     text={'Lat:'}/>
                        <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.target.height.toFixed()}
                                     className={'camera-altitude'}
                                     units={[meter, mile]}/>
                    </SlCard>
                </SlAnimation>
            }
        </div>
    )

}

