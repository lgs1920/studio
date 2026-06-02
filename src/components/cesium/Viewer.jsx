/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Viewer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@shoelace-style/shoelace/dist/themes/light.css'
/* eslint-disable react-refresh/only-export-components */
import { CanvasEventManager } from '@Core/events/CanvasEventManager'
import { LayersUtils }        from '@Utils/cesium/LayersUtils'
import { SceneUtils }                                                                                  from '@Utils/cesium/SceneUtils'
import { Color, ImageryLayerCollection, ScreenSpaceEventType, Viewer as CesiumViewer, WebMercatorProjection } from 'cesium'
import { useEffect }                                                                                   from 'react'

let layersInitialized = false
let cameraUpdateHandlerAttached = false
let canvasEventsInitialized = false
let cameraUpdateInProgress = false

const VIEWER_BASE_COLOR = Color.fromCssColorString('hsla(125, 87%, 18%, 0.95)')

export const ensureViewer = () => {

    /**
     * We manage our own camera update event
     *
     * @return {Promise<void>}
     */
    const flushCameraUpdate = async (options = {}) => {
        if (cameraUpdateInProgress) {
            return
        }

        cameraUpdateInProgress = true
        try {
            await __.ui.cameraManager.raiseUpdateEvent(options)
        }
        finally {
            cameraUpdateInProgress = false
        }
    }

    const raiseCameraUpdateEvent = async () => {
        if (__.ui.cameraManager?.isRotating?.() || __.ui.cameraManager?.isFlying?.() || lgs.stores.ui.mainUI.panorama.active) {
            return
        }

        await flushCameraUpdate()
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
    lgs.scene.globe.baseColor = VIEWER_BASE_COLOR.clone()
    lgs.scene.backgroundColor = VIEWER_BASE_COLOR.clone()

    //lgs.scene.maximumRenderTimeChange = 0.2
    //lgs.scene.debugShowFramesPerSecond=true

    lgs.scene.shadows = true
    lgs.scene.requestRenderMode = true

    lgs.viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)


    //Layers
    if (!layersInitialized) {
        const layerCollection = new ImageryLayerCollection()
        layerCollection.layerAdded = LayersUtils.layerOrder
        layersInitialized = true
    }

    // Manage Camera
    if (!cameraUpdateHandlerAttached) {
        lgs.camera.changed.addEventListener(raiseCameraUpdateEvent)
        cameraUpdateHandlerAttached = true
    }

    // Manage events
    if (!canvasEventsInitialized) {
        __.canvasEvents = new CanvasEventManager(lgs.viewer)
        canvasEventsInitialized = true
    }
}

export function Viewer() {
    useEffect(() => {
        ensureViewer()
        __.ui.flythrough?.bindCesiumCameraBridge?.()
    }, [])

    return (<></>)
}
