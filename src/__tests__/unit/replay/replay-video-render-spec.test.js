/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-render-spec.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {
    assertReplayVideoSourceResolution,
    buildReplayVideoRenderSpec,
    computeReplayVideoRecordingOutput,
    REPLAY_VIDEO_READINESS_POLICIES,
    REPLAY_VIDEO_RENDER_HOST_MODES,
    REPLAY_VIDEO_RENDER_QUALITIES,
    REPLAY_VIDEO_RESOLUTION_PROFILES,
} from '@Core/ui/replay/ReplayVideoRenderSpec'

describe('Replay video render profiles', () => {
    it('preserves the automatic output policy when no profile is selected', () => {
        const cropRect = {left: 0, top: 0, width: 1920, height: 1080}
        const spec = buildReplayVideoRenderSpec({
            cropRect,
            video: {fps: 0, quality: 0, renderHostMode: 'visible'},
            settings: {},
            device: {dpr: 1, browser: 'chromium', mobile: false},
            sourceCanvas: {width: 1920, height: 1080},
        })

        const automatic = computeReplayVideoRecordingOutput({
            cropWidth: 1920,
            cropHeight: 1080,
            fps: 30,
            qualityIndex: 0,
            deviceDpr: 1,
            browser: 'chromium',
            mobile: false,
        })
        expect(spec.dimensions).toEqual({width: automatic.targetWidth, height: automatic.targetHeight})
        expect(spec.renderHostMode).toBe(REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD)
        expect(spec.readinessPolicy).toBe(REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE)
    })

    it('uses saved export choices when the runtime store still contains its startup defaults', () => {
        const spec = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 1920, height: 1080},
            video: {
                renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD,
                resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC,
                customDimensions: {width: 1920, height: 1080},
                renderQuality: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD,
                readinessPolicy: REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE,
            },
            settings: {
                renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ,
                resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K,
                customDimensions: {width: 3840, height: 2160},
                renderQuality: REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM,
                readinessPolicy: REPLAY_VIDEO_READINESS_POLICIES.STRICT,
            },
            sourceCanvas: {width: 1920, height: 1080},
        })

        expect(spec).toMatchObject({
            renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ,
            resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K,
            dimensions: {width: 3840, height: 2160},
            renderQuality: REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM,
            maximumScreenSpaceError: 2,
            readinessPolicy: REPLAY_VIDEO_READINESS_POLICIES.STRICT,
        })
    })

    it.each([
        [1300, 2310, {width: 1080, height: 1920}],
        [1800, 3200, {width: 1440, height: 2560}],
        [2200, 3910, {width: 2160, height: 3840}],
    ])('snaps portrait Automatic resolution at %s px to the lower standard tier', (width, height, expected) => {
        const spec = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width, height},
            video: {fps: 0, quality: 0, ratio: '9x16', resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC},
            settings: {},
            device: {dpr: 1, browser: 'chromium', mobile: false},
            sourceCanvas: {width, height},
        })

        expect(spec.dimensions).toEqual(expected)
    })

    it('does not enlarge a portrait crop below the smallest Automatic tier', () => {
        const output = computeReplayVideoRecordingOutput({
            cropWidth: 900,
            cropHeight: 1600,
            formatRatio: '9x16',
            fps: 30,
            qualityIndex: 0,
            deviceDpr: 1,
            browser: 'chromium',
            mobile: false,
        })

        expect(output).toMatchObject({targetWidth: 900, targetHeight: 1600})
    })

    it.each([
        [2000, 1125, {width: 1920, height: 1080}],
        [3000, 1688, {width: 2560, height: 1440}],
        [4000, 2250, {width: 3840, height: 2160}],
    ])('snaps landscape Automatic resolution at %s px to the lower standard tier', (width, height, expected) => {
        const output = computeReplayVideoRecordingOutput({
            cropWidth: width,
            cropHeight: height,
            formatRatio: '16x9',
            fps: 30,
            qualityIndex: 0,
            deviceDpr: 1,
            browser: 'chromium',
            mobile: false,
        })

        expect(output).toMatchObject({targetWidth: expected.width, targetHeight: expected.height})
    })

    it('keeps square and other custom Automatic formats on their own aspect ratio', () => {
        const square = computeReplayVideoRecordingOutput({
            cropWidth: 1080,
            cropHeight: 1080,
            formatRatio: '1x1',
            fps: 30,
            qualityIndex: 0,
            deviceDpr: 1,
            browser: 'chromium',
            mobile: false,
        })
        const custom = computeReplayVideoRecordingOutput({
            cropWidth: 1600,
            cropHeight: 2000,
            formatRatio: '4x5',
            fps: 30,
            qualityIndex: 0,
            deviceDpr: 1,
            browser: 'chromium',
            mobile: false,
        })

        expect(square.targetWidth).toBe(square.targetHeight)
        expect(custom.targetWidth / custom.targetHeight).toBeCloseTo(0.8, 2)
    })

    it('keeps 720p, 1080p, 1440p and 4K UHD dimensions independent of FPS', () => {
        const cropRect = {left: 0, top: 0, width: 1600, height: 900}
        const build = (resolutionProfile, fps) => buildReplayVideoRenderSpec({
            cropRect,
            video: {
                fps,
                resolutionProfile,
                renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ,
                renderQuality: REPLAY_VIDEO_RENDER_QUALITIES.HIGH,
            },
            sourceCanvas: {width: 1920, height: 1080},
        })

        expect(build(REPLAY_VIDEO_RESOLUTION_PROFILES.HD_720, 3).dimensions)
            .toEqual({width: 1280, height: 720})
        expect(build(REPLAY_VIDEO_RESOLUTION_PROFILES.HD_720, 2).dimensions)
            .toEqual({width: 1280, height: 720})
        expect(build(REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD, 3).dimensions)
            .toEqual({width: 1920, height: 1080})
        expect(build(REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD, 2).dimensions)
            .toEqual({width: 1920, height: 1080})
        expect(build(REPLAY_VIDEO_RESOLUTION_PROFILES.QHD_1440, 3).dimensions)
            .toEqual({width: 2560, height: 1440})
        expect(build(REPLAY_VIDEO_RESOLUTION_PROFILES.QHD_1440, 2).dimensions)
            .toEqual({width: 2560, height: 1440})
        expect(build(REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K, 3).dimensions)
            .toEqual({width: 3840, height: 2160})
        expect(build(REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K, 2).dimensions)
            .toEqual({width: 3840, height: 2160})
    })

    it('preserves portrait and custom crop aspect ratios without stretching', () => {
        const portrait = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 900, height: 1600},
            video: {resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD},
            sourceCanvas: {width: 900, height: 1600},
        })
        const custom = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 600, height: 1000},
            video: {
                resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM,
                customDimensions: {width: 1200, height: 1920},
            },
            sourceCanvas: {width: 900, height: 1600},
        })

        expect(portrait.dimensions).toEqual({width: 1080, height: 1920})
        expect(custom.dimensions).toEqual({width: 1152, height: 1920})
        expect(custom.dimensions.width * 5).toBe(custom.dimensions.height * 3)
    })

    it.each([
        [REPLAY_VIDEO_RESOLUTION_PROFILES.HD_720, {width: 720, height: 1280}],
        [REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD, {width: 1080, height: 1920}],
        [REPLAY_VIDEO_RESOLUTION_PROFILES.QHD_1440, {width: 1440, height: 2560}],
        [REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K, {width: 2160, height: 3840}],
    ])('uses the locked 9x16 format for %s when CSS crop rounding shifts its measured ratio', (profile, expected) => {
        const spec = buildReplayVideoRenderSpec({
            cropRect: {left: 3, top: 11, width: 674, height: 1199},
            video: {
                ratio: '9x16',
                renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ,
                resolutionProfile: profile,
            },
            sourceCanvas: {width: 900, height: 1600},
        })

        expect(spec.dimensions).toEqual(expected)
    })

    it('resolves the explicit 1440p profile to QHD dimensions in landscape and portrait', () => {
        const build = (ratio, cropRect) => buildReplayVideoRenderSpec({
            cropRect,
            video: {
                ratio,
                resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.QHD_1440,
            },
            sourceCanvas: {width: 1920, height: 1080},
        })

        expect(build('16x9', {left: 0, top: 0, width: 1001, height: 563}).dimensions)
            .toEqual({width: 2560, height: 1440})
        expect(build('9x16', {left: 0, top: 0, width: 563, height: 1001}).dimensions)
            .toEqual({width: 1440, height: 2560})
    })

    it('maps the independent Cesium quality and readiness choices to export policy', () => {
        const standard = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 1920, height: 1080},
            video: {renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ},
            sourceCanvas: {width: 1920, height: 1080},
        })
        const maximum = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 1920, height: 1080},
            video: {
                renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ,
                renderQuality: REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM,
                readinessPolicy: REPLAY_VIDEO_READINESS_POLICIES.STRICT,
            },
            sourceCanvas: {width: 1920, height: 1080},
        })

        expect(standard.maximumScreenSpaceError).toBe(16)
        expect(standard.readinessPolicy).toBe(REPLAY_VIDEO_READINESS_POLICIES.STRICT)
        expect(maximum.maximumScreenSpaceError).toBe(2)
    })

    it('rejects standard output profiles that would upscale the visible Cesium crop', () => {
        const sourceCanvas = {
            width: 1920,
            height: 1080,
            getBoundingClientRect: () => ({width: 1920, height: 1080}),
        }

        expect(() => assertReplayVideoSourceResolution({
            sourceCanvas,
            cropRect: {width: 1920, height: 1080},
            dimensions: {width: 3840, height: 2160},
        })).toThrow('Select Native HQ or a smaller output profile')
        expect(assertReplayVideoSourceResolution({
            sourceCanvas: {
                width: 3840,
                height: 2160,
                getBoundingClientRect: () => ({width: 1920, height: 1080}),
            },
            cropRect: {width: 1920, height: 1080},
            dimensions: {width: 3840, height: 2160},
        })).toEqual({width: 3840, height: 2160})
    })

    it('reports an explicit error when custom crop dimensions cannot fit evenly', () => {
        expect(() => buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 1919, height: 1080},
            video: {
                resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD,
            },
            sourceCanvas: {width: 1920, height: 1080},
        })).toThrow('cannot fit inside 1920 × 1080 with even output dimensions')
    })
})
