import '@shoelace-style/shoelace/dist/themes/light.css'
import { LayersUtils }                                                                                  from '@Utils/cesium/LayersUtils'
import {
    SceneUtils,
}                                                                                                       from '@Utils/cesium/SceneUtils'
import { Cartesian3, ImageryLayerCollection, Math as M, Viewer as CesiumViewer, WebMercatorProjection } from 'cesium'

export function Viewer() {

    const coordinates = {
        position: {
            longitude: lgs.settings.starter.longitude,
            latitude:  lgs.settings.starter.latitude,
            height:    lgs.settings.starter.height,
            heading:   lgs.settings.starter.camera.heading,
            pitch:     lgs.settings.starter.camera.pitch,
            roll:      lgs.settings.starter.camera.roll,
        },
    }

    const startCameraPoint = () => {
        return Cartesian3.fromDegrees(
            coordinates.position.longitude,
            coordinates.position.latitude,
            coordinates.position.height,
        )
    }

    const cameraOrientation = () => {
        return {
            heading: M.toRadians(coordinates.position.heading),
            pitch:   M.toRadians(coordinates.position.pitch),
            roll:    M.toRadians(coordinates.position.roll),
        }
    }

    const cameraStore = lgs.mainProxy.components.camera


    const raiseCameraUpdateEvent = async () => {
        await __.ui.cameraManager.raiseUpdateEvent({})
    }
    // If initialisation phase was OK, we have somme additional tasks to do.

    // Initialize the Cesium Viewer only once
    if (!lgs.viewer) {
        lgs.viewer = new CesiumViewer('cesium-viewer', {
            homeButton:           false,
            timeline:             false,
            animation:            false,
            navigationHelpButton: false,
            fullscreenButton:     false,
            geocoder:             false,
            infoBox:              false,
            sceneModePicker:      false,
            showRenderLoopErrors: false,
            mapProjection:        new WebMercatorProjection(), // TODO is it a problem in 3D ?
            // Avoid consuming Cesium Ion Sessions
            // DO NOT CHANGE the 2 following lines
            imageryProvider: false,
            baseLayerPicker: false,
        })
    }
    // Change scene mode
    lgs.viewer.scene.sceneMode = SceneUtils.modeFromLGSToGIS(lgs.settings.scene.mode)

    // Add some globe parameters
    lgs.scene.globe.enableLighting = false
    lgs.scene.globe.depthTestAgainstTerrain = true

    //Layers
    const layerCollection = new ImageryLayerCollection()
    layerCollection.layerAdded = LayersUtils.layerOrder

    // Manage Camera
    lgs.camera.changed.addEventListener(raiseCameraUpdateEvent)

    __.ui.sceneManager.focus(coordinates.position, {
        heading:  lgs.settings.starter.camera.heading,
        pitch:    (lgs.settings.starter.camera.canRotate || __.ui.sceneManager.noRelief())
                  ? lgs.settings.starter.camera.pitch
                  : -90,
        roll:     lgs.settings.starter.camera.roll,
        range:    lgs.settings.starter.camera.range,
        infinite: true,
        rotate:   lgs.settings.starter.camera.canRotate && lgs.journeys.size === 0,
        lookAt:   true,
        rpm:      lgs.settings.starter.camera.rpm,
    })

    return (<></>)
}

