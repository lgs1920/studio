/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoRenderSpec.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NAVIGATOR } from '@Core/constants'
import {
    DEFAULT_REPLAY_VIDEO_FPS_INDEX,
    DEFAULT_REPLAY_VIDEO_QUALITY_INDEX,
    REPLAY_VIDEO_FPS,
} from '@Core/ui/replay/ReplayVideoSettings'

const VIDEO_PIXEL_BUDGETS_BY_FPS = {
    15: 3_600_000,
    30: 2_800_000,
    45: 2_250_000,
    60: 1_700_000,
}
const VIDEO_QUALITY_BUDGET_FACTORS = [0.9, 1, 1.12]
const VIDEO_BROWSER_BUDGET_FACTORS = {
    [NAVIGATOR.firefox]: 0.92,
    [NAVIGATOR.edge]:    0.65,
}
const VIDEO_HIGH_DPR_BUDGET_FACTORS_BY_FPS = {
    15: 1.16,
    30: 1.12,
    45: 1.08,
    60: 1.04,
}
const VIDEO_MOBILE_BUDGET_FACTORS_BY_FPS = {
    15: 1.12,
    30: 1.08,
    45: 1.04,
    60: 1,
}
const VIDEO_DESKTOP_MAX_DPR_BY_FPS = {
    15: 3,
    30: 2.75,
    45: 2.5,
    60: 2.25,
}
const VIDEO_MOBILE_MAX_DPR_BY_FPS = {
    15: 2.75,
    30: 2.5,
    45: 2.3,
    60: 2.1,
}

const VIDEO_AUTOMATIC_STANDARD_DIMENSIONS = Object.freeze({
    '16x9': [
        {width: 1920, height: 1080},
        {width: 2560, height: 1440},
        {width: 3840, height: 2160},
    ],
    '9x16': [
        {width: 1080, height: 1920},
        {width: 1440, height: 2560},
        {width: 2160, height: 3840},
    ],
})

export const REPLAY_VIDEO_RESOLUTION_PROFILES = Object.freeze({
    AUTOMATIC: 'automatic',
    FULL_HD: '1080p',
    UHD_4K: '4k-uhd',
    CUSTOM: 'custom',
})

export const REPLAY_VIDEO_RENDER_HOST_MODES = Object.freeze({
    STANDARD: 'visible',
    NATIVE_HQ: 'isolated',
})

export const REPLAY_VIDEO_RENDER_QUALITIES = Object.freeze({
    STANDARD: 'standard',
    HIGH: 'high',
    MAXIMUM: 'maximum',
})

export const REPLAY_VIDEO_READINESS_POLICIES = Object.freeze({
    ADAPTIVE: 'adaptive',
    STRICT: 'strict',
})

const REPLAY_VIDEO_RENDER_SSE = Object.freeze({
    [REPLAY_VIDEO_RENDER_QUALITIES.STANDARD]: 16,
    [REPLAY_VIDEO_RENDER_QUALITIES.HIGH]: 4,
    [REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM]: 2,
})

const finiteNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') {
        return fallback
    }

    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const toEvenInt = value => Math.max(2, Math.floor(Number(value) / 2) * 2)

/**
 * Find the greatest common divisor of two positive integer crop dimensions.
 *
 * @param {number} left - First crop dimension.
 * @param {number} right - Second crop dimension.
 * @returns {number} Greatest common divisor, or one for invalid input.
 */
const greatestCommonDivisor = (left, right) => {
    let a = Math.abs(Math.trunc(left))
    let b = Math.abs(Math.trunc(right))
    while (b > 0) {
        [a, b] = [b, a % b]
    }
    return a || 1
}

/**
 * Resolve a standard automatic resolution family from the selected format or crop.
 * Free, square, and other custom formats intentionally retain their computed ratio.
 *
 * @param {Object} options - Selected ratio and crop dimensions.
 * @returns {string|null} Standard format key, or null for a custom format.
 */
const resolveAutomaticStandardFormat = ({formatRatio, cropWidth, cropHeight}) => {
    const ratio = `${formatRatio?.value ?? formatRatio ?? ''}`.trim().toLowerCase().replace(':', 'x')
    if (Object.prototype.hasOwnProperty.call(VIDEO_AUTOMATIC_STANDARD_DIMENSIONS, ratio)) {
        return ratio
    }
    if (ratio) {
        return null
    }

    const aspectRatio = cropWidth / cropHeight
    return Object.keys(VIDEO_AUTOMATIC_STANDARD_DIMENSIONS).find(format => {
        const [width, height] = format.split('x').map(Number)
        return Math.abs((aspectRatio / (width / height)) - 1) <= 0.005
    }) ?? null
}

/**
 * Snap a computed standard-format output down to the largest supported level it fits.
 *
 * @param {Object} options - Computed dimensions and standard format.
 * @returns {Object|null} Lower standard dimensions, or null below the minimum.
 */
const resolveAutomaticStandardDimensions = ({width, height, format}) => {
    const levels = VIDEO_AUTOMATIC_STANDARD_DIMENSIONS[format]
    if (!levels) {
        return null
    }

    return levels.filter(level => level.width <= width && level.height <= height).at(-1) ?? null
}

/**
 * Fit an explicit resolution profile inside its requested bounds while preserving crop aspect.
 *
 * @param {Object} options - Crop, profile and custom resolution values.
 * @returns {Object} Even physical output dimensions.
 */
const resolveProfileDimensions = ({crop, profile, customDimensions}) => {
    const cropWidth = Math.max(2, Number(crop?.width) || 1920)
    const cropHeight = Math.max(2, Number(crop?.height) || 1080)
    const aspectRatio = cropWidth / cropHeight
    const profileBounds = profile === REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD
        ? {width: aspectRatio >= 1 ? 1920 : 1080, height: aspectRatio >= 1 ? 1080 : 1920}
        : profile === REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K
          ? {width: aspectRatio >= 1 ? 3840 : 2160, height: aspectRatio >= 1 ? 2160 : 3840}
          : null
    const bounds = profileBounds
        ? profileBounds
        : {
            width: Math.max(2, Number(customDimensions?.width) || 1920),
            height: Math.max(2, Number(customDimensions?.height) || 1080),
        }
    const divisor = greatestCommonDivisor(cropWidth, cropHeight)
    const aspectWidth = cropWidth / divisor
    const aspectHeight = cropHeight / divisor
    const maxMultiple = Math.floor(Math.min(bounds.width / aspectWidth, bounds.height / aspectHeight))
    const evenMultiple = Math.floor(maxMultiple / 2) * 2
    if (evenMultiple < 2) {
        throw new RangeError(
            `The selected crop aspect ratio cannot fit inside ${bounds.width} × ${bounds.height} `
            + 'with even output dimensions. Increase the custom bounds or choose another crop.',
        )
    }

    return {
        width: aspectWidth * evenMultiple,
        height: aspectHeight * evenMultiple,
    }
}

/**
 * Resolve an independent Cesium LOD target and readiness policy.
 *
 * @param {Object} options - Export renderer choices.
 * @returns {Object} Normalized renderer quality values.
 */
const resolveReplayRenderQuality = ({renderQuality, renderHostMode, readinessPolicy}) => {
    const quality = Object.values(REPLAY_VIDEO_RENDER_QUALITIES).includes(renderQuality)
        ? renderQuality
        : REPLAY_VIDEO_RENDER_QUALITIES.STANDARD
    const policy = Object.values(REPLAY_VIDEO_READINESS_POLICIES).includes(readinessPolicy)
        ? readinessPolicy
        : renderHostMode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ
          ? REPLAY_VIDEO_READINESS_POLICIES.STRICT
          : REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE

    return {
        renderQuality: quality,
        maximumScreenSpaceError: REPLAY_VIDEO_RENDER_SSE[quality],
        readinessPolicy: policy,
    }
}

export const normalizeReplayVideoCropRect = (cropRect = null) => {
    const left = finiteNumber(cropRect?.left ?? cropRect?.x, null)
    const top = finiteNumber(cropRect?.top ?? cropRect?.y, null)
    const width = finiteNumber(cropRect?.width, null)
    const height = finiteNumber(cropRect?.height, null)
    if ([left, top, width, height].some(value => value === null) || width <= 0 || height <= 0) {
        return null
    }

    return {
        left:   Math.round(left),
        top:    Math.round(top),
        width:  Math.max(2, Math.round(width)),
        height: Math.max(2, Math.round(height)),
    }
}

export const replayVideoComposerClipFromCropRect = cropRect => {
    const normalized = normalizeReplayVideoCropRect(cropRect)
    if (!normalized) {
        return null
    }

    return {
        x:      normalized.left,
        y:      normalized.top,
        width:  normalized.width,
        height: normalized.height,
    }
}

/**
 * Reject explicit standard output profiles that exceed the visible Cesium crop resolution.
 *
 * @param {Object} options - Visible source canvas, crop and requested dimensions.
 * @returns {Object} Available physical source dimensions for the crop.
 * @throws {Error} When the visible render would need to be upscaled.
 */
export const assertReplayVideoSourceResolution = ({sourceCanvas, cropRect, dimensions} = {}) => {
    const sourceWidth = Number(sourceCanvas?.width) || 0
    const sourceHeight = Number(sourceCanvas?.height) || 0
    const logicalRect = sourceCanvas?.getBoundingClientRect?.() ?? null
    const scaleX = logicalRect?.width > 0 ? sourceWidth / logicalRect.width : 1
    const scaleY = logicalRect?.height > 0 ? sourceHeight / logicalRect.height : 1
    const cropWidth = Number(cropRect?.width) || Number(logicalRect?.width) || sourceWidth
    const cropHeight = Number(cropRect?.height) || Number(logicalRect?.height) || sourceHeight
    const available = {
        width: Math.floor(cropWidth * scaleX),
        height: Math.floor(cropHeight * scaleY),
    }
    const requestedWidth = Math.max(0, Math.trunc(Number(dimensions?.width) || 0))
    const requestedHeight = Math.max(0, Math.trunc(Number(dimensions?.height) || 0))
    if (available.width < requestedWidth || available.height < requestedHeight) {
        throw new Error(
            `Standard export can render this crop at ${available.width} × ${available.height} pixels, `
            + `below the requested ${requestedWidth} × ${requestedHeight}. Select Native HQ or a smaller output profile.`,
        )
    }

    return available
}

export const computeReplayVideoRecordingOutput = ({
                                                       cropWidth,
                                                       cropHeight,
                                                       formatRatio = null,
                                                       fps = REPLAY_VIDEO_FPS[DEFAULT_REPLAY_VIDEO_FPS_INDEX],
                                                       qualityIndex = DEFAULT_REPLAY_VIDEO_QUALITY_INDEX,
                                                       deviceDpr = globalThis.__?.device?.dpr ?? globalThis.devicePixelRatio ?? 1,
                                                       browser = globalThis.__?.device?.browser,
                                                       mobile = globalThis.__?.device?.mobile === true,
                                                   } = {}) => {
    const baseWidth = Math.max(2, Math.round(Number(cropWidth) || 0))
    const baseHeight = Math.max(2, Math.round(Number(cropHeight) || 0))
    const safeFps = REPLAY_VIDEO_FPS.includes(Number(fps)) ? Number(fps) : REPLAY_VIDEO_FPS[DEFAULT_REPLAY_VIDEO_FPS_INDEX]
    const nativeDpr = Math.max(1, Number(deviceDpr) || 1)
    const isHighDpr = nativeDpr > 1.25
    const platformDprCap = mobile
                           ? (VIDEO_MOBILE_MAX_DPR_BY_FPS[safeFps] ?? VIDEO_MOBILE_MAX_DPR_BY_FPS[30])
                           : (VIDEO_DESKTOP_MAX_DPR_BY_FPS[safeFps] ?? VIDEO_DESKTOP_MAX_DPR_BY_FPS[30])
    const usableDpr = Math.max(1, Math.min(nativeDpr, isHighDpr ? platformDprCap : nativeDpr))
    const nativeWidth = toEvenInt(baseWidth * usableDpr)
    const nativeHeight = toEvenInt(baseHeight * usableDpr)
    const basePixels = baseWidth * baseHeight
    const nativePixels = nativeWidth * nativeHeight
    const qualityFactor = VIDEO_QUALITY_BUDGET_FACTORS[qualityIndex] ?? 1
    const browserFactor = VIDEO_BROWSER_BUDGET_FACTORS[browser] ?? 1
    const highDprFactor = isHighDpr ? (VIDEO_HIGH_DPR_BUDGET_FACTORS_BY_FPS[safeFps] ?? VIDEO_HIGH_DPR_BUDGET_FACTORS_BY_FPS[30]) : 1
    const mobileFactor = mobile ? (VIDEO_MOBILE_BUDGET_FACTORS_BY_FPS[safeFps] ?? VIDEO_MOBILE_BUDGET_FACTORS_BY_FPS[30]) : 1
    const pixelBudget = Math.round((VIDEO_PIXEL_BUDGETS_BY_FPS[safeFps] ?? VIDEO_PIXEL_BUDGETS_BY_FPS[30]) * qualityFactor * browserFactor * highDprFactor * mobileFactor)
    const targetPixels = Math.max(basePixels, Math.min(nativePixels, pixelBudget))
    const scale = Math.sqrt(targetPixels / basePixels)
    const computedWidth = Math.min(nativeWidth, toEvenInt(baseWidth * scale))
    const computedHeight = Math.min(nativeHeight, toEvenInt(baseHeight * scale))
    const standardFormat = resolveAutomaticStandardFormat({
        formatRatio,
        cropWidth: baseWidth,
        cropHeight: baseHeight,
    })
    const standardDimensions = resolveAutomaticStandardDimensions({
        width: computedWidth,
        height: computedHeight,
        format: standardFormat,
    })
    const targetWidth = standardDimensions?.width ?? computedWidth
    const targetHeight = standardDimensions?.height ?? computedHeight
    const outputDpr = Math.max(1, Math.min(usableDpr, targetWidth / baseWidth, targetHeight / baseHeight))

    return {
        outputDpr,
        targetWidth,
        targetHeight,
        nativeWidth,
        nativeHeight,
        pixelBudget,
    }
}

export const buildReplayVideoRenderSpec = ({
                                               cropRect = null,
                                               video = globalThis.lgs?.stores?.ui?.video ?? null,
                                               settings = globalThis.lgs?.settings?.ui?.video ?? null,
                                               device = globalThis.__?.device ?? null,
                                               sourceCanvas = globalThis.lgs?.canvas ?? null,
                                               dimensions = null,
                                               captureMode = null,
                                               fps = null,
                                               qualityIndex = null,
                                                       resolutionProfile = null,
                                                       customDimensions = null,
                                                       renderHostMode = null,
                                                       renderQuality = null,
                                                       readinessPolicy = null,
                                           } = {}) => {
    const normalizedCrop = normalizeReplayVideoCropRect(
        cropRect
        ?? globalThis.lgs?.stores?.replay?.videoCropRect
        ?? (sourceCanvas ? {left: 0, top: 0, width: sourceCanvas.width, height: sourceCanvas.height} : null),
    )
    const selectedFps = finiteNumber(fps, null)
                        ?? REPLAY_VIDEO_FPS[video?.fps]
                        ?? REPLAY_VIDEO_FPS[settings?.fps]
                        ?? REPLAY_VIDEO_FPS[DEFAULT_REPLAY_VIDEO_FPS_INDEX]
    const selectedQualityIndex = finiteNumber(qualityIndex, null)
                                 ?? finiteNumber(video?.quality, null)
                                 ?? finiteNumber(settings?.quality, null)
                                 ?? DEFAULT_REPLAY_VIDEO_QUALITY_INDEX
    const selectedCaptureMode = captureMode
                                ?? video?.captureMode
                                ?? settings?.captureMode
                                ?? 'speed'
    const requestedResolutionProfile = resolutionProfile
                                       ?? video?.resolutionProfile
                                       ?? settings?.resolutionProfile
                                       ?? REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC
    const selectedResolutionProfile = Object.values(REPLAY_VIDEO_RESOLUTION_PROFILES).includes(requestedResolutionProfile)
        ? requestedResolutionProfile
        : REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC
    const selectedRenderHostMode = renderHostMode
                                   ?? video?.renderHostMode
                                   ?? settings?.renderHostMode
                                   ?? REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD
    const selectedRenderQuality = renderQuality
                                  ?? video?.renderQuality
                                  ?? settings?.renderQuality
                                  ?? REPLAY_VIDEO_RENDER_QUALITIES.STANDARD
    const selectedReadinessPolicy = readinessPolicy
                                    ?? video?.readinessPolicy
                                    ?? settings?.readinessPolicy
                                    ?? null
    const savedCustomDimensions = customDimensions
                                  ?? video?.customDimensions
                                  ?? settings?.customDimensions
                                  ?? null
    const profiledDimensions = selectedResolutionProfile === REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC
        ? null
        : resolveProfileDimensions({
            crop: normalizedCrop ?? sourceCanvas,
            profile: selectedResolutionProfile,
            customDimensions: savedCustomDimensions,
        })
    const requestedDimensions = profiledDimensions ?? dimensions
    const requestedWidth = Math.max(2, Math.round(Number(requestedDimensions?.width) || 0))
    const requestedHeight = Math.max(2, Math.round(Number(requestedDimensions?.height) || 0))
    const requestedOutputDpr = normalizedCrop
                               ? Math.max(1, Math.min(
                                   requestedWidth / normalizedCrop.width,
                                   requestedHeight / normalizedCrop.height,
                               ))
                               : 1
    const output = requestedDimensions
                   ? {
            outputDpr:    requestedOutputDpr,
            targetWidth:  requestedWidth,
            targetHeight: requestedHeight,
            nativeWidth:  requestedWidth,
            nativeHeight: requestedHeight,
            pixelBudget:  Math.max(0, Math.round(requestedWidth * requestedHeight)),
        }
                   : computeReplayVideoRecordingOutput({
            cropWidth:    normalizedCrop?.width ?? sourceCanvas?.width ?? 1920,
            cropHeight:   normalizedCrop?.height ?? sourceCanvas?.height ?? 1080,
            formatRatio:  video?.ratio ?? settings?.ratio ?? null,
            fps:          selectedFps,
            qualityIndex: selectedQualityIndex,
            deviceDpr:    device?.dpr ?? globalThis.devicePixelRatio ?? 1,
            browser:      device?.browser,
            mobile:       device?.mobile === true || device?.isMobile === true,
        })
    const renderQualityOptions = resolveReplayRenderQuality({
        renderQuality: selectedRenderQuality,
        renderHostMode: selectedRenderHostMode,
        readinessPolicy: selectedReadinessPolicy,
    })

    return {
        fps:          selectedFps,
        fpsIndex:     REPLAY_VIDEO_FPS.indexOf(selectedFps),
        qualityIndex: selectedQualityIndex,
        captureMode:  selectedCaptureMode === 'quality' ? 'quality' : 'speed',
        renderHostMode: selectedRenderHostMode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ
            ? REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ
            : REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD,
        resolutionProfile: selectedResolutionProfile,
        customDimensions: savedCustomDimensions
            ? {width: Number(savedCustomDimensions.width) || 0, height: Number(savedCustomDimensions.height) || 0}
            : null,
        renderQuality: renderQualityOptions.renderQuality,
        maximumScreenSpaceError: renderQualityOptions.maximumScreenSpaceError,
        readinessPolicy: renderQualityOptions.readinessPolicy,
        cropRect:     normalizedCrop,
        composerClip: replayVideoComposerClipFromCropRect(normalizedCrop),
        dimensions:   {
            width:  output.targetWidth,
            height: output.targetHeight,
        },
        outputDpr: output.outputDpr,
        nativeDimensions: {
            width:  output.nativeWidth,
            height: output.nativeHeight,
        },
        pixelBudget: output.pixelBudget,
        sourceCanvasDimensions: sourceCanvas
                                ? {
                width:  Number(sourceCanvas.width) || 0,
                height: Number(sourceCanvas.height) || 0,
            }
                                : null,
    }
}
