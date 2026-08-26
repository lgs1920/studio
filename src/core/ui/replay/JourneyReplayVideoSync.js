/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayVideoSync.js
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

import { REPLAY_EVENT_STOP_CLIPS_COMPLETE } from './JourneyReplayMode'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { hasJourneyReplayStopClips } from '@Core/ui/replay/ReplayOverlayResolver'
import { replayVideoTraceDebug } from './ReplayVideoTraceDebug'

const defaultJourneyReplayStore = () => globalThis.lgs?.stores?.replay ?? null

const waitForAnimationFrame = () => new Promise(resolve => {
    const requestFrame = globalThis.requestAnimationFrame
                         ?? (callback => setTimeout(callback, 0))
    requestFrame(() => resolve())
})

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
    #replayCaptureActive = false
    #replayCaptureToken = null
    #replayStartPending = false
    #captureGeneration = 0

    constructor({recorder = globalThis.__?.recorder ?? null, replay = globalThis.__?.ui?.replay ?? null, store = defaultJourneyReplayStore()} = {}) {
        this.#recorder = recorder
        this.#replay = replay
        this.#store = store
    }

    #syncStore = () => {
        if (this.#store) {
            this.#store.recordingSync = this.#armed
            this.#store.captureFps = this.#armed ? this.#captureFps : null
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
        this.#captureGeneration += 1
        const replay = this.#resolveJourneyReplay()
        if (!replay) {
            return
        }

        this.#cancelPendingStart()
        const replayWasActive = Boolean(this.#replayCaptureActive || replay.running || replay.paused || replay.playing)
        if (replayWasActive) {
            replay.stop?.({
                emit:              false,
                deferSceneRestore: deferSceneRestore === true,
            })
        }
        if (replayWasActive) {
            replay.setContinuousRender?.(false)
        }
        this.#replayCaptureActive = false
        this.#replayCaptureToken = null
        this.#replayStartPending = false
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

    #stopRecorderAfterStopClips = ({sample = null} = {}) => {
        if (!this.#armed || !this.#autoStopRecording) {
            return
        }

        const recorder = this.#resolveRecorder()
        const replay = this.#resolveJourneyReplay()
        const generation = this.#captureGeneration
        const captureToken = this.#replayCaptureToken
        const stopRecorder = async () => {
            if (!recorder?.isRecording?.()) {
                this.#setVideoSafeMode(false)
                return
            }

            try {
                // Publish the exact terminal sample before the recorder reads
                // the composited canvas for its final Draft frame.
                replay?.seek?.(1)
                await waitForAnimationFrame()
                await waitForAnimationFrame()
                replay?.seek?.(1)
                if (!this.#armed
                    || generation !== this.#captureGeneration
                    || captureToken !== this.#replayCaptureToken) {
                    return
                }
                await recorder.stopVideo({captureFinalFrame: true})
            }
            finally {
                this.#setVideoSafeMode(false)
            }
        }

        if (!hasJourneyReplayStopClips()) {
            // JourneyReplayMode already waits for the final widget/render
            // frames before dispatching STOP_CLIPS_COMPLETE. Starting the
            // recorder stop immediately keeps the final Cesium trace alive
            // while captureFinalFrame reads the source canvas.
            stopRecorder()
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

        const startJourneyReplay = async () => {
            if (!this.#armed) {
                return
            }

            const startGeneration = this.#captureGeneration
            const startStartedAt = globalThis.performance?.now?.() ?? Date.now()
            const previousTerrainHeightLookupBypass = this.#replay?.terrainHeightLookupBypass === true
            const previousTerrainHeightLookupTrace = this.#replay?.terrainHeightLookupTrace === true
            this.#cancelPendingStart()
            if (!this.#armed || startGeneration !== this.#captureGeneration) {
                this.#setVideoSafeMode(false)
                return
            }
            replayVideoTraceDebug('draft.replay.start.begin', {
                armed: this.#armed,
                resetToStart: this.#resetToStart === true,
                captureMode: this.#captureMode,
                captureFps: this.#captureFps,
                generation: startGeneration,
                replayRunning: this.#replay?.running === true,
            })
            let startSucceeded = false
            let startError = null
            try {
                this.#replay?.setTerrainHeightLookupTrace?.(true)
                this.#replay?.setTerrainHeightLookupBypass?.(true)
                replayVideoTraceDebug('draft.replay.terrain.lookup.bypass.start', {
                    generation: startGeneration,
                    previousBypass: previousTerrainHeightLookupBypass,
                    previousTrace: previousTerrainHeightLookupTrace,
                })
                this.#replay?.cancelPendingSceneRestore?.()
                if (this.#resetToStart && this.#replay?.running) {
                    this.#replay.stop?.({emit: false})
                }
                await waitForAnimationFrame()
                replayVideoTraceDebug('draft.replay.camera.prepared', {
                    generation: startGeneration,
                    hasPrepareReplayCamera: typeof this.#replay?.prepareReplayCamera === 'function',
                })
                if (!this.#armed || startGeneration !== this.#captureGeneration) {
                    return
                }
                this.#replayCaptureActive = true
                this.#replayStartPending = true
                const startResult = this.#replay?.start?.({progress: 0})
                await startResult
                if (!this.#armed || startGeneration !== this.#captureGeneration) {
                    return
                }
                this.#replayCaptureToken = Number.isFinite(this.#replay?.clipSequenceToken)
                                          ? this.#replay.clipSequenceToken
                                          : null
                startSucceeded = true
            }
            catch (error) {
                startError = error
                replayVideoTraceDebug('draft.replay.start.error', {
                    elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startStartedAt,
                    generation: startGeneration,
                    message: error?.message ?? null,
                    name: error?.name ?? null,
                    armed: this.#armed,
                })
                return
            }
            finally {
                this.#replay?.setTerrainHeightLookupBypass?.(previousTerrainHeightLookupBypass)
                this.#replay?.setTerrainHeightLookupTrace?.(previousTerrainHeightLookupTrace)
                replayVideoTraceDebug('draft.replay.terrain.lookup.bypass.end', {
                    generation: startGeneration,
                    restoredBypass: previousTerrainHeightLookupBypass,
                    restoredTrace: previousTerrainHeightLookupTrace,
                })
                if (!startSucceeded) {
                    this.#replayCaptureActive = false
                }
                this.#replayStartPending = false
                replayVideoTraceDebug('draft.replay.start.end', {
                    elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startStartedAt,
                    generation: startGeneration,
                    armed: this.#armed,
                    captureMode: this.#captureMode,
                    captureFps: this.#captureFps,
                    succeeded: startSucceeded,
                    errored: startError !== null,
                    captureToken: this.#replayCaptureToken,
                    captureActive: this.#replayCaptureActive,
                    pendingStart: this.#replayStartPending,
                })
            }
        }

        const handleRecorderStart = () => {
            replayVideoTraceDebug('draft.recorder.start.received', {
                armed: this.#armed,
                captureMode: this.#captureMode,
                captureFps: this.#captureFps,
                resetToStart: this.#resetToStart === true,
            })
            this.#setVideoCaptureCadence()
            this.#cancelPendingStart()
            this.#replayStartPending = true
            replayVideoTraceDebug('draft.replay.start.scheduled', {
                captureMode: this.#captureMode,
                captureFps: this.#captureFps,
                generation: this.#captureGeneration,
            })
            this.#pendingStartTimeout = globalThis.setTimeout(() => {
                this.#pendingStartTimeout = null
                void startJourneyReplay()
            }, 0)
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

        const handleStopClipsComplete = event => {
            const eventToken = event?.detail?.clipSequenceToken
            if (this.#replayStartPending) {
                return
            }
            if (this.#replayCaptureToken !== null
                && Number.isFinite(eventToken)
                && eventToken !== this.#replayCaptureToken) {
                return
            }
            this.#stopRecorderAfterStopClips(event?.detail ?? {})
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
        this.#captureGeneration += 1
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
        this.stopJourneyReplay()
        this.#setVideoSafeMode(false)
        this.#captureMode = 'speed'
        this.#captureFps = null
        this.#syncStore()
        return this
    }

    isArmed = () => this.#armed
}
