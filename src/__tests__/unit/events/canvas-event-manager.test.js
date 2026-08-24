// @vitest-environment jsdom

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const {FakeScreenSpaceEventHandler, inputActions} = vi.hoisted(() => {
    const inputActions = new Map()
    class FakeScreenSpaceEventHandler {
        destroy = vi.fn()
        removeInputAction = vi.fn()
        setInputAction = vi.fn((handler, type, modifier) => {
            inputActions.set(`${type}:${modifier ?? ''}`, handler)
        })
    }

    return {FakeScreenSpaceEventHandler, inputActions}
})

vi.mock('cesium', async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        ScreenSpaceEventHandler: FakeScreenSpaceEventHandler,
    }
})

import {CanvasEventManager} from '@Core/events/CanvasEventManager'
import {ScreenSpaceEventType} from 'cesium'
import {DOUBLE_TAP_TIMEOUT, LONG_TAP_TIMEOUT} from '@Core/constants'
import {proxy} from 'valtio'

describe('CanvasEventManager', () => {
    let canvas
    let manager
    let viewer

    beforeEach(() => {
        inputActions.clear()
        window.matchMedia = vi.fn(() => ({matches: false}))
        delete window.ontouchstart
        Object.defineProperty(navigator, 'maxTouchPoints', {
            configurable: true,
            value: 0,
        })
        canvas = document.createElement('canvas')
        document.body.append(canvas)
        viewer = {
            scene: {
                canvas,
                pick: vi.fn(() => undefined),
                screenSpaceCameraController: {
                    enableInputs:    true,
                    enableTranslate: true,
                    enableZoom:      true,
                    enableRotate:    true,
                    enableTilt:      true,
                    enableLook:      true,
                },
            },
        }
        globalThis.lgs = {
            stores:   {
                replay: proxy({recordingSync: false}),
                ui:     {video: proxy({preRecording: false, recording: false, recordingHQ: false})},
            },
            settings: {ui: {replay: {recordingSync: false}}},
        }
        globalThis.__ = {recorder: {isRecording: vi.fn(() => false)}}
        manager = new CanvasEventManager(viewer)
    })

    afterEach(() => {
        vi.useRealTimers()
        manager?.destroy()
        canvas?.remove()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('emits mouse down and up listeners through the Cesium actions', () => {
        const down = vi.fn()
        const up = vi.fn()

        manager.onMouseDown(down)
        manager.onMouseUp(up)

        inputActions.get(`${ScreenSpaceEventType.LEFT_DOWN}:`)({
            position: {x: 10, y: 20},
        })
        inputActions.get(`${ScreenSpaceEventType.LEFT_UP}:`)({
            position: {x: 10, y: 20},
        })

        expect(down).toHaveBeenCalledOnce()
        expect(up).toHaveBeenCalledOnce()
    })

    it('handles Cesium wheel deltas without trying to pick a position', () => {
        const wheel = vi.fn()

        manager.onWheel(wheel)

        expect(() => inputActions.get(`${ScreenSpaceEventType.WHEEL}:`)(120)).not.toThrow()
        expect(viewer.scene.pick).not.toHaveBeenCalled()
        expect(wheel).toHaveBeenCalledWith(120, null, expect.any(Object), null)
    })

    it('focuses the canvas when a pointer interaction starts', () => {
        const focus = vi.spyOn(canvas, 'focus')

        canvas.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}))

        expect(focus).toHaveBeenCalledWith({preventScroll: true})
    })

    it('keeps canvas input available during video preparation', () => {
        const canvasInput = vi.fn()
        canvas.addEventListener('pointerdown', canvasInput)
        globalThis.lgs.stores.ui.video.preRecording = true
        globalThis.lgs.stores.replay.recordingSync = true

        const event = new PointerEvent('pointerdown', {bubbles: true, cancelable: true})
        canvas.dispatchEvent(event)

        expect(canvasInput).toHaveBeenCalledOnce()
        expect(event.defaultPrevented).toBe(false)
    })

    it('keeps canvas input available while the recorder starts during video preparation', () => {
        const canvasInput = vi.fn()
        canvas.addEventListener('pointerdown', canvasInput)
        globalThis.lgs.stores.ui.video.preRecording = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.__.recorder.isRecording.mockReturnValue(true)

        const event = new PointerEvent('pointerdown', {bubbles: true, cancelable: true})
        canvas.dispatchEvent(event)

        expect(canvasInput).toHaveBeenCalledOnce()
        expect(event.defaultPrevented).toBe(false)
    })

    it('blocks canvas input during synchronized recording', () => {
        const canvasInput = vi.fn()
        canvas.addEventListener('pointerdown', canvasInput)
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true

        const event = new PointerEvent('pointerdown', {bubbles: true, cancelable: true})
        canvas.dispatchEvent(event)

        expect(canvasInput).not.toHaveBeenCalled()
        expect(event.defaultPrevented).toBe(true)
    })

    it('applies the exact video phase matrix to Cesium actions and camera controls', () => {
        const down = vi.fn()
        const controller = viewer.scene.screenSpaceCameraController
        const leftDown = () => inputActions.get(`${ScreenSpaceEventType.LEFT_DOWN}:`)({
            position: {x: 10, y: 20},
        })
        const expectCameraInput = enabled => {
            expect(controller).toMatchObject({
                enableInputs:    enabled,
                enableTranslate: enabled,
                enableZoom:      enabled,
                enableRotate:    enabled,
                enableTilt:      enabled,
                enableLook:      enabled,
            })
        }

        manager.onMouseDown(down)

        globalThis.lgs.stores.ui.video.preRecording = true
        globalThis.lgs.stores.replay.recordingSync = true
        leftDown()
        expect(down).toHaveBeenCalledTimes(1)
        expectCameraInput(true)

        globalThis.lgs.stores.ui.video.preRecording = false
        globalThis.lgs.stores.ui.video.recording = true
        leftDown()
        expect(down).toHaveBeenCalledTimes(1)
        expectCameraInput(false)

        globalThis.lgs.stores.replay.recordingSync = false
        leftDown()
        expect(down).toHaveBeenCalledTimes(2)
        expectCameraInput(true)

        globalThis.lgs.stores.ui.video.recordingHQ = true
        globalThis.lgs.stores.replay.recordingSync = true
        leftDown()
        expect(down).toHaveBeenCalledTimes(2)
        expectCameraInput(false)

        globalThis.lgs.stores.ui.video.recordingHQ = false
        globalThis.lgs.stores.replay.recordingSync = false
        leftDown()
        expect(down).toHaveBeenCalledTimes(3)
        expectCameraInput(true)
    })

    it('ignores a persisted sync preference when runtime recording is not synchronized', () => {
        const down = vi.fn()
        manager.onMouseDown(down)
        globalThis.lgs.settings.ui.replay.recordingSync = true
        globalThis.lgs.stores.ui.video.recording = true

        inputActions.get(`${ScreenSpaceEventType.LEFT_DOWN}:`)({
            position: {x: 10, y: 20},
        })

        expect(down).toHaveBeenCalledOnce()
        expect(viewer.scene.screenSpaceCameraController.enableRotate).toBe(true)
        expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(true)
    })

    it('blocks every registered Cesium mouse input category during synchronized recording', () => {
        const down = vi.fn()
        const rightClick = vi.fn()
        const move = vi.fn()
        const wheel = vi.fn()
        manager.onMouseDown(down)
        manager.onRightClick(rightClick)
        manager.onMouseMove(move)
        manager.onWheel(wheel)
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true

        inputActions.get(`${ScreenSpaceEventType.LEFT_DOWN}:`)({position: {x: 10, y: 20}})
        inputActions.get(`${ScreenSpaceEventType.RIGHT_CLICK}:`)({position: {x: 10, y: 20}})
        inputActions.get(`${ScreenSpaceEventType.MOUSE_MOVE}:`)({endPosition: {x: 10, y: 20}})
        inputActions.get(`${ScreenSpaceEventType.WHEEL}:`)(120)

        expect(down).not.toHaveBeenCalled()
        expect(rightClick).not.toHaveBeenCalled()
        expect(move).not.toHaveBeenCalled()
        expect(wheel).not.toHaveBeenCalled()
        expect(viewer.scene.pick).not.toHaveBeenCalled()
    })

    it('restores the camera input configuration that existed before synchronized recording', () => {
        const controller = viewer.scene.screenSpaceCameraController
        controller.enableLook = false

        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true
        expect(controller.enableLook).toBe(false)
        expect(controller.enableRotate).toBe(false)
        expect(controller.enableInputs).toBe(false)

        globalThis.lgs.stores.ui.video.recording = false
        expect(controller.enableLook).toBe(false)
        expect(controller.enableRotate).toBe(true)
        expect(controller.enableInputs).toBe(true)
    })

    it('keeps HUD input available during synchronized recording', () => {
        const hud = document.createElement('button')
        const hudInput = vi.fn()
        hud.addEventListener('pointerdown', hudInput)
        document.body.append(hud)
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true

        const event = new PointerEvent('pointerdown', {bubbles: true, cancelable: true})
        hud.dispatchEvent(event)

        expect(hudInput).toHaveBeenCalledOnce()
        expect(event.defaultPrevented).toBe(false)
        hud.remove()
    })

    it('dispatches mouse move, enter, and leave through one Cesium action', () => {
        const mouseEnter = vi.fn()
        const mouseMove = vi.fn()
        const mouseLeave = vi.fn()
        viewer.scene.pick
            .mockReturnValueOnce({id: 'track-a'})
            .mockReturnValueOnce(undefined)

        manager.onMouseEnter(mouseEnter, {entity: 'track-a'})
        manager.onMouseMove(mouseMove, {entity: false})
        manager.onMouseLeave(mouseLeave, {entity: 'track-a'})

        const mouseMotion = inputActions.get(`${ScreenSpaceEventType.MOUSE_MOVE}:`)
        mouseMotion({endPosition: {x: 10, y: 20}})
        mouseMotion({endPosition: {x: 20, y: 30}})

        expect(mouseEnter).toHaveBeenCalledOnce()
        expect(mouseMove).toHaveBeenCalledTimes(2)
        expect(mouseLeave).toHaveBeenCalledOnce()
    })

    it('dispatches tap, double tap, and long tap through shared touch actions', () => {
        vi.useFakeTimers()
        manager.destroy()
        window.matchMedia = vi.fn(() => ({matches: true}))
        Object.defineProperty(navigator, 'maxTouchPoints', {
            configurable: true,
            value:        1,
        })
        manager = new CanvasEventManager(viewer)

        const tap = vi.fn()
        const doubleTap = vi.fn()
        const longTap = vi.fn()
        const touchDown = () => inputActions.get(`${ScreenSpaceEventType.LEFT_DOWN}:`)({
            pointerType: 'touch',
            position:    {x: 10, y: 20},
        })
        const touchUp = () => inputActions.get(`${ScreenSpaceEventType.LEFT_UP}:`)()

        manager.onTap(tap)
        manager.onDoubleTap(doubleTap)
        manager.onLongTap(longTap)

        touchDown()
        touchUp()
        vi.advanceTimersByTime(DOUBLE_TAP_TIMEOUT + 51)
        touchDown()
        touchUp()
        touchDown()
        touchUp()
        touchDown()
        vi.advanceTimersByTime(LONG_TAP_TIMEOUT)

        expect(tap).toHaveBeenCalledOnce()
        expect(doubleTap).toHaveBeenCalledOnce()
        expect(longTap).toHaveBeenCalledOnce()

        const pickCount = viewer.scene.pick.mock.calls.length
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true
        touchDown()
        touchUp()
        vi.advanceTimersByTime(LONG_TAP_TIMEOUT)

        expect(tap).toHaveBeenCalledOnce()
        expect(doubleTap).toHaveBeenCalledOnce()
        expect(longTap).toHaveBeenCalledOnce()
        expect(viewer.scene.pick).toHaveBeenCalledTimes(pickCount)
    })

    it('keeps canvas input available during non-synchronized recording', () => {
        const canvasInput = vi.fn()
        canvas.addEventListener('pointerdown', canvasInput)
        globalThis.lgs.stores.ui.video.recording = true

        const event = new PointerEvent('pointerdown', {bubbles: true, cancelable: true})
        canvas.dispatchEvent(event)

        expect(canvasInput).toHaveBeenCalledOnce()
        expect(event.defaultPrevented).toBe(false)
    })
})
