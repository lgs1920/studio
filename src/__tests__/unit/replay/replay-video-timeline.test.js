import {JourneyReplayPlaybackController} from '@Core/ui/replay/JourneyReplayPlaybackController'
import {
    buildReplayVideoTimeline, resolveReplayVideoFramePhase,
} from '@Core/ui/replay/ReplayVideoTimeline'
import {describe, expect, it} from 'vitest'

const replayClips = {
    catalog: {
        intro: {
            id:      'intro',
            slots:   ['start'],
            defaults: {duration: 2},
        },
        outro: {
            id:      'outro',
            slots:   ['stop'],
            defaults: {duration: 1},
        },
    },
    start: [{clipId: 'intro'}],
    stop:  [{clipId: 'outro'}],
}

describe('ReplayVideoTimeline', () => {
    it('keeps one canonical ordering and duration for start, replay, and stop', () => {
        const timeline = buildReplayVideoTimeline({
            replayDurationMillis: 4000,
            fps:                  10,
            clips:                replayClips,
        })

        expect(timeline.phases.map(phase => phase.kind)).toEqual(['start', 'replay', 'stop'])
        expect(timeline.phases.map(phase => phase.durationMillis)).toEqual([2000, 4000, 1000])
        expect(timeline.phases.map(phase => [phase.startMillis, phase.endMillis])).toEqual([
            [0, 2000],
            [2000, 6000],
            [6000, 7000],
        ])
        expect(timeline.durationMillis).toBe(7000)
        expect(timeline.frameCount).toBe(71)
    })

    it('resolves exact phase boundaries including the final stop frame', () => {
        const timeline = buildReplayVideoTimeline({
            replayDurationMillis: 4000,
            fps:                  10,
            clips:                replayClips,
        })

        expect(resolveReplayVideoFramePhase({timeline, frameTimeMs: 0})).toEqual(expect.objectContaining({
            kind:         'start',
            localProgress: 0,
            frameIndex:   0,
            frameCount:   71,
        }))
        expect(resolveReplayVideoFramePhase({timeline, frameTimeMs: 2000})).toEqual(expect.objectContaining({
            kind:          'replay',
            progress:      0,
            localProgress: 0,
            replayFrameIndex: 0,
        }))
        expect(resolveReplayVideoFramePhase({timeline, frameTimeMs: 6000})).toEqual(expect.objectContaining({
            kind:          'stop',
            localProgress: 0,
            frameIndex:    60,
        }))
        expect(resolveReplayVideoFramePhase({
            timeline,
            frameTimeMs: 7000,
            isFinalSceneFrame: true,
        })).toEqual(expect.objectContaining({
            kind:              'stop',
            localProgress:     1,
            isFinalSceneFrame: true,
            isLastPhaseFrame:  true,
            frameIndex:        70,
        }))
    })

    it('publishes the same absolute clock from Draft as the shared export timeline', () => {
        const previousLgs = globalThis.lgs
        const frames = []
        let now = 0
        const sampler = {
            hasSamples:    true,
            durationMillis: 4000,
            atProgress:    progress => ({
                journeyElapsedMillis: progress * 4000,
                journeyDurationMillis: 4000,
            }),
        }
        globalThis.lgs = {
            stores: {
                replay: {
                    captureFps: 10,
                },
            },
            events: {emit: () => {}},
            scene:  {requestRender: () => {}},
        }

        try {
            const controller = new JourneyReplayPlaybackController({
                requestFrame: callback => {
                    frames.push(callback)
                    return frames.length
                },
                cancelFrame: () => {},
                now:         () => now,
            })
            controller.configure({sampler, duration: 4, clips: replayClips, captureFps: 10})
            controller.start()

            expect(globalThis.lgs.stores.replay.dynamicFrameState.phase).toEqual(
                expect.objectContaining({kind: 'replay', frameTimeMs: 2000}),
            )

            now = 2000
            frames.shift()()
            const draftPhase = globalThis.lgs.stores.replay.dynamicFrameState.phase
            const exportPhase = resolveReplayVideoFramePhase({
                timeline: controller.videoTimeline,
                frameTimeMs: draftPhase.frameTimeMs,
            })
            expect(draftPhase).toEqual(exportPhase)

            now = 4000
            frames.shift()()
            expect(globalThis.lgs.stores.replay.dynamicFrameState.phase).toEqual(
                expect.objectContaining({kind: 'stop', frameTimeMs: 6000}),
            )
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })
})
