/**
 * React
 */
import { VT3D_UI }                 from '@Components/VT3D_UI/VT3D_UI.jsx'
import { Camera as CameraManager } from '@Core/ui/Camera'
/**
 * We are using shoelace Web components
 */
import '@shoelace-style/shoelace/dist/themes/light.css'
import { VT3D }                    from '@Core/VT3D'
import { CameraUtils }             from '@Utils/cesium/CameraUtils.js'
import { TrackUtils }              from '@Utils/cesium/TrackUtils'

import * as Cesium                                                         from 'cesium'
import { useEffect, useRef }                                               from 'react'
import { Camera, CameraFlyTo, Entity, Globe, ImageryLayer, Scene, Viewer } from 'resium'
import { UIToast }                                                         from './Utils/UIToast'

//setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.13.1/cdn/')
window.vt3d = new VT3D()
await __.app.init()

export function ViewTrack3D() {

    const viewerRef = useRef(null)

    const starter = vt3d.configuration.starter
    vt3d.windowCenter = Cesium.Cartesian3.fromDegrees(starter.longitude, starter.latitude, starter.height)

    vt3d.cameraOrientation = {
        heading: Cesium.Math.toRadians(starter.camera.heading),
        pitch: Cesium.Math.toRadians(starter.camera.pitch),
        roll: Cesium.Math.toRadians(starter.camera.roll),
    }

    const cameraStore = vt3d.mainProxy.components.camera

    const run360 = () => {
        CameraUtils.run360()
    }

    const updateCameraPosition = () => {
        CameraUtils.updateCamera().then(data => {
            if (data !== undefined) {
                cameraStore.position = data
            }
            vt3d.events.emit(CameraManager.MOVE_EVENT, [data])
        })

    }


    useEffect(() => {

        const readAllFromDB = async () => {
            await TrackUtils.readAllFromDB()
        }


        // Set DefaultTheme
        __.app.setTheme()

        // Update camera info
        CameraUtils.updateCamera(vt3d?.camera).then(async r => {
        })

        // Read DB
        readAllFromDB()

        vt3d.initManagers()


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
                baseLayerPicker={false}
                sceneModePicker={false}
                terrain={Cesium.Terrain.fromWorldTerrain({
                    requestVertexNormals: false,
                })}
                id="viewTrack3DViewer"
            //   imageryProvider={true}
            // baseLayer={Cesium.ImageryLayer.fromWorldImagery({
            //     style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS,
            // })}
            //     imageryProvider={new Cesium.WebMapTileServiceImageryProvider({
            //         url: 'https://wxs.ign.fr/cartes/geoportail/wmts',
            //         layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
            //         style: 'normal',
            //         format: 'image/png',
            //         tileMatrixSetID: 'PM',
            //     })}
                ref={viewerRef}
        >
            <ImageryLayer imageryProvider={new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/',
            })}/>


            {/* <ImageryLayer imageryProvider={new Cesium.WebMapTileServiceImageryProvider({ */}
            {/*     url: 'https://wxs.ign.fr/cartes/geoportail/wmts', */}
            {/*     layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', */}
            {/*     style: 'normal', */}
            {/*     format: 'image/png', */}
            {/*     tileMatrixSetID: 'PM', */}
            {/* })} */}


            {/* <ImageryLayer imageryProvider={new Cesium.WebMapTileServiceImageryProvider({ */}
            {/*     url: 'https://wxs.ign.fr/cartes/geoportail/wmts', */}
            {/*     layer: 'ORTHOIMAGERY.ORTHOPHOTOS2', */}
            {/*     style: 'normal', */}
            {/*     format: 'image/png', */}
            {/*     tileMatrixSetID: 'PM', */}
            {/* })}/> */}


            {/* <ImageryLayer imageryProvider={new Cesium.WebMapTileServiceImageryProvider({ */}
            {/*     url: 'https://wxs.ign.fr/cartes/geoportail/wmts', */}
            {/*     layer: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS', */}
            {/*     style: 'normal', */}
            {/*     format: 'image/png', */}
            {/*     tileMatrixSetID: 'PM', */}
            {/* })}/> */}

            <Scene></Scene>
            <Globe enableLighting={false}></Globe>
            <Camera onMoveEnd={updateCameraPosition} ref={viewerRef}>
                <CameraFlyTo
                    orientation={vt3d.cameraOrientation}
                    duration={3}
                    destination={vt3d.windowCenter}
                    once={true}
                    onComplete={run360}
                />
            </Camera>
            <Entity id={'markers-group'}/>
            <VT3D_UI/>
        </Viewer>
    </>)
}

