/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderPlaybackController.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const WANDER_EVENT_START = 'wander/start'
export const WANDER_EVENT_UPDATE = 'wander/update'
export const WANDER_EVENT_PAUSE = 'wander/pause'
export const WANDER_EVENT_RESUME = 'wander/resume'
export const WANDER_EVENT_STOP = 'wander/stop'
export const WANDER_EVENT_END = 'wander/end'
export const WANDER_EVENTS = [
    WANDER_EVENT_START,
    WANDER_EVENT_UPDATE,
    WANDER_EVENT_PAUSE,
    WANDER_EVENT_RESUME,
    WANDER_EVENT_STOP,
    WANDER_EVENT_END,
]

const DEFAULT_DURATION = 60
const MILLIS = 1000

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const safeDuration = duration => {
    const numeric = Number(duration)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_DURATION
}

export class WanderPlaybackController {
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
        WANDER_EVENTS.forEach(event => this.#listeners.set(event, new Set()))
    }

    configure = ({
                     sampler = this.#sampler,
                     duration = this.#duration,
                     direction = this.#direction,
                     loop = this.#loop,
                     progress = this.#progress,
                 } = {}) => {
        this.#sampler = sampler
        this.#duration = safeDuration(duration)
        this.#direction = Number(direction) < 0 ? -1 : 1
        this.#loop = Boolean(loop)
        this.#progress = clamp(Number(progress) || 0, 0, 1)
        this.#syncStore(this.currentSample())
        return this
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

    get loop() {
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
        this.#startedAt = this.#now() - this.#elapsedFromProgress(this.#progress)

        const sample = this.currentSample()
        this.#syncStore(sample)
        this.#emit(WANDER_EVENT_START, sample)
        this.#emit(WANDER_EVENT_UPDATE, sample)
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
        this.#syncStore(sample)
        this.#emit(WANDER_EVENT_PAUSE, sample)
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
        this.#syncStore(sample)
        this.#emit(WANDER_EVENT_RESUME, sample)
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
        this.#syncStore(sample)
        if (emit) {
            this.#emit(WANDER_EVENT_STOP, sample)
        }
        return sample
    }

    seek = (progress) => {
        this.#progress = clamp(Number(progress) || 0, 0, 1)
        if (this.#running && !this.#paused) {
            this.#startedAt = this.#now() - this.#elapsedFromProgress(this.#progress) - this.#pauseDuration
        }
        const sample = this.currentSample()
        this.#syncStore(sample)
        this.#emit(WANDER_EVENT_UPDATE, sample)
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
            this.#emit(WANDER_EVENT_UPDATE, sample)
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
                this.#emit(WANDER_EVENT_END, this.currentSample())
                this.#syncStore(this.currentSample())
                return
            }
        }
        catch (error) {
            console.error('[WanderPlaybackController] Tick failed.', error)
        }

        this.#schedule()
    }

    #eventDetail = sample => ({
        controller: this,
        sampler:    this.#sampler,
        sample,
        progress:   this.#progress,
        duration:   this.#duration,
        direction:  this.#direction,
        loop:       this.#loop,
        running:    this.#running,
        paused:     this.#paused,
    })

    #emit = (event, sample) => {
        const detail = this.#eventDetail(sample)
        this.#listeners.get(event)?.forEach(callback => {
            try {
                callback(detail)
            }
            catch (error) {
                console.error(`[WanderPlaybackController] Listener failed for "${event}".`, error)
            }
        })
        try {
            globalThis.lgs?.events?.emit?.(event, detail)
        }
        catch (error) {
            console.error(`[WanderPlaybackController] Global event failed for "${event}".`, error)
        }
    }

    #syncStore = (sample) => {
        const store = globalThis.lgs?.stores?.ui?.mainUI?.wander
        if (!store) {
            return
        }

        store.active = this.#running || this.#paused
        store.playing = this.#running && !this.#paused
        store.paused = this.#paused
        store.progress = this.#progress
        store.sample = sample
        store.duration = this.#duration
        store.direction = this.#direction
        store.loop = this.#loop
        store.totalDistance = this.#sampler?.totalDistance ?? 0
    }
}
