/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppSurface.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Base3DLayer} from '@Components/cesium/Base3DLayer'
import {Base3DLoadingOverlay} from '@Components/cesium/Base3DLoadingOverlay'
import {MapLayer} from '@Components/cesium/MapLayer'
import {Tiles3DLayer} from '@Components/cesium/Tiles3DLayer'
import {Viewer} from '@Components/cesium/Viewer'
import {MainUI} from '@Components/MainUI/MainUI.jsx'
import ResponsiveDevice from '@Components/MainUI/ResponsiveDevice'
import {SelectionIndicator} from '@Components/MainUI/SelectionIndicator'
import {ToolsUI} from '@Components/MainUI/ToolsUI'
import {Toast} from '@Components/Toast'
import {BASE_ENTITY, OVERLAY_ENTITY} from '@Core/constants'
import {useEffect} from 'react'

const APP_SURFACE_READY_TIMEOUT = 1500

/**
 * Describes whether the current Cesium surface can accept a completed frame.
 *
 * @returns {{surfaceAvailable: boolean, viewer: boolean, scene: boolean, canvas: boolean, viewerDestroyed: boolean}} Surface state.
 */
const getCesiumSurfaceState = () => {
    const scene = globalThis.lgs?.scene
    const canvas = scene?.canvas
    const viewer = globalThis.lgs?.viewer
    const viewerDestroyed = viewer?.isDestroyed?.() === true

    return {
        surfaceAvailable: !viewerDestroyed && Boolean(scene && canvas),
        viewer: Boolean(viewer),
        scene:  Boolean(scene),
        canvas: Boolean(canvas),
        viewerDestroyed,
    }
}

/**
 * Waits for the next browser paint opportunity.
 *
 * @returns {Promise<void>} Promise resolved on the next animation frame.
 */
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

/**
 * Resolves only after Cesium completes a frame, or fails when the render never arrives.
 *
 * @returns {Promise<boolean>} Whether Cesium completed its first render before the timeout.
 */
const waitForAppSurfaceReady = () => new Promise(resolve => {
    const scene = globalThis.lgs?.scene
    let done = false
    const cleanup = []
    const finish = ready => {
        if (done) {
            return
        }
        done = true
        cleanup.forEach(remove => remove?.())
        resolve(ready)
    }

    const timeout = window.setTimeout(() => finish(false), APP_SURFACE_READY_TIMEOUT)
    cleanup.push(() => window.clearTimeout(timeout))

    const removePostRenderListener = scene?.postRender?.addEventListener?.(() => {
        if (globalThis.lgs?.scene === scene && getCesiumSurfaceState().surfaceAvailable) {
            finish(true)
        }
    })
    if (typeof removePostRenderListener === 'function') {
        cleanup.push(removePostRenderListener)
    }

    scene?.requestRender?.()
})

/**
 * Renders the map, controls, drawers, and app-level overlays.
 *
 * @param {{onReady?: () => void, onError?: (error: Error) => void}} props - Surface readiness callbacks.
 * @returns {JSX.Element} Mounted application surface.
 */
export const AppSurface = ({onReady, onError}) => {
    useEffect(() => {
        let cancelled = false
        void (async () => {
            await nextFrame()
            await nextFrame()
            const surfaceReady = await waitForAppSurfaceReady()
            if (!cancelled) {
                if (surfaceReady) {
                    onReady?.()
                }
                else {
                    const state = getCesiumSurfaceState()
                    const error = new Error('[LGS1920][Cesium] Surface readiness timed out: Cesium did not complete its first render.')
                    console.error('[LGS1920][Cesium] Surface readiness failed.', {
                        ...state,
                        error: error.message,
                    })
                    onError?.(error)
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [onError, onReady])

    useEffect(() => () => {
        __.ui.replay?.stop?.({emit: false})
        __.ui.replay?.restoreJourneyToolbarVisibility?.()
    }, [])

    return (
        <>
            <div id="drawer-root" className="drawer-wrapper"/>
            <ToolsUI/>
            <MainUI/>
            <ResponsiveDevice/>
            <MapLayer type={BASE_ENTITY}/>
            <MapLayer type={OVERLAY_ENTITY}/>
            <Viewer/>
            <Base3DLayer/>
            <Base3DLoadingOverlay/>
            <Tiles3DLayer/>
            <SelectionIndicator/>
            <Toast/>
        </>
    )
}
