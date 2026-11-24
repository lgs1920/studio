/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-editor-utils-loading.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-24
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {DRAWING_FROM_UI} from '@Core/constants'
import {describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
    getGlobalHideOtherJourneys: vi.fn(() => false),
    refreshJourneyVisibility:   vi.fn(),
    saveCurrentJourneyToDB:     vi.fn(async () => undefined),
    saveCurrentPOIToDB:         vi.fn(async () => undefined),
    saveCurrentTrackToDB:       vi.fn(async () => undefined),
    setProfileVisibility:       vi.fn(),
    toastError:                 vi.fn(),
    toastWarning:               vi.fn(),
}))

vi.mock('@Core/Journey', () => ({Journey: class {}}))
vi.mock('@Core/Track', () => ({Track: class {}}))
vi.mock('@Core/ui/JourneyVisibility', () => ({
    getGlobalHideOtherJourneys: mocks.getGlobalHideOtherJourneys,
    refreshJourneyVisibility:   mocks.refreshJourneyVisibility,
}))
vi.mock('@Utils/cesium/TrackUtils', () => ({
    TrackUtils: {
        saveCurrentJourneyToDB: mocks.saveCurrentJourneyToDB,
        saveCurrentPOIToDB:     mocks.saveCurrentPOIToDB,
        saveCurrentTrackToDB:   mocks.saveCurrentTrackToDB,
        setProfileVisibility:   mocks.setProfileVisibility,
    },
}))
vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error:   mocks.toastError,
        warning: mocks.toastWarning,
    },
}))

const {Utils} = await import('@Editor/Utils')

const createContext = () => {
    const track = {
        addToContext: vi.fn(),
        addToEditor:  vi.fn(),
        draw:         vi.fn(async () => undefined),
        slug:         'track-b',
    }
    const loadedJourney = {
        addToContext:    vi.fn(),
        addToEditor:     vi.fn(),
        focus:           vi.fn(),
        slug:            'journey-b',
        startupSpatial:  {bounds: [1, 1, 2, 2], centroid: {latitude: 1.5, longitude: 1.5}},
        tracks:          new Map([['track-b', track]]),
        tracksLoaded:    true,
        updateVisibility: vi.fn(),
        visible:          true,
    }
    const summary = {
        slug:        'journey-b',
        title:       'Journey B',
        tracks:      new Map(),
        tracksLoaded: false,
        visible:     true,
    }
    const editorStore = {
        journey: {slug: 'journey-a'},
        poi:     null,
        track:   null,
    }

    globalThis.__ = {
        ui: {
            drawerManager: {
                consumeSuppressFocusOnOpen: vi.fn(() => false),
            },
            poiManager: {
                stopRotationAndSync: vi.fn(async () => undefined),
            },
            profiler: {
                draw: vi.fn(),
            },
        },
    }
    globalThis.lgs = {
        getJourneyBySlug: vi.fn(() => summary),
        saveJourneyInContext: vi.fn(),
        settings: {
            ui: {camera: {start: {rotate: {journey: false}}}},
        },
        stores: {
            main: {
                components: {
                    journeyEditor: {
                        keys: {
                            journey: {list: 0, settings: 0},
                            track:   {list: 0, settings: 0},
                        },
                    },
                },
            },
            ui: {mainUI: {rotate: {target: null}}},
        },
        startupDataLoader: {
            ensureJourneyLoaded: vi.fn(async (_slug, options) => {
                options.onSpatialReady?.(loadedJourney, loadedJourney.startupSpatial)
                return loadedJourney
            }),
        },
        theJourneyEditorProxy: editorStore,
    }

    return {editorStore, loadedJourney, summary, track}
}

describe('journey editor lazy loading', () => {
    it('warns, loads, focuses and then switches to an unloaded catalog journey', async () => {
        const {editorStore, loadedJourney, summary, track} = createContext()

        try {
            await Utils.updateJourneyEditor('journey-b', {})

            expect(mocks.toastWarning).toHaveBeenCalledWith({
                caption: 'Journey loading',
                text:    'Journey B is loading in the background.',
            })
            expect(globalThis.lgs.startupDataLoader.ensureJourneyLoaded).toHaveBeenCalledWith(
                'journey-b',
                expect.objectContaining({onFirstTrackReady: expect.any(Function), onSpatialReady: expect.any(Function)}),
            )
            expect(loadedJourney.focus).toHaveBeenCalledWith({
                action:         DRAWING_FROM_UI,
                resetCamera:    true,
                rotate:         false,
                startupSpatial: loadedJourney.startupSpatial,
            })
            expect(editorStore.journey).toBe(loadedJourney)
            expect(editorStore.track).toBe(track)
            expect(summary.tracksLoaded).toBe(false)
        }
        finally {
            globalThis.__ = undefined
            globalThis.lgs = undefined
        }
    })

    it('keeps the current editor journey when lazy loading fails', async () => {
        const {editorStore} = createContext()
        const currentJourney = editorStore.journey
        globalThis.lgs.startupDataLoader.ensureJourneyLoaded.mockRejectedValueOnce(new Error('worker failed'))

        try {
            await Utils.updateJourneyEditor('journey-b', {})

            expect(editorStore.journey).toBe(currentJourney)
            expect(mocks.toastError).toHaveBeenCalledWith({
                caption: 'Journey loading failed',
                text:    'worker failed',
            })
        }
        finally {
            globalThis.__ = undefined
            globalThis.lgs = undefined
        }
    })
})
