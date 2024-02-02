import './style.css'
import {forwardRef} from "react";
import {useCesium} from "resium";
import {CameraPositionUI} from "../CameraPositionUI/CameraPositionUI.jsx";
import {FileLoaderUI} from "../FileLoaderUI/FileLoaderUI.jsx";


export const VT3D_UI = forwardRef(function VT3D_UI(props, ref) {
    window.vt3DContext.viewer = useCesium().viewer;


    return (
        <div id="vt3d-main-ui" className={'ui'} ref={ref}>
            <CameraPositionUI ref={ref}/>
            <FileLoaderUI ref={ref}/>
        </div>
    )

})

