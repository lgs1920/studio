/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-replay-camera-angle-guide.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-29
 * Last modified: 2026-09-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

const guideHarness = vi.hoisted(() => ({
    mount:   vi.fn(() => true),
    remove:  vi.fn(),
    resolve: vi.fn(({camera, sample}) => ({
        anchor: sample
            ? {height: sample.altitude, latitude: sample.latitude, longitude: sample.longitude}
            : {height: 0, latitude: 48, longitude: 2},
        mode: camera.positionMode === 'ahead' ? 'Ahead' : 'Behind',
    })),
    update: vi.fn(() => true),
}))

vi.mock('@Core/ui/replay/JourneyReplayCameraAngleGuide', () => ({
    mountJourneyReplayCameraAngleGuide: guideHarness.mount,
    removeJourneyReplayCameraAngleGuide: guideHarness.remove,
    resolveJourneyReplayCameraAngleGuide: guideHarness.resolve,
    updateJourneyReplayCameraAngleGuide: guideHarness.update,
}))

vi.mock('@Core/ui/replay/JourneyReplayRuntime', () => ({
    isJourneyReplayVideoCaptureActive: () => false,
}))

import {JourneyReplayCameraAngleGuide} from '@Components/JourneyReplay/JourneyReplayCameraAngleGuide'

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    globalThis.lgs = undefined
})

describe('JourneyReplayCameraAngleGuide component', () => {
    it('moves the Expert map guide with the live replay sample', async () => {
        const journey = {
            slug:   'journey-a',
            tracks: new Map(),
        }
        const replay = proxy({
            active:        false,
            liveSample:    null,
            sample:        null,
            recordingSync: true,
        })
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: proxy({
                        userMode: 'expert',
                        camera: {
                            headingOffset: 20,
                            positionMode:  'behind',
                        },
                    }),
                },
            },
            stores: {
                main: proxy({theJourney: journey}),
                replay,
                ui: {
                    drawers: proxy({open: null}),
                    video: proxy({
                        editing:      false,
                        preRecording: false,
                        recordingHQ:  false,
                        snapshot:     false,
                        finalizing:   false,
                    }),
                },
            },
            viewer: {},
        }

        render(<JourneyReplayCameraAngleGuide/>)
        expect(guideHarness.mount).not.toHaveBeenCalled()

        const sample = {
            longitude:  2.5,
            latitude:   48.5,
            altitude:   150,
            source: {
                startPoint: {longitude: 2.49, latitude: 48.5, altitude: 145},
                endPoint:   {longitude: 2.51, latitude: 48.5, altitude: 155},
            },
        }
        act(() => {
            replay.active = true
            replay.liveSample = sample
        })

        await waitFor(() => {
            expect(guideHarness.mount).toHaveBeenCalled()
            expect(guideHarness.resolve).toHaveBeenLastCalledWith(expect.objectContaining({sample}))
            expect(guideHarness.update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
                anchor: {height: 150, latitude: 48.5, longitude: 2.5},
                mode:   'Behind',
            }))
        })
    })
})
