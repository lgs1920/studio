import './style.css'
import {TextValueUI} from "../TextValueUI/TextValueUI.jsx"
import * as Cesium from "cesium";
import {forwardRef, useEffect, useState} from "react";
import {useCesium} from "resium";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

import { faMapLocation} from '@fortawesome/pro-regular-svg-icons'
import {CameraUtils} from "../../../Utils/CameraUtils.js";
import {SlButton, SlAnimation,SlInput} from "@shoelace-style/shoelace/dist/react";

export const FileLoaderUI = forwardRef(function FileLoaderUI(props, ref) {
    window.vt3DContext.viewer = useCesium().viewer;
    const [shown, show] = useState(false);

    const toggle = () => {
        show((shown) => !shown)
    }

    useEffect(() => {
        CameraUtils.updatePosition(window.vt3DContext?.camera)
    }, []);

    return (
        <div id="file-loader" className={'ui-element transparent'} ref={ref}>

            <SlButton size="small" onClick={toggle}><FontAwesomeIcon icon={faMapLocation} slot={'prefix'}/></SlButton>
            {shown &&
                <SlAnimation easing="bounceInLeft" duration={1000} iterations={1} play={shown}
                             onSlFinish={() => show(false)}>
                    <div className={'ui-element'} ref={ref}>
                        <SlInput type="file" placeholder="Date" />
                    </div>
                </SlAnimation>


            }
        </div>
    )

})

