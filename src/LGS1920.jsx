import { MainUI }                                    from '@Components/MainUI/MainUI.jsx'
import '@shoelace-style/shoelace/dist/themes/light.css'
import { LGS1920Context }                            from '@Core/LGS1920Context'
import { TrackUtils }                                from '@Utils/cesium/TrackUtils'
import * as Cesium                                   from 'cesium'
import { useEffect }                                 from 'react'
import { Camera, CameraFlyTo, Globe, Scene, Viewer } from 'resium'
import { MapLayer }                                  from './components/cesium/MapLayer'
import { InitErrorMessage }                          from './components/InitErrorMessage'
import { WelcomeModal }                              from './components/MainUI/WelcomeModal'
import { LayerManager }                              from './core/layers/LayerManager'
import { UIToast }                                   from './Utils/UIToast'

/***************************************
 * Init Application context
 */
window.lgs = new LGS1920Context()


// Application initialisation
const initApp = await __.app.init()

// If Init is OK, we have some additional tasks to do.

if (initApp.status) {
    // Set DefaultTheme
    __.app.setTheme()

    // Init UI managers
    lgs.initManagers()

    // Init Layer
    __.layer = new LayerManager()


}

export function LGS1920() {

    const coordinates = {
        position: {
            longitude: lgs.configuration.starter.camera.longitude,
            latitude:  lgs.configuration.starter.camera.latitude,
            height:    lgs.configuration.starter.camera.height,
            heading:   lgs.configuration.starter.camera.heading,
            pitch:     lgs.configuration.starter.camera.pitch,
            roll:      lgs.configuration.starter.camera.roll,
        },
    }

    const startCameraPoint = () => {
        return Cesium.Cartesian3.fromDegrees(
            coordinates.position.longitude,
            coordinates.position.latitude,
            coordinates.position.height,
        )
    }

    const cameraOrientation = () => {
        return {
            heading: Cesium.Math.toRadians(coordinates.position.heading),
            pitch:   Cesium.Math.toRadians(coordinates.position.pitch),
            roll:    Cesium.Math.toRadians(coordinates.position.roll),
        }
    }

    const cameraStore = lgs.mainProxy.components.camera

    const rotateCamera = async () => {
        if (lgs.journeys.size === 0) {
            await __.ui.cameraManager.runOrbital({})
        }
    }

    const raiseCameraUpdateEvent = async () => {
        await __.ui.cameraManager.raiseUpdateEvent({})
    }

    useEffect(() => {
        try {
            if (initApp.status) {
                // Init was OK, we have somme additional tasks to do.

                // Set body class to manage css versus platform
                document.body.classList.add(lgs.platform);

                (async () => {
                    // Read DB
                    await TrackUtils.readAllFromDB()

                    //Ready
                    UIToast.success({
                                        caption: `Welcome on ${lgs.configuration.applicationName}!`,
                                        text:    'We\'re ready to assist you !',
                                    })
                    console.log(`LGS1920 ${lgs.versions.studio} has been loaded and is ready on ${lgs.platform} platform !`)
                    console.log(`Connected to backend ${lgs.versions.backend}.`)
                })()

            }
            else {
                // Init was wrong, let'stop here
                UIToast.error({
                                  caption: `LGS1920 was stopped due to init errors!`,
                                  text:    `We're sorry`,
                              })
                console.log('LGS1920 was stopped due to init errors!')
                console.error(initApp.error)
            }
        }
        catch (error) {
            UIToast.error({
                              caption: `LGS1920 was stopped due to errors!`,
                              text:    `We're sorry`,
                          })
            console.log('LGS1920 was stopped due to errors!')
            console.error(error)
        }
    })

    return (<>

        {
            !initApp.status && <InitErrorMessage message={initApp.error.message}/>
        }
        {
            initApp.status &&
        <Viewer full
                timeline={false}
                animation={false}
                homeButton={false}
                navigationHelpButton={false}
                fullscreenButton={false}
                geocoder={false}
                infoBox={false}
                sceneModePicker={false}
                showRenderLoopErrors={false}
            //terrain={Cesium.Terrain.fromWorldTerrain({

            /* Y6VgRYi3iKQEttoa3G0v */
                terrain={new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl(`https://api.maptiler.com/tiles/terrain-quantized-mesh-v2/?key=${'qiE5uSYF7NoDFKCbfpfc'}`, {
                    requestVertexNormals: false,
                }))}

                id="studioMapViewer"

            /***********************/
            // Avoid consuming Cesium Ion Sessions
            // DO NOT CHANGE the 2 following lines
                imageryProvider={false}
                baseLayerPicker={false}
        >
            <MapLayer/>

            <Scene verticalExaggeration={1.3}></Scene>
            <Globe enableLighting={false} depthTestAgainstTerrain={true}></Globe>
            <Camera onChange={raiseCameraUpdateEvent}>
                <CameraFlyTo
                    orientation={cameraOrientation()}
                    duration={3}
                    destination={startCameraPoint()}
                    maximumHeight={10000}
                    once={true}
                    onComplete={rotateCamera}
                />
            </Camera>


            <MainUI/>
            <WelcomeModal/>

        </Viewer>
        }
    </>)
}

