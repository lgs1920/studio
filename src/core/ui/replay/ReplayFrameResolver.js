/**
 * On-demand resolver shared by Draft, HQ, and interactive scrubbing.
 */

import {createReplayFrameIntent} from './ReplayFrameIntent'
import {createReplayCameraCommand} from './ReplayCameraCommand'
import {ReplayFrameTimeline} from './ReplayFrameTimeline'
import {isReplayRenderPlan} from './ReplayRenderPlan'
import {createReplayRenderModeContract, REPLAY_RENDER_MODE_DRAFT} from './ReplayRenderModeContract'
import {resolveReplayVideoFramePhase} from './ReplayVideoTimeline'

/**
 * Return a null frame contribution.
 *
 * @returns {null} Empty resolver contribution.
 */
const resolveEmptyFrameContribution = () => null

/**
 * Throw a standard cancellation error when frame resolution was aborted.
 *
 * @param {AbortSignal|null} signal - Optional cancellation signal.
 * @returns {void}
 */
const throwIfReplayResolutionAborted = signal => {
    if (signal?.aborted) {
        throw new DOMException('Replay frame resolution was aborted', 'AbortError')
    }
}

/**
 * Convert one canonical intent back to the legacy logical-frame projection.
 *
 * @param {Object|null} intent - Canonical frame intent.
 * @returns {Object|null} Legacy logical frame projection.
 */
export const replayFrameIntentToLogicalFrame = intent => intent ? {
    sample: intent.replay?.sample ?? null,
    progress: intent.replay?.progress ?? 0,
    elapsedMillis: intent.timeline?.elapsedMillis ?? intent.frame?.timeMs ?? 0,
    durationMillis: intent.timeline?.durationMillis ?? null,
    frameTimeMs: intent.frame?.timeMs ?? 0,
    frameIntervalMs: intent.frame?.intervalMillis ?? null,
    cameraPose: intent.scene?.cameraPose ?? null,
    cameraCommand: intent.scene?.cameraCommand ?? null,
    cameraFrame: intent.scene?.cameraFrame ?? null,
    phase: intent.timeline?.phase ?? null,
    source: intent.source ?? 'replay',
} : null

/**
 * Resolve canonical frame intents lazily without enumerating a route timeline.
 */
export class ReplayFrameResolver {
    #plan = null
    #frameTimeline = null
    #resolveSample = resolveEmptyFrameContribution
    #resolveCameraPose = resolveEmptyFrameContribution
    #resolveCameraFrame = resolveEmptyFrameContribution
    #resolveMarkerState = resolveEmptyFrameContribution
    #resolveTraceState = resolveEmptyFrameContribution
    #resolvePoiStates = resolveEmptyFrameContribution
    #resolveWidgetStates = resolveEmptyFrameContribution
    #resolveMediaStates = resolveEmptyFrameContribution
    #resolutionCount = 0

    /**
     * Create an on-demand resolver for one immutable render plan.
     *
     * @param {Object} options - Plan and evaluator adapters.
     */
    constructor({
                    plan,
                    resolveSample = resolveEmptyFrameContribution,
                    resolveCameraPose = resolveEmptyFrameContribution,
                    resolveCameraFrame = resolveEmptyFrameContribution,
                    resolveMarkerState = resolveEmptyFrameContribution,
                    resolveTraceState = resolveEmptyFrameContribution,
                    resolvePoiStates = resolveEmptyFrameContribution,
                    resolveWidgetStates = resolveEmptyFrameContribution,
                    resolveMediaStates = resolveEmptyFrameContribution,
                } = {}) {
        if (!isReplayRenderPlan(plan)) {
            throw new TypeError('Replay frame resolver requires a replay render plan')
        }

        this.#plan = plan
        this.#frameTimeline = new ReplayFrameTimeline(plan.frameClock)
        this.#resolveSample = typeof resolveSample === 'function' ? resolveSample : resolveEmptyFrameContribution
        this.#resolveCameraPose = typeof resolveCameraPose === 'function' ? resolveCameraPose : resolveEmptyFrameContribution
        this.#resolveCameraFrame = typeof resolveCameraFrame === 'function' ? resolveCameraFrame : resolveEmptyFrameContribution
        this.#resolveMarkerState = typeof resolveMarkerState === 'function' ? resolveMarkerState : resolveEmptyFrameContribution
        this.#resolveTraceState = typeof resolveTraceState === 'function' ? resolveTraceState : resolveEmptyFrameContribution
        this.#resolvePoiStates = typeof resolvePoiStates === 'function' ? resolvePoiStates : resolveEmptyFrameContribution
        this.#resolveWidgetStates = typeof resolveWidgetStates === 'function' ? resolveWidgetStates : resolveEmptyFrameContribution
        this.#resolveMediaStates = typeof resolveMediaStates === 'function' ? resolveMediaStates : resolveEmptyFrameContribution
    }

    /**
     * Return the immutable plan used by this resolver.
     *
     * @returns {Object} Replay render plan.
     */
    get plan() {
        return this.#plan
    }

    /**
     * Return the number of individual frame requests resolved so far.
     *
     * @returns {number} Resolution count.
     */
    get resolutionCount() {
        return this.#resolutionCount
    }

    /**
     * Resolve an absolute time from replay progress inside the replay phase.
     *
     * @param {number} progress - Journey replay progress.
     * @returns {number} Absolute timeline time in milliseconds.
     */
    timeAtProgress = progress => {
        const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0))
        const replayPhase = this.#plan.timeline?.replayPhase
        if (!replayPhase) {
            return safeProgress * this.#frameTimeline.durationMillis
        }

        const localProgress = Number(this.#plan.timeline?.direction) < 0
                              ? 1 - safeProgress
                              : safeProgress
        return replayPhase.startMillis + (localProgress * replayPhase.durationMillis)
    }

    /**
     * Build the shared base context for one requested frame.
     *
     * @param {Object} options - Frame resolution options.
     * @returns {Object} Base frame context.
     */
    #baseContext = ({frame = null, timeMs = null, phase = null, signal = null} = {}) => {
        throwIfReplayResolutionAborted(signal)
        const resolvedFrame = frame
                              ?? this.#frameTimeline.frameAtTimeMs(timeMs ?? 0)
        const resolvedPhase = phase ?? resolveReplayVideoFramePhase({
            timeline: this.#plan.timeline,
            frame: resolvedFrame,
            frameTimeMs: timeMs,
            isFinalSceneFrame: resolvedFrame?.isLast === true,
        })

        return {
            plan: this.#plan,
            frame: resolvedFrame,
            phase: resolvedPhase,
            progress: resolvedPhase?.progress ?? resolvedFrame?.progress ?? 0,
            timeMs: resolvedPhase?.frameTimeMs ?? resolvedFrame?.frameTimeMs ?? 0,
            signal,
        }
    }

    /**
     * Reject asynchronous contributions from the synchronous Draft resolver.
     *
     * @param {*} value - Resolver contribution.
     * @param {string} name - Contribution name.
     * @returns {*} Synchronous contribution.
     */
    #synchronousContribution = (value, name) => {
        if (value && typeof value.then === 'function') {
            throw new TypeError(`${name} returned a Promise during synchronous replay resolution`)
        }
        return value
    }

    /**
     * Build a canonical intent from evaluated frame contributions.
     *
     * @param {Object} context - Base frame context.
     * @param {Object} values - Evaluated frame values and caller options.
     * @returns {Object} Canonical replay frame intent.
     */
    #buildIntent = (context, values) => {
        const definition = this.#plan.definition
        const frame = context.frame
        const phase = context.phase
        const cameraPose = values.cameraPose ?? null
        const cameraCommand = values.cameraCommand !== undefined
                              ? values.cameraCommand
                              : createReplayCameraCommand({
                                  pose: cameraPose,
                                  source: values.source ?? definition.source ?? 'replay',
                              })
        const cameraFrame = values.cameraFrame ?? null
        this.#resolutionCount += 1

        return createReplayFrameIntent({
            planId: this.#plan.id,
            // A logical camera pose is still only an intent. Scene adapters
            // explicitly mark the frame resolved after applying and qualifying it.
            resolved: values.resolved ?? false,
            renderMode: values.renderMode ?? REPLAY_RENDER_MODE_DRAFT,
            source: values.source ?? definition.source ?? 'replay',
            frameId: values.frameId ?? frame?.index ?? null,
            frameIndex: frame?.index ?? phase?.frameIndex ?? null,
            frameCount: frame?.frameCount ?? this.#plan.frameClock.frameCount,
            replayFrameIndex: phase?.replayFrameIndex ?? null,
            replayFrameCount: phase?.replayFrameCount ?? null,
            timeMs: context.timeMs,
            elapsedMillis: context.timeMs,
            durationMillis: this.#plan.timeline?.durationMillis ?? this.#plan.frameClock.durationMillis,
            frameIntervalMs: frame?.frameIntervalMs ?? this.#plan.frameClock.frameIntervalMs,
            phase,
            progress: context.progress,
            direction: this.#plan.timeline?.direction ?? definition.direction,
            sample: values.sample,
            cameraPose,
            cameraCommand,
            cameraFrame,
            trackPath: this.#plan.trackPath,
            markerState: values.markerState,
            traceState: values.traceState,
            poiStates: values.poiStates,
            widgetStates: values.widgetStates,
            mediaStates: values.mediaStates,
            renderSpec: values.renderSpec !== undefined ? values.renderSpec : definition.renderSpec,
            visibleOverlayIds: values.visibleOverlayIds !== undefined
                               ? values.visibleOverlayIds
                               : definition.visibleOverlayIds,
            outputProfile: values.outputProfile !== undefined ? values.outputProfile : definition.outputProfile,
            qualityRequirements: values.qualityRequirements !== undefined
                                 ? values.qualityRequirements
                                 : definition.qualityPolicy,
        })
    }

    /**
     * Resolve one frame synchronously for Draft playback and immediate scrubbing.
     *
     * @param {Object} options - Frame and override options.
     * @returns {Object} Canonical replay frame intent.
     */
    resolveFrameSync = (options = {}) => {
        const context = this.#baseContext(options)
        const baseContributionContext = Object.assign({}, context, {settled: options.settled === true})

        /**
         * Resolve one synchronous contribution or preserve its caller override.
         *
         * @param {Function} callback - Contribution resolver.
         * @param {string} name - Contribution name used in diagnostics.
         * @param {*} override - Explicit caller override.
         * @returns {*} Resolved synchronous contribution.
         */
        const resolve = (callback, name, override) => override !== undefined
            ? override
            : this.#synchronousContribution(callback(baseContributionContext), name)

        const sample = resolve(this.#resolveSample, 'resolveSample', options.sample)
        const contributionContext = Object.assign({}, baseContributionContext, {sample})

        /**
         * Resolve one contribution that can depend on the logical sample.
         *
         * @param {Function} callback - Contribution resolver.
         * @param {string} name - Contribution name used in diagnostics.
         * @param {*} override - Explicit caller override.
         * @returns {*} Resolved synchronous contribution.
         */
        const resolveAfterSample = (callback, name, override) => override !== undefined
            ? override
            : this.#synchronousContribution(callback(contributionContext), name)

        return this.#buildIntent(context, Object.assign({}, options, {
            sample,
            cameraPose: resolveAfterSample(this.#resolveCameraPose, 'resolveCameraPose', options.cameraPose),
            cameraFrame: resolveAfterSample(this.#resolveCameraFrame, 'resolveCameraFrame', options.cameraFrame),
            markerState: resolveAfterSample(this.#resolveMarkerState, 'resolveMarkerState', options.markerState),
            traceState: resolveAfterSample(this.#resolveTraceState, 'resolveTraceState', options.traceState),
            poiStates: resolveAfterSample(this.#resolvePoiStates, 'resolvePoiStates', options.poiStates),
            widgetStates: resolveAfterSample(this.#resolveWidgetStates, 'resolveWidgetStates', options.widgetStates),
            mediaStates: resolveAfterSample(this.#resolveMediaStates, 'resolveMediaStates', options.mediaStates),
        }))
    }

    /**
     * Resolve one frame asynchronously for qualification and HQ preparation.
     *
     * @param {Object} options - Frame and override options.
     * @returns {Promise<Object>} Canonical replay frame intent.
     */
    resolveFrame = async (options = {}) => {
        const context = this.#baseContext(options)
        const baseContributionContext = Object.assign({}, context, {settled: options.settled === true})

        /**
         * Resolve one optional asynchronous frame contribution.
         *
         * @param {Function} callback - Contribution resolver.
         * @param {*} override - Explicit caller override.
         * @returns {Promise<*>} Resolved contribution.
         */
        const resolve = async (callback, override) => override !== undefined
            ? override
            : callback(baseContributionContext)

        const sample = await resolve(this.#resolveSample, options.sample)
        throwIfReplayResolutionAborted(options.signal)
        const contributionContext = Object.assign({}, baseContributionContext, {sample})

        /**
         * Resolve one asynchronous contribution that can depend on the sample.
         *
         * @param {Function} callback - Contribution resolver.
         * @param {*} override - Explicit caller override.
         * @returns {Promise<*>} Resolved contribution.
         */
        const resolveAfterSample = async (callback, override) => override !== undefined
            ? override
            : callback(contributionContext)

        const [cameraPose, cameraFrame, markerState, traceState, poiStates, widgetStates, mediaStates] = await Promise.all([
            resolveAfterSample(this.#resolveCameraPose, options.cameraPose),
            resolveAfterSample(this.#resolveCameraFrame, options.cameraFrame),
            resolveAfterSample(this.#resolveMarkerState, options.markerState),
            resolveAfterSample(this.#resolveTraceState, options.traceState),
            resolveAfterSample(this.#resolvePoiStates, options.poiStates),
            resolveAfterSample(this.#resolveWidgetStates, options.widgetStates),
            resolveAfterSample(this.#resolveMediaStates, options.mediaStates),
        ])
        throwIfReplayResolutionAborted(options.signal)

        return this.#buildIntent(context, Object.assign({}, options, {
            sample,
            cameraPose,
            cameraFrame,
            markerState,
            traceState,
            poiStates,
            widgetStates,
            mediaStates,
        }))
    }

    /**
     * Resolve one absolute timeline time synchronously.
     *
     * @param {number} timeMs - Absolute timeline time.
     * @param {Object} options - Intent options.
     * @returns {Object} Canonical replay frame intent.
     */
    resolveAtTimeSync = (timeMs, options = {}) => this.resolveFrameSync(
        Object.assign({}, options, {timeMs}),
    )

    /**
     * Resolve one replay progress synchronously without timeline enumeration.
     *
     * @param {number} progress - Replay progress.
     * @param {Object} options - Intent options.
     * @returns {Object} Canonical replay frame intent.
     */
    resolveAtProgressSync = (progress, options = {}) => this.resolveAtTimeSync(
        this.timeAtProgress(progress),
        options,
    )

    /**
     * Build the legacy render contract for one canonical intent.
     *
     * @param {Object} intent - Canonical replay frame intent.
     * @returns {Object} Compatibility render contract.
     */
    renderContractForIntent = intent => createReplayRenderModeContract({
        renderMode: intent?.renderMode,
        logicalFrame: replayFrameIntentToLogicalFrame(intent),
        cameraPose: intent?.scene?.cameraPose,
        trackPath: this.#plan.trackPath,
        initialCameraState: this.#plan.definition?.initialCameraState,
        renderSpec: intent?.composition?.renderSpec,
        visibleOverlayIds: intent?.composition?.visibleOverlayIds,
        outputProfile: intent?.composition?.outputProfile,
    })
}
