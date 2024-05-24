/**
 * React
 */
import { MainUI }                  from '@Components/MainUI/MainUI.jsx'
/**
 * We are using shoelace Web components
 */
import '@shoelace-style/shoelace/dist/themes/light.css'
import { LGS1920Context }          from '@Core/LGS1920Context'
import { CameraUtils }             from '@Utils/cesium/CameraUtils.js'
import { TrackUtils }              from '@Utils/cesium/TrackUtils'

import * as Cesium                                   from 'cesium'
import { useEffect, useRef }                         from 'react'
import { Camera, CameraFlyTo, Globe, Scene, Viewer } from 'resium'
import {  useSnapshot }                    from 'valtio'
import { subscribeKey }                              from 'valtio/utils'
import { MapLayer }                                  from './components/cesium/MapLayer.jsx'
import { WelcomeModal }            from './components/MainUI/WelcomeModal.jsx'
import { Layer }                                     from './core/Layer.js'
import { Camera as CameraManager } from './core/ui/Camera'
import { UIToast }                 from './Utils/UIToast'
//setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.13.1/cdn/')
window.lgs = new LGS1920Context()
await __.app.init()

export function LGS1920() {

    const viewerRef = useRef(null)
    const mainStore = lgs.mainProxy
    mainStore.layer = Layer.IGN_AERIAL

    lgs.journeyEditorStore = mainStore.components.journeyEditor
    lgs.mainUIStore = mainStore.components.mainUI
   // const mainUISnapshot = useSnapshot(lgs.mainUIStore)

    const starter = lgs.configuration.starter
    lgs.windowCenter = Cesium.Cartesian3.fromDegrees(starter.longitude, starter.latitude, starter.height)

    lgs.cameraOrientation = {
        heading: Cesium.Math.toRadians(starter.camera.heading),
        pitch: Cesium.Math.toRadians(starter.camera.pitch),
        roll: Cesium.Math.toRadians(starter.camera.roll),
    }
    const cameraStore = lgs.mainProxy.components.camera

    const run360 = () => {
        lgs.camera.changed.addEventListener(updateCameraPosition)
        lgs.camera.percentageChanged=lgs.configuration.camera.percentageChanged
        __.ui.camera.event = true
        CameraUtils.run360()
    }

    const updateCameraPosition = () => {
        if (__?.ui?.camera) {
            __.ui.camera.update().then(data => {
                cameraStore.position = data
                lgs.events.emit(CameraManager.UPDATE_EVENT, [data])
            })
        } else {
            CameraUtils.updateCamera().then(data => {
                if (data !== undefined) {
                    cameraStore.position = data
                }
                lgs.events.emit(CameraManager.UPDATE_EVENT, [data])
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
        lgs.initManagers()
        //Ready
        UIToast.success({
            caption: `Welcome on ${lgs.configuration.applicationName}!`,
            text: 'We\'re ready to assist you !',
        })

        console.log('LGS1920 has been loaded and is ready !')
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
                    orientation={lgs.cameraOrientation}
                    duration={3}
                    destination={lgs.windowCenter}
                    once={true}
                    onComplete={run360}
                />
            </Camera>


            <MainUI/>
            <WelcomeModal/>

        </Viewer>
    </>)
}

