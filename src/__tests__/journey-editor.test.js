/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-editor.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-01
 * Last modified: 2026-06-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Utils } from '@Editor/Utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Utils/cesium/TrackUtils', () => ({
    TrackUtils: {
        setProfileVisibility: vi.fn(),
        saveCurrentJourneyToDB: vi.fn(async () => undefined),
        saveCurrentTrackToDB:   vi.fn(async () => undefined),
        saveCurrentPOIToDB:     vi.fn(async () => undefined),
    },
}))

describe('journey editor switching', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('stops rotation before switching journey and clears the stale rotation target', async () => {
        const callOrder = []
        const oldTrack = {
            slug:            'track-old',
            addToContext:    vi.fn(),
            addToEditor:     vi.fn(),
        }
        const newTrack = {
            slug:            'track-new',
            addToContext:    vi.fn(),
            addToEditor:     vi.fn(),
        }
        const oldJourney = {
            slug:         'journey-old',
            visible:      true,
            tracks:       new Map([['track-old', oldTrack]]),
            addToContext: vi.fn(function () {
                lgs.theJourney = this
            }),
            addToEditor:  vi.fn(),
            focus:        vi.fn(),
        }
        const newJourney = {
            slug:         'journey-new',
            visible:      true,
            tracks:       new Map([['track-new', newTrack]]),
            addToContext: vi.fn(function () {
                lgs.theJourney = this
            }),
            addToEditor:  vi.fn(),
            focus:        vi.fn(),
        }
        const stopRotate = vi.fn(async () => {
            callOrder.push(`stop:${lgs.theJourney.slug}`)
        })

        globalThis.lgs = {
            theJourney: oldJourney,
            theJourneyEditorProxy: {
                journey: oldJourney,
                track:   oldTrack,
                poi:     null,
            },
            getJourneyBySlug: slug => slug === newJourney.slug ? newJourney : oldJourney,
            saveJourneyInContext: vi.fn(),
            settings:             {
                ui: {
                    camera: {
                        start: {
                            rotate: {journey: false},
                        },
                    },
                },
            },
            stores:               {
                ui: {
                    mainUI: {
                        rotate: {running: true, target: {slug: 'journey-old', element: 'journey'}},
                    },
                },
                main: {
                    components: {
                        journeyEditor: {
                            list:  ['journey-old', 'journey-new'],
                            keys:  {
                                journey: {list: 0, settings: 0},
                                track:   {list: 0, settings: 0},
                            },
                        },
                    },
                },
            },
            db:                   {
                lgs1920: {
                    put: vi.fn(async () => undefined),
                },
            },
        }

        globalThis.__ = {
            ui: {
                cameraManager: {
                    isRotating: vi.fn(() => true),
                    stopRotate,
                },
                drawerManager: {
                    consumeSuppressFocusOnOpen: vi.fn(() => false),
                },
                profiler: {
                    draw: vi.fn(),
                },
            },
        }

        await Utils.updateJourneyEditor('journey-new', {focus: true, rotate: false})

        expect(callOrder).toEqual(['stop:journey-old'])
        expect(lgs.stores.ui.mainUI.rotate.target).toBeNull()
        expect(lgs.theJourney).toBe(newJourney)
        expect(newJourney.focus).toHaveBeenCalledTimes(1)
        expect(newJourney.focus.mock.calls[0][0]).toMatchObject({resetCamera: true, rotate: false})
    })
})
