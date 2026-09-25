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
 * Last modified: 2026-09-25
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

const getCesiumSurfaceState = () => {
    const scene = globalThis.lgs?.scene
    const canvas = scene?.canvas
    const viewer = globalThis.lgs?.viewer
    const viewerDestroyed = viewer?.isDestroyed?.() === true

    return {
        ready: !viewerDestroyed && Boolean(canvas),
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
 * Resolves when the app surface has had a chance to render, with a timeout
 * fallback so the welcome CTA cannot remain blocked by a missing render event.
 *
 * @returns {Promise<void>} Promise resolved once the surface is ready enough to enter.
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

    const timeout = window.setTimeout(() => finish(getCesiumSurfaceState().ready), APP_SURFACE_READY_TIMEOUT)
    cleanup.push(() => window.clearTimeout(timeout))

    const removePostRenderListener = scene?.postRender?.addEventListener?.(() => {
        if (getCesiumSurfaceState().ready) {
            finish(true)
        }
    })
    if (typeof removePostRenderListener === 'function') {
        cleanup.push(removePostRenderListener)
    }

    const poll = () => {
        if (done) {
            return
        }

        const surfaceState = getCesiumSurfaceState()
        if (surfaceState.ready) {
            finish(true)
            return
        }

        globalThis.requestAnimationFrame(poll)
    }
    scene?.requestRender?.()
    poll()
})

/**
 * Renders the map, controls, drawers, and app-level overlays.
 *
 * @param {{onReady?: () => void, onError?: (error: Error) => void}} props - Surface readiness callbacks.
 * @returns {JSX.Element} Mounted application surface.
 */
export const AppSurface = ({onReady, onError}) => {
    useEffect(() => {
        console.error('[LGS1920][Diagnostics] AppSurface mounted')

        const inspectPointerTarget = event => {
            const target = event.target instanceof Element ? event.target : null
            const point = {x: event.clientX ?? 0, y: event.clientY ?? 0}
            const topElement = document.elementFromPoint?.(point.x, point.y)
            const stack = document.elementsFromPoint?.(point.x, point.y) ?? []
            console.error('[LGS1920][Diagnostics] app pointer', {
                type: event.type,
                point,
                target: target?.tagName?.toLowerCase() ?? null,
                targetId: target?.id ?? null,
                topElement: topElement?.tagName?.toLowerCase() ?? null,
                topElementId: topElement?.id ?? null,
                stack: stack.slice(0, 12).map(element => ({
                    tag: element.tagName.toLowerCase(),
                    id: element.id || null,
                    className: typeof element.className === 'string' ? element.className : null,
                    pointerEvents: getComputedStyle(element).pointerEvents,
                    position: getComputedStyle(element).position,
                    zIndex: getComputedStyle(element).zIndex,
                })),
                editing: lgs.stores.ui.video.editing,
                simplePreparationActive: lgs.stores.replay.simplePreparationActive,
            })
        }

        window.addEventListener('pointerdown', inspectPointerTarget, true)
        window.addEventListener('mousedown', inspectPointerTarget, true)
        window.addEventListener('click', inspectPointerTarget, true)
        const reportUnhandledRejection = event => {
            const reason = event.reason
            const reasonText = reason instanceof Error
                ? `${reason.name}: ${reason.message}`
                : String(reason)
            console.error(`[LGS1920][Diagnostics] unhandled rejection: ${reasonText}`)
            console.error('[LGS1920][Diagnostics] rejection stack:', reason?.stack ?? '(no stack)')
            console.error('[LGS1920][Diagnostics] rejection value:', reason)
        }
        const reportRuntimeError = event => {
            console.error('[LGS1920][Diagnostics] runtime error', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error,
            })
        }
        window.addEventListener('unhandledrejection', reportUnhandledRejection)
        window.addEventListener('error', reportRuntimeError)
        return () => {
            window.removeEventListener('pointerdown', inspectPointerTarget, true)
            window.removeEventListener('mousedown', inspectPointerTarget, true)
            window.removeEventListener('click', inspectPointerTarget, true)
            window.removeEventListener('unhandledrejection', reportUnhandledRejection)
            window.removeEventListener('error', reportRuntimeError)
        }
    }, [])

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
                    const error = new Error('[LGS1920][Cesium] Surface readiness timed out: no Cesium canvas is available.')
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
