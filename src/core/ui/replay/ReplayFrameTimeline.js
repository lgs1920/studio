/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayFrameTimeline.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified on: 2026-07-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const finiteNumber = (value, fallback = null) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const safeFps = (fps = 30) => {
    const numeric = finiteNumber(fps, 30)
    return numeric !== null && numeric > 0 ? numeric : 30
}

export class ReplayFrameTimeline {
    #durationMillis = 0
    #fps = 30
    #direction = 1
    #includeFinalFrame = true

    constructor({
                    durationMillis = 0,
                    fps = 30,
                    direction = 1,
                    includeFinalFrame = true,
                } = {}) {
        this.#durationMillis = Math.max(0, finiteNumber(durationMillis, 0))
        this.#fps = safeFps(fps)
        this.#direction = Number(direction) < 0 ? -1 : 1
        this.#includeFinalFrame = includeFinalFrame !== false
    }

    get durationMillis() {
        return this.#durationMillis
    }

    get fps() {
        return this.#fps
    }

    get direction() {
        return this.#direction
    }

    get frameIntervalMs() {
        return 1000 / this.#fps
    }

    get frameCount() {
        if (this.#durationMillis <= 0) {
            return 1
        }

        const baseFrames = Math.ceil(this.#durationMillis / this.frameIntervalMs)
        return this.#includeFinalFrame ? (baseFrames + 1) : Math.max(1, baseFrames)
    }

    /**
     * Convert a frame index into a timestamp on the replay timeline.
     * The returned time is clamped to the timeline duration.
     *
     * @param {number} index
     * @returns {number}
     */
    frameTimeMs = (index = 0) => {
        const safeIndex = clamp(Math.trunc(Number(index) || 0), 0, Math.max(0, this.frameCount - 1))
        const timeMs = safeIndex * this.frameIntervalMs
        if (this.#durationMillis <= 0) {
            return 0
        }
        return Math.min(this.#durationMillis, timeMs)
    }

    /**
     * Convert a frame index into a replay progress value.
     * Reverse playback is handled by mirroring the progress.
     *
     * @param {number} index
     * @returns {number}
     */
    progressForIndex = (index = 0) => {
        if (this.#durationMillis <= 0) {
            return this.#direction < 0 ? 1 : 0
        }

        const timeMs = this.frameTimeMs(index)
        const rawProgress = clamp(timeMs / this.#durationMillis, 0, 1)
        return this.#direction < 0 ? 1 - rawProgress : rawProgress
    }

    /**
     * Return the canonical frame payload for a given index.
     *
     * @param {number} index
     * @returns {{
     *   index: number,
     *   frameCount: number,
     *   frameIntervalMs: number,
     *   frameTimeMs: number,
     *   progress: number,
     *   durationMillis: number,
     *   direction: number,
     *   isFirst: boolean,
     *   isLast: boolean,
     * }}
     */
    frameAtIndex = (index = 0) => {
        const safeIndex = clamp(Math.trunc(Number(index) || 0), 0, Math.max(0, this.frameCount - 1))
        return {
            index:            safeIndex,
            frameCount:       this.frameCount,
            frameIntervalMs:  this.frameIntervalMs,
            frameTimeMs:      this.frameTimeMs(safeIndex),
            progress:         this.progressForIndex(safeIndex),
            durationMillis:   this.#durationMillis,
            direction:        this.#direction,
            isFirst:          safeIndex === 0,
            isLast:           safeIndex === (this.frameCount - 1),
        }
    }

    /**
     * Resolve the nearest frame for a timestamp in milliseconds.
     *
     * @param {number} timeMs
     * @returns {ReturnType<ReplayFrameTimeline['frameAtIndex']>}
     */
    frameAtTimeMs = (timeMs = 0) => {
        if (this.#durationMillis <= 0) {
            return this.frameAtIndex(0)
        }

        const safeTimeMs = clamp(finiteNumber(timeMs, 0), 0, this.#durationMillis)
        const index = Math.round(safeTimeMs / this.frameIntervalMs)
        return this.frameAtIndex(index)
    }

    /**
     * Resolve the nearest frame for a replay progress value.
     *
     * @param {number} progress
     * @returns {ReturnType<ReplayFrameTimeline['frameAtIndex']>}
     */
    frameAtProgress = (progress = 0) => {
        const safeProgress = clamp(finiteNumber(progress, 0), 0, 1)
        const targetProgress = this.#direction < 0 ? 1 - safeProgress : safeProgress
        const timeMs = targetProgress * this.#durationMillis
        return this.frameAtTimeMs(timeMs)
    }

    /**
     * Iterate over the full deterministic frame sequence.
     */
    *frames() {
        for (let index = 0; index < this.frameCount; index += 1) {
            yield this.frameAtIndex(index)
        }
    }
}
