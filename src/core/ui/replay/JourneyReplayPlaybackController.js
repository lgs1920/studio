/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayPlaybackController.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {buildReplayFrameState} from './JourneyReplayRuntime'
import {createJourneyReplayLogicalFrame} from './JourneyReplayLogicalFrame'
import {ReplayFrameResolver} from './ReplayFrameResolver'
import {createReplayDefinition} from './ReplayDefinition'
import {createReplayRenderPlan} from './ReplayRenderPlan'
import {createReplayTrackPathDescriptor} from './ReplayTrackPathDescriptor'
import {buildReplayVideoTimeline, resolveReplayVideoFramePhase} from './ReplayVideoTimeline'

export const REPLAY_EVENT_START = 'replay/start'
export const REPLAY_EVENT_UPDATE = 'replay/update'
export const REPLAY_EVENT_PAUSE = 'replay/pause'
export const REPLAY_EVENT_RESUME = 'replay/resume'
export const REPLAY_EVENT_STOP = 'replay/stop'
export const REPLAY_EVENT_END = 'replay/end'
export const REPLAY_EVENTS = [
    REPLAY_EVENT_START,
    REPLAY_EVENT_UPDATE,
    REPLAY_EVENT_PAUSE,
    REPLAY_EVENT_RESUME,
    REPLAY_EVENT_STOP,
    REPLAY_EVENT_END,
]

const DEFAULT_DURATION = 60
const MILLIS = 1000
const STORE_SYNC_INTERVAL = 250
const GLOBAL_UPDATE_EVENT_INTERVAL = 250
const VIDEO_SAFE_GLOBAL_UPDATE_EVENT_INTERVAL = GLOBAL_UPDATE_EVENT_INTERVAL

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const safeDuration = duration => {
    const numeric = Number(duration)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_DURATION
}

export class JourneyReplayPlaybackController {
    #sampler = null
    #duration = DEFAULT_DURATION
    #direction = 1
    #loop = false
    #progress = 0
    #running = false
    #paused = false
    #startedAt = 0
    #pausedAt = 0
    #pauseDuration = 0
    #frame = null
    #listeners = new Map()
    #requestFrame
    #cancelFrame
    #now
    #lastStoreSync = 0
    #lastGlobalUpdate = 0
    #storeSyncInterval = STORE_SYNC_INTERVAL
    #globalUpdateInterval = GLOBAL_UPDATE_EVENT_INTERVAL
    #dynamicFrameId = 0
    #videoTimeline = null
    #replayDefinition = null
    #renderPlan = null
    #frameResolver = null

    constructor({
                    requestFrame = callback => globalThis.__?.requestAnimationFrame?.(callback)
                        ?? globalThis.requestAnimationFrame?.(callback),
                    cancelFrame = frame => {
                        if (globalThis.__?.cancelAnimationFrame) {
                            globalThis.__.cancelAnimationFrame(frame)
                            return
                        }
                        globalThis.cancelAnimationFrame?.(frame)
                    },
                    now = () => globalThis.performance?.now?.() ?? Date.now(),
                } = {}) {
        this.#requestFrame = requestFrame
        this.#cancelFrame = cancelFrame
        this.#now = now
        REPLAY_EVENTS.forEach(event => this.#listeners.set(event, new Set()))
    }

    configure = ({
                     sampler = this.#sampler,
                     duration = this.#duration,
                     direction = this.#direction,
                     loop = this.#loop,
                     progress = this.#progress,
                     clips = undefined,
                     captureFps = undefined,
                     videoTimeline = null,
                 } = {}) => {
        this.#sampler = sampler
        this.#duration = safeDuration(duration)
        this.#direction = Number(direction) < 0 ? -1 : 1
        this.#loop = Boolean(loop)
        this.#progress = clamp(Number(progress) || 0, 0, 1)
        if (videoTimeline) {
            this.#videoTimeline = videoTimeline
        }
        else if (clips !== undefined || captureFps !== undefined || !this.#videoTimeline) {
            this.#videoTimeline = buildReplayVideoTimeline({
                replayDurationMillis: this.#duration * MILLIS,
                fps: captureFps
                      ?? globalThis.lgs?.stores?.replay?.captureFps
                      ?? 30,
                direction: this.#direction,
                clips: clips ?? null,
            })
        }
        const trackPath = this.#sampler?.logicalTrackPath ?? null
        const trackPathDescriptor = createReplayTrackPathDescriptor(trackPath)
        this.#replayDefinition = createReplayDefinition({
            journeyId: this.#sampler?.journey?.slug ?? null,
            direction: this.#direction,
            timeline: this.#videoTimeline,
            cameraDefinition: globalThis.lgs?.stores?.replay?.camera ?? null,
            renderSpec: globalThis.lgs?.stores?.replay?.deferredExportPlan?.renderSpec ?? null,
            visibleOverlayIds: globalThis.lgs?.stores?.replay?.deferredExportPlan?.runtime?.context?.visibleOverlayIds ?? [],
            trackPathDescriptor,
            qualityPolicy: globalThis.lgs?.stores?.replay?.readiness ?? null,
            source: 'draft',
        })
        this.#renderPlan = createReplayRenderPlan({
            definition: this.#replayDefinition,
            trackPath,
            trackPathDescriptor,
        })
        this.#frameResolver = new ReplayFrameResolver({
            plan: this.#renderPlan,
            resolveSample: ({progress: requestedProgress}) => this.#sampler?.atProgress?.(requestedProgress) ?? null,
        })
        this.#syncStore(this.currentSample(), {force: true})
        return this
    }

    setPublicationCadence = ({
                                  storeSyncInterval = this.#storeSyncInterval,
                                  globalUpdateInterval = this.#globalUpdateInterval,
                              } = {}) => {
        const nextStoreSyncInterval = Number(storeSyncInterval)
        const nextGlobalUpdateInterval = Number(globalUpdateInterval)
        this.#storeSyncInterval = Number.isFinite(nextStoreSyncInterval) && nextStoreSyncInterval > 0
                                  ? nextStoreSyncInterval
                                  : STORE_SYNC_INTERVAL
        this.#globalUpdateInterval = Number.isFinite(nextGlobalUpdateInterval) && nextGlobalUpdateInterval > 0
                                     ? nextGlobalUpdateInterval
                                     : GLOBAL_UPDATE_EVENT_INTERVAL
        return {
            storeSyncInterval:   this.#storeSyncInterval,
            globalUpdateInterval: this.#globalUpdateInterval,
        }
    }

    setVideoSafeMode = (enabled = true) => {
        return this.setPublicationCadence(enabled
                                          ? {
                                              storeSyncInterval:   STORE_SYNC_INTERVAL,
                                              globalUpdateInterval: VIDEO_SAFE_GLOBAL_UPDATE_EVENT_INTERVAL,
                                          }
                                          : {
                                              storeSyncInterval:   STORE_SYNC_INTERVAL,
                                              globalUpdateInterval: GLOBAL_UPDATE_EVENT_INTERVAL,
                                          })
    }

    get sampler() {
        return this.#sampler
    }

    get duration() {
        return this.#duration
    }

    get direction() {
        return this.#direction
    }

    get videoTimeline() {
        return this.#videoTimeline
    }

    /**
     * Return the current plain replay definition.
     *
     * @returns {Object|null} Replay definition.
     */
    get replayDefinition() {
        return this.#replayDefinition
    }

    /**
     * Return the current lazy replay render plan.
     *
     * @returns {Object|null} Replay render plan.
     */
    get renderPlan() {
        return this.#renderPlan
    }

    /**
     * Return the current shared frame resolver.
     *
     * @returns {ReplayFrameResolver|null} Replay frame resolver.
     */
    get frameResolver() {
        return this.#frameResolver
    }

    /**
     * Resolve one replay position without enumerating intermediate frames.
     *
     * @param {number} progress - Requested replay progress.
     * @param {Object} options - Canonical intent overrides.
     * @returns {Object|null} Canonical frame intent.
     */
    resolveFrameAtProgress = (progress, options = {}) => this.#frameResolver?.resolveAtProgressSync(
        progress,
        options,
    ) ?? null

    /**
     * Resolve a Draft frame phase from the shared absolute video timeline.
     *
     * @param {number} frameTimeMs - Absolute timeline time in milliseconds.
     * @param {Object} options - Phase resolution options.
     * @returns {Object} Resolved timeline phase.
     */
    videoFramePhaseAtTime = (frameTimeMs = 0, {isFinalSceneFrame = false} = {}) => (
        resolveReplayVideoFramePhase({
            timeline: this.#videoTimeline,
            frameTimeMs,
            isFinalSceneFrame,
        })
    )

    get loop() {
        return this.#loop
    }

    setLoop = loop => {
        this.#loop = Boolean(loop)
        this.#syncStore(this.currentSample(), {force: true})
        return this.#loop
    }

    get progress() {
        return this.#progress
    }

    get running() {
        return this.#running
    }

    get paused() {
        return this.#paused
    }

    get playing() {
        return this.#running && !this.#paused
    }

    currentSample = () => this.#sampler?.atProgress?.(this.#progress) ?? null

    on = (event, callback) => {
        if (!this.#listeners.has(event) || typeof callback !== 'function') {
            return () => {}
        }

        this.#listeners.get(event).add(callback)
        return () => this.off(event, callback)
    }

    off = (event, callback) => {
        this.#listeners.get(event)?.delete(callback)
    }

    start = ({progress = this.#direction > 0 ? 0 : 1} = {}) => {
        if (!this.#sampler?.hasSamples) {
            return null
        }

        this.#cancelCurrentFrame()
        this.#progress = clamp(Number(progress) || 0, 0, 1)
        this.#running = true
        this.#paused = false
        this.#pauseDuration = 0
        this.#pausedAt = 0
        this.#lastGlobalUpdate = 0
        this.#startedAt = this.#now() - this.#elapsedFromProgress(this.#progress)

        const sample = this.currentSample()
        this.#syncStore(sample, {force: true})
        this.#emit(REPLAY_EVENT_START, sample)
        this.#emit(REPLAY_EVENT_UPDATE, sample)
        this.#schedule()
        return sample
    }

    pause = () => {
        if (!this.#running || this.#paused) {
            return this.currentSample()
        }

        this.#paused = true
        this.#pausedAt = this.#now()
        this.#cancelCurrentFrame()
        const sample = this.currentSample()
        this.#syncStore(sample, {force: true})
        this.#emit(REPLAY_EVENT_PAUSE, sample)
        return sample
    }

    resume = () => {
        if (!this.#running) {
            return this.start({progress: this.#progress})
        }
        if (!this.#paused) {
            return this.currentSample()
        }

        this.#pauseDuration += this.#now() - this.#pausedAt
        this.#pausedAt = 0
        this.#paused = false
        const sample = this.currentSample()
        this.#syncStore(sample, {force: true})
        this.#emit(REPLAY_EVENT_RESUME, sample)
        this.#schedule()
        return sample
    }

    stop = ({emit = true, clearProgress = false} = {}) => {
        if (!this.#running && !this.#paused) {
            return this.currentSample()
        }

        this.#cancelCurrentFrame()
        this.#running = false
        this.#paused = false
        this.#pausedAt = 0
        if (clearProgress) {
            this.#progress = this.#direction > 0 ? 0 : 1
        }
        const sample = this.currentSample()
        this.#syncStore(sample, {force: true})
        if (emit) {
            this.#emit(REPLAY_EVENT_STOP, sample)
        }
        return sample
    }

    seek = (progress) => {
        this.#progress = clamp(Number(progress) || 0, 0, 1)
        if (this.#running && !this.#paused) {
            this.#startedAt = this.#now() - this.#elapsedFromProgress(this.#progress) - this.#pauseDuration
        }
        const sample = this.currentSample()
        this.#syncStore(sample, {force: true})
        this.#emit(REPLAY_EVENT_UPDATE, sample)
        return sample
    }

    #elapsedFromProgress = progress => {
        const playbackProgress = this.#direction > 0 ? progress : 1 - progress
        return clamp(playbackProgress, 0, 1) * this.#duration * MILLIS
    }

    #progressFromElapsed = elapsed => {
        const playbackProgress = clamp(elapsed / (this.#duration * MILLIS), 0, 1)
        return this.#direction > 0 ? playbackProgress : 1 - playbackProgress
    }

    #schedule = () => {
        if (!this.#running || this.#paused) {
            return
        }

        this.#frame = this.#requestFrame?.(this.#tick)
    }

    #cancelCurrentFrame = () => {
        if (this.#frame !== null && this.#frame !== undefined) {
            this.#cancelFrame?.(this.#frame)
        }
        this.#frame = null
    }

    #tick = () => {
        if (!this.#running || this.#paused) {
            this.#frame = null
            return
        }

        try {
            const elapsed = this.#now() - this.#startedAt - this.#pauseDuration
            const playbackProgress = elapsed / (this.#duration * MILLIS)
            const reachedEnd = playbackProgress >= 1

            this.#progress = this.#progressFromElapsed(elapsed)
            const sample = this.currentSample()
            this.#syncStore(sample)
            this.#emit(REPLAY_EVENT_UPDATE, sample)
            globalThis.lgs?.scene?.requestRender?.()

            if (reachedEnd) {
                if (this.#loop) {
                    this.#startedAt = this.#now()
                    this.#pauseDuration = 0
                    this.#progress = this.#direction > 0 ? 0 : 1
                    this.#schedule()
                    return
                }

                this.#running = false
                this.#paused = false
                this.#frame = null
                this.#syncStore(sample, {force: true})
                this.#emit(REPLAY_EVENT_END, sample)
                return
            }
        }
        catch (error) {
        }

        this.#schedule()
    }

    #eventDetail = sample => {
        const runtimeFrame = globalThis.lgs?.stores?.replay?.dynamicFrameState ?? null
        const logicalFrame = createJourneyReplayLogicalFrame({
            sample,
            progress:        this.#progress,
            durationMillis:  runtimeFrame?.durationMillis ?? this.#duration * MILLIS,
            frameTimeMs:     runtimeFrame?.frameTimeMs,
            frameIntervalMs: runtimeFrame?.frameIntervalMs,
            phase:           runtimeFrame?.phase,
            source:          'replay-clock',
        })

        return {
            controller:      this,
            sampler:         this.#sampler,
            sample,
            progress:        this.#progress,
            duration:        this.#duration,
            direction:       this.#direction,
            loop:            this.#loop,
            running:         this.#running,
            paused:          this.#paused,
            frameTimeMs:     logicalFrame.frameTimeMs,
            frameIntervalMs: logicalFrame.frameIntervalMs,
            logicalFrame,
        }
    }

    #emit = (event, sample) => {
        const detail = this.#eventDetail(sample)
        this.#listeners.get(event)?.forEach(callback => {
            try {
                callback(detail)
            }
            catch (error) {
            }
        })
        if (!this.#shouldEmitGlobalEvent(event)) {
            return
        }

        try {
            globalThis.lgs?.events?.emit?.(event, detail)
        }
        catch (error) {
        }
    }

    #shouldEmitGlobalEvent = event => {
        if (event !== REPLAY_EVENT_UPDATE || !this.#running || this.#paused) {
            return true
        }

        const now = this.#now()
        if (now - this.#lastGlobalUpdate < this.#globalUpdateInterval) {
            return false
        }

        this.#lastGlobalUpdate = now
        return true
    }

    #syncStore = (sample, {force = false} = {}) => {
        const store = globalThis.lgs?.stores?.replay
        if (!store) {
            return
        }

        const frameNow = this.#now()
        this.#dynamicFrameId += 1
        const playbackProgress = this.#direction < 0 ? 1 - this.#progress : this.#progress
        const replayPhase = this.#videoTimeline?.replayPhase ?? null
        const replayElapsedMillis = clamp(playbackProgress, 0, 1) * this.#duration * MILLIS
        const frameTimeMs = Math.min(
            this.#videoTimeline?.durationMillis ?? this.#duration * MILLIS,
            (replayPhase?.startMillis ?? 0) + replayElapsedMillis,
        )
        const phase = this.videoFramePhaseAtTime(frameTimeMs)
        const frameIntervalMillis = this.#videoTimeline?.frameIntervalMs ?? (MILLIS / 30)
        const replayFrameIndex = phase.replayFrameIndex
        const replayFrameCount = phase.replayFrameCount
        const frameIndex = phase.frameIndex ?? 0
        const frameCount = phase.frameCount ?? 1
        const hasClipPhases = this.#videoTimeline?.phases?.some(phaseItem => phaseItem.kind !== 'replay') === true
        const logicalElapsedMillis = hasClipPhases
                                     ? (phase.frameTimeMs ?? frameTimeMs)
                                     : (sample?.journeyElapsedMillis ?? null)
        const logicalDurationMillis = hasClipPhases
                                      ? this.#videoTimeline.durationMillis
                                      : (sample?.journeyDurationMillis ?? this.#sampler?.durationMillis ?? null)
        const deferredRenderContract = store.deferredExportPlan?.renderContract
                                      ?? store.deferredExportPlan?.runtime?.context?.renderContract
                                      ?? null
        const frameIntent = this.#frameResolver?.resolveFrameSync({
            frame: {
                index: frameIndex,
                frameCount,
                frameTimeMs: phase.frameTimeMs ?? frameTimeMs,
                frameIntervalMs: frameIntervalMillis,
                progress: this.#progress,
                isFirst: frameIndex === 0,
                isLast: frameIndex === frameCount - 1,
            },
            phase,
            sample,
            renderMode: 'draft',
            source: 'controller',
            resolved: false,
            renderSpec: deferredRenderContract?.renderSpec
                        ?? store.deferredExportPlan?.renderSpec
                        ?? undefined,
            visibleOverlayIds: deferredRenderContract?.visibleOverlayIds
                               ?? store.deferredExportPlan?.runtime?.context?.visibleOverlayIds
                               ?? undefined,
        }) ?? null
        // Shared live draft tick for replay-driven widgets.
        store.liveSample = sample
        store.dynamicStatsTick = frameNow
        store.replayFramePhase = phase
        const initialCameraState = globalThis.__?.ui?.replay?.savedCameraState
                                   ?? deferredRenderContract?.initialCameraState
                                   ?? null
        store.dynamicFrameState = buildReplayFrameState({
            active:          this.#running || this.#paused,
            playing:         this.#running && !this.#paused,
            paused:          this.#paused,
            index:           frameIndex,
            progress:        this.#progress,
            direction:       this.#direction,
            sample,
            elapsedMillis:   logicalElapsedMillis,
            durationMillis:  logicalDurationMillis,
            frameId:         this.#dynamicFrameId,
            frameCount,
            frameTimeMs:      phase.frameTimeMs ?? frameTimeMs,
            frameIntervalMs: frameIntervalMillis,
            replayFrameIndex,
            replayFrameCount,
            phase,
            source:          'controller',
            updatedAt:       frameNow,
            renderMode:      'draft',
            trackPath:       deferredRenderContract?.trackPath ?? null,
            initialCameraState,
            renderSpec:      deferredRenderContract?.renderSpec
                             ?? store.deferredExportPlan?.renderSpec
                             ?? null,
            visibleOverlayIds: deferredRenderContract?.visibleOverlayIds
                               ?? store.deferredExportPlan?.runtime?.context?.visibleOverlayIds
                               ?? [],
            frameIntent,
        })

        const now = this.#now()
        if (!force && now - this.#lastStoreSync < this.#storeSyncInterval) {
            return
        }
        this.#lastStoreSync = now

        store.active = this.#running || this.#paused
        store.playing = this.#running && !this.#paused
        store.paused = this.#paused
        store.progress = this.#progress
        store.elapsedMillis = sample?.journeyElapsedMillis ?? null
        store.durationMillis = sample?.journeyDurationMillis ?? this.#sampler?.durationMillis ?? null
        store.sample = sample
        store.duration = this.#duration
        store.direction = this.#direction
        store.loop = this.#loop
        store.totalDistance = this.#sampler?.totalDistance ?? 0
    }
}
