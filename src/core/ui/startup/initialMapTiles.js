/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: initialMapTiles.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-25
 * Last modified: 2026-11-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const INITIAL_TILES_READY_TIMEOUT = 5000

/** Report a slow provider, then keep waiting for a rendered frame with the selected map tiles. */
export const watchInitialMapTiles = (context, onResult) => {
    const {scene, settings} = context
    let stopped = false
    let deadlineReached = false
    let fallbackReported = false
    const stop = () => {
        if (stopped) return
        stopped = true
        window.clearTimeout(timeout)
        remove()
    }
    const finish = status => {
        if (stopped) return
        stop()
        onResult(status)
    }
    /** Release startup on the visible 2D base while Cesium continues loading detail. */
    const reportFallback = () => {
        const {base} = settings.layers
        if (fallbackReported || !base || !scene.globe.show || context.theLayer?.ready !== true) {
            return
        }

        fallbackReported = true
        onResult('fallback')
    }
    const timeout = window.setTimeout(() => {
        deadlineReached = true
        reportFallback()
        if (!fallbackReported) {
            onResult('timeout')
        }
    }, INITIAL_TILES_READY_TIMEOUT)
    const remove = scene.postRender.addEventListener(() => {
        const {base, overlay, base3d, tiles3d} = settings.layers
        const globeBaseReady = !base || !scene.globe.show || context.theLayer?.ready === true
        // A visible globe supplies complete fallback imagery while 3D detail refines.
        const base3dReady = !base3d || scene.globe.show || context.base3dTileset?.tilesLoaded === true
        const baseReady = globeBaseReady && base3dReady
        const overlayReady = base3d || !overlay || context.theLayerOverlay?.ready
        const tileset = context.theTiles3DLayer
        const tilesetReady = !tiles3d || tileset?.show === false || tileset?.tilesLoaded === true
        const globeReady = !scene.globe.show || scene.globe.tilesLoaded
        if (baseReady && overlayReady && tilesetReady && globeReady) {
            finish('ready')
            return
        }

        if (deadlineReached) {
            reportFallback()
        }
    })
    scene.requestRender()
    return stop
}
