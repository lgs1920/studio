/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Viewer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-08
 * Last modified: 2025-05-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import '@shoelace-style/shoelace/dist/themes/light.css'
import { CanvasEventManager } from '@Core/events/CanvasEventManager'
import { LayersUtils }        from '@Utils/cesium/LayersUtils'
import { SceneUtils }                                                                                  from '@Utils/cesium/SceneUtils'
import { ImageryLayerCollection, ScreenSpaceEventType, Viewer as CesiumViewer, WebMercatorProjection } from 'cesium'
import { useEffect }                                                                                   from 'react'

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

    /**
     * We manage our own camera update event
     *
     * @return {Promise<void>}
     */
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
            showRenderLoopErrors: true,
            resolutionScale: 2,
            mapProjection:        new WebMercatorProjection(), // TODO is it a problem in 3D ?
            //selectionIndicator: false,
            //*************************************
            // Avoid consuming Cesium Ion Sessions
            // DO NOT CHANGE the 2 following lines
            //*************************************
            imageryProvider: false,
            baseLayerPicker: false,
        })
    }

    // Change scene mode
    lgs.viewer.scene.sceneMode = SceneUtils.modeFromLGSToGIS(lgs.settings.scene.mode)

    // Add some globe parameters
    lgs.scene.globe.enableLighting = false
    lgs.scene.globe.depthTestAgainstTerrain = true

    //lgs.scene.maximumRenderTimeChange = 0.2
    //lgs.scene.debugShowFramesPerSecond=true

    lgs.scene.shadows = true
    lgs.scene.requestRenderMode = true

    lgs.viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)


    //Layers
    const layerCollection = new ImageryLayerCollection()
    layerCollection.layerAdded = LayersUtils.layerOrder

    // Manage Camera
    lgs.camera.changed.addEventListener(raiseCameraUpdateEvent)

    // Manage events
    __.canvasEvents = new CanvasEventManager(lgs.viewer)


    return (<></>)
}

