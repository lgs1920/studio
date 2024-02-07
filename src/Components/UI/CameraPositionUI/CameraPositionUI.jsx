import './style.css'

import {faAngle, faCompass, faMountains, faVideo} from '@fortawesome/pro-regular-svg-icons'
import {FontAwesomeIcon}                          from '@fortawesome/react-fontawesome'
import {SlAnimation, SlButton, SlTooltip}         from '@shoelace-style/shoelace/dist/react'
import {forwardRef, useEffect, useState}          from 'react'
import {useCesium}                                from 'resium'
import {CameraUtils}                              from '../../../Utils/CameraUtils.js'
import {UIUtils as UI}                            from '../../../Utils/UIUtils'
import {TextValueUI}                              from '../TextValueUI/TextValueUI.jsx'

export const CameraPositionUI = forwardRef(function CameraPositionUI(props, ref) {
    window.vt3d.viewer = useCesium().viewer
    const [shown, show] = useState(false)

    const toggle = () => {
        show((shown) => !shown)
    }

    useEffect(() => {
        CameraUtils.updatePosition(window.vt3d?.camera)
    }, [])

    return (
        <div id="camera-position" className={'ui-element transparent'} ref={ref}>
            <SlTooltip content="Show real time camera information">
                <SlButton size="small" onClick={toggle}><FontAwesomeIcon icon={faVideo} slot={'prefix'}/></SlButton>
            </SlTooltip>
            {shown &&
                <SlAnimation easing="bounceInLeft" duration={1000} iterations={1} play={shown}
                             onSlFinish={() => show(false)}>
                    <div className={'ui-element'} ref={ref}>
                        {/*<FontAwesomeIcon icon={faCompass}/>*/}
                        <sl-icon src={UI.useFAIcon(faCompass)}></sl-icon>
                        <TextValueUI ref={ref} id={'camera-longitude'} text={'Lon:'}/>
                        <TextValueUI ref={ref} id={'camera-latitude'} text={'Lat:'}/>
                        <sl-icon src={UI.useFAIcon(faAngle)}></sl-icon>
                        <TextValueUI ref={ref} id={'camera-heading'} text={'Heading:'} unit={'°'}/>
                        <TextValueUI ref={ref} id={'camera-pitch'} text={'Pitch:'} unit={'°'}/>
                        <sl-icon src={UI.useFAIcon(faMountains)}></sl-icon>
                        <TextValueUI ref={ref} id={'camera-altitude'} unit={'m'}/>
                    </div>
                </SlAnimation>


            }
        </div>
    )

})

