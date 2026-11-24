/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraTarget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-10-12
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaIcon} from '@awesome.me/webawesome/dist/react'
import {isCameraOwnedByReplay} from '@Core/ui/replay/ReplayCameraOwnership'
import {getMainSceneCameraPivot, setMainSceneCameraPivot} from '@Core/ui/MainSceneCameraPivot'
import {Cartesian2, Cartesian3, Math as CesiumMath, SceneMode, SceneTransforms} from 'cesium'
import {useCallback, useEffect, useRef} from 'react'
import {proxy, useSnapshot} from 'valtio/index'

const PIVOT_DRAG_HIT_SLOP = 14

const mapCameraContext = () => {
    const studio = globalThis.lgs
    const scene = studio?.scene ?? studio?.viewer?.scene
    const camera = studio?.camera ?? studio?.viewer?.camera
    const canvas = scene?.canvas
    return scene && camera && canvas ? {scene, camera, canvas} : null
}

const mainCameraContext = () => {
    const studio = globalThis.lgs
    const context = mapCameraContext()
    if (!context) return null
    const {scene, camera, canvas} = context
    const controller = scene?.screenSpaceCameraController
    const video = studio?.stores?.ui?.video
    if (!scene || !camera || !canvas || !controller?.enableInputs || scene.mode !== SceneMode.SCENE3D
        || video?.editing || video?.preRecording || video?.exporting || video?.snapshot || video?.finalizing
        || studio?.stores?.ui?.mainUI?.panorama?.active || studio?.stores?.ui?.mainUI?.cameraFlight?.running
        || isCameraOwnedByReplay(camera)) return null
    return {scene, camera, canvas}
}

const clientToCanvasPosition = (canvas, clientX, clientY) => {
    const rect = canvas.getBoundingClientRect()
    const width = canvas.clientWidth || rect.width
    const height = canvas.clientHeight || rect.height
    if (!rect.width || !rect.height || !width || !height) return null
    return new Cartesian2(
        CesiumMath.clamp((clientX - rect.left) * width / rect.width, 0, width),
        CesiumMath.clamp((clientY - rect.top) * height / rect.height, 0, height),
    )
}

const resolveWorldPosition = (scene, camera, screenPosition) => {
    const ray = camera.getPickRay(screenPosition)
    const ellipsoid = scene.globe?.ellipsoid ?? scene.ellipsoid
    let picked = null
    if (scene.pickPositionSupported) {
        try {
            picked = scene.pickPosition(screenPosition)
        }
        catch {
            picked = null
        }
    }
    picked ??= (ray ? scene.globe?.pick(ray, scene) : null)
        ?? camera.pickEllipsoid(screenPosition, ellipsoid)
    return picked && ellipsoid ? Cartesian3.clone(picked) : null
}

/** The Cesium map reticle owns pivot selection independently of the CamBall widget. */
export const CameraTarget = () => {
    const box = useRef(null)
    const drag = useRef(null)
    const camera = useSnapshot(proxy(lgs.settings.ui.camera))

    const updateMarkerPosition = useCallback(() => {
        const element = box.current
        const context = mapCameraContext()
        if (!element || !context) return
        const {scene, camera: activeCamera, canvas} = context
        const pivot = getMainSceneCameraPivot(scene, activeCamera)
        const screenPosition = pivot
            ? SceneTransforms.worldToWindowCoordinates(scene, pivot)
            : new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
        if (!screenPosition) return
        const canvasRect = canvas.getBoundingClientRect()
        const parent = element.offsetParent ?? element.parentElement
        const parentRect = parent?.getBoundingClientRect?.()
        if (!parentRect || !canvasRect.width || !canvasRect.height) return
        const canvasWidth = canvas.clientWidth || canvasRect.width
        const canvasHeight = canvas.clientHeight || canvasRect.height
        const clientX = canvasRect.left + screenPosition.x * canvasRect.width / canvasWidth
        const clientY = canvasRect.top + screenPosition.y * canvasRect.height / canvasHeight
        const scaleX = parent.clientWidth && parentRect.width ? parent.clientWidth / parentRect.width : 1
        const scaleY = parent.clientHeight && parentRect.height ? parent.clientHeight / parentRect.height : 1
        element.style.left = `${(clientX - parentRect.left) * scaleX - parent.clientLeft - element.offsetWidth / 2}px`
        element.style.top = `${(clientY - parentRect.top) * scaleY - parent.clientTop - element.offsetHeight / 2}px`
    }, [])

    useEffect(() => {
        const context = mainCameraContext()
        updateMarkerPosition()
        const removePostRender = context?.scene.postRender?.addEventListener(updateMarkerPosition)
        window.addEventListener('resize', updateMarkerPosition)
        return () => {
            removePostRender?.()
            window.removeEventListener('resize', updateMarkerPosition)
        }
    }, [updateMarkerPosition])

    useEffect(() => {
        const removePointerListeners = () => {
            window.removeEventListener('pointermove', onPointerMove, true)
            window.removeEventListener('pointerup', onPointerEnd, true)
            window.removeEventListener('pointercancel', onPointerCancel, true)
            window.removeEventListener('lostpointercapture', onPointerCancel, true)
            window.removeEventListener('blur', onWindowBlur)
        }

        const placeAtClientPosition = (clientX, clientY, currentDrag) => {
            const element = box.current
            const {canvas, parent, pointerOffsetX, pointerOffsetY} = currentDrag
            const canvasRect = canvas.getBoundingClientRect()
            const parentRect = parent.getBoundingClientRect()
            const scaleX = parent.clientWidth && parentRect.width ? parent.clientWidth / parentRect.width : 1
            const scaleY = parent.clientHeight && parentRect.height ? parent.clientHeight / parentRect.height : 1
            const centerX = CesiumMath.clamp(clientX + pointerOffsetX, canvasRect.left, canvasRect.right)
            const centerY = CesiumMath.clamp(clientY + pointerOffsetY, canvasRect.top, canvasRect.bottom)
            element.style.left = `${(centerX - parentRect.left) * scaleX - parent.clientLeft - element.offsetWidth / 2}px`
            element.style.top = `${(centerY - parentRect.top) * scaleY - parent.clientTop - element.offsetHeight / 2}px`
        }

        function onPointerMove(event) {
            const currentDrag = drag.current
            if (!currentDrag || currentDrag.pointerId !== event.pointerId) return
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            if (!currentDrag.moved) {
                currentDrag.moved = true
                box.current?.classList.remove('is-pivot-grabbed')
            }
            placeAtClientPosition(event.clientX, event.clientY, currentDrag)
        }

        function onPointerEnd(event) {
            const currentDrag = drag.current
            if (!currentDrag || currentDrag.pointerId !== event.pointerId) return
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            drag.current = null
            box.current?.classList.remove('is-pivot-grabbed', 'is-pivot-dragging')
            removePointerListeners()
            const context = mainCameraContext()
            if (event.type === 'pointerup' && context?.scene === currentDrag.scene
                && context.camera === currentDrag.camera) {
                const canvasRect = currentDrag.canvas.getBoundingClientRect()
                const centerX = CesiumMath.clamp(event.clientX + currentDrag.pointerOffsetX, canvasRect.left, canvasRect.right)
                const centerY = CesiumMath.clamp(event.clientY + currentDrag.pointerOffsetY, canvasRect.top, canvasRect.bottom)
                const screenPosition = clientToCanvasPosition(currentDrag.canvas, centerX, centerY)
                const position = screenPosition
                    ? resolveWorldPosition(currentDrag.scene, currentDrag.camera, screenPosition)
                    : null
                if (position) setMainSceneCameraPivot(currentDrag.scene, currentDrag.camera, position)
            }
            updateMarkerPosition()
        }

        function onPointerCancel(event) {
            if (event.pointerId === drag.current?.pointerId) onPointerEnd(event)
        }

        function onWindowBlur() {
            const currentDrag = drag.current
            if (!currentDrag) return
            drag.current = null
            box.current?.classList.remove('is-pivot-grabbed', 'is-pivot-dragging')
            removePointerListeners()
            if (currentDrag.canvas.hasPointerCapture?.(currentDrag.pointerId)) {
                currentDrag.canvas.releasePointerCapture(currentDrag.pointerId)
            }
            updateMarkerPosition()
        }

        const onPointerDown = event => {
            const element = box.current
            const context = mainCameraContext()
            const markerRect = element?.getBoundingClientRect()
            const path = event.composedPath?.() ?? []
            if (!context || !element || element.getAttribute('show') !== 'true' || !markerRect
                || !path.includes(context.canvas)
                || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.button !== 0
                || event.clientX < markerRect.left - PIVOT_DRAG_HIT_SLOP
                || event.clientX > markerRect.right + PIVOT_DRAG_HIT_SLOP
                || event.clientY < markerRect.top - PIVOT_DRAG_HIT_SLOP
                || event.clientY > markerRect.bottom + PIVOT_DRAG_HIT_SLOP) return
            const parent = element.offsetParent ?? element.parentElement
            if (!parent) return
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            drag.current = {
                scene: context.scene,
                camera: context.camera,
                canvas: context.canvas,
                parent,
                pointerId: event.pointerId,
                pointerOffsetX: markerRect.left + markerRect.width / 2 - event.clientX,
                pointerOffsetY: markerRect.top + markerRect.height / 2 - event.clientY,
                moved: false,
            }
            element.classList.remove('is-pivot-grabbed')
            void element.offsetWidth
            element.classList.add('is-pivot-grabbed', 'is-pivot-dragging')
            context.canvas.setPointerCapture?.(event.pointerId)
            window.addEventListener('pointermove', onPointerMove, {capture: true, passive: false})
            window.addEventListener('pointerup', onPointerEnd, {capture: true, passive: false})
            window.addEventListener('pointercancel', onPointerCancel, {capture: true, passive: false})
            window.addEventListener('lostpointercapture', onPointerCancel, {capture: true, passive: false})
            window.addEventListener('blur', onWindowBlur)
        }

        window.addEventListener('pointerdown', onPointerDown, {capture: true, passive: false})
        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true)
            if (drag.current) {
                const currentDrag = drag.current
                drag.current = null
                box.current?.classList.remove('is-pivot-grabbed', 'is-pivot-dragging')
                removePointerListeners()
                if (currentDrag.canvas.hasPointerCapture?.(currentDrag.pointerId)) {
                    currentDrag.canvas.releasePointerCapture(currentDrag.pointerId)
                }
            }
        }
    }, [updateMarkerPosition])

    return (
        <div show={camera.targetIcon.show ? 'true' : 'false'} id="camera-target" ref={box} style={{
            width: camera.targetIcon.size,
            height: camera.targetIcon.size,
            color: camera.targetIcon.color,
            background: camera.targetIcon.background,
        }} aria-label="Map camera pivot. Hold Shift and drag to move it.">
            <WaIcon name="arrows-to-circle" variant="regular"/>
        </div>
    )
}
