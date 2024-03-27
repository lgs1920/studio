/**
 * React
 */
import * as Cesium                                           from 'cesium'
import { useEffect, useRef }                                 from 'react'

/**
 * Some Cesium and Resium modules are needed
 */
import { Camera, CameraFlyTo, Entity, Globe, Scene, Viewer } from 'resium'
import { VT3D }                                              from './classes/VT3D'
/**
 * We also need our owns
 */
import { VT3D_UI }                                           from './Components/UI/VT3D_UI/VT3D_UI.jsx'
import { CameraUtils }                                       from './Utils/cesium/CameraUtils.js'

/**
 * We are using shoelace Web Components
 */
import '@shoelace-style/shoelace/dist/themes/light.css'
/**
 * Then import our owns
 */
import { UINotifier }                                        from './Utils/UINotifier'

//setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.13.1/cdn/')
window.vt3d = new VT3D()
await _utils.app.init()

export function ViewTrack3D() {

    const viewerRef = useRef(null)

    const center = vt3d.configuration.center
    vt3d.windowCenter = Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, center.height)

    vt3d.cameraOrientation = {
        heading: Cesium.Math.toRadians(center.camera.heading),
        pitch: Cesium.Math.toRadians(center.camera.pitch),
        roll: Cesium.Math.toRadians(center.camera.roll),
    }

    const updateCameraPosition = () => {
        const cameraStore = vt3d.mainProxy.components.camera
        CameraUtils.updatePosition().then(data => {
            if (data !== undefined) {
                cameraStore.position = data
            }
        })
    }

    useEffect(() => {

        // Set DefaultTheme
        _utils.app.setTheme()

        // Update camera info
        CameraUtils.updatePosition(vt3d?.camera).then(r => {
        })

        //vt3d.viewer.scene.verticalExaggeration = Number(1)


        // Ready
        UINotifier.notifySuccess({
            caption: `Welcome on ${vt3d.configuration.applicationName}!`,
            text: 'We\'re ready to assist you !',
        })
        console.log('ViewTrack3D has been loaded and is ready !')
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
                        requestVertexNormals: false,
                    })}
                    id="viewTrack3DViewer"
                    imageryProvider={false}
                    baseLayer={Cesium.ImageryLayer.fromWorldImagery({
                        style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS,
                    })}
                    ref={viewerRef}
        >
            <Scene></Scene>
            <Globe enableLighting={false}></Globe>
            <Camera onMoveStart={updateCameraPosition} onMoveEnd={updateCameraPosition} ref={viewerRef}>
                <CameraFlyTo
                    orientation={vt3d.cameraOrientation}
                    duration={3}
                    destination={vt3d.windowCenter}
                    once={true}
                    onComplete={CameraUtils.turnAroundCameraTarget}
                />
            </Camera>
            <Entity id={'markers-group'}/>

            <VT3D_UI/>

        </Viewer>
    )
    //

    //
}

