/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoRenderSession.js
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

import { ReplayFrameTimeline } from '@Core/ui/replay/ReplayFrameTimeline'
import {createReplayRenderModeContract} from '@Core/ui/replay/ReplayRenderModeContract'

export class ReplayVideoRenderSession {
    #controller = null
    #timeline = null
    #seek = null
    #render = null
    #beforeFrame = null
    #afterFrame = null
    #resolveSample = null
    #renderMode = 'hq'
    #renderSpec = null
    #initialCameraState = null
    #visibleOverlayIds = []
    #trackPath = null

    constructor({
                    controller = null,
                    timeline = null,
                    seek = null,
                    render = null,
                    beforeFrame = null,
                    afterFrame = null,
                    resolveSample = null,
                    renderMode = 'hq',
                    renderSpec = null,
                    initialCameraState = null,
                    visibleOverlayIds = [],
                    trackPath = null,
                } = {}) {
        this.#controller = controller
        this.#timeline = timeline instanceof ReplayFrameTimeline
                         ? timeline
                         : new ReplayFrameTimeline(timeline ?? {})
        this.#seek = typeof seek === 'function'
                     ? seek
                     : (progress => this.#controller?.seek?.(progress))
        this.#render = typeof render === 'function' ? render : async () => undefined
        this.#beforeFrame = typeof beforeFrame === 'function' ? beforeFrame : async () => undefined
        this.#afterFrame = typeof afterFrame === 'function' ? afterFrame : async () => undefined
        this.#resolveSample = typeof resolveSample === 'function'
                              ? resolveSample
                              : (frame => this.#controller?.sampler?.atProgress?.(frame.progress)
                                  ?? this.#controller?.currentSample?.()
                                  ?? null)
        this.#renderMode = renderMode
        this.#renderSpec = renderSpec
        this.#initialCameraState = initialCameraState
        this.#visibleOverlayIds = visibleOverlayIds
        this.#trackPath = trackPath
    }

    get timeline() {
        return this.#timeline
    }

    get controller() {
        return this.#controller
    }

    /**
     * Render a single frame.
     *
     * The session resolves the frame, seeks the replay, refreshes the sample,
     * then executes the caller-provided render hook.
     *
     * @param {number} frameIndex
     * @param {Object} options
     * @returns {Promise<object>}
     */
    renderFrame = async (frameIndex = 0, options = {}) => {
        const frame = this.#timeline.frameAtIndex(frameIndex)
        await this.#seek?.(frame.progress, frame, options)
        const nextSample = await this.#resolveSample(frame)
        const logicalFrame = {
            sample:          nextSample,
            progress:        frame.progress,
            elapsedMillis:   frame.frameTimeMs,
            durationMillis:  frame.durationMillis,
            frameTimeMs:     frame.frameTimeMs,
            frameIntervalMs: frame.frameIntervalMs,
            phase:           options.phase ?? null,
            source:          this.#renderMode,
        }
        const renderContract = createReplayRenderModeContract({
            renderMode: this.#renderMode,
            logicalFrame,
            cameraPose: options.cameraPose ?? null,
            trackPath: this.#trackPath,
            initialCameraState: this.#initialCameraState,
            renderSpec: this.#renderSpec,
            visibleOverlayIds: this.#visibleOverlayIds,
        })

        await this.#beforeFrame({
            frame,
            sample: nextSample,
            logicalFrame,
            renderContract,
            options,
        })

        const renderResult = await this.#render({
            frame,
            sample: nextSample,
            logicalFrame,
            renderContract,
            options,
        })

        await this.#afterFrame({
            frame,
            sample: nextSample,
            options,
            renderResult,
        })

        return {
            ...frame,
            sample: nextSample,
            logicalFrame,
            renderContract,
            renderResult,
        }
    }

    /**
     * Render the full timeline sequentially.
     *
     * This keeps the export deterministic and gives the caller a hook for each
     * rendered frame.
     *
     * @param {{signal?: AbortSignal|null, onFrame?: Function|null}} options
     * @returns {Promise<Array<object>>}
     */
    renderAll = async ({signal = null, onFrame = null} = {}) => {
        const frames = []
        for (let index = 0; index < this.#timeline.frameCount; index += 1) {
            if (signal?.aborted) {
                break
            }

            const rendered = await this.renderFrame(index, {signal})
            frames.push(rendered)
            if (typeof onFrame === 'function') {
                await onFrame(rendered)
            }
        }

        return frames
    }
}
