import {REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP} from '@Core/ui/replay/JourneyReplayClips'
import {
    finiteNumber, isJourneyReplayCameraActive, isJourneyReplayTraceActive, isJourneyReplayVideoCaptureActive,
    publishReplayClipFrameState, resetRuntimeProgress,
} from '@Core/ui/replay/JourneyReplayRuntime'
import {describe, expect, it} from 'vitest'

describe('JourneyReplayRuntime', () => {
    it('keeps only finite numeric values', () => {
        expect(finiteNumber('12.5')).toBe(12.5)
        expect(finiteNumber(Number.NaN)).toBeNull()
        expect(finiteNumber(undefined)).toBeNull()
    })

    it('does not activate camera updates for an inactive configured replay', () => {
        expect(isJourneyReplayCameraActive({sample: {progress: 0.5}})).toBe(false)
    })

    it('activates camera updates while replay playback or clips are active', () => {
        expect(isJourneyReplayCameraActive({active: true})).toBe(true)
        expect(isJourneyReplayCameraActive({paused: true})).toBe(true)
        expect(isJourneyReplayCameraActive({clipSequenceActive: true})).toBe(true)
    })

    it('does not keep the replay trace visible from a completed linked recording', () => {
        const previousLgs = globalThis.lgs
        try {
            globalThis.lgs = {
                settings: {ui: {replay: {recordingSync: true}}},
                stores: {
                    replay: {recordingSync: true},
                    ui: {
                        video: {
                            editing:      true,
                            preRecording: false,
                            recording:    false,
                            snapshot:     false,
                            finalizing:   false,
                        },
                    },
                },
            }

            expect(isJourneyReplayVideoCaptureActive()).toBe(false)
            expect(isJourneyReplayTraceActive()).toBe(false)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('keeps the replay trace visible during an active linked recording', () => {
        const previousLgs = globalThis.lgs
        try {
            globalThis.lgs = {
                settings: {ui: {replay: {recordingSync: true}}},
                stores: {
                    replay: {recordingSync: true},
                    ui: {video: {recording: true}},
                },
            }

            expect(isJourneyReplayVideoCaptureActive()).toBe(true)
            expect(isJourneyReplayTraceActive()).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('publishes a normalized start clip frame state', () => {
        const store = {
            direction: 1,
            elapsedMillis: 100,
            durationMillis: 1000,
        }

        const phase = publishReplayClipFrameState({
            store,
            slot: REPLAY_CLIP_SLOT_START,
            progress: 0.25,
            sample: {
                journeyElapsedMillis: 250,
                journeyDurationMillis: 1000,
            },
        })

        expect(phase.slot).toBe(REPLAY_CLIP_SLOT_START)
        expect(store.dynamicFrameState.phase).toBe(phase)
        expect(store.dynamicFrameState.elapsedMillis).toBe(250)
    })

    it('publishes the shared frame contract fields for clip playback', () => {
        const store = {
            direction: 1,
            elapsedMillis: 100,
            durationMillis: 1000,
        }

        const phase = publishReplayClipFrameState({
            store,
            slot: REPLAY_CLIP_SLOT_START,
            progress: 0.25,
            sample: {
                journeyElapsedMillis: 250,
                journeyDurationMillis: 1000,
            },
        })

        expect(store.dynamicFrameState).toEqual(expect.objectContaining({
            active:          true,
            playing:         false,
            paused:          false,
            index:           null,
            frameIndex:      null,
            frameId:         null,
            frameCount:      null,
            frameTimeMs:     null,
            frameIntervalMs: null,
            replayFrameIndex: null,
            replayFrameCount: null,
            phase,
            source:          'clip',
        }))
    })

    it('publishes the stop phase at the end of the replay', () => {
        const store = {direction: -1}
        const phase = publishReplayClipFrameState({store, slot: REPLAY_CLIP_SLOT_STOP})

        expect(phase.progress).toBe(1)
        expect(phase.localProgress).toBe(1)
        expect(store.dynamicFrameState.direction).toBe(-1)
    })

    it('resets transient replay state', () => {
        const store = {
            active: true,
            playing: true,
            paused: true,
            progress: 0.5,
            metricOverlay: {visible: true, source: 'test'},
        }

        resetRuntimeProgress(store)

        expect(store.active).toBe(false)
        expect(store.playing).toBe(false)
        expect(store.progress).toBe(0)
        expect(store.dynamicFrameState).toBeNull()
        expect(store.resolvedFrameState).toBeNull()
        expect(store.metricOverlay.visible).toBe(false)
    })
})
