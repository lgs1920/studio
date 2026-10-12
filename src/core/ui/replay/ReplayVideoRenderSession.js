/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoRenderSession.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified: 2026-10-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ReplayFrameTimeline } from '@Core/ui/replay/ReplayFrameTimeline'
import {
    ReplayFrameResolver,
    replayFrameIntentToLogicalFrame,
} from '@Core/ui/replay/ReplayFrameResolver'
import {createReplayDefinition} from '@Core/ui/replay/ReplayDefinition'
import {createReplayRenderPlan} from '@Core/ui/replay/ReplayRenderPlan'
import {createReplayTrackPathDescriptor} from '@Core/ui/replay/ReplayTrackPathDescriptor'

export class ReplayVideoRenderSession {
    #controller = null
    #timeline = null
    #seek = null
    #render = null
    #beforeFrame = null
    #afterFrame = null
    #resolveSample = null
    #renderMode = 'export'
    #definition = null
    #renderPlan = null
    #frameResolver = null
    #preparedFrameSampleResolver = null

    constructor({
                    controller = null,
                    timeline = null,
                    seek = null,
                    render = null,
                    beforeFrame = null,
                    afterFrame = null,
                    resolveSample = null,
                    renderMode = 'export',
                    renderSpec = null,
                    initialCameraState = null,
                    visibleOverlayIds = [],
                    trackPath = null,
                    definition = null,
                    renderPlan = null,
                    frameResolver = null,
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
        const timelineDescriptor = {
            durationMillis: this.#timeline.durationMillis,
            fps: this.#timeline.fps,
            direction: this.#timeline.direction,
            frameIntervalMs: this.#timeline.frameIntervalMs,
            frameCount: this.#timeline.frameCount,
            phases: [],
            replayPhase: null,
        }
        const trackPathDescriptor = createReplayTrackPathDescriptor(trackPath)
        this.#definition = definition ?? createReplayDefinition({
            direction: this.#timeline.direction,
            timeline: timelineDescriptor,
            initialCameraState,
            renderSpec,
            visibleOverlayIds,
            trackPathDescriptor,
            source: renderMode,
        })
        this.#renderPlan = renderPlan ?? createReplayRenderPlan({
            definition: this.#definition,
            trackPath,
            trackPathDescriptor,
        })
        this.#frameResolver = frameResolver instanceof ReplayFrameResolver
                              ? frameResolver
                              : new ReplayFrameResolver({
                                  plan: this.#renderPlan,
                                  resolveSample: ({frame}) => this.#resolveSample(frame),
                              })
    }

    get timeline() {
        return this.#timeline
    }

    get controller() {
        return this.#controller
    }

    /**
     * Return the lazy render plan used by this session.
     *
     * @returns {Object} Replay render plan.
     */
    get renderPlan() {
        return this.#renderPlan
    }

    /**
     * Return the shared on-demand frame resolver.
     *
     * @returns {ReplayFrameResolver} Replay frame resolver.
     */
    get frameResolver() {
        return this.#frameResolver
    }

    /**
     * Attach a resolver for route samples prepared progressively in a worker.
     *
     * @param {Function|null} resolver - Resolves a route sample for one frame.
     * @returns {void}
     */
    setPreparedFrameSampleResolver = resolver => {
        this.#preparedFrameSampleResolver = typeof resolver === 'function' ? resolver : null
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
        const frameOptions = Object.assign({}, options)
        if (this.#preparedFrameSampleResolver) {
            frameOptions.sample = await this.#preparedFrameSampleResolver(frameIndex, frame)
        }
        await this.#seek?.(frame.progress, frame, frameOptions)
        const intent = await this.#frameResolver.resolveFrame({
            frame,
            phase: options.phase,
            signal: options.signal,
            renderMode: this.#renderMode,
            source: this.#renderMode,
            cameraPose: options.cameraPose,
            cameraFrame: options.cameraFrame,
            sample: frameOptions.sample,
            resolved: options.intentResolved,
        })
        const nextSample = intent.replay?.sample ?? null
        const logicalFrame = replayFrameIntentToLogicalFrame(intent)
        const renderContract = this.#frameResolver.renderContractForIntent(intent)

        await this.#beforeFrame({
            frame,
            sample: nextSample,
            intent,
            logicalFrame,
            renderContract,
            options,
        })

        const renderResult = await this.#render({
            frame,
            sample: nextSample,
            intent,
            logicalFrame,
            renderContract,
            options,
        })

        await this.#afterFrame({
            frame,
            sample: nextSample,
            intent,
            options,
            renderResult,
        })

        return {
            ...frame,
            sample: nextSample,
            intent,
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
     * @param {{signal?: AbortSignal|null, onFrame?: Function|null, shouldStop?: Function|null}} options
     * @returns {Promise<Array<object>>}
     */
    renderAll = async ({signal = null, onFrame = null, shouldStop = null} = {}) => {
        const frames = []
        await this.renderEach({
            signal,
            shouldStop,
            onFrame: async rendered => {
                frames.push(rendered)
                if (typeof onFrame === 'function') {
                    await onFrame(rendered)
                }
            },
        })

        return frames
    }

    /**
     * Render every frame sequentially without retaining completed frames.
     *
     * @param {{signal?: AbortSignal|null, onFrame?: Function|null, shouldStop?: Function|null, yieldBetweenFrames?: boolean, yieldIntervalMs?: number, yieldToBrowser?: Function|null}} options
     * @returns {Promise<number>} Number of rendered frames.
     */
    renderEach = async ({
                           signal = null,
                           onFrame = null,
                           shouldStop = null,
                           yieldBetweenFrames = false,
                           yieldIntervalMs = 0,
                           yieldToBrowser = null,
                       } = {}) => {
        let renderedCount = 0
        let lastYieldAt = globalThis.performance?.now?.() ?? Date.now()
        const safeYieldIntervalMs = Math.max(0, Number(yieldIntervalMs) || 0)
        for (let index = 0; index < this.#timeline.frameCount; index += 1) {
            if (signal?.aborted) {
                break
            }

            const rendered = await this.renderFrame(index, {signal})
            renderedCount += 1
            if (typeof onFrame === 'function') {
                await onFrame(rendered)
            }
            if (renderedCount > 0 && typeof shouldStop === 'function' && shouldStop(rendered, renderedCount)) {
                break
            }
            const now = globalThis.performance?.now?.() ?? Date.now()
            const yieldIntervalElapsed = safeYieldIntervalMs <= 0 || now - lastYieldAt >= safeYieldIntervalMs
            if (yieldBetweenFrames
                && renderedCount < this.#timeline.frameCount
                && !signal?.aborted
                && yieldIntervalElapsed) {
                if (typeof yieldToBrowser === 'function') {
                    await yieldToBrowser()
                }
                else {
                    await new Promise(resolve => globalThis.setTimeout(resolve, 0))
                }
                lastYieldAt = globalThis.performance?.now?.() ?? Date.now()
            }
        }

        return renderedCount
    }
}
