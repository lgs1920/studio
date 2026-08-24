import {describe, expect, it, vi} from 'vitest'

import {createReplayDefinition} from '@Core/ui/replay/ReplayDefinition'
import {
    ReplayFrameResolver,
    replayFrameIntentToLogicalFrame,
} from '@Core/ui/replay/ReplayFrameResolver'
import {createReplayRenderPlan} from '@Core/ui/replay/ReplayRenderPlan'
import {createReplayTrackPathDescriptor} from '@Core/ui/replay/ReplayTrackPathDescriptor'
import {buildReplayVideoTimeline} from '@Core/ui/replay/ReplayVideoTimeline'

/**
 * Build a small lazy plan and resolver for one test timeline.
 *
 * @param {Object} options - Optional timeline and evaluator overrides.
 * @returns {Object} Definition, plan, resolver, and sample spy.
 */
const createLazyFixture = ({
    durationMillis = 1000,
    fps = 10,
    clips = null,
    resolveSample = null,
    resolveCameraPose = null,
} = {}) => {
    const timeline = buildReplayVideoTimeline({
        replayDurationMillis: durationMillis,
        fps,
        direction: 1,
        clips,
    })
    const segment = [[2, 48, 100], [2.1, 48.1, 120]]
    const trackPath = [{trackSlug: 'track-a', trackIndex: 0, segments: [segment]}]
    const trackPathDescriptor = createReplayTrackPathDescriptor(trackPath)
    const definition = createReplayDefinition({
        journeyId: 'journey-a',
        timeline,
        trackPathDescriptor,
        renderSpec: {fps, dimensions: {width: 1920, height: 1080}},
        visibleOverlayIds: ['stats'],
    })
    const plan = createReplayRenderPlan({
        definition,
        trackPath,
        trackPathDescriptor,
    })
    const sampleSpy = resolveSample ?? vi.fn(({progress}) => ({progress, longitude: 2 + progress}))
    const resolver = new ReplayFrameResolver({
        plan,
        resolveSample: sampleSpy,
        resolveCameraPose: resolveCameraPose ?? vi.fn(({progress}) => ({heading: progress, pitch: -0.8})),
    })

    return {timeline, trackPath, trackPathDescriptor, definition, plan, resolver, sampleSpy}
}

/**
 * Fail when a route descriptor attempts to read coordinate content.
 *
 * @returns {never} This helper always throws.
 */
const rejectCoordinateRead = () => {
    throw new Error('coordinate was read')
}

describe('lazy replay render plan', () => {
    it('describes route identity without reading or serializing coordinates', () => {
        const coordinate = {}
        Object.defineProperty(coordinate, 'longitude', {
            get: rejectCoordinateRead,
        })
        const segment = [coordinate, coordinate]
        const trackPath = [{trackSlug: 'track-a', segments: [segment]}]

        const first = createReplayTrackPathDescriptor(trackPath)
        const second = createReplayTrackPathDescriptor([{trackSlug: 'track-a', segments: [segment]}])
        const replacement = createReplayTrackPathDescriptor([{trackSlug: 'track-a', segments: [[coordinate, coordinate]]}])

        expect(first.pointCount).toBe(2)
        expect(second.signature).toBe(first.signature)
        expect(replacement.signature).not.toBe(first.signature)
    })

    it('stores clock metadata without allocating output frames', () => {
        const {plan} = createLazyFixture({
            durationMillis: 24 * 60 * 60 * 1000,
            fps: 60,
        })

        expect(plan.frameClock.frameCount).toBeGreaterThan(5_000_000)
        expect(plan.materializedFrameCount).toBe(0)
        expect(plan.frames).toBeUndefined()
    })

    it('resolves one requested timestamp with one sample evaluation', () => {
        const {resolver, sampleSpy, trackPath} = createLazyFixture()

        const intent = resolver.resolveAtTimeSync(750, {
            renderMode: 'draft',
            source: 'scrub',
        })

        expect(sampleSpy).toHaveBeenCalledTimes(1)
        expect(intent.frame.timeMs).toBe(750)
        expect(intent.replay.progress).toBeCloseTo(0.75, 8)
        expect(intent.scene.trackPath).toBe(trackPath)
        expect(intent.composition.visibleOverlayIds).toEqual(['stats'])
        expect(resolver.resolutionCount).toBe(1)
    })

    it('maps replay progress through start clips without enumerating them', () => {
        const {resolver, sampleSpy} = createLazyFixture({
            clips: {
                catalog: {
                    wait: {
                        id: 'wait',
                        slots: ['start'],
                        defaults: {duration: 2},
                        fields: [{key: 'duration', type: 'number', min: 0, max: 60}],
                    },
                },
                start: [{clipId: 'wait', enabled: true, params: {duration: 2}}],
                stop: [],
            },
        })

        const intent = resolver.resolveAtProgressSync(0.5)

        expect(intent.frame.timeMs).toBe(2500)
        expect(intent.timeline.phase.kind).toBe('replay')
        expect(intent.replay.progress).toBeCloseTo(0.5, 8)
        expect(sampleSpy).toHaveBeenCalledTimes(1)
    })

    it('produces equivalent Draft and HQ visual intent at the same time', () => {
        const {resolver} = createLazyFixture()

        const draft = resolver.resolveAtTimeSync(400, {renderMode: 'draft', source: 'draft'})
        const hq = resolver.resolveAtTimeSync(400, {renderMode: 'hq', source: 'hq'})

        expect(draft.frame).toEqual(hq.frame)
        expect(draft.timeline).toEqual(hq.timeline)
        expect(draft.replay).toEqual(hq.replay)
        expect(draft.scene).toEqual(hq.scene)
        expect(draft.composition).toEqual(hq.composition)
        expect(replayFrameIntentToLogicalFrame(draft)).toEqual(expect.objectContaining({
            progress: 0.4,
            frameTimeMs: 400,
        }))
    })

    it('cancels asynchronous qualification before publishing an intent', async () => {
        let releaseCamera = null
        const cameraPromise = new Promise(resolve => {
            releaseCamera = resolve
        })
        const {resolver} = createLazyFixture({
            resolveCameraPose: vi.fn(() => cameraPromise),
        })
        const abortController = new AbortController()
        const resolution = resolver.resolveFrame({
            timeMs: 500,
            signal: abortController.signal,
        })

        abortController.abort()
        releaseCamera({heading: 0.5, pitch: -0.8})

        await expect(resolution).rejects.toMatchObject({name: 'AbortError'})
        expect(resolver.resolutionCount).toBe(0)
    })
})
