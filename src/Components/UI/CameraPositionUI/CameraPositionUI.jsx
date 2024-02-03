import './style.css'
import {TextValueUI} from "../TextValueUI/TextValueUI.jsx"
import {forwardRef, useEffect, useState} from "react";
import {useCesium} from "resium";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

import {faAngle, faCompass, faMountains, faVideo} from '@fortawesome/pro-regular-svg-icons'
import {CameraUtils} from "../../../Utils/CameraUtils.js";
import {SlButton, SlAnimation, SlTooltip} from "@shoelace-style/shoelace/dist/react";

export const CameraPositionUI = forwardRef(function CameraPositionUI(props, ref) {
    window.vt3DContext.viewer = useCesium().viewer;
    const [shown, show] = useState(false);

    const toggle = () => {
        show((shown) => !shown)
    }

    useEffect(() => {
        CameraUtils.updatePosition(window.vt3DContext?.camera)
    }, []);

    return (
        <div id="camera-position" className={'ui-element transparent'} ref={ref}>
            <SlTooltip content="Show real time camera information">
                <SlButton size="small" onClick={toggle}><FontAwesomeIcon icon={faVideo} slot={'prefix'}/></SlButton>
            </SlTooltip>
            {shown &&
                <SlAnimation easing="bounceInLeft" duration={1000} iterations={1} play={shown}
                             onSlFinish={() => show(false)}>
                    <div className={'ui-element'} ref={ref}>
                        <FontAwesomeIcon icon={faCompass}/>
                        <TextValueUI ref={ref} id={'camera-longitude'} text={'Lon:'}/>
                        <TextValueUI ref={ref} id={'camera-latitude'} text={'Lat:'}/>
                        <FontAwesomeIcon icon={faAngle}/>
                        <TextValueUI ref={ref} id={'camera-heading'} text={'Heading:'} unit={'°'}/>
                        <TextValueUI ref={ref} id={'camera-pitch'} text={'Pitch:'} unit={'°'}/>
                        <FontAwesomeIcon icon={faMountains}/>
                        <TextValueUI ref={ref} id={'camera-altitude'} unit={'m'}/>
                    </div>
                </SlAnimation>


            }
        </div>
    )

})

