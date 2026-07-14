/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoRenderSpec.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NAVIGATOR } from '@Core/constants'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'

const VIDEO_PIXEL_BUDGETS_BY_FPS = {
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
    30: 1.12,
    45: 1.08,
    60: 1.04,
}
const VIDEO_MOBILE_BUDGET_FACTORS_BY_FPS = {
    30: 1.08,
    45: 1.04,
    60: 1,
}
const VIDEO_DESKTOP_MAX_DPR_BY_FPS = {
    30: 2.75,
    45: 2.5,
    60: 2.25,
}
const VIDEO_MOBILE_MAX_DPR_BY_FPS = {
    30: 2.5,
    45: 2.3,
    60: 2.1,
}

const finiteNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') {
        return fallback
    }

    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const toEvenInt = value => Math.max(2, Math.floor(Number(value) / 2) * 2)

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

export const computeReplayVideoRecordingOutput = ({
                                                       cropWidth,
                                                       cropHeight,
                                                       fps = ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX],
                                                       qualityIndex = ScreenMediaRecorder.DEFAULT_QUALITY_INDEX,
                                                       deviceDpr = globalThis.__?.device?.dpr ?? globalThis.devicePixelRatio ?? 1,
                                                       browser = globalThis.__?.device?.browser,
                                                       mobile = globalThis.__?.device?.mobile === true,
                                                   } = {}) => {
    const baseWidth = Math.max(2, Math.round(Number(cropWidth) || 0))
    const baseHeight = Math.max(2, Math.round(Number(cropHeight) || 0))
    const safeFps = ScreenMediaRecorder.FPS.includes(Number(fps)) ? Number(fps) : ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX]
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
    const targetWidth = Math.min(nativeWidth, toEvenInt(baseWidth * scale))
    const targetHeight = Math.min(nativeHeight, toEvenInt(baseHeight * scale))
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
                                           } = {}) => {
    const normalizedCrop = normalizeReplayVideoCropRect(
        cropRect
        ?? globalThis.lgs?.stores?.replay?.videoCropRect
        ?? (sourceCanvas ? {left: 0, top: 0, width: sourceCanvas.width, height: sourceCanvas.height} : null),
    )
    const selectedFps = finiteNumber(fps, null)
                        ?? ScreenMediaRecorder.FPS[video?.fps]
                        ?? ScreenMediaRecorder.FPS[settings?.fps]
                        ?? ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX]
    const selectedQualityIndex = finiteNumber(qualityIndex, null)
                                 ?? finiteNumber(video?.quality, null)
                                 ?? finiteNumber(settings?.quality, null)
                                 ?? ScreenMediaRecorder.DEFAULT_QUALITY_INDEX
    const selectedCaptureMode = captureMode
                                ?? video?.captureMode
                                ?? settings?.captureMode
                                ?? 'speed'
    const requestedWidth = Math.max(2, Math.round(Number(dimensions?.width) || 0))
    const requestedHeight = Math.max(2, Math.round(Number(dimensions?.height) || 0))
    const requestedOutputDpr = normalizedCrop
                               ? Math.max(1, Math.min(
                                   requestedWidth / normalizedCrop.width,
                                   requestedHeight / normalizedCrop.height,
                               ))
                               : 1
    const output = dimensions
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
            fps:          selectedFps,
            qualityIndex: selectedQualityIndex,
            deviceDpr:    device?.dpr ?? globalThis.devicePixelRatio ?? 1,
            browser:      device?.browser,
            mobile:       device?.mobile === true || device?.isMobile === true,
        })

    return {
        fps:          selectedFps,
        fpsIndex:     ScreenMediaRecorder.FPS.indexOf(selectedFps),
        qualityIndex: selectedQualityIndex,
        captureMode:  selectedCaptureMode === 'quality' ? 'quality' : 'speed',
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
