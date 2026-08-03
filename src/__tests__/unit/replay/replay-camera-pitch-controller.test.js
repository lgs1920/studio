import {describe, expect, it, vi} from 'vitest'

import {
    REPLAY_CAMERA_PITCH_PHASE_ATTACK,
    REPLAY_CAMERA_PITCH_PHASE_HOLD,
    REPLAY_CAMERA_PITCH_PHASE_INACTIVE,
    REPLAY_CAMERA_PITCH_PHASE_PENDING,
    REPLAY_CAMERA_PITCH_PHASE_RELEASE,
    createReplayCameraPitchCorrectionState,
    replayCameraPitchCorrectionLimit,
    replayCameraPitchCorrectionSearchLimits,
    resolveReplayCameraPitchCorrection,
    resolveReplayCameraPitchCorrectionState,
    weightedReplayCameraRedirectState,
} from '@Core/ui/replay/JourneyReplayCameraPitchController'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from '@Core/ui/replay/JourneyReplayInternal'

const candidate = {
    headingOffset: 0.2,
    pitchOffset:   -0.3,
}

describe('Journey replay temporary pitch controller', () => {
    it('ignores one isolated visibility miss', () => {
        const pending = resolveReplayCameraPitchCorrectionState(null, {
            logicalNow: 0,
            nominalVisible: false,
            candidateRedirectState: candidate,
        })
        expect(pending.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_PENDING)
        expect(pending.ownsCamera).toBe(false)

        const visible = resolveReplayCameraPitchCorrectionState(pending.state, {
            logicalNow: 100,
            nominalVisible: true,
            candidateRedirectState: null,
        })
        expect(visible.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_INACTIVE)
        expect(visible.weightedRedirectState).toBeNull()
        expect(visible.ownsCamera).toBe(false)
    })

    it('uses logical time for a gentle attack and a faster release', () => {
        let result = resolveReplayCameraPitchCorrectionState(null, {
            logicalNow: 0,
            nominalVisible: false,
            candidateRedirectState: candidate,
        })
        result = resolveReplayCameraPitchCorrectionState(result.state, {
            logicalNow: 250,
            nominalVisible: false,
            candidateRedirectState: candidate,
        })
        expect(result.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_ATTACK)
        expect(result.state.weight).toBe(0)

        result = resolveReplayCameraPitchCorrectionState(result.state, {
            logicalNow: 700,
            nominalVisible: false,
            candidateRedirectState: candidate,
        })
        expect(result.state.weight).toBeCloseTo(0.5)
        expect(result.weightedRedirectState.pitchOffset).toBeCloseTo(-0.15)

        result = resolveReplayCameraPitchCorrectionState(result.state, {
            logicalNow: 1150,
            nominalVisible: false,
            candidateRedirectState: candidate,
        })
        expect(result.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_HOLD)
        expect(result.state.weight).toBe(1)

        result = resolveReplayCameraPitchCorrectionState(result.state, {
            logicalNow: 1200,
            nominalVisible: true,
            candidateRedirectState: null,
        })
        expect(result.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_HOLD)

        result = resolveReplayCameraPitchCorrectionState(result.state, {
            logicalNow: 1350,
            nominalVisible: true,
            candidateRedirectState: null,
        })
        expect(result.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_RELEASE)

        result = resolveReplayCameraPitchCorrectionState(result.state, {
            logicalNow: 1575,
            nominalVisible: true,
            candidateRedirectState: null,
        })
        expect(result.state.weight).toBeCloseTo(0.5)

        result = resolveReplayCameraPitchCorrectionState(result.state, {
            logicalNow: 1800,
            nominalVisible: true,
            candidateRedirectState: null,
        })
        expect(result.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_INACTIVE)
        expect(result.weightedRedirectState).toBeNull()
        expect(result.completed).toBe(true)
    })

    it('resumes attack from the current weight without accumulating pitch', () => {
        const releasing = {
            ...createReplayCameraPitchCorrectionState(),
            phase: REPLAY_CAMERA_PITCH_PHASE_RELEASE,
            phaseStartedAt: 1000,
            startWeight: 0.8,
            weight: 0.4,
            redirectState: candidate,
            visibleSince: 900,
        }
        const result = resolveReplayCameraPitchCorrectionState(releasing, {
            logicalNow: 1200,
            nominalVisible: false,
            candidateRedirectState: candidate,
        })

        expect(result.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_ATTACK)
        expect(result.state.startWeight).toBeCloseTo(0.4)
        expect(result.state.weight).toBeCloseTo(0.4)
        expect(result.weightedRedirectState.pitchOffset).toBeCloseTo(-0.12)
    })

    it('forces an exact nominal state on the final frame', () => {
        const active = {
            ...createReplayCameraPitchCorrectionState(),
            phase: REPLAY_CAMERA_PITCH_PHASE_HOLD,
            weight: 1,
            redirectState: candidate,
        }
        const result = resolveReplayCameraPitchCorrectionState(active, {
            logicalNow: 2000,
            nominalVisible: false,
            candidateRedirectState: candidate,
            isFinalFrame: true,
        })

        expect(result.state.phase).toBe(REPLAY_CAMERA_PITCH_PHASE_INACTIVE)
        expect(result.state.weight).toBe(0)
        expect(result.weightedRedirectState).toBeNull()
        expect(result.ownsCamera).toBe(true)
    })

    it('uses the same state resolver for Navigation and Dynamic views', () => {
        const runMode = markerMode => {
            const mode = {
                [JOURNEY_REPLAY_INTERNAL_STATE]: {
                    cameraPitchCorrectionState: {
                        ...createReplayCameraPitchCorrectionState(),
                        phase: REPLAY_CAMERA_PITCH_PHASE_ATTACK,
                        phaseStartedAt: 0,
                        redirectState: candidate,
                    },
                    cameraRedirectState: null,
                },
                [JOURNEY_REPLAY_INTERNAL_CALL]: {
                    cameraViewWithRedirectState: vi.fn((view, redirectState) => ({
                        ...view,
                        markerMode,
                        heading: view.heading + redirectState.headingOffset,
                        pitch: view.pitch + redirectState.pitchOffset,
                    })),
                },
            }
            return resolveReplayCameraPitchCorrection(mode, {
                nominalView: {
                    heading: 0.4,
                    pitch: -0.6,
                },
                logicalNow: 450,
                nominalVisible: false,
                candidateRedirectState: candidate,
            })
        }

        const navigation = runMode('navigation')
        const dynamic = runMode('dynamic')
        expect(navigation.state.weight).toBeCloseTo(dynamic.state.weight)
        expect(navigation.view.heading).toBeCloseTo(dynamic.view.heading)
        expect(navigation.view.pitch).toBeCloseTo(dynamic.view.pitch)
    })

    it('uses a gentle shallow limit before a bounded recovery limit', () => {
        expect(replayCameraPitchCorrectionLimit(-10 * Math.PI / 180)).toBeCloseTo(8 * Math.PI / 180)
        expect(replayCameraPitchCorrectionLimit(-45 * Math.PI / 180)).toBeCloseTo(20 * Math.PI / 180)
        expect(replayCameraPitchCorrectionSearchLimits(-10 * Math.PI / 180)).toEqual([
            8 * Math.PI / 180,
            20 * Math.PI / 180,
        ])
        expect(replayCameraPitchCorrectionSearchLimits(-45 * Math.PI / 180)).toEqual([
            20 * Math.PI / 180,
        ])
        expect(weightedReplayCameraRedirectState(candidate, 0)).toBeNull()
    })
})
