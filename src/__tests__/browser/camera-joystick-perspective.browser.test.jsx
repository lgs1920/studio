/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: camera-joystick-perspective.browser.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-23
 * Last modified: 2026-11-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, expect, it, vi} from 'vitest'
import {userEvent} from 'vitest/browser'
import {render} from 'vitest-browser-react'
import {proxy} from 'valtio'
import {ReplayCameraJoystick} from '@Components/JourneyReplay/ReplayCameraJoystick'

vi.mock('@Components/MainUI/widgets/Widget', () => ({Widget: ({children}) => <div>{children}</div>}))
vi.mock('@Core/ui/replay/JourneyReplayRuntime', () => ({
    currentJourneyReplayCameraSettings: () => lgs.stores.replay.camera,
    isJourneyReplayCameraActive: () => false,
}))

afterEach(() => {
    vi.unstubAllGlobals()
})

it('drags the dome and grip using real browser hit testing at a steep tilt', async () => {
    const replay = proxy({camera: {altitude: 1200, pitch: -40, cameraAngle: 65}})
    const updatePreparationCamera = vi.fn(updates => Object.assign(replay.camera, updates))
    vi.stubGlobal('lgs', {
        camera: {pitch: -0.15},
        settings: {ui: proxy({joystick: {followPitch: true}})},
        stores: {
            replay,
            main: proxy({theJourney: {slug: 'prepared'}}),
            ui: {video: proxy({editing: true})},
        },
    })
    vi.stubGlobal('__', {ui: {replay: {updatePreparationCamera}}})

    const view = await render(<ReplayCameraJoystick/>)
    try {
        const pad = view.getByRole('group', {name: /adjust pitch/})
        const element = pad.element()
        await expect.element(pad).toHaveClass('is-threejs-ready')
        const {left, top, width, height} = element.getBoundingClientRect()
        const visual = element.querySelector('.replay-camera-joystick-visual')
        const matrix = new DOMMatrix(getComputedStyle(visual).transform)
        const dome = element.querySelector('.replay-camera-joystick-dome-hit')
        const grip = element.querySelector('.replay-camera-joystick-grip-hit')

        /** Convert a point on the dial face using Chromium's computed transform. */
        const project = (x, y) => {
            const point = matrix.transformPoint(new DOMPoint((x / 100 - 0.5) * width, (y / 100 - 0.5) * height))
            return {x: Math.round(width / 2 + point.x / point.w), y: Math.round(height / 2 + point.y / point.w)}
        }

        const center = project(50, 53)
        const gripRight = project(78.5, 54)
        const gripBottom = project(50, 80.5)
        expect(document.elementFromPoint(left + center.x, top + center.y)).toBe(dome)
        expect(document.elementFromPoint(left + gripRight.x, top + gripRight.y)).toBe(grip)
        expect(document.elementFromPoint(left + gripBottom.x, top + gripBottom.y)).toBe(grip)

        await userEvent.dragAndDrop(pad, pad, {
            sourcePosition: center, targetPosition: {x: center.x + 20, y: center.y - 10},
        })
        expect(replay.camera.altitude).toBeLessThan(1200)
        expect(replay.camera.pitch).toBe(-40)
        const zoomedAltitude = replay.camera.altitude
        await userEvent.dragAndDrop(pad, pad, {
            sourcePosition: center, targetPosition: {x: center.x + 10, y: center.y - 20},
        })
        expect(replay.camera.pitch).toBeGreaterThan(-40)
        expect(replay.camera.altitude).toBe(zoomedAltitude)
        expect(replay.camera.cameraAngle).toBe(65)

        await userEvent.dragAndDrop(pad, pad, {sourcePosition: gripRight, targetPosition: gripBottom})
        expect(replay.camera.cameraAngle).toBeLessThan(0)
    }
    finally {
        await view.unmount()
    }
})
