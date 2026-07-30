import {
    replayAdaptiveRuntimeTrackingSettings,
    replayFrameLeadSeconds,
    replayIsWindowPointOutsideToleranceZone,
    replayRuntimeTrackingSettings,
    replayNavigationCorrectionWindowActive,
    replayTrackingZonePressure,
    replayToleranceZoneBounds,
    REPLAY_TRACKING_DYNAMIC_Z1_MIN_RATIO,
    REPLAY_TRACKING_DYNAMIC_Z2_MIN_RATIO,
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

    it('adapts dynamic Z1 and Z2 early for short replays while preserving nesting', () => {
        const viewport = REPLAY_REGRESSION_VIEWPORTS.standard
        const base = replayAdaptiveRuntimeTrackingSettings({}, viewport, {
            durationSeconds: 60,
            progress:        0,
            transitionSeconds: 1,
            frameLeadSeconds: 1 / 30,
        })
        const short = replayAdaptiveRuntimeTrackingSettings({}, viewport, {
            durationSeconds: 5,
            progress:        0,
            transitionSeconds: 1,
            frameLeadSeconds: 1 / 30,
        })
        const final = replayAdaptiveRuntimeTrackingSettings({}, viewport, {
            durationSeconds: 60,
            progress:        1,
            transitionSeconds: 1,
            frameLeadSeconds: 1 / 30,
        })
        const baseZ1 = replayToleranceZoneBounds(base.dynamic.triggerZone)
        const baseZ2 = replayToleranceZoneBounds(base.dynamic.targetZone)
        const shortZ1 = replayToleranceZoneBounds(short.dynamic.triggerZone)
        const shortZ2 = replayToleranceZoneBounds(short.dynamic.targetZone)
        const finalZ1 = replayToleranceZoneBounds(final.dynamic.triggerZone)
        const finalZ2 = replayToleranceZoneBounds(final.dynamic.targetZone)

        expect(short.diagnostics.pressure).toBeGreaterThan(0)
        expect(shortZ1.right - shortZ1.left).toBeLessThan(baseZ1.right - baseZ1.left)
        expect(shortZ2.right - shortZ2.left).toBeLessThan(baseZ2.right - baseZ2.left)
        expect(finalZ1.right - finalZ1.left).toBeCloseTo(REPLAY_TRACKING_DYNAMIC_Z1_MIN_RATIO, 6)
        expect(finalZ2.right - finalZ2.left).toBeCloseTo(REPLAY_TRACKING_DYNAMIC_Z2_MIN_RATIO, 6)
        expect(finalZ2.left).toBeGreaterThan(finalZ1.left)
        expect(finalZ2.right).toBeLessThan(finalZ1.right)
        expect(finalZ2.top).toBeGreaterThan(finalZ1.top)
        expect(finalZ2.bottom).toBeLessThan(finalZ1.bottom)
    })

    it('keeps adaptive collision zones identical for Draft and HQ', () => {
        const viewport = REPLAY_REGRESSION_VIEWPORTS.standard
        const options = {
            durationSeconds:   4,
            progress:          0.35,
            transitionSeconds: 1.2,
            frameLeadSeconds:  1 / 30,
        }
        const draft = replayAdaptiveRuntimeTrackingSettings({}, viewport, options)
        const hq = replayAdaptiveRuntimeTrackingSettings({}, viewport, options)

        expect(draft).toEqual(hq)
    })

    it('increases adaptive pressure when delayed calculations reduce the transition budget', () => {
        const nominal = replayTrackingZonePressure({
            durationSeconds:       10,
            progress:              0,
            transitionSeconds:     1,
            frameLeadSeconds:      1 / 30,
            calculationLagSeconds: 0.25,
        })
        const delayed = replayTrackingZonePressure({
            durationSeconds:       10,
            progress:              0,
            transitionSeconds:     1,
            frameLeadSeconds:      0.4,
            calculationLagSeconds: 1,
        })

        expect(delayed.transitionBudgetSeconds).toBeGreaterThan(nominal.transitionBudgetSeconds)
        expect(delayed.pressure).toBeGreaterThan(nominal.pressure)
    })

    it('holds a forced navigation correction for two logical seconds', () => {
        expect(replayNavigationCorrectionWindowActive({
                                                       startedAt: 1_000,
                                                       logicalNow: 2_999,
                                                   })).toBe(true)
        expect(replayNavigationCorrectionWindowActive({
                                                       startedAt: 1_000,
                                                       logicalNow: 3_000,
                                                   })).toBe(false)
        expect(replayNavigationCorrectionWindowActive({
                                                       startedAt: 1_000,
                                                       logicalNow: 900,
                                                   })).toBe(false)
    })

    it('repairs custom dynamic zones that would otherwise break Z1/Z2 nesting', () => {
        const tracking = replayAdaptiveRuntimeTrackingSettings({
            tracking: {
                dynamic: {
                    triggerZone: {top: 0.4, left: 0.4, width: 0.2, height: 0.2},
                    targetZone:  {top: 0.1, left: 0.1, width: 0.8, height: 0.8},
                },
            },
        }, REPLAY_REGRESSION_VIEWPORTS.standard, {
            durationSeconds: 60,
            progress:        0,
        })
        const z1 = replayToleranceZoneBounds(tracking.dynamic.triggerZone)
        const z2 = replayToleranceZoneBounds(tracking.dynamic.targetZone)

        expect(z2.left).toBeGreaterThan(z1.left)
        expect(z2.right).toBeLessThan(z1.right)
        expect(z2.top).toBeGreaterThan(z1.top)
        expect(z2.bottom).toBeLessThan(z1.bottom)
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
