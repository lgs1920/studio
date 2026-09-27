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
 * Last modified: 2026-09-27
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
                replayVideoSync: {
                    arm: vi.fn(),
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

    it('arms synchronization and opens video editing from a selected journey', () => {
        render(
            <JourneyReplayButton
                id="launch-the-replay-video"
                tooltipText="Record a synchronized Replay video"
                ariaLabel="Record a synchronized Replay video"
                onClick={() => {
                    __.ui.replayVideoSync.arm({autoStopRecording: true, resetToStart: true})
                    lgs.stores.ui.video.editing = true
                }}
            />,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Record a synchronized Replay video'}))

        expect(globalThis.__.ui.replayVideoSync.arm).toHaveBeenCalledWith({
            autoStopRecording: true,
            resetToStart: true,
        })
        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
        expect(globalThis.__.ui.drawerManager.open).not.toHaveBeenCalled()
        expect(screen.getByRole('button').querySelector('[data-icon="drone"]')).not.toBeNull()
    })

    it('prepares Basic Replay on the map and exposes video launch controls', async () => {
        const enterReplayPreparation = vi.fn()
        globalThis.__.ui.replay = {enterReplayPreparation}
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
        expect(globalThis.__.ui.replayVideoSync.arm).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
        expect(globalThis.lgs.settings.ui.replay.simple.camera.heading).toBe(0)
        expect(globalThis.lgs.settings.ui.replay.simple.camera.headingOffset).toBe(0)
        expect(globalThis.lgs.settings.ui.replay.simple.camera.positionMode).toBe('system')
        expect(globalThis.lgs.settings.ui.replay.camera.positionMode).toBe('system')
        expect(globalThis.lgs.stores.replay.camera.positionMode).toBe('system')
        expect(globalThis.lgs.settings.ui.replay.simple.camera.debug).toBe(false)
        expect(globalThis.lgs.stores.replay.simplePreparationActive).toBe(true)
        await waitFor(() => {
            const icon = screen.getByRole('button', {name: 'Start Basic Replay'}).querySelector('[data-icon="video-down-to-line"]')
            expect(icon).not.toBeNull()
            expect(icon.getAttribute('data-rotate')).toBe('45')
        })

        expect(globalThis.lgs.settings.ui.replay.userMode).toBe('basic')
    })

    it('forces a journey-relative camera position when entering Expert Replay', () => {
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

        expect(globalThis.lgs.theJourney.replay.expert.camera.positionMode).toBe('behind')
        expect(globalThis.lgs.settings.ui.replay.camera.positionMode).toBe('behind')
        expect(globalThis.lgs.stores.replay.camera.positionMode).toBe('behind')
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

        expect(globalThis.lgs.settings.ui.replay.camera).toMatchObject(expertCamera)
        expect(globalThis.lgs.stores.replay.camera).toMatchObject(expertCamera)
        expect(globalThis.lgs.settings.ui.replay.userMode).toBe('expert')
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
})
