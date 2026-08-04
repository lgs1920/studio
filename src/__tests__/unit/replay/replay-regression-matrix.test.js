import {
    replayFrameLeadSeconds,
    replayIsWindowPointOutsideToleranceZone,
    replayRuntimeTrackingSettings,
    replayToleranceZoneBounds,
} from '@Core/ui/replay/JourneyReplayCameraMath'
import {
    createReplayRenderModeContract,
    REPLAY_RENDER_MODE_DRAFT,
    REPLAY_RENDER_MODE_HQ,
} from '@Core/ui/replay/ReplayRenderModeContract'
import {describe, expect, it} from 'vitest'

import {
    REPLAY_REGRESSION_CAMERA_STATE,
    REPLAY_REGRESSION_LOGICAL_FRAME,
    REPLAY_REGRESSION_VIEWPORTS,
} from './replay-regression-fixtures'

const renderModes = [REPLAY_RENDER_MODE_DRAFT, REPLAY_RENDER_MODE_HQ]

describe('replay regression matrix', () => {
    it('freezes the navigation Z1 geometry for standard and narrow crops', () => {
        const trackingByRenderMode = Object.fromEntries(renderModes.map(renderMode => [
            renderMode,
            replayRuntimeTrackingSettings({}, REPLAY_REGRESSION_VIEWPORTS.standard),
        ]))
        const narrowTrackingByRenderMode = Object.fromEntries(renderModes.map(renderMode => [
            renderMode,
            replayRuntimeTrackingSettings({}, REPLAY_REGRESSION_VIEWPORTS.narrow),
        ]))
        const standardZone = trackingByRenderMode[REPLAY_RENDER_MODE_DRAFT].navigation.triggerZone
        const narrowZone = narrowTrackingByRenderMode[REPLAY_RENDER_MODE_DRAFT].navigation.triggerZone
        const standardBounds = replayToleranceZoneBounds(standardZone)
        const narrowBounds = replayToleranceZoneBounds(narrowZone)

        expect(trackingByRenderMode[REPLAY_RENDER_MODE_DRAFT].navigation.triggerZone)
            .toEqual(trackingByRenderMode[REPLAY_RENDER_MODE_HQ].navigation.triggerZone)
        expect(narrowTrackingByRenderMode[REPLAY_RENDER_MODE_DRAFT].navigation.triggerZone)
            .toEqual(narrowTrackingByRenderMode[REPLAY_RENDER_MODE_HQ].navigation.triggerZone)
        expect(standardBounds.left).toBeCloseTo(0.35, 6)
        expect(standardBounds.top).toBeCloseTo(0.35, 6)
        expect(standardBounds.right).toBeCloseTo(0.65, 6)
        expect(standardBounds.bottom).toBeCloseTo(0.65, 6)
        expect(narrowBounds.left).toBeCloseTo(0.39, 6)
        expect(narrowBounds.top).toBeCloseTo(0.39, 6)
        expect(narrowBounds.right).toBeCloseTo(0.61, 6)
        expect(narrowBounds.bottom).toBeCloseTo(0.61, 6)
    })

    it('freezes navigation collision decisions without a Z2 target zone', () => {
        const trackingByRenderMode = Object.fromEntries(renderModes.map(renderMode => [
            renderMode,
            replayRuntimeTrackingSettings({}, REPLAY_REGRESSION_VIEWPORTS.standard),
        ]))
        const viewport = REPLAY_REGRESSION_VIEWPORTS.standard
        const draftTracking = trackingByRenderMode[REPLAY_RENDER_MODE_DRAFT]
        const hqTracking = trackingByRenderMode[REPLAY_RENDER_MODE_HQ]

        expect(draftTracking).toEqual(hqTracking)
        expect(draftTracking.navigation.targetZone).toBeUndefined()
        expect(replayIsWindowPointOutsideToleranceZone({
                                                              point:  {x: viewport.width * 0.5, y: viewport.height * 0.5},
                                                              width:  viewport.width,
                                                              height: viewport.height,
                                                              zone:   draftTracking.navigation.triggerZone,
                                                          })).toBe(false)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                              point:  {x: viewport.width * 0.34, y: viewport.height * 0.5},
                                                              width:  viewport.width,
                                                              height: viewport.height,
                                                              zone:   draftTracking.navigation.triggerZone,
                                                          })).toBe(true)
    })

    it('freezes dynamic Z1 and Z2 collision decisions', () => {
        const trackingByRenderMode = Object.fromEntries(renderModes.map(renderMode => [
            renderMode,
            replayRuntimeTrackingSettings({}, REPLAY_REGRESSION_VIEWPORTS.standard),
        ]))
        const viewport = REPLAY_REGRESSION_VIEWPORTS.standard
        const draftTracking = trackingByRenderMode[REPLAY_RENDER_MODE_DRAFT]
        const hqTracking = trackingByRenderMode[REPLAY_RENDER_MODE_HQ]

        expect(draftTracking).toEqual(hqTracking)
        const dynamicTriggerBounds = replayToleranceZoneBounds(draftTracking.dynamic.triggerZone)
        const dynamicTargetBounds = replayToleranceZoneBounds(draftTracking.dynamic.targetZone)

        expect(dynamicTriggerBounds.left).toBeCloseTo(0.125, 6)
        expect(dynamicTriggerBounds.top).toBeCloseTo(0.125, 6)
        expect(dynamicTriggerBounds.right).toBeCloseTo(0.875, 6)
        expect(dynamicTriggerBounds.bottom).toBeCloseTo(0.875, 6)
        expect(dynamicTargetBounds.left).toBeCloseTo(0.35, 6)
        expect(dynamicTargetBounds.top).toBeCloseTo(0.35, 6)
        expect(dynamicTargetBounds.right).toBeCloseTo(0.65, 6)
        expect(dynamicTargetBounds.bottom).toBeCloseTo(0.65, 6)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                              point:  {x: viewport.width * 0.5, y: viewport.height * 0.5},
                                                              width:  viewport.width,
                                                              height: viewport.height,
                                                              zone:   draftTracking.dynamic.triggerZone,
                                                          })).toBe(false)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                              point:  {x: viewport.width * 0.1, y: viewport.height * 0.5},
                                                              width:  viewport.width,
                                                              height: viewport.height,
                                                              zone:   draftTracking.dynamic.triggerZone,
                                                          })).toBe(true)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                              point:  {x: viewport.width * 0.5, y: viewport.height * 0.5},
                                                              width:  viewport.width,
                                                              height: viewport.height,
                                                              zone:   draftTracking.dynamic.targetZone,
                                                          })).toBe(false)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                              point:  {x: viewport.width * 0.3, y: viewport.height * 0.5},
                                                              width:  viewport.width,
                                                              height: viewport.height,
                                                              zone:   draftTracking.dynamic.targetZone,
                                                          })).toBe(true)
    })

    it('freezes one-frame lookahead from each mode configured cadence', () => {
        const configuredDraftFps = 12
        const configuredHqFps = 48

        expect(replayFrameLeadSeconds({fps: configuredDraftFps})).toBeCloseTo(1 / configuredDraftFps, 6)
        expect(replayFrameLeadSeconds({fps: configuredHqFps})).toBeCloseTo(1 / configuredHqFps, 6)
        expect(replayFrameLeadSeconds({fps: configuredDraftFps, frameIntervalMs: 1000 / configuredHqFps}))
            .toBeCloseTo(1 / configuredHqFps, 6)
    })

    it('freezes the shared initial camera and logical frame while keeping scheduling separate', () => {
        const draft = createReplayRenderModeContract({
            renderMode:        REPLAY_RENDER_MODE_DRAFT,
            logicalFrame:      REPLAY_REGRESSION_LOGICAL_FRAME,
            cameraPose:        {heading: 0.4, pitch: -0.7, cameraHeight: 2400},
            initialCameraState: REPLAY_REGRESSION_CAMERA_STATE,
        })
        const hq = createReplayRenderModeContract({
            renderMode:        REPLAY_RENDER_MODE_HQ,
            logicalFrame:      REPLAY_REGRESSION_LOGICAL_FRAME,
            cameraPose:        {heading: 0.4, pitch: -0.7, cameraHeight: 2400},
            initialCameraState: REPLAY_REGRESSION_CAMERA_STATE,
        })

        expect(draft.initialCameraState).toEqual(hq.initialCameraState)
        expect(draft.logicalFrame).toEqual(hq.logicalFrame)
        expect(draft.cameraPose).toEqual(hq.cameraPose)
        expect(draft.scheduling).toEqual({realtime: true, frameByFrame: false})
        expect(hq.scheduling).toEqual({realtime: false, frameByFrame: true})
    })
})
