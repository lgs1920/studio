/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-sync.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified: 2026-06-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyReplayVideoSync } from '@Core/ui/replay/JourneyReplayVideoSync'
import { REPLAY_EVENT_END } from '@Core/ui/replay/JourneyReplayPlaybackController'
import { REPLAY_EVENT_STOP_CLIPS_COMPLETE } from '@Core/ui/replay/JourneyReplayMode'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'

vi.hoisted(() => {
    if (!Object.getOwnPropertyDescriptor(document, 'adoptedStyleSheets')) {
        Object.defineProperty(document, 'adoptedStyleSheets', {
            configurable: true,
            get: () => [],
            set: () => {},
        })
    }
})

class FakeRecorder extends EventTarget {
    constructor() {
        super()
        this.stopVideo = vi.fn(async () => {
            this.recording = false
            this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.STOP))
        })
        this.recording = false
    }

    isRecording = () => this.recording
}

const makeController = () => {
    const listeners = new Map()
    return {
        on: (event, callback) => {
            if (!listeners.has(event)) {
                listeners.set(event, new Set())
            }
            listeners.get(event).add(callback)
            return () => listeners.get(event)?.delete(callback)
        },
        emit: (event, detail) => {
            for (const callback of listeners.get(event) ?? []) {
                callback(detail)
            }
        },
    }
}

const makeJourneyReplay = () => {
    const controller = makeController()
    return {
        controller,
        start: vi.fn(),
        seek: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        setVideoSafeMode: vi.fn(),
        setPublicationCadence: vi.fn(),
        setTerrainHeightLookupBypass: vi.fn(),
        setTerrainHeightLookupTrace: vi.fn(),
        prepareReplayCamera: vi.fn(async () => true),
        restoreCameraState:     vi.fn(),
        restorePlaybackScene: vi.fn(),
    }
}

describe('JourneyReplayVideoSync', () => {
    afterEach(() => {
        vi.useRealTimers()
        globalThis.lgs = undefined
        globalThis.requestAnimationFrame = undefined
        delete globalThis.__lgsReplayVideoTrace
    })

    it('starts the replay when the recorder starts', () => {
        const recorder = new FakeRecorder()
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm()
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
        expect(replay.start).not.toHaveBeenCalled()
        return waitFor(() => {
            expect(replay.start).toHaveBeenCalledWith({progress: 0})
            expect(replay.setTerrainHeightLookupBypass).toHaveBeenCalledWith(true)
            expect(replay.setTerrainHeightLookupTrace).toHaveBeenCalledWith(true)
        }).then(() => {
            const traceEntries = globalThis.__lgsReplayVideoTrace ?? []
            const traceEvents = traceEntries.map(entry => entry.event)
            expect(store.recordingSync).toBe(true)
            expect(globalThis.lgs.settings.ui.replay.recordingSync).toBe(true)
            expect(replay.setVideoSafeMode).toHaveBeenCalledWith(true)
            expect(replay.restoreCameraState).not.toHaveBeenCalled()
            expect(replay.setTerrainHeightLookupBypass.mock.invocationCallOrder[0]).toBeLessThan(replay.start.mock.invocationCallOrder[0])
            expect(replay.setTerrainHeightLookupBypass).toHaveBeenLastCalledWith(false)
            expect(replay.setTerrainHeightLookupTrace).toHaveBeenLastCalledWith(false)
            expect(traceEvents).toEqual(expect.arrayContaining([
                'draft.recorder.start.received',
                'draft.replay.start.scheduled',
                'draft.replay.terrain.lookup.bypass.start',
                'draft.replay.camera.prepared',
                'draft.replay.start.begin',
                'draft.replay.terrain.lookup.bypass.end',
                'draft.replay.start.end',
            ]))
            expect(traceEntries.find(entry => entry.event === 'draft.replay.start.end')?.data).toEqual(expect.objectContaining({
                succeeded: true,
                errored: false,
            }))
        })
    })

    it('stops a replay whose start clips are still pending when recording is cancelled', async () => {
        const recorder = new FakeRecorder()
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm()
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
        await waitFor(() => {
            expect(replay.start).toHaveBeenCalledWith({progress: 0})
        })
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.CANCEL))
        expect(replay.stop).toHaveBeenCalledWith({
            emit:              false,
            deferSceneRestore: false,
        })
        expect(replay.restorePlaybackScene).toHaveBeenCalledWith({force: true})
    })

    it('uses a tighter publication cadence in quality capture mode', () => {
        const recorder = new FakeRecorder()
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({captureMode: 'quality', captureFps: 60})
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))

        expect(replay.setPublicationCadence).toHaveBeenCalledWith({
            storeSyncInterval:   17,
            globalUpdateInterval: 17,
        })
        expect(replay.setVideoSafeMode).not.toHaveBeenCalledWith(true)
    })

    it('stops the recorder after the final composed frames when stop clips exist', async () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false, clips: {stop: [{}]}}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({autoStopRecording: true})
        replay.controller.emit(REPLAY_EVENT_END)
        expect(recorder.stopVideo).not.toHaveBeenCalled()

        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE))
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
        expect(recorder.stopVideo).toHaveBeenCalledWith({captureFinalFrame: true})
    })

    it('stops the recorder after the final composed frames without stop clips', async () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false, clips: {stop: []}}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({autoStopRecording: true})
        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE))
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
        expect(recorder.stopVideo).toHaveBeenCalledWith({captureFinalFrame: true})
        expect(replay.seek).toHaveBeenCalledWith(1)
    })

    it('captures the final frame before stopping the recorder', async () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false, clips: {stop: [{}]}}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({autoStopRecording: true})
        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE))
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
        expect(recorder.stopVideo).toHaveBeenCalledWith({captureFinalFrame: true})
        expect(replay.seek).toHaveBeenCalledWith(1)
    })

    it('stops the replay when the recorder stops', () => {
        const recorder = new FakeRecorder()
        const replay = makeJourneyReplay()
        replay.running = true
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm()
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.STOP))

        expect(replay.setVideoSafeMode).toHaveBeenCalledWith(false)
        expect(replay.stop).toHaveBeenCalledWith({
            emit:              false,
            deferSceneRestore: true,
        })
        expect(replay.restorePlaybackScene).toHaveBeenCalledWith({force: true})
    })

    it('disarm prevents stop-clips-complete events from stopping the recorder', () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({autoStopRecording: true})
        sync.disarm()
        replay.controller.emit(REPLAY_EVENT_END)
        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE))

        expect(store.recordingSync).toBe(false)
        expect(globalThis.lgs.settings.ui.replay.recordingSync).toBe(false)
        expect(replay.setVideoSafeMode).toHaveBeenCalledWith(false)
        expect(recorder.stopVideo).not.toHaveBeenCalled()
    })

    it('ignores stop-clips-complete from the previous replay session', async () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const replay = makeJourneyReplay()
        replay.clipSequenceToken = 2
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({autoStopRecording: true})
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
        await waitFor(() => {
            expect(replay.start).toHaveBeenCalledTimes(1)
        })
        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE, {
            detail: {clipSequenceToken: 1},
        }))

        await new Promise(resolve => setTimeout(resolve, 10))

        expect(recorder.stopVideo).not.toHaveBeenCalled()
    })

    it('waits for an asynchronous replay start before accepting its stop token', async () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const replay = makeJourneyReplay()
        replay.clipSequenceToken = 1
        let resolveStart
        replay.start = vi.fn(() => new Promise(resolve => {
            resolveStart = resolve
        }))
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({autoStopRecording: true})
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
        await waitFor(() => {
            expect(replay.start).toHaveBeenCalledTimes(1)
        })
        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE, {
            detail: {clipSequenceToken: 1},
        }))

        expect(recorder.stopVideo).not.toHaveBeenCalled()

        replay.clipSequenceToken = 2
        resolveStart()
        await Promise.resolve()
        await Promise.resolve()

        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE, {
            detail: {clipSequenceToken: 1},
        }))
        expect(recorder.stopVideo).not.toHaveBeenCalled()

        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE, {
            detail: {clipSequenceToken: 2},
        }))
        await waitFor(() => {
            expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
        })
    })

    it('ignores a replay start that resolves after the recording was disarmed', async () => {
        const recorder = new FakeRecorder()
        const replay = makeJourneyReplay()
        let resolveStart
        replay.start = vi.fn(() => new Promise(resolve => {
            resolveStart = resolve
        }))
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm()
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
        await waitFor(() => {
            expect(replay.start).toHaveBeenCalledTimes(1)
        })
        sync.disarm()
        replay.clipSequenceToken = 4
        resolveStart()

        await Promise.resolve()
        await Promise.resolve()

        expect(store.recordingSync).toBe(false)
        expect(replay.clipSequenceToken).toBe(4)
    })

    it('cancels a pending auto-stop when the previous replay is aborted', async () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const replay = makeJourneyReplay()
        replay.clipSequenceToken = 1
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({autoStopRecording: true})
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE, {
            detail: {clipSequenceToken: 1},
        }))
        sync.stopJourneyReplay()

        await new Promise(resolve => setTimeout(resolve, 20))

        expect(recorder.stopVideo).not.toHaveBeenCalled()
    })
})
