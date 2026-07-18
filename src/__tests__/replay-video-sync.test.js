/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-sync.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        setVideoSafeMode: vi.fn(),
        setPublicationCadence: vi.fn(),
        restorePlaybackScene: vi.fn(),
    }
}

describe('JourneyReplayVideoSync', () => {
    afterEach(() => {
        vi.useRealTimers()
        globalThis.lgs = undefined
        globalThis.requestAnimationFrame = undefined
    })

    it('starts the replay when the recorder starts', () => {
        const recorder = new FakeRecorder()
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm()
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
        return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
            expect(store.recordingSync).toBe(true)
            expect(globalThis.lgs.settings.ui.replay.recordingSync).toBe(true)
            expect(replay.setVideoSafeMode).toHaveBeenCalledWith(true)
            expect(replay.start).toHaveBeenCalledWith({progress: 0})
        })
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

    it('stops the recorder immediately after stop clips complete when stop clips exist', async () => {
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

        expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
        expect(recorder.stopVideo).toHaveBeenCalledWith({captureFinalFrame: true})
    })

    it('stops the recorder immediately without stop clips after the final frame is ready', async () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const replay = makeJourneyReplay()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {replay: {recordingSync: false, clips: {stop: []}}}}}
        const sync = new JourneyReplayVideoSync({recorder, replay, store})

        sync.arm({autoStopRecording: true})
        window.dispatchEvent(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE))

        expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
        expect(recorder.stopVideo).toHaveBeenCalledWith({captureFinalFrame: true})
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

        expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
        expect(recorder.stopVideo).toHaveBeenCalledWith({captureFinalFrame: true})
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
})
