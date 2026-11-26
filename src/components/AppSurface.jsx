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
 * Last modified: 2026-11-26
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
import {markStartup} from '@Core/ui/startup/startupTelemetry'
import {useEffect} from 'react'

const APP_SURFACE_READY_WARNING_TIMEOUT = 1500
const APP_SURFACE_READY_TIMEOUT = 10000

/** Keep the selected map layers mounted throughout startup and interactive use. */
export const AppMapLayers = () => (
    <>
        <MapLayer type={BASE_ENTITY}/>
        <MapLayer type={OVERLAY_ENTITY}/>
        <Base3DLayer/>
        <Tiles3DLayer/>
    </>
)

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
 * Listen for the first completed Cesium frame after the application surface mounts.
 * @param {(ready: boolean) => void} onResult Completion callback.
 * @returns {() => void} Cleanup for the render listener and timeout.
 */
const watchAppSurfaceReady = onResult => {
    const scene = globalThis.lgs?.scene
    let done = false

    /** Stop observing on completion or unmount. */
    const cleanup = () => {
        if (!done) {
            done = true
            window.clearTimeout(warningTimeout)
            window.clearTimeout(timeout)
            removePostRenderListener?.()
        }
    }

    /** Report readiness or timeout once for the current surface. */
    const finish = ready => {
        if (!done) {
            cleanup()
            onResult(ready)
        }
    }

    const warningTimeout = window.setTimeout(() => {
        const state = getCesiumSurfaceState()
        console.warn('[LGS1920][Cesium] Surface readiness is taking longer than expected.', {
            ...state,
            timeoutMs: APP_SURFACE_READY_WARNING_TIMEOUT,
        })
        globalThis.lgs?.viewer?.forceResize?.()
        scene?.requestRender?.()
    }, APP_SURFACE_READY_WARNING_TIMEOUT)
    const timeout = window.setTimeout(() => finish(false), APP_SURFACE_READY_TIMEOUT)
    const removePostRenderListener = scene?.postRender?.addEventListener?.(() => {
        if (globalThis.lgs?.scene === scene && getCesiumSurfaceState().surfaceAvailable) {
            finish(true)
        }
    })

    scene?.requestRender?.()
    return cleanup
}

/**
 * Renders the map, controls, drawers, and app-level overlays.
 *
 * @param {{initialMapTilesReady?: boolean, onReady?: () => void, onError?: (error: Error) => void}} props - Surface readiness and map callbacks.
 * @returns {JSX.Element} Mounted application surface.
 */
export const AppSurface = ({initialMapTilesReady = true, onReady, onError}) => {
    useEffect(() => {
        markStartup('surface-mounted')
        return watchAppSurfaceReady(ready => {
            if (ready) {
                onReady?.()
                return
            }

            const state = getCesiumSurfaceState()
            const error = new Error('[LGS1920][Cesium] Surface readiness timed out: Cesium did not complete its first render.')
            console.error('[LGS1920][Cesium] Surface readiness failed.', {
                ...state,
                error: error.message,
            })
            onError?.(error)
        })
    }, [onError, onReady])

    useEffect(() => () => {
        __.ui.replay?.stop?.({emit: false})
        __.ui.replay?.restoreJourneyToolbarVisibility?.()
    }, [])

    return (
        <>
            <div id="drawer-root" className="drawer-wrapper"/>
            <ToolsUI/>
            <MainUI initialMapTilesReady={initialMapTilesReady}/>
            <ResponsiveDevice/>
            <Viewer/>
            <Base3DLoadingOverlay/>
            <SelectionIndicator/>
            <Toast/>
        </>
    )
}
