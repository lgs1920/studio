/**
 * React
 */
import { VT3D_UI }     from '@Components/VT3D_UI/VT3D_UI.jsx'
import { VT3D }        from '@Core/VT3D'
import { CameraUtils } from '@Utils/cesium/CameraUtils.js'
import { TrackUtils }  from '@Utils/cesium/TrackUtils'

import * as Cesium                                                         from 'cesium'
import { useEffect, useRef }                                               from 'react'
import { Camera, CameraFlyTo, Entity, Globe, ImageryLayer, Scene, Viewer } from 'resium'

/**
 * We are using shoelace Web components
 */
import '@shoelace-style/shoelace/dist/themes/light.css'
import { Profiler }                                                        from './core/ui/Profiler'
import { UIToast }                                                         from './Utils/UIToast'

//setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.13.1/cdn/')
window.vt3d = new VT3D()
await __.app.init()

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

        const readAllFromDB = async () => {
            await TrackUtils.readAllFromDB()
        }


        // Set DefaultTheme
        __.app.setTheme()

        // Update camera info
        CameraUtils.updatePosition(vt3d?.camera).then(async r => {
        })

        // Read DB
        readAllFromDB()

        // Init Managers
        __.ui.profiler = new Profiler()


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
            {/* <ImageryLayer imageryProvider={new Cesium.OpenStreetMapImageryProvider({ */}
            {/*     url: 'https://a.tile.openstreetmap.org/', */}
            {/* })}/> */}


            {/* <ImageryLayer imageryProvider={new Cesium.WebMapTileServiceImageryProvider({ */}
            {/*     url: 'https://wxs.ign.fr/cartes/geoportail/wmts', */}
            {/*     layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', */}
            {/*     style: 'normal', */}
            {/*     format: 'image/png', */}
            {/*     tileMatrixSetID: 'PM', */}
            {/* })} */}


            <ImageryLayer imageryProvider={new Cesium.WebMapTileServiceImageryProvider({
                url: 'https://wxs.ign.fr/cartes/geoportail/wmts',
                layer: 'ORTHOIMAGERY.ORTHOPHOTOS2',
                style: 'normal',
                format: 'image/png',
                tileMatrixSetID: 'PM',
            })}/>


            {/* <ImageryLayer imageryProvider={new Cesium.WebMapTileServiceImageryProvider({ */}
            {/*     url: 'https://wxs.ign.fr/cartes/geoportail/wmts', */}
            {/*     layer: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS', */}
            {/*     style: 'normal', */}
            {/*     format: 'image/png', */}
            {/*     tileMatrixSetID: 'PM', */}
            {/* })}/> */}

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
    </>)
}

