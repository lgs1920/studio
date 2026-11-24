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
import {
    getMainSceneCameraPivot,
    pickMainSceneWorldPosition,
    recenterMainSceneCameraPivot,
    setMainSceneCameraPivot,
} from '@Core/ui/MainSceneCameraPivot'
import {Cartesian2, Math as CesiumMath, SceneMode, SceneTransforms} from 'cesium'
import {useCallback, useEffect, useRef} from 'react'
import {proxy, useSnapshot} from 'valtio/index'

const PIVOT_DRAG_HIT_SLOP = 14
const PIVOT_DRAG_THRESHOLD = 5
const PIVOT_LONG_PRESS_DURATION = 500
const PIVOT_DOUBLE_TAP_INTERVAL = 350
const PIVOT_DOUBLE_TAP_DISTANCE = 24

/** Return the pointer's distance from the start of its pivot gesture. */
const getPointerDistance = (event, currentDrag) => Math.hypot(
    event.clientX - currentDrag.startClientX,
    event.clientY - currentDrag.startClientY,
)

/** Build a cancellation event that clears Cesium's active touch pointer. */
const createCesiumTouchCancelEvent = currentDrag => {
    const cancelEvent = typeof PointerEvent === 'function'
        ? new PointerEvent('pointercancel', {
            bubbles: true,
            cancelable: false,
            pointerId: currentDrag.pointerId,
            pointerType: 'touch',
            clientX: currentDrag.lastClientX,
            clientY: currentDrag.lastClientY,
        })
        : new Event('pointercancel', {bubbles: true})
    if (typeof PointerEvent !== 'function') {
        Object.defineProperties(cancelEvent, {
            pointerId: {value: currentDrag.pointerId},
            pointerType: {value: 'touch'},
            clientX: {value: currentDrag.lastClientX},
            clientY: {value: currentDrag.lastClientY},
        })
    }
    Object.defineProperty(cancelEvent, 'cameraTargetLongPressCancel', {value: true})
    return cancelEvent
}

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

/** The Cesium map reticle owns pivot selection independently of the CamBall widget. */
export const CameraTarget = () => {
    const box = useRef(null)
    const drag = useRef(null)
    const lastTap = useRef(null)
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
        /** Remove listeners and timers owned by the current pointer gesture. */
        const removePointerListeners = currentDrag => {
            window.clearTimeout(currentDrag?.longPressTimer)
            window.removeEventListener('pointermove', onPointerMove, true)
            window.removeEventListener('pointerup', onPointerEnd, true)
            window.removeEventListener('pointercancel', onPointerCancel, true)
            window.removeEventListener('lostpointercapture', onPointerCancel, true)
            window.removeEventListener('blur', onWindowBlur)
        }

        /** Keep the pivot reticle under the captured pointer. */
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
            currentDrag.lastClientX = clientX
            currentDrag.lastClientY = clientY
        }

        /** Play one pulse after a recognized pivot gesture is released. */
        const playReleasePulse = () => {
            const element = box.current
            if (!element) return
            element.classList.remove('is-pivot-release-pulse')
            void element.offsetWidth
            element.classList.add('is-pivot-release-pulse')
        }

        /** Recognize Shift-double-click on desktop and double-tap on touch screens. */
        const isPivotDoubleTap = (currentDrag, event) => {
            if (event.type !== 'pointerup' || currentDrag.dragging
                || (currentDrag.pointerType !== 'touch' && !event.shiftKey)) {
                lastTap.current = null
                return false
            }
            const previousTap = lastTap.current
            const isDoubleTap = previousTap?.pointerType === currentDrag.pointerType
                && event.timeStamp - previousTap.time <= PIVOT_DOUBLE_TAP_INTERVAL
                && Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <= PIVOT_DOUBLE_TAP_DISTANCE
            lastTap.current = isDoubleTap
                ? null
                : {pointerType: currentDrag.pointerType, time: event.timeStamp, x: event.clientX, y: event.clientY}
            return isDoubleTap
        }

        /** Clear an active gesture and optionally hand pointer capture back to the browser. */
        const clearGesture = (currentDrag, {releasePointerCapture = true, cancelCesiumPointer = false} = {}) => {
            if (drag.current !== currentDrag) return
            drag.current = null
            removePointerListeners(currentDrag)
            box.current?.classList.remove('is-pivot-grabbed', 'is-pivot-dragging')
            if (cancelCesiumPointer && currentDrag.pointerType === 'touch' && !currentDrag.cesiumPointerCancelled) {
                currentDrag.cesiumPointerCancelled = true
                currentDrag.canvas.dispatchEvent(createCesiumTouchCancelEvent(currentDrag))
            }
            if (releasePointerCapture && currentDrag.canvas.hasPointerCapture?.(currentDrag.pointerId)) {
                currentDrag.canvas.releasePointerCapture(currentDrag.pointerId)
            }
            updateMarkerPosition()
        }

        /** Show the looping pulse once a touch has qualified as a long press. */
        const beginTouchPivotSelection = currentDrag => {
            if (drag.current !== currentDrag) return
            const context = mainCameraContext()
            if (!context || context.scene !== currentDrag.scene || context.camera !== currentDrag.camera) {
                clearGesture(currentDrag, {cancelCesiumPointer: true})
                return
            }
            currentDrag.active = true
            lastTap.current = null
            currentDrag.cesiumPointerCancelled = true
            currentDrag.canvas.dispatchEvent(createCesiumTouchCancelEvent(currentDrag))
            const element = box.current
            element?.classList.remove('is-pivot-release-pulse', 'is-pivot-grabbed')
            if (element) {
                void element.offsetWidth
                element.classList.add('is-pivot-grabbed')
            }
        }

        /** Handle pointer movement while preserving ordinary Cesium navigation outside owned gestures. */
        function onPointerMove(event) {
            const currentDrag = drag.current
            if (!currentDrag || currentDrag.pointerId !== event.pointerId) return

            const distance = getPointerDistance(event, currentDrag)
            if (currentDrag.pointerType === 'touch' && !currentDrag.active) {
                if (distance >= PIVOT_DRAG_THRESHOLD) {
                    lastTap.current = null
                    clearGesture(currentDrag, {releasePointerCapture: false})
                    return
                }
                event.preventDefault()
                event.stopPropagation()
                event.stopImmediatePropagation?.()
                return
            }

            if (currentDrag.pointerType !== 'touch' && !event.shiftKey) {
                event.preventDefault()
                event.stopPropagation()
                event.stopImmediatePropagation?.()
                return
            }

            const context = mainCameraContext()
            if (!context || context.scene !== currentDrag.scene || context.camera !== currentDrag.camera) {
                clearGesture(currentDrag, {cancelCesiumPointer: true})
                return
            }
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            if (!currentDrag.dragging && distance < PIVOT_DRAG_THRESHOLD) return
            if (!currentDrag.dragging) {
                currentDrag.dragging = true
                lastTap.current = null
                box.current?.classList.remove('is-pivot-grabbed', 'is-pivot-release-pulse')
                box.current?.classList.add('is-pivot-dragging')
            }
            placeAtClientPosition(event.clientX, event.clientY, currentDrag)
        }

        /** Finish an owned gesture, committing its final dragged pivot on pointer release. */
        function onPointerEnd(event) {
            const currentDrag = drag.current
            if (!currentDrag || currentDrag.pointerId !== event.pointerId) return
            if (currentDrag.pointerType === 'touch' && !currentDrag.active) {
                const repeatedTap = isPivotDoubleTap(currentDrag, event)
                const hasSelectedPivot = getMainSceneCameraPivot(currentDrag.scene, currentDrag.camera)
                const context = mainCameraContext()
                if (repeatedTap && hasSelectedPivot && context?.scene === currentDrag.scene
                    && context.camera === currentDrag.camera) {
                    event.preventDefault()
                    event.stopPropagation()
                    event.stopImmediatePropagation?.()
                    recenterMainSceneCameraPivot(currentDrag.scene, currentDrag.camera)
                    currentDrag.cesiumPointerCancelled = true
                    currentDrag.canvas.dispatchEvent(createCesiumTouchCancelEvent(currentDrag))
                    clearGesture(currentDrag, {releasePointerCapture: false})
                    playReleasePulse()
                    return
                }
                clearGesture(currentDrag, {releasePointerCapture: false})
                return
            }
            const repeatedClick = currentDrag.pointerType !== 'touch' && isPivotDoubleTap(currentDrag, event)
            const hasSelectedPivot = getMainSceneCameraPivot(currentDrag.scene, currentDrag.camera)
            const context = mainCameraContext()
            if (repeatedClick && hasSelectedPivot && context?.scene === currentDrag.scene
                && context.camera === currentDrag.camera) {
                event.preventDefault()
                event.stopPropagation()
                event.stopImmediatePropagation?.()
                recenterMainSceneCameraPivot(currentDrag.scene, currentDrag.camera)
                clearGesture(currentDrag, {releasePointerCapture: false})
                playReleasePulse()
                return
            }
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            if (event.type === 'pointerup' && currentDrag.dragging && context?.scene === currentDrag.scene
                && context.camera === currentDrag.camera) {
                if (currentDrag.pointerType === 'touch' || event.shiftKey) {
                    placeAtClientPosition(event.clientX, event.clientY, currentDrag)
                }
                const canvasRect = currentDrag.canvas.getBoundingClientRect()
                const clientX = currentDrag.lastClientX + currentDrag.pointerOffsetX
                const clientY = currentDrag.lastClientY + currentDrag.pointerOffsetY
                const centerX = CesiumMath.clamp(clientX, canvasRect.left, canvasRect.right)
                const centerY = CesiumMath.clamp(clientY, canvasRect.top, canvasRect.bottom)
                const screenPosition = clientToCanvasPosition(currentDrag.canvas, centerX, centerY)
                const position = screenPosition
                    ? pickMainSceneWorldPosition(currentDrag.scene, currentDrag.camera, screenPosition)
                    : null
                if (position && setMainSceneCameraPivot(currentDrag.scene, currentDrag.camera, position)) {
                    __.ui.cameraManager?.retargetActiveRotationToMapPivot?.(position)
                }
            }
            const released = event.type === 'pointerup' && currentDrag.active
            clearGesture(currentDrag, {releasePointerCapture: false})
            if (released) playReleasePulse()
        }

        /** Clear touch or pointer state when the browser cancels capture. */
        function onPointerCancel(event) {
            if (event.cameraTargetLongPressCancel) return
            lastTap.current = null
            const currentDrag = drag.current
            if (!currentDrag || event.pointerId !== currentDrag.pointerId) return
            if (currentDrag.pointerType === 'touch' && !currentDrag.active) {
                clearGesture(currentDrag, {releasePointerCapture: false})
                return
            }
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            clearGesture(currentDrag, {releasePointerCapture: false, cancelCesiumPointer: true})
        }

        /** Release gesture resources if the browser window loses focus. */
        function onWindowBlur() {
            const currentDrag = drag.current
            lastTap.current = null
            if (!currentDrag) return
            clearGesture(currentDrag, {cancelCesiumPointer: true})
        }

        /** Start Shift-drag on desktop or arm the long-press gesture on touch devices. */
        const onPointerDown = event => {
            const element = box.current
            const context = mainCameraContext()
            const markerRect = element?.getBoundingClientRect()
            const path = event.composedPath?.() ?? []
            const pointerType = event.pointerType || 'mouse'
            const isTouch = pointerType === 'touch'
            if (!context || !element || element.getAttribute('show') !== 'true' || !markerRect
                || !path.includes(context.canvas) || (!isTouch && !event.shiftKey)
                || event.ctrlKey || event.altKey || event.metaKey || event.button !== 0
                || event.clientX < markerRect.left - PIVOT_DRAG_HIT_SLOP
                || event.clientX > markerRect.right + PIVOT_DRAG_HIT_SLOP
                || event.clientY < markerRect.top - PIVOT_DRAG_HIT_SLOP
                || event.clientY > markerRect.bottom + PIVOT_DRAG_HIT_SLOP) return
            const parent = element.offsetParent ?? element.parentElement
            if (!parent) return
            const currentDrag = {
                scene: context.scene,
                camera: context.camera,
                canvas: context.canvas,
                parent,
                pointerId: event.pointerId,
                pointerType,
                startClientX: event.clientX,
                startClientY: event.clientY,
                lastClientX: event.clientX,
                lastClientY: event.clientY,
                pointerOffsetX: markerRect.left + markerRect.width / 2 - event.clientX,
                pointerOffsetY: markerRect.top + markerRect.height / 2 - event.clientY,
                active: !isTouch,
                dragging: false,
                cesiumPointerCancelled: false,
            }
            drag.current = currentDrag
            if (isTouch) {
                event.preventDefault()
                currentDrag.longPressTimer = window.setTimeout(
                    () => beginTouchPivotSelection(currentDrag),
                    PIVOT_LONG_PRESS_DURATION,
                )
            }
            else {
                event.preventDefault()
                event.stopPropagation()
                event.stopImmediatePropagation?.()
                element.classList.remove('is-pivot-release-pulse', 'is-pivot-grabbed')
                void element.offsetWidth
                element.classList.add('is-pivot-grabbed')
                context.canvas.setPointerCapture?.(event.pointerId)
            }
            window.addEventListener('pointermove', onPointerMove, {capture: true, passive: false})
            window.addEventListener('pointerup', onPointerEnd, {capture: true, passive: false})
            window.addEventListener('pointercancel', onPointerCancel, {capture: true, passive: false})
            window.addEventListener('lostpointercapture', onPointerCancel, {capture: true, passive: false})
            window.addEventListener('blur', onWindowBlur)
        }

        window.addEventListener('pointerdown', onPointerDown, {capture: true, passive: false})
        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true)
            lastTap.current = null
            if (drag.current) {
                const currentDrag = drag.current
                clearGesture(currentDrag, {cancelCesiumPointer: true})
            }
        }
    }, [updateMarkerPosition])

    return (
        <div show={camera.targetIcon.show ? 'true' : 'false'} id="camera-target" ref={box} style={{
            width: camera.targetIcon.size,
            height: camera.targetIcon.size,
            color: camera.targetIcon.color,
            background: camera.targetIcon.background,
        }} aria-label="Map camera pivot. Hold Shift and drag or Shift-double-click to center it on desktop. Long-press and drag or double-tap on touch devices.">
            <WaIcon name="arrows-to-circle" variant="regular"/>
        </div>
    )
}
