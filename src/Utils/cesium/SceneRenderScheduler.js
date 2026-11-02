/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneRenderScheduler.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-02
 * Last modified: 2026-11-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Initial grace period used to consolidate related scene mutations. */
export const SCENE_RENDER_CONSOLIDATION_WINDOW_MS = 200

const schedulersByScene = new WeakMap()

/** Read a monotonic timestamp for scheduler deadlines. */
const readMonotonicTime = () => globalThis.performance.now()

/** Check whether a Cesium scene is already destroyed. */
const isSceneDestroyed = scene => {
    if (typeof scene?.isDestroyed !== 'function') {
        return false
    }

    try {
        return scene.isDestroyed()
    }
    catch {
        return true
    }
}

/** Schedule coalesced render requests for one Cesium scene. */
class SceneRenderScheduler {
    #scene
    #windowDurationMs
    #now
    #scheduleTimeout
    #cancelTimeout
    #windowDeadline = 0
    #windowTimer = null
    #timerGeneration = 0
    #continuousDemands = new Set()
    #postUpdateListener = null
    #removePostUpdateListener = null
    #destroyed = false

    /**
     * Create a scheduler bound to one Cesium scene.
     * @param {Scene} scene - Scene whose render requests are consolidated.
     * @param {object} [options] - Scheduler configuration and test dependencies.
     * @param {number} [options.windowDurationMs=200] - Consolidation window length.
     * @param {() => number} [options.now] - Monotonic clock used for deadlines.
     * @param {(callback: Function, delayMs: number) => unknown} [options.setTimeout]
     * @param {(timer: unknown) => void} [options.clearTimeout]
     */
    constructor(scene, {
        windowDurationMs = SCENE_RENDER_CONSOLIDATION_WINDOW_MS,
        now = readMonotonicTime,
        setTimeout: scheduleTimeout = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
        clearTimeout: cancelTimeout = timer => globalThis.clearTimeout(timer),
    } = {}) {
        if (!scene || typeof scene !== 'object') {
            throw new TypeError('SceneRenderScheduler requires a Cesium scene.')
        }

        this.#scene = scene
        this.#windowDurationMs = Number.isFinite(windowDurationMs) && windowDurationMs > 0
            ? windowDurationMs
            : SCENE_RENDER_CONSOLIDATION_WINDOW_MS
        this.#now = now
        this.#scheduleTimeout = scheduleTimeout
        this.#cancelTimeout = cancelTimeout
    }

    /** Get the scene owned by this scheduler. */
    get scene() {
        return this.#scene
    }

    /** Return whether this scheduler has been destroyed. */
    get destroyed() {
        return this.#destroyed
    }

    /** Request an immediate render and extend the shared stabilization window. */
    invalidate = () => {
        if (this.#destroyed || isSceneDestroyed(this.#scene)) {
            return false
        }

        this.#scene.requestRender?.()
        this.#windowDeadline = this.#now() + this.#windowDurationMs
        this.#scheduleWindowExpiry()
        this.#syncPostUpdateListener()
        return true
    }

    /** Acquire an independent continuous-render demand and return its idempotent release. */
    acquireContinuous = () => {
        if (this.#destroyed || isSceneDestroyed(this.#scene)) {
            return () => {}
        }

        const demand = {}
        this.#continuousDemands.add(demand)
        this.#scene.requestRender?.()
        this.#syncPostUpdateListener()

        let released = false
        return () => {
            if (released) {
                return
            }
            released = true
            if (this.#destroyed) {
                return
            }

            this.#continuousDemands.delete(demand)
            this.#syncPostUpdateListener()
        }
    }

    /** Remove listeners and timers and invalidate all outstanding release functions. */
    destroy = () => {
        if (this.#destroyed) {
            return
        }

        this.#destroyed = true
        this.#clearWindowTimer()
        this.#windowDeadline = 0
        this.#continuousDemands.clear()
        this.#detachPostUpdateListener()
        if (schedulersByScene.get(this.#scene) === this) {
            schedulersByScene.delete(this.#scene)
        }
    }

    /** Schedule expiry independently of Cesium updates so idle scenes are cleaned up. */
    #scheduleWindowExpiry = () => {
        this.#clearWindowTimer()
        const generation = this.#timerGeneration
        const remainingMs = Math.max(0, this.#windowDeadline - this.#now())
        this.#windowTimer = this.#scheduleTimeout(() => {
            if (this.#destroyed || generation !== this.#timerGeneration) {
                return
            }

            this.#windowTimer = null
            const remainingWindowMs = this.#windowDeadline - this.#now()
            if (remainingWindowMs > 0) {
                this.#scheduleWindowExpiry()
                return
            }

            this.#windowDeadline = 0
            this.#syncPostUpdateListener()
        }, remainingMs)
    }

    /** Cancel the current expiry callback and make any queued callback stale. */
    #clearWindowTimer = () => {
        this.#timerGeneration += 1
        if (this.#windowTimer !== null) {
            this.#cancelTimeout(this.#windowTimer)
            this.#windowTimer = null
        }
    }

    /** Attach or detach the one shared postUpdate callback as demand changes. */
    #syncPostUpdateListener = () => {
        if (this.#destroyed) {
            this.#detachPostUpdateListener()
            return
        }
        if (isSceneDestroyed(this.#scene)) {
            this.destroy()
            return
        }

        const windowActive = this.#now() < this.#windowDeadline
        const hasDemand = windowActive || this.#continuousDemands.size > 0
        if (!hasDemand) {
            this.#detachPostUpdateListener()
            return
        }
        if (this.#postUpdateListener) {
            return
        }

        const postUpdate = this.#scene.postUpdate
        if (typeof postUpdate?.addEventListener !== 'function') {
            return
        }

        this.#postUpdateListener = () => {
            if (this.#destroyed) {
                this.#detachPostUpdateListener()
                return
            }
            if (isSceneDestroyed(this.#scene)) {
                this.destroy()
                return
            }

            if (this.#now() >= this.#windowDeadline && this.#continuousDemands.size === 0) {
                this.#windowDeadline = 0
                this.#clearWindowTimer()
                this.#syncPostUpdateListener()
                return
            }

            // Replay and other explicit continuous modes already own their frame cadence.
            if (this.#scene.requestRenderMode === true) {
                this.#scene.requestRender?.()
            }
        }

        const removeListener = postUpdate.addEventListener(this.#postUpdateListener)
        this.#removePostUpdateListener = typeof removeListener === 'function'
            ? removeListener
            : () => postUpdate.removeEventListener?.(this.#postUpdateListener)
    }

    /** Detach the shared scene callback, if it is currently installed. */
    #detachPostUpdateListener = () => {
        if (!this.#postUpdateListener) {
            return
        }

        this.#removePostUpdateListener?.()
        this.#postUpdateListener = null
        this.#removePostUpdateListener = null
    }
}

/** Return the existing scheduler for a scene, creating its single instance when needed. */
export const getOrCreateSceneRenderScheduler = (scene, options) => {
    if (!scene || typeof scene !== 'object' || isSceneDestroyed(scene)) {
        return null
    }

    const existing = schedulersByScene.get(scene)
    if (existing && !existing.destroyed) {
        return existing
    }

    const scheduler = new SceneRenderScheduler(scene, options)
    schedulersByScene.set(scene, scheduler)
    return scheduler
}

/** Return the lifecycle-owned scheduler for a scene without creating one. */
export const getSceneRenderScheduler = scene => {
    const scheduler = scene && schedulersByScene.get(scene)
    return scheduler && !scheduler.destroyed ? scheduler : null
}

/** Request a scene render through its lifecycle-owned scheduler when available. */
export const requestSceneRender = scene => {
    if (!scene || isSceneDestroyed(scene)) {
        return false
    }

    const scheduler = getSceneRenderScheduler(scene)
    if (scheduler) {
        return scheduler.invalidate()
    }

    scene.requestRender?.()
    return true
}
