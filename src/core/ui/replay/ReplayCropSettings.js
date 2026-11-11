/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayCropSettings.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-11-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {VIDEO_CROP_ZONE} from '@Core/constants'

/** Serialize writes for each Journey so older crop edits cannot finish after newer edits. */
const cropWrites = new WeakMap()

/** Resolve the exact aspect ratio encoded by a standard WxH format identifier. */
const aspectRatioFromFormatValue = value => {
    const match = `${value ?? ''}`.trim().toLowerCase().replace(':', 'x').match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/)
    const width = Number(match?.[1])
    const height = Number(match?.[2])
    return width > 0 && height > 0 ? width / height : null
}

/** Normalize the Journey-owned crop dimensions and ratio, rejecting invalid stored sizes. */
export const normalizeReplayCropZone = value => {
    if (!Number.isFinite(value?.width) || !Number.isFinite(value?.height)
        || value.width <= 0 || value.height <= 0) {
        return null
    }
    const ratioValue = typeof value.ratio?.value === 'string' ? value.ratio.value : 'free'
    const lockedAspectRatio = value.ratio?.locked === true
        ? aspectRatioFromFormatValue(ratioValue)
          ?? (Number.isFinite(value.ratio?.aspectRatio) && value.ratio.aspectRatio > 0
              ? value.ratio.aspectRatio
              : value.width / value.height)
        : value.width / value.height
    return {
        width: value.width,
        height: value.height,
        ratio: {
            value: ratioValue,
            aspectRatio: lockedAspectRatio,
            locked: value.ratio?.locked === true,
        },
    }
}

/** Restore the active Journey crop after shared widget persistence has been read. */
export const restoreJourneyReplayCrop = (config, journey = globalThis.lgs?.theJourney) => {
    if (config.id !== VIDEO_CROP_ZONE || !journey?.slug) {
        return
    }
    const bounds = (config.container ?? globalThis.lgs?.canvas)?.getBoundingClientRect?.()
    if (!(bounds?.width > 0 && bounds?.height > 0)) {
        return
    }
    const saved = normalizeReplayCropZone(journey.replay?.cropZone)
    const defaultValue = globalThis.__?.device?.isPortrait ? '9x16' : '16x9'
    const aspectRatio = saved?.ratio.aspectRatio ?? (defaultValue === '9x16' ? 9 / 16 : 16 / 9)
    const margin = Math.max(0, Number(config.margin) || 0)
    const availableWidth = Math.max(1, bounds.width - margin * 2)
    const availableHeight = Math.max(1, bounds.height - margin * 2)
    const requestedWidth = saved?.width ?? availableWidth
    const requestedHeight = saved?.height ?? requestedWidth / aspectRatio
    const scale = Math.min(1, availableWidth / requestedWidth, availableHeight / requestedHeight)
    const width = Math.max(1, Math.floor(requestedWidth * scale))
    const height = Math.max(1, Math.floor(requestedHeight * scale))
    const left = Math.floor((bounds.width - width) / 2)
    const top = Math.floor((bounds.height - height) / 2)
    config.replayCropJourneySlug = journey.slug
    config.cropDimensions = {left, top, width, height}
    config.dimensions = {width, height}
    config.position = {left, top}
    config.centerRatio = {x: 0.5, y: 0.5}
    config.savedRatios = {leftRatio: 50, topRatio: 50}
    config.ratio = saved?.ratio ?? {value: defaultValue, aspectRatio, locked: true}
    config.fromDB = true
    config.scale = {x: 1, y: 1}
    const $video = globalThis.lgs?.stores?.ui?.video
    if ($video) {
        $video.ratio = config.ratio.value
        if ($video.cropper) {
            $video.cropper.aspectRatio = config.ratio.locked ? config.ratio.aspectRatio : Number.NaN
        }
    }
    const $replay = globalThis.lgs?.stores?.replay
    if ($replay) {
        $replay.videoCropRect = {...config.cropDimensions}
    }
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('onCropUpdate', {
            detail: {id: config.id, crop: {...config.cropDimensions}, ratio: {...config.ratio}, phase: 'journey-restore'},
        }))
    }
}

/** Persist completed crop edits only to the Journey that owns the mounted crop. */
export const persistJourneyReplayCrop = (config, phase) => {
    const journey = globalThis.lgs?.theJourney
    if (config.id !== VIDEO_CROP_ZONE || !journey?.slug
        || config.replayCropJourneySlug !== journey.slug
        || phase === 'resize' || phase === 'drag') {
        return
    }
    const cropZone = normalizeReplayCropZone({...config.cropDimensions, ratio: config.ratio})
    if (!cropZone || JSON.stringify(cropZone) === JSON.stringify(normalizeReplayCropZone(journey.replay?.cropZone))) {
        return
    }
    journey.replay = {...journey.replay, cropZone}
    if (typeof journey.persistToDatabase !== 'function') {
        return
    }
    const write = (cropWrites.get(journey) ?? Promise.resolve())
        .then(() => journey.persistToDatabase())
        .catch(error => {
            console.error(`[Replay persistence] Failed to save crop zone for ${journey.slug}.`, error)
        })
    cropWrites.set(journey, write)
    return write
}
