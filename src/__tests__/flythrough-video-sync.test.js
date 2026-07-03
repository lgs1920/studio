/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythrough-video-sync.test.js
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

import { FlythroughVideoSync } from '@Core/ui/flythrough/FlythroughVideoSync'
import { FLYTHROUGH_EVENT_END } from '@Core/ui/flythrough/FlythroughPlaybackController'
import { FLYTHROUGH_EVENT_STOP_CLIPS_COMPLETE } from '@Core/ui/flythrough/FlythroughMode'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { describe, expect, it, vi } from 'vitest'

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

const makeFlythrough = () => {
    const controller = makeController()
    return {
        controller,
        start: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        setVideoSafeMode: vi.fn(),
        restorePlaybackScene: vi.fn(),
    }
}

describe('FlythroughVideoSync', () => {
    it('starts the flythrough when the recorder starts', () => {
        const recorder = new FakeRecorder()
        const flythrough = makeFlythrough()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {flythrough: {recordingSync: false}}}}
        const sync = new FlythroughVideoSync({recorder, flythrough, store})

        sync.arm()
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
        return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
            expect(store.recordingSync).toBe(true)
            expect(globalThis.lgs.settings.ui.flythrough.recordingSync).toBe(true)
            expect(flythrough.setVideoSafeMode).toHaveBeenCalledWith(true)
            expect(flythrough.start).toHaveBeenCalledWith({progress: 0})
        })
    })

    it('stops the recorder after stop clips complete', async () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const flythrough = makeFlythrough()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {flythrough: {recordingSync: false}}}}
        const sync = new FlythroughVideoSync({recorder, flythrough, store})

        sync.arm({autoStopRecording: true})
        flythrough.controller.emit(FLYTHROUGH_EVENT_END)
        expect(recorder.stopVideo).not.toHaveBeenCalled()

        window.dispatchEvent(new CustomEvent(FLYTHROUGH_EVENT_STOP_CLIPS_COMPLETE))

        expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
    })

    it('stops the flythrough when the recorder stops', () => {
        const recorder = new FakeRecorder()
        const flythrough = makeFlythrough()
        flythrough.running = true
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {flythrough: {recordingSync: false}}}}
        const sync = new FlythroughVideoSync({recorder, flythrough, store})

        sync.arm()
        recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.STOP))

        expect(flythrough.setVideoSafeMode).toHaveBeenCalledWith(false)
        expect(flythrough.stop).toHaveBeenCalledWith({
            emit:              false,
            deferSceneRestore: true,
        })
    })

    it('disarm prevents stop-clips-complete events from stopping the recorder', () => {
        const recorder = new FakeRecorder()
        recorder.recording = true
        const flythrough = makeFlythrough()
        const store = {recordingSync: false}
        globalThis.lgs = {settings: {ui: {flythrough: {recordingSync: false}}}}
        const sync = new FlythroughVideoSync({recorder, flythrough, store})

        sync.arm({autoStopRecording: true})
        sync.disarm()
        flythrough.controller.emit(FLYTHROUGH_EVENT_END)
        window.dispatchEvent(new CustomEvent(FLYTHROUGH_EVENT_STOP_CLIPS_COMPLETE))

        expect(store.recordingSync).toBe(false)
        expect(globalThis.lgs.settings.ui.flythrough.recordingSync).toBe(false)
        expect(flythrough.setVideoSafeMode).toHaveBeenCalledWith(false)
        expect(recorder.stopVideo).not.toHaveBeenCalled()
    })
})
