/**
 * React
 */
import {useEffect, useRef} from "react";

/**
 * Some Cesium and Resium modules are needed
 */
import {Camera, CameraFlyTo, useCesium, Globe, Scene, Viewer} from "resium";
import * as Cesium from "cesium";
import {Vr3DContext} from "./Utils/Vr3DContext";
import {CameraUtils} from "./Utils/CameraUtils.js";

/**
 * We are using shoelace Web Components
 */
import '@shoelace-style/shoelace/dist/themes/light.css';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path';
setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.13.1/cdn/');

/**
 * We also need our owns
 */
import {VT3D_UI} from "./Components/UI/VT3D_UI/VT3D_UI.jsx";
import {AppUtils} from "./Utils/AppUtils.js";

/**
 * Some initialization
 */

window.vt3DContext = new Vr3DContext()

export const APP_NAME = 'visu-rando-3d'
export const CONFIGURATION = './config.json'
window.vt3DContext.configuration = await import(/* @vite-ignore */ CONFIGURATION)
Cesium.Ion.defaultAccessToken = window.vt3DContext.configuration.ionToken


export function ViewTrack3D() {

    const viewerRef = useRef(null)

    window.vt3DContext.viewer = useCesium().viewer;
    const center = window.vt3DContext.configuration.center
    window.vt3DContext.windowCenter = Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, center.height)

    window.vt3DContext.cameraOrientation = {
        heading: Cesium.Math.toRadians(center.camera.heading),
        pitch: Cesium.Math.toRadians(center.camera.pitch),
        roll: Cesium.Math.toRadians(center.camera.roll),
    }


    useEffect(() => {

        // Set DefaultTheme
        AppUtils.setTheme()

        // Ready
        console.log("ViewTrack3D has been loaded and is ready !");
    })

    return (<Viewer full
                    timeline={false}
                    animation={false}
                    homeButton={false}
                    navigationHelpButton={false}
                    fullscreenButton={false}
                    baseLayerPicker={false}
                    sceneModePicker={false}
                    terrain={Cesium.Terrain.fromWorldTerrain({
                        requestVertexNormals: true,
                    })}
                    id='viewTrack3DViewer'
                    ref={viewerRef}
        >
            <Scene></Scene>
            <Globe enableLighting={false}></Globe>
            <Camera onMoveEnd={CameraUtils.updatePosition} ref={viewerRef}>
                <CameraFlyTo
                    orientation={window.vt3DContext.cameraOrientation}
                    duration={3}
                    destination={window.vt3DContext.windowCenter}
                    once={true}
                    onComplete={CameraUtils.turnAroundCameraTarget}
                />
            </Camera>

            <VT3D_UI/>

        </Viewer>
    )
//

    //
}

