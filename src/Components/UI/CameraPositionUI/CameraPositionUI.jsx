import './style.css'

import {faAngle, faCompass, faMountains, faVideo} from '@fortawesome/pro-regular-svg-icons'
import {FontAwesomeIcon}                          from '@fortawesome/react-fontawesome'
import {SlAnimation, SlButton, SlTooltip}         from '@shoelace-style/shoelace/dist/react'
import {forwardRef, useEffect}                    from 'react'
import {useCesium}                                from 'resium'
import {useSnapshot}                              from 'valtio'
import {CameraUtils}                              from '../../../Utils/CameraUtils.js'
import {FA2SL}                                    from '../../../Utils/FA2SL'
import {TextValueUI}                              from '../TextValueUI/TextValueUI.jsx'


export const CameraPositionUI = forwardRef(function CameraPositionUI(props, ref) {
    vt3d.viewer = useCesium().viewer

    const store = vt3d.store.components
    const snap = useSnapshot(store)

    const toggle = () => {
        store.cameraPosition.show = !store.cameraPosition.show
    }


    useEffect(() => {
        CameraUtils.updatePosition(vt3d?.camera)
    }, [])

    return (
        <div id="camera-position" className={'ui-element transparent'} ref={ref}>
            <SlTooltip content="Show real time camera information">
                <SlButton size="small" onClick={toggle}><FontAwesomeIcon icon={faVideo} slot={'prefix'}/></SlButton>
            </SlTooltip>
            {snap.cameraPosition.show &&
                <SlAnimation easing="bounceInLeft" duration={1000} iterations={1} play={snap.cameraPosition.show}
                             onSlFinish={() => toggle()}>
                    <div className={'ui-element'} ref={ref} open={snap.cameraPosition.show}>
                        {/*<FontAwesomeIcon icon={faCompass}/>*/}
                        <sl-icon library="fa" name={FA2SL.set(faCompass)}></sl-icon>
                        <TextValueUI ref={ref} id={'camera-longitude'} text={'Lon:'}/>
                        <TextValueUI ref={ref} id={'camera-latitude'} text={'Lat:'}/>
                        <sl-icon library="fa" name={FA2SL.set(faAngle)}></sl-icon>
                        <TextValueUI ref={ref} id={'camera-heading'} text={'Heading:'} unit={'°'}/>
                        <TextValueUI ref={ref} id={'camera-pitch'} text={'Pitch:'} unit={'°'}/>
                        <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                        <TextValueUI ref={ref} id={'camera-altitude'} unit={'m'}/>
                    </div>
                </SlAnimation>
            }
        </div>
    )

})

