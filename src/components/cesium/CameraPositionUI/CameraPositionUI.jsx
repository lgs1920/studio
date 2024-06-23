import './style.css'
import { TextValueUI } from '@Components/TextValueUI/TextValueUI.jsx'

import { faAngle, faCompass, faMountains, faVideo }         from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation, SlButton, SlCard, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                            from '@Utils/FA2SL'
import { forwardRef }                                       from 'react'
import { useCesium }                                        from 'resium'
import { useSnapshot } from 'valtio'
import { meter, mile } from '../../../Utils/UnitUtils'


export const CameraPositionUI = forwardRef(function CameraPositionUI(props, ref) {
    lgs.viewer = useCesium().viewer

    const cameraStore = lgs.mainProxy.components.camera
    const cameraSnap = useSnapshot(cameraStore)

    const toggle = () => {
        // Update camera info
        if (!cameraStore.show) {
            cameraStore.show = !cameraStore.show
            cameraStore.position = __.ui.camera.get()
            return
        }
        cameraStore.show = false

    }

    return (
        <div className="camera-position" ref={ref}>
            <SlTooltip hoist placement="right" content="Camera information">
                <SlButton size={'small'} className={'square-icon'} onClick={toggle}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faVideo)}></SlIcon>
                </SlButton>
            </SlTooltip>

            {cameraSnap.show && cameraSnap.position.target !== undefined &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={cameraSnap.show}
                             onSlFinish={toggle}>
                    <SlCard className="camera-data-panel" ref={ref} open={cameraSnap.show}>
                        <sl-icon library="fa" name={FA2SL.set(faCompass)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.longitude?.toFixed(5)}
                                     className={'camera-longitude'}
                                     text={'Lon:'}/>
                        <TextValueUI value={cameraSnap.position.latitude?.toFixed(5)}
                                     className={'camera-latitude'}
                                     text={'Lat:'}/>
                        <sl-icon library="fa" name={FA2SL.set(faAngle)}></sl-icon>
                        <TextValueUI value={cameraSnap.position.heading?.toFixed()}
                                     className={'camera-heading'} text={'Heading:'} units={'°'}/>
                        <TextValueUI value={(cameraSnap.position?.pitch)?.toFixed()}
                                     className={'camera-pitch'} text={'Pitch:'} units={'°'}/>
                        <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                        <TextValueUI value={cameraSnap.position?.height?.toFixed()}
                                     className={'camera-altitude'}
                                     units={[meter, mile]}/>
                    </SlCard>
                </SlAnimation>
            }
        </div>
    )

})

