import {describe, expect, it} from 'vitest'
import {
    createReplayRenderContext, createReplayRenderModeContract, REPLAY_RENDER_MODE_DRAFT,
    REPLAY_RENDER_MODE_HQ,
} from '@Core/ui/replay/ReplayRenderModeContract'
import {updateReplayFrameRenderContract} from '@Core/ui/replay/JourneyReplayRuntime'

describe('Replay render mode contract', () => {
    const logicalFrame = {
        sample:   {progress: 0.5, longitude: 2, latitude: 48},
        progress: 0.5,
        frameTimeMs: 500,
    }
    const renderSpec = {
        fps:              30,
        qualityIndex:     1,
        captureMode:      'quality',
        cropRect:         {left: 10, top: 20, width: 640, height: 360},
        composerClip:     {x: 10, y: 20, width: 640, height: 360},
        dimensions:       {width: 1280, height: 720},
        outputDpr:        2,
        nativeDimensions: {width: 1280, height: 720},
        pixelBudget:      921600,
    }

    it('keeps visual inputs identical while isolating Draft and HQ scheduling', () => {
        const common = {
            logicalFrame,
            cameraPose: {heading: 0.5, pitch: -0.75, cameraHeight: 1000},
            trackPath: [[[2, 48, 100], [2.1, 48.1, 120]]],
            initialCameraState: {
                destination: {longitude: 2, latitude: 48, height: 5000},
                orientation: {heading: 0.1, pitch: -1, roll: 0},
            },
            renderSpec,
            visibleOverlayIds: ['journey-stats-widget'],
        }
        const draft = createReplayRenderModeContract({renderMode: REPLAY_RENDER_MODE_DRAFT, ...common})
        const hq = createReplayRenderModeContract({renderMode: REPLAY_RENDER_MODE_HQ, ...common})

        expect(draft.logicalFrame).toEqual(hq.logicalFrame)
        expect(draft.cameraPose).toEqual(hq.cameraPose)
        expect(draft.trackPath).toEqual(hq.trackPath)
        expect(draft.renderSpec).toEqual(hq.renderSpec)
        expect(draft.initialCameraState).toEqual(hq.initialCameraState)
        expect(draft.scheduling).toEqual({realtime: true, frameByFrame: false})
        expect(hq.scheduling).toEqual({realtime: false, frameByFrame: true})
    })

    it('invalidates a warm context when replay or render inputs change', () => {
        const base = {
            durationMillis: 1000,
            direction: 1,
            clipSignature: 'clips-a',
            widgetSignature: 'widget-a',
            initialCameraState: {destination: {longitude: 2, latitude: 48, height: 5000}},
            renderSpec,
            visibleOverlayIds: ['journey-stats-widget'],
            recordingSync: true,
        }
        const context = createReplayRenderContext(base)

        expect(createReplayRenderContext(base).contextKey).toBe(context.contextKey)
        expect(createReplayRenderContext({...base, durationMillis: 2000}).contextKey).not.toBe(context.contextKey)
        expect(createReplayRenderContext({...base, direction: -1}).contextKey).not.toBe(context.contextKey)
        expect(createReplayRenderContext({...base, clipSignature: 'clips-b'}).contextKey).not.toBe(context.contextKey)
        expect(createReplayRenderContext({...base, widgetSignature: 'widget-b'}).contextKey).not.toBe(context.contextKey)
        expect(createReplayRenderContext({...base, renderSpec: {...renderSpec, outputDpr: 1}}).contextKey).not.toBe(context.contextKey)
    })

    it('publishes the completed logical camera frame after the adapter applies it', () => {
        const store = {
            dynamicFrameState: {
                sample: {progress: 0.5},
                renderContract: createReplayRenderModeContract({
                    renderMode: REPLAY_RENDER_MODE_DRAFT,
                    logicalFrame: {sample: {progress: 0.5}, progress: 0.5},
                    trackPath: [[[2, 48, 100], [2.1, 48.1, 120]]],
                    initialCameraState: {
                        destination: {longitude: 2, latitude: 48, height: 5000},
                    },
                    renderSpec,
                    visibleOverlayIds: ['journey-stats-widget'],
                }),
            },
        }
        const logicalFrame = {
            sample: {progress: 0.5},
            progress: 0.5,
            frameTimeMs: 500,
            cameraPose: {heading: 0.7, pitch: -0.8, cameraHeight: 1100},
            cameraFrame: {position: {x: 1, y: 2, z: 3}},
        }

        const contract = updateReplayFrameRenderContract({store, logicalFrame})

        expect(contract).toEqual(expect.objectContaining({
            renderMode: REPLAY_RENDER_MODE_DRAFT,
            cameraPose: logicalFrame.cameraPose,
            trackPath: [[[2, 48, 100], [2.1, 48.1, 120]]],
            initialCameraState: expect.objectContaining({
                destination: expect.objectContaining({longitude: 2, latitude: 48, height: 5000}),
            }),
        }))
        expect(contract.logicalFrame).toEqual(expect.objectContaining(logicalFrame))
        expect(store.dynamicFrameState.renderContract).toEqual(contract)
    })
})
