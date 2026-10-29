/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-joystick.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-29
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {ReplayCameraJoystick} from '@Components/JourneyReplay/ReplayCameraJoystick'

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children}) => <div>{children}</div>,
}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
}))
vi.mock('@Core/ui/replay/JourneyReplayRuntime', () => ({
    currentJourneyReplayCameraSettings: () => globalThis.lgs.stores.replay.camera,
    isJourneyReplayCameraActive: replay => Boolean(replay?.active || replay?.playing || replay?.paused || replay?.clipSequenceActive),
}))

/** Install deterministic animation frames and the public preparation camera API. */
const install = () => {
    const frames = new Map()
    let nextFrame = 0
    vi.stubGlobal('requestAnimationFrame', callback => { frames.set(++nextFrame, callback)
        return nextFrame })
    vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id))
    const replay = proxy({camera: {altitude: 1200, pitch: -40, cameraAngle: 65}})
    const video = proxy({editing: true})
    const main = proxy({theJourney: {slug: 'journey-a'}})
    const updatePreparationCamera = vi.fn(updates => { Object.assign(replay.camera, updates) })
    vi.stubGlobal('lgs', {stores: {main, replay, ui: {video}}, settings: {unitSystem: proxy({current: 0})}})
    vi.stubGlobal('__', {ui: {replay: {updatePreparationCamera}}})
    /** Deliver one explicitly timed animation frame without a wall-clock sleep. */
    const frame = async timestamp => act(async () => {
        const callbacks = [...frames.values()]
        frames.clear()
        callbacks.forEach(callback => callback(timestamp))
    })
    return {frames, frame, replay, video, main, updatePreparationCamera}
}

/** Dispatch a pointer using CSS coordinates without relying on jsdom's missing PointerEvent. */
const pointer = (target, type, x, y, pointerId = 1, ctrlKey = false) => {
    const event = new Event(type, {bubbles: true, cancelable: true})
    Object.defineProperties(event, {
        button: {value: 0}, clientX: {value: x}, clientY: {value: y}, pointerId: {value: pointerId}, ctrlKey: {value: ctrlKey},
    })
    const grip = type === 'pointerdown' ? target.querySelector('.replay-camera-joystick-thumb') : null
    fireEvent(grip ?? target, event)
}

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('Replay camera joystick', () => {
    it('lets the hemisphere surface reach widget dragging while the recessed thumb remains a camera control', () => {
        const {frames, updatePreparationCamera} = install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        const sphere = view.container.querySelector('.replay-camera-joystick')
        const hostDrag = vi.fn()
        sphere.addEventListener('pointerdown', hostDrag)
        try {
            fireEvent(pad, new Event('pointerdown', {bubbles: true, cancelable: true}))
            expect(hostDrag).toHaveBeenCalledOnce()
            expect(pad.closest('.lgs-widget-no-drag')).toBeNull()
            expect(pad.querySelector('.replay-camera-joystick-thumb').classList.contains('lgs-widget-no-drag')).toBe(true)
            expect(frames.size).toBe(0)
            expect(updatePreparationCamera).not.toHaveBeenCalled()
        }
        finally { sphere.removeEventListener('pointerdown', hostDrag) }
    })

    it.each(['horizontal', 'vertical'])('locks Ctrl dragging to its initial %s axis and unlocks without a jump', async axis => {
        const {frame, replay} = install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(pad, 'pointerdown', 50, 50, 1, true)
        const horizontal = axis === 'horizontal'
        pointer(pad, 'pointermove', horizontal ? 70 : 53, horizontal ? 53 : 70, 1, true)
        await frame(40)
        if (horizontal) {
            expect(replay.camera.altitude).toBe(1200)
            expect(replay.camera.pitch).toBeLessThan(-40)
        }
        else {
            expect(replay.camera.pitch).toBe(-40)
            expect(replay.camera.altitude).toBeGreaterThan(1200)
        }
        pointer(pad, 'pointermove', 130, 130, 1, true)
        await frame(80)
        const thumb = pad.querySelector('.replay-camera-joystick-thumb')
        expect(horizontal ? thumb.style.top : thumb.style.left).toBe('50%')
        expect(horizontal ? replay.camera.altitude : replay.camera.pitch).toBe(horizontal ? 1200 : -40)
        const pose = {...replay.camera}
        pointer(pad, 'pointermove', 130, 130, 1, false)
        expect(replay.camera).toEqual(pose)
        pointer(pad, 'pointermove', horizontal ? 130 : 125, horizontal ? 125 : 130, 1, false)
        await frame(160)
        expect(horizontal ? replay.camera.altitude : replay.camera.pitch).not.toBe(horizontal ? pose.altitude : pose.pitch)
    })

    it('projects the recessed thumb onto the sphere and shows feedback during movement', () => {
        install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        const thumb = view.container.querySelector('.replay-camera-joystick-thumb')
        expect(thumb.style.left).toBe('50%')
        expect(view.container.querySelector('[data-icon]')).toBeNull()
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 90, 50)
        expect(thumb.style.left).toBe('90%')
        const matrix = thumb.style.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number)
        expect(matrix[0]).toBeCloseTo(0.6, 8)
        expect(matrix[3]).toBe(1)
        expect(view.container.querySelector('[data-icon="arrow-rotate-right"]')).not.toBeNull()
        expect(view.container.querySelector('[data-icon="magnifying-glass-plus"]')).toBeNull()
        pointer(pad, 'pointermove', 90, 10)
        expect(view.container.querySelector('[data-icon="magnifying-glass-plus"]')).not.toBeNull()
        pointer(pad, 'pointerup', 90, 10)
        expect(thumb.style.left).toBe('50%')
        expect(thumb.style.top).toBe('50%')
        expect(view.container.querySelector('[data-icon]')).toBeNull()
    })

    it('changes zoom and pitch together, consumes pointer input, and stops on release', async () => {
        const {frame, frames, replay, updatePreparationCamera} = install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 116, height: 116})
        const bubbled = vi.fn()
        document.addEventListener('pointerdown', bubbled)
        try {
            pointer(pad, 'pointerdown', 85, 30)
            expect(bubbled).not.toHaveBeenCalled()
            await frame(0)
            expect(updatePreparationCamera).not.toHaveBeenCalled()
            pointer(pad, 'pointermove', 90, 25)
            await frame(40)
            expect(updatePreparationCamera).toHaveBeenCalledOnce()
            expect(replay.camera.altitude).toBeLessThan(1200)
            expect(replay.camera.pitch).toBeLessThan(-40)
            expect(replay.camera.cameraAngle).toBe(65)
            const pose = {...replay.camera}
            await frame(80)
            expect(replay.camera.altitude).toBeLessThan(pose.altitude)
            expect(replay.camera.pitch).toBeLessThan(pose.pitch)
            const heldPose = {...replay.camera}
            pointer(pad, 'pointermove', 90, 25)
            await frame(120)
            expect(replay.camera.altitude).toBeLessThan(heldPose.altitude)
            expect(replay.camera.pitch).toBeLessThan(heldPose.pitch)
            pointer(pad, 'pointerup', 85, 30)
            expect(frames.size).toBe(0)
            const releasedPose = {...replay.camera}
            const releasedCallCount = updatePreparationCamera.mock.calls.length
            await frame(2000)
            expect(replay.camera).toEqual(releasedPose)
            expect(updatePreparationCamera).toHaveBeenCalledTimes(releasedCallCount)
            expect(view.container.querySelector('.replay-camera-joystick-thumb').style.transform).toBe('translate(-50%, -50%) matrix(1, 0, 0, 1, 0, 0)')
        }
        finally { document.removeEventListener('pointerdown', bubbled) }
    })

    it('stops a held adjustment when the thumb returns to center before release', async () => {
        const {frames, frame, replay} = install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 70, 30)
        await frame(0)
        await frame(40)
        pointer(pad, 'pointermove', 50, 50)
        const centeredPose = {...replay.camera}
        expect(frames.size).toBe(0)
        await frame(80)
        expect(replay.camera).toEqual(centeredPose)
        expect(view.container.querySelector('[data-icon]')).toBeNull()
    })

    it('keeps the held adjustment rate independent of animation frame frequency', async () => {
        const poses = []
        for (const fps of [30, 60]) {
            const {frame, replay} = install()
            const view = render(<ReplayCameraJoystick/>)
            const pad = view.getByLabelText('Drag to adjust zoom and pitch')
            pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
            pointer(pad, 'pointerdown', 50, 50)
            pointer(pad, 'pointermove', 70, 30)
            await frame(0)
            for (let index = 1; index <= fps; index++) await frame(index * 1000 / fps)
            pointer(pad, 'pointerup', 70, 30)
            poses.push({...replay.camera})
            view.unmount()
        }
        expect(poses[0].altitude).toBeCloseTo(poses[1].altitude, 8)
        expect(poses[0].pitch).toBeCloseTo(poses[1].pitch, 8)
        expect(poses.map(pose => pose.cameraAngle)).toEqual([65, 65])
    })

    it('offers focus-scoped keyboard axes with bounded values and no visible buttons or text', async () => {
        const {replay} = install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        expect(view.container.textContent).toBe('')
        expect(view.container.querySelector('button, wa-button, small, strong')).toBeNull()
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowDown'}))
        expect(replay.camera.altitude).toBeGreaterThan(1200)
        expect(replay.camera.pitch).toBe(-40)
        const altitude = replay.camera.altitude
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowLeft'}))
        expect(replay.camera.altitude).toBe(altitude)
        expect(replay.camera.pitch).toBe(-37)
        await act(async () => { replay.camera.altitude = 100000
            replay.camera.pitch = -89 })
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowDown'}))
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowRight'}))
        expect(replay.camera.altitude).toBe(100000)
        expect(replay.camera.pitch).toBe(-89)
        await act(async () => { replay.camera.altitude = 10 })
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowUp'}))
        expect(replay.camera.altitude).toBe(10)
    })

    it('flushes a short drag on release without leaving a queued camera update', async () => {
        const {frames, frame, replay, updatePreparationCamera} = install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 70, 30)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
        pointer(pad, 'pointerup', 70, 30)
        expect(updatePreparationCamera).toHaveBeenCalledOnce()
        expect(frames.size).toBe(0)
        const altitude = replay.camera.altitude
        await frame(5000)
        expect(replay.camera.altitude).toBe(altitude)
        expect(updatePreparationCamera).toHaveBeenCalledOnce()
    })

    it.each(['preRecording', 'exporting', 'snapshot', 'finalizing'])('hides and cancels queued input when %s starts', async field => {
        const {video, frames, frame, updatePreparationCamera} = install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 116, height: 116})
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        await act(async () => { video[field] = true })
        await frame(100)
        expect(view.queryByLabelText('Drag to adjust zoom and pitch')).toBeNull()
        expect(frames.size).toBe(0)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
    })

    it('stops on pointer cancellation, blur, journey replacement, and unmount', async () => {
        const {frames, main} = install()
        const view = render(<ReplayCameraJoystick/>)
        const pad = view.getByLabelText('Drag to adjust zoom and pitch')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 116, height: 116})
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        pointer(pad, 'pointercancel', 85, 30)
        expect(frames.size).toBe(0)
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        fireEvent(window, new Event('blur'))
        expect(frames.size).toBe(0)
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        await act(async () => { main.theJourney = {slug: 'journey-b'} })
        expect(frames.size).toBe(0)
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        view.unmount()
        expect(frames.size).toBe(0)
    })

    it.each(['active', 'playing', 'paused', 'clipSequenceActive'])('blocks joystick input during Replay %s', async field => {
        const {replay, frames, updatePreparationCamera} = install()
        const view = render(<ReplayCameraJoystick/>)
        await act(async () => { replay[field] = true })
        expect(view.queryByLabelText('Drag to adjust zoom and pitch')).toBeNull()
        expect(frames.size).toBe(0)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
    })
})
