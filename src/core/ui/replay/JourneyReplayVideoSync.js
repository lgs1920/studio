/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayVideoSync.js
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

import { REPLAY_EVENT_STOP_CLIPS_COMPLETE } from './JourneyReplayMode'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { hasJourneyReplayStopClips } from '@Components/Stats/replayStatsWidgetUtils'

const defaultJourneyReplayStore = () => globalThis.lgs?.stores?.replay ?? null

/**
 * Bridge the recorder lifecycle with the replay playback.
 *
 * The helper is intentionally small and stateful:
 * - arm/disarm is driven by the UI toggle;
 * - recorder START starts the replay;
 * - recorder pause/resume mirrors playback;
 * - replay END waits for stop-clips completion, then stops the recorder and opens the normal export flow.
 */
export class JourneyReplayVideoSync {
    #armed = false
    #autoStopRecording = true
    #resetToStart = true
    #captureMode = 'speed'
    #captureFps = null
    #recorder = null
    #replay = null
    #store = null
    #bound = false
    #pendingStartTimeout = null

    constructor({recorder = globalThis.__?.recorder ?? null, replay = globalThis.__?.ui?.replay ?? null, store = defaultJourneyReplayStore()} = {}) {
        this.#recorder = recorder
        this.#replay = replay
        this.#store = store
    }

    #syncStore = () => {
        if (this.#store) {
            this.#store.recordingSync = this.#armed
        }
        if (globalThis.lgs?.settings?.ui?.replay) {
            globalThis.lgs.settings.ui.replay.recordingSync = this.#armed
        }
    }

    #resolveRecorder = () => this.#recorder ?? globalThis.__?.recorder ?? null
    #resolveJourneyReplay = () => this.#replay ?? globalThis.__?.ui?.replay ?? null

    #cancelPendingStart = () => {
        if (this.#pendingStartTimeout !== null) {
            clearTimeout(this.#pendingStartTimeout)
            this.#pendingStartTimeout = null
        }
    }

    stopJourneyReplay = ({deferSceneRestore = false} = {}) => {
        const replay = this.#resolveJourneyReplay()
        if (!replay) {
            return
        }

        this.#cancelPendingStart()
        if (replay.running || replay.paused || replay.playing) {
            replay.stop?.({
                emit:              false,
                deferSceneRestore: deferSceneRestore === true,
            })
        }
    }

    #setVideoSafeMode = (enabled) => {
        this.#resolveJourneyReplay()?.setVideoSafeMode?.(enabled)
    }

    #setVideoCaptureCadence = () => {
        const replay = this.#resolveJourneyReplay()
        if (!replay) {
            return
        }

        if (this.#captureMode === 'quality') {
            const fps = Number(this.#captureFps)
            const interval = Number.isFinite(fps) && fps > 0 ? Math.max(16, Math.round(1000 / fps)) : 16
            replay.setPublicationCadence?.({
                storeSyncInterval:   interval,
                globalUpdateInterval: interval,
            })
            return
        }

        replay.setVideoSafeMode?.(true)
    }

    #stopRecorderAfterStopClips = () => {
        if (!this.#armed || !this.#autoStopRecording) {
            return
        }

        const recorder = this.#resolveRecorder()
        const stopRecorder = () => {
            this.#setVideoSafeMode(false)
            if (recorder?.isRecording?.()) {
                void recorder.stopVideo()
            }
        }

        if (!hasJourneyReplayStopClips()) {
            const raf = globalThis.requestAnimationFrame
                        ?? globalThis.window?.requestAnimationFrame?.bind(globalThis.window)
                        ?? (callback => setTimeout(callback, 0))

            raf(() => {
                raf(() => {
                    stopRecorder()
                })
            })
            return
        }

        stopRecorder()
    }

    #bind = () => {
        if (this.#bound) {
            return
        }

        const recorder = this.#resolveRecorder()
        const replay = this.#resolveJourneyReplay()
        if (!recorder || !replay) {
            return
        }

        this.#recorder = recorder
        this.#replay = replay

        const startJourneyReplay = () => {
            if (!this.#armed) {
                return
            }

            this.#setVideoCaptureCadence()
            this.#cancelPendingStart()
            if (!this.#armed) {
                this.#setVideoSafeMode(false)
                return
            }
            if (this.#resetToStart && this.#replay?.running) {
                this.#replay.stop?.({emit: false})
            }
            this.#replay?.start?.({progress: 0})
        }

        const handleRecorderStart = () => {
            startJourneyReplay()
        }

        const handleRecorderPause = () => {
            if (!this.#armed) {
                return
            }
            this.#replay?.pause?.()
        }

        const handleRecorderResume = () => {
            if (!this.#armed) {
                return
            }
            this.#replay?.resume?.()
        }

        const handleRecorderStop = (event) => {
            this.#setVideoSafeMode(false)
            this.stopJourneyReplay({
                deferSceneRestore: event?.type === ScreenMediaRecorder.events.STOP,
            })
            this.#resolveJourneyReplay()?.restorePlaybackScene?.({force: true})
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

        globalThis.window?.addEventListener?.(REPLAY_EVENT_STOP_CLIPS_COMPLETE, handleStopClipsComplete)

        this.#bound = true
    }

    arm = ({
        recorder = null,
        replay = null,
        store = null,
        autoStopRecording = true,
        resetToStart = true,
        captureMode = 'speed',
        captureFps = null,
    } = {}) => {
        if (recorder) {
            this.#recorder = recorder
        }
        if (replay) {
            this.#replay = replay
        }
        if (store) {
            this.#store = store
        }

        this.#autoStopRecording = autoStopRecording !== false
        this.#resetToStart = resetToStart !== false
        this.#captureMode = captureMode === 'quality' ? 'quality' : 'speed'
        this.#captureFps = captureFps
        this.#armed = true
        this.#syncStore()
        this.#bind()
        return this
    }

    disarm = () => {
        this.#armed = false
        this.#cancelPendingStart()
        this.#setVideoSafeMode(false)
        this.#captureMode = 'speed'
        this.#captureFps = null
        this.#syncStore()
        return this
    }

    isArmed = () => this.#armed
}
