/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-replay-button.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-28
 * Last modified: 2026-10-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name, rotate}) => <span data-icon={name} data-rotate={rotate}/>,
    WaTooltip: ({children}) => <span>{children}</span>,
}))

import {JourneyReplayButton} from '@Components/JourneyReplay/JourneyReplayButton'

describe('JourneyReplayButton synchronized video entry point', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                drawerManager: {
                    isCurrent: vi.fn(() => false),
                    open: vi.fn(),
                    close: vi.fn(),
                },
            },
        }
        globalThis.lgs = {
            theJourney: {slug: 'journey-a'},
            stores: {
                ui: {
                    video: proxy({
                        recording: false,
                        preRecording: false,
                        snapshot: false,
                        editing: false,
                        timelinePreviewActive: false,
                        cropper: proxy({}),
                    }),
                },
                replay: proxy({recordingSync: false, simplePreparationActive: false}),
            },
            settings: {
                ui: {
                    replay: proxy({userMode: 'basic', simple: null, recordingSync: false}),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('prepares Basic Replay on the map and exposes video launch controls', async () => {
        const enterReplayPreparation = vi.fn()
        globalThis.__.ui.replay = {enterReplayPreparation}
        globalThis.lgs.settings.ui.replay.duration = 60
        globalThis.lgs.settings.ui.replay.simple = {
            duration: 10,
            camera: {headingOffset: 8, pitch: -48, positionMode: 'behind'},
        }
        globalThis.lgs.theJourney.replay = {
            simple: {camera: {headingOffset: -24, pitch: -48, positionMode: 'behind'}},
        }
        render(
            <JourneyReplayButton
                id="launch-basic-replay"
                mode="basic"
                ariaLabel="Basic Replay"
            />,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Basic Replay'}))

        expect(screen.queryByRole('dialog')).toBeNull()
        expect(enterReplayPreparation).toHaveBeenCalledWith(expect.objectContaining({
            journey: globalThis.lgs.theJourney,
            shouldApply: expect.any(Function),
        }))
        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
        expect(globalThis.lgs.settings.ui.replay.simple.camera).toMatchObject({
            cameraAngle: 156,
            pitch: -48,
        })
        expect(globalThis.lgs.settings.ui.replay.camera).toMatchObject({
            cameraAngle: 156,
        })
        expect(globalThis.lgs.stores.replay.camera).toMatchObject({
            cameraAngle: 156,
        })
        expect(globalThis.lgs.settings.ui.replay.duration).toBe(60)
        expect(globalThis.lgs.stores.replay.duration).toBe(10)
        expect(globalThis.lgs.settings.ui.replay.simple.camera.debug).toBe(false)
        expect(globalThis.lgs.stores.replay.simplePreparationActive).toBe(true)
        await waitFor(() => {
            const icon = screen.getByRole('button', {name: 'Start Basic Replay'}).querySelector('[data-icon="video-down-to-line"]')
            expect(icon).not.toBeNull()
            expect(icon.getAttribute('data-rotate')).toBe('45')
        })

        expect(globalThis.lgs.settings.ui.replay.userMode).toBe('basic')
        expect(globalThis.lgs.stores.replay.userMode).toBe('basic')
    })

    it('restores the Expert duration after leaving Basic Replay', () => {
        globalThis.lgs.settings.ui.replay.duration = 60
        globalThis.lgs.settings.ui.replay.simple = {duration: 10}
        globalThis.lgs.theJourney.replay = {
            expert: {camera: {altitude: 900, pitch: -60}},
        }

        const {unmount} = render(
            <JourneyReplayButton id="launch-basic-replay-duration" mode="basic" ariaLabel="Basic Replay"/>,
        )
        fireEvent.click(screen.getByRole('button', {name: 'Basic Replay'}))
        expect(globalThis.lgs.stores.replay.duration).toBe(10)
        expect(globalThis.lgs.settings.ui.replay.duration).toBe(60)

        unmount()
        render(
            <JourneyReplayButton id="launch-expert-replay-duration" mode="expert" ariaLabel="Expert Replay"/>,
        )
        fireEvent.click(screen.getByRole('button', {name: 'Expert Replay'}))

        expect(globalThis.lgs.stores.replay.duration).toBe(60)
        expect(globalThis.lgs.settings.ui.replay.duration).toBe(60)
    })

    it('migrates a legacy Simple camera to one angle when entering Expert Replay', () => {
        globalThis.lgs.theJourney.replay = {
            simple: {camera: {positionMode: 'system'}},
        }

        render(
            <JourneyReplayButton
                id="launch-expert-replay-from-simple-camera"
                mode="expert"
                ariaLabel="Expert Replay"
            />,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Expert Replay'}))

        expect(globalThis.lgs.theJourney.replay.expert.camera.cameraAngle).toBe(180)
        expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(180)
        expect(globalThis.lgs.stores.replay.camera.cameraAngle).toBe(180)
        expect(globalThis.lgs.stores.replay.userMode).toBe('expert')
    })

    it('keeps the Expert Replay icon upright', () => {
        render(
            <JourneyReplayButton
                id="launch-expert-replay-icon"
                mode="expert"
                ariaLabel="Expert Replay"
            />,
        )

        const icon = screen.getByRole('button', {name: 'Expert Replay'}).querySelector('[data-icon="drone"]')
        expect(icon).not.toBeNull()
        expect(icon.getAttribute('data-rotate')).toBe('0')
    })

    it('opens Expert Replay in the crop zone with all widgets and the timeline', () => {
        const expertCamera = {debug: true, positionMode: 'ahead'}
        globalThis.lgs.theJourney.replay = {expert: {camera: expertCamera}}
        globalThis.lgs.settings.ui.replay.userMode = 'basic'

        render(
            <JourneyReplayButton
                id="launch-expert-replay"
                mode="expert"
                ariaLabel="Expert Replay"
            />,
        )

        const icon = screen.getByRole('button', {name: 'Expert Replay'}).querySelector('[data-icon="drone"]')
        expect(icon).not.toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Expert Replay'}))

        expect(globalThis.lgs.settings.ui.replay.camera).toMatchObject({debug: true, cameraAngle: 0})
        expect(globalThis.lgs.stores.replay.camera).toMatchObject({debug: true, cameraAngle: 0})
        expect(globalThis.lgs.settings.ui.replay.userMode).toBe('expert')
        expect(globalThis.lgs.stores.replay.userMode).toBe('expert')
        expect(globalThis.lgs.settings.ui.replay.recordingSync).toBe(true)
        expect(globalThis.lgs.stores.replay.recordingSync).toBe(true)
        expect(globalThis.lgs.stores.replay.simplePreparationActive).toBe(false)
        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
        expect(globalThis.lgs.stores.ui.video.timelinePreviewActive).toBe(true)
        expect(globalThis.lgs.stores.ui.video.cropper).toMatchObject({
            ratioEditor: true,
            widgetEditor: true,
            draggable: true,
            resizable: true,
        })
        expect(globalThis.__.ui.drawerManager.open).not.toHaveBeenCalled()
    })

    it.each([
        ['Basic', 'basic', 'wa'],
        ['Expert', 'expert', 'tunnel'],
    ])('hides the %s Replay entry point when no Journey is selected', (label, mode, tooltipStyle) => {
        globalThis.lgs.theJourney = null

        render(
            <JourneyReplayButton
                id={`launch-${mode}-replay-without-journey`}
                mode={mode}
                tooltipStyle={tooltipStyle}
                ariaLabel={`${label} Replay`}
            />,
        )

        expect(screen.queryByRole('button', {name: `${label} Replay`})).toBeNull()
    })
})
