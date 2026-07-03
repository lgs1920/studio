/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughVideoSync.js
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

import { FLYTHROUGH_EVENT_STOP_CLIPS_COMPLETE } from './FlythroughMode'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'

const defaultFlythroughStore = () => globalThis.lgs?.stores?.flythrough ?? null

/**
 * Bridge the recorder lifecycle with the flythrough playback.
 *
 * The helper is intentionally small and stateful:
 * - arm/disarm is driven by the UI toggle;
 * - recorder START starts the flythrough;
 * - recorder pause/resume mirrors playback;
 * - flythrough END waits for stop-clips completion, then stops the recorder and opens the normal export flow.
 */
export class FlythroughVideoSync {
    #armed = false
    #autoStopRecording = true
    #resetToStart = true
    #recorder = null
    #flythrough = null
    #store = null
    #bound = false
    #pendingStartTimeout = null

    constructor({recorder = globalThis.__?.recorder ?? null, flythrough = globalThis.__?.ui?.flythrough ?? null, store = defaultFlythroughStore()} = {}) {
        this.#recorder = recorder
        this.#flythrough = flythrough
        this.#store = store
    }

    #syncStore = () => {
        if (this.#store) {
            this.#store.recordingSync = this.#armed
        }
        if (globalThis.lgs?.settings?.ui?.flythrough) {
            globalThis.lgs.settings.ui.flythrough.recordingSync = this.#armed
        }
    }

    #resolveRecorder = () => this.#recorder ?? globalThis.__?.recorder ?? null
    #resolveFlythrough = () => this.#flythrough ?? globalThis.__?.ui?.flythrough ?? null

    #cancelPendingStart = () => {
        if (this.#pendingStartTimeout !== null) {
            clearTimeout(this.#pendingStartTimeout)
            this.#pendingStartTimeout = null
        }
    }

    stopFlythrough = ({deferSceneRestore = false} = {}) => {
        const flythrough = this.#resolveFlythrough()
        if (!flythrough) {
            return
        }

        this.#cancelPendingStart()
        if (flythrough.running || flythrough.paused || flythrough.playing) {
            flythrough.stop?.({
                emit:              false,
                deferSceneRestore: deferSceneRestore === true,
            })
        }
    }

    #setVideoSafeMode = (enabled) => {
        this.#resolveFlythrough()?.setVideoSafeMode?.(enabled)
    }

    #stopRecorderAfterStopClips = () => {
        if (!this.#armed || !this.#autoStopRecording) {
            return
        }

        this.#setVideoSafeMode(false)
        const recorder = this.#resolveRecorder()
        if (recorder?.isRecording?.()) {
            void recorder.stopVideo()
        }
    }

    #bind = () => {
        if (this.#bound) {
            return
        }

        const recorder = this.#resolveRecorder()
        const flythrough = this.#resolveFlythrough()
        if (!recorder || !flythrough) {
            return
        }

        this.#recorder = recorder
        this.#flythrough = flythrough

        const startFlythrough = () => {
            if (!this.#armed) {
                return
            }

            this.#setVideoSafeMode(true)
            this.#cancelPendingStart()
            this.#pendingStartTimeout = setTimeout(() => {
                this.#pendingStartTimeout = null
                if (!this.#armed) {
                    this.#setVideoSafeMode(false)
                    return
                }
                if (this.#resetToStart && this.#flythrough?.running) {
                    this.#flythrough.stop?.({emit: false})
                }
                this.#flythrough?.start?.({progress: 0})
            }, 0)
        }

        const handleRecorderStart = () => {
            startFlythrough()
        }

        const handleRecorderPause = () => {
            if (!this.#armed) {
                return
            }
            this.#flythrough?.pause?.()
        }

        const handleRecorderResume = () => {
            if (!this.#armed) {
                return
            }
            this.#flythrough?.resume?.()
        }

        const handleRecorderStop = (event) => {
            this.#setVideoSafeMode(false)
            this.stopFlythrough({
                deferSceneRestore: event?.type === ScreenMediaRecorder.events.STOP,
            })
        }

        const handleStopClipsComplete = () => {
            this.#stopRecorderAfterStopClips()
        }

        recorder.addEventListener?.(ScreenMediaRecorder.events.START, handleRecorderStart)
        recorder.addEventListener?.(ScreenMediaRecorder.events.PAUSE, handleRecorderPause)
        recorder.addEventListener?.(ScreenMediaRecorder.events.RESUME, handleRecorderResume)
        recorder.addEventListener?.(ScreenMediaRecorder.events.STOP, handleRecorderStop)
        recorder.addEventListener?.(ScreenMediaRecorder.events.CANCEL, handleRecorderStop)
        recorder.addEventListener?.(ScreenMediaRecorder.events.FINALIZE, handleRecorderStop)
        recorder.addEventListener?.(ScreenMediaRecorder.events.MAX_DURATION, handleRecorderStop)
        recorder.addEventListener?.(ScreenMediaRecorder.events.MAX_SIZE, handleRecorderStop)

        globalThis.window?.addEventListener?.(FLYTHROUGH_EVENT_STOP_CLIPS_COMPLETE, handleStopClipsComplete)

        this.#bound = true
    }

    arm = ({
        recorder = null,
        flythrough = null,
        store = null,
        autoStopRecording = true,
        resetToStart = true,
    } = {}) => {
        if (recorder) {
            this.#recorder = recorder
        }
        if (flythrough) {
            this.#flythrough = flythrough
        }
        if (store) {
            this.#store = store
        }

        this.#autoStopRecording = autoStopRecording !== false
        this.#resetToStart = resetToStart !== false
        this.#armed = true
        this.#syncStore()
        this.#bind()
        return this
    }

    disarm = () => {
        this.#armed = false
        this.#cancelPendingStart()
        this.#setVideoSafeMode(false)
        this.#syncStore()
        return this
    }

    isArmed = () => this.#armed
}
