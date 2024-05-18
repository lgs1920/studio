/**
 * React
 */
import { VT3D_UI }     from '@Components/VT3D_UI/VT3D_UI.jsx'
/**
 * We are using shoelace Web components
 */
import '@shoelace-style/shoelace/dist/themes/light.css'
import { VT3D }        from '@Core/VT3D'
import { CameraUtils } from '@Utils/cesium/CameraUtils.js'
import { TrackUtils }  from '@Utils/cesium/TrackUtils'

import * as Cesium                                   from 'cesium'
import { useEffect, useRef }                         from 'react'
import { Camera, CameraFlyTo, Globe, Scene, Viewer } from 'resium'
import { MapLayer }                                  from './components/cesium/MapLayer.jsx'
import { Layer }                                     from './core/Layer.js'
import { UIToast }                                   from './Utils/UIToast'

//setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.13.1/cdn/')
window.vt3d = new VT3D()
await __.app.init()

export function ViewTrack3D() {

    const viewerRef = useRef(null)
    const mainStore = vt3d.mainProxy
    mainStore.layer = Layer.IGN_AERIAL


    const starter = vt3d.configuration.starter
    vt3d.windowCenter = Cesium.Cartesian3.fromDegrees(starter.longitude, starter.latitude, starter.height)

    vt3d.cameraOrientation = {
        heading: Cesium.Math.toRadians(starter.camera.heading),
        pitch: Cesium.Math.toRadians(starter.camera.pitch),
        roll: Cesium.Math.toRadians(starter.camera.roll),
    }
    const cameraStore = vt3d.mainProxy.components.camera

    const run360 = () => {
        vt3d.camera.changed.addEventListener(updateCameraPosition)
        vt3d.camera.percentageChanged=0.2
        CameraUtils.run360()
    }

    const updateCameraPosition = () => {
        if (__?.ui?.camera) {
            __.ui.camera.update().then(data => {
                return
                cameraStore.position = data
                vt3d.events.emit(CameraManager.UPDATE_EVENT, [data])
            })
        } else {
            CameraUtils.updateCamera().then(data => {
                if (data !== undefined) {
                    cameraStore.position = data
                }
                vt3d.events.emit(CameraManager.UPDATE_EVENT, [data])
            })
        }
    }


    useEffect(() => {

        const readAllFromDB = async () => {
            await TrackUtils.readAllFromDB()
        }


        // Set DefaultTheme
        __.app.setTheme()

        // Read DB
        readAllFromDB()

        // Let's instantiate some elements Managers
        vt3d.initManagers()

        updateCameraPosition()

        //Ready
        UIToast.success({
            caption: `Welcome on ${vt3d.configuration.applicationName}!`,
            text: 'We\'re ready to assist you !',
        })

        console.log('ViewTrack3D has been loaded and is ready !')
    })

    return (<>
        <Viewer full
                timeline={false}
                animation={false}
                homeButton={false}
                navigationHelpButton={false}
                fullscreenButton={false}

                sceneModePicker={false}
                terrain={Cesium.Terrain.fromWorldTerrain({
                    requestVertexNormals: false,
                })}
                id="viewTrack3DViewer"
            // Avoid consuming Cesium Ion Sessions
            // DONOT CHANGE
                imageryProvider={false}
                baseLayerPicker={false}
                ref={viewerRef}
        >
            <MapLayer/>

            <Scene verticalExaggeration={1.15}
                   verticalExaggerationRelativeHeight={2400.0}>
            </Scene>
            <Globe enableLighting={false}></Globe>
            <Camera>
                <CameraFlyTo
                    orientation={vt3d.cameraOrientation}
                    duration={3}
                    destination={vt3d.windowCenter}
                    once={true}
                    onComplete={run360}
                />
            </Camera>
            <VT3D_UI/>
        </Viewer>
    </>)
}

