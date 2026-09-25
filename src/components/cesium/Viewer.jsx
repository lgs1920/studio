/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Viewer.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-12-11
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@shoelace-style/shoelace/dist/themes/light.css'
/* oxlint-disable react/only-export-components */
import { CanvasEventManager } from '@Core/events/CanvasEventManager'
import {constrainReplayCesiumCameraAboveTerrain} from '@Core/ui/replay/ReplayCesiumCameraAdapter'
import { SceneUtils }                                                                                  from '@Utils/cesium/SceneUtils'
import { Color, ScreenSpaceEventType, Viewer as CesiumViewer, WebMercatorProjection } from 'cesium'
import { useEffect }                                                                                   from 'react'

let viewerLifecycle = null
let cameraUpdateInProgress = false
let cameraTerrainCorrectionInProgress = false

const VIEWER_BASE_COLOR = Color.fromCssColorString('hsla(125, 87%, 18%, 0.95)')

const isViewerDestroyed = viewer => {
    if (!viewer || typeof viewer.isDestroyed !== 'function') {
        return false
    }

    try {
        return viewer.isDestroyed()
    }
    catch {
        return true
    }
}

const describeCesiumError = error => ({
    name:    error?.name,
    message: error?.message ?? String(error),
    stack:   error?.stack,
})

const resetViewerLifecycle = viewer => {
    viewerLifecycle = {
        viewer,
        cameraUpdateHandlerAttached: false,
        canvasEventsInitialized:     false,
        renderErrorAttached:         false,
        canvasErrorListenersAttached: false,
    }
}

const constrainCameraAboveTerrain = () => {
    if (cameraTerrainCorrectionInProgress) {
        return
    }

    cameraTerrainCorrectionInProgress = true
    try {
        constrainReplayCesiumCameraAboveTerrain({
            camera: lgs.camera,
            scene: lgs.scene,
        })
    }
    finally {
        cameraTerrainCorrectionInProgress = false
    }
}

const getViewerContainer = () => {
    const container = document.getElementById('cesium-viewer')
    if (!container) {
        const error = new Error('[LGS1920][Cesium] The #cesium-viewer container is missing.')
        console.error(error.message)
        throw error
    }
    return container
}

const getOrCreateViewer = () => {
    const container = getViewerContainer()

    if (isViewerDestroyed(lgs.viewer)) {
        console.warn('[LGS1920][Cesium] Discarding a destroyed viewer before reinitialization.')
        lgs.viewer = null
    }

    if (!lgs.viewer) {
        try {
            lgs.viewer = new CesiumViewer(container, {
                homeButton:           false,
                timeline:             false,
                animation:            false,
                navigationHelpButton: false,
                fullscreenButton:     false,
                geocoder:             false,
                infoBox:              false,
                sceneModePicker:      false,
                showRenderLoopErrors: true,
                resolutionScale:      2,
                mapProjection:        new WebMercatorProjection(), // TODO is it a problem in 3D ?
                //selectionIndicator: false,
                //*************************************
                // Avoid consuming Cesium Ion Sessions
                // DO NOT CHANGE the 2 following lines
                //*************************************
                baseLayer:             false,
                baseLayerPicker:       false,
            })
        }
        catch (error) {
            console.error('[LGS1920][Cesium] Viewer construction failed.', {
                containerConnected: container.isConnected,
                containerSize:      {width: container.clientWidth, height: container.clientHeight},
                error:              describeCesiumError(error),
            })
            throw error
        }
    }

    if (!viewerLifecycle || viewerLifecycle.viewer !== lgs.viewer) {
        resetViewerLifecycle(lgs.viewer)
    }

    if (!lgs.viewer.scene || !lgs.viewer.camera || !lgs.viewer.scene.canvas) {
        const error = new Error('[LGS1920][Cesium] Viewer was created without a scene, camera, or canvas.')
        console.error(error.message)
        throw error
    }

    return lgs.viewer
}

const attachViewerDiagnostics = viewer => {
    const scene = viewer.scene

    if (!viewerLifecycle.renderErrorAttached) {
        scene.renderError?.addEventListener?.((renderScene, error) => {
            console.error('[LGS1920][Cesium] Scene render failed.', {
                sceneDestroyed: renderScene?.isDestroyed?.(),
                error:         describeCesiumError(error),
            })
        })
        viewerLifecycle.renderErrorAttached = true
    }

    if (!viewerLifecycle.canvasErrorListenersAttached && scene.canvas?.addEventListener) {
        const reportContextLost = event => {
            console.error('[LGS1920][Cesium] WebGL context lost.', {
                statusMessage: event?.statusMessage,
            })
        }

        const reportContextRestored = () => {
            console.warn('[LGS1920][Cesium] WebGL context restored; requesting a render.')
            scene.requestRender?.()
        }
        scene.canvas.addEventListener('webglcontextlost', reportContextLost)
        scene.canvas.addEventListener('webglcontextrestored', reportContextRestored)
        viewerLifecycle.canvasErrorListenersAttached = true
    }

    viewer.forceResize?.()
    scene.requestRender?.()
}

/**
 * Creates the Cesium surface before the asynchronous Studio startup begins.
 * The full application wiring is intentionally left to ensureViewer.
 *
 * @returns {Viewer} A live Cesium viewer.
 */
export const ensureViewerBase = () => {
    const viewer = getOrCreateViewer()
    attachViewerDiagnostics(viewer)
    return viewer
}

/**
 * Gives the static DOM shell a short window to become available before failing.
 * This is intentionally bounded so a real WebGL failure remains visible to startup.
 *
 * @param {{attempts?: number, delayMs?: number}} options Retry configuration.
 * @returns {Promise<Viewer>} A live Cesium viewer.
 */
export const ensureViewerBaseWithRetry = async ({attempts = 4, delayMs = 100} = {}) => {
    let lastError

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return ensureViewerBase()
        }
        catch (error) {
            lastError = error
            if (attempt === attempts - 1) {
                break
            }

            console.warn('[LGS1920][Cesium] Viewer bootstrap retry scheduled.', {
                attempt: attempt + 1,
                attempts,
                error:   describeCesiumError(error),
            })
            await new Promise(resolve => globalThis.setTimeout(resolve, delayMs))
        }
    }

    throw lastError
}

export const ensureViewer = () => {
    const viewer = ensureViewerBase()

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

    // Change scene mode
    viewer.scene.sceneMode = SceneUtils.modeFromLGSToGIS(lgs.settings.scene.mode)

    // Add some globe parameters
    lgs.scene.globe.enableLighting = false
    lgs.scene.globe.depthTestAgainstTerrain = true
    lgs.scene.globe.baseColor = VIEWER_BASE_COLOR.clone()
    lgs.scene.backgroundColor = VIEWER_BASE_COLOR.clone()

    const cameraController = lgs.scene.screenSpaceCameraController
    if (cameraController) {
        cameraController.enableCollisionDetection = true
        cameraController.maximumTiltAngle = Math.PI / 2
        cameraController.minimumCollisionTerrainHeight = 15000
    }

    //lgs.scene.maximumRenderTimeChange = 0.2
    //lgs.scene.debugShowFramesPerSecond=true

    lgs.scene.shadows = true
    lgs.scene.requestRenderMode = true

    viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

    // Manage Camera
    if (!viewerLifecycle.cameraUpdateHandlerAttached) {
        lgs.camera.changed.addEventListener(constrainCameraAboveTerrain)
        lgs.scene.postRender.addEventListener(constrainCameraAboveTerrain)
        lgs.camera.changed.addEventListener(raiseCameraUpdateEvent)
        viewerLifecycle.cameraUpdateHandlerAttached = true
    }

    // Manage events
    if (!viewerLifecycle.canvasEventsInitialized) {
        __.canvasEvents = new CanvasEventManager(lgs.viewer)
        viewerLifecycle.canvasEventsInitialized = true
    }

    lgs.scene.requestRender?.()

    return viewer
}

export function Viewer() {
    useEffect(() => {
        ensureViewer()
        __.ui.replay?.bindCesiumCameraBridge?.()
    }, [])

    return (<></>)
}
