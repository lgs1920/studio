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
 * Last modified: 2026-09-22
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
 * Waits for the next browser paint opportunity.
 *
 * @returns {Promise<void>} Promise resolved on the next animation frame.
 */
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

/**
 * Resolves when the app surface has had a chance to render, with a timeout
 * fallback so the welcome CTA cannot remain blocked by a missing render event.
 *
 * @returns {Promise<void>} Promise resolved once the surface is ready enough to enter.
 */
const waitForAppSurfaceReady = () => new Promise(resolve => {
    const scene = lgs?.scene
    let done = false
    const cleanup = []
    const finish = () => {
        if (done) {
            return
        }
        done = true
        cleanup.forEach(remove => remove?.())
        resolve()
    }

    const timeout = window.setTimeout(finish, APP_SURFACE_READY_TIMEOUT)
    cleanup.push(() => window.clearTimeout(timeout))

    if (!scene) {
        void nextFrame().then(finish)
        return
    }

    const removePostRenderListener = scene.postRender?.addEventListener?.(finish)
    if (typeof removePostRenderListener === 'function') {
        cleanup.push(removePostRenderListener)
    }

    scene.requestRender?.()
    nextFrame().then(() => {
        scene.requestRender?.()
        return nextFrame()
    }).then(finish, finish)
})

/**
 * Renders the map, controls, drawers, and app-level overlays.
 *
 * @param {{onReady?: () => void}} props - Surface readiness callback.
 * @returns {JSX.Element} Mounted application surface.
 */
export const AppSurface = ({onReady}) => {
    useEffect(() => {
        let cancelled = false
        void (async () => {
            await nextFrame()
            await nextFrame()
            await waitForAppSurfaceReady()
            if (!cancelled) {
                onReady?.()
            }
        })()
        return () => {
            cancelled = true
        }
    }, [onReady])

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
