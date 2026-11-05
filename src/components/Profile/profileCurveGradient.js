/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profileCurveGradient.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-05
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Clamp one smoothing control coordinate to the interval between its neighbors. */
const clampBetween = (value, first, second) => Math.max(Math.min(first, second), Math.min(Math.max(first, second), value))

/** Sample the same constrained cubic smoothing used by the profile line. */
const smoothProfileSegment = points => {
    if (points.length < 3) {
        return points
    }

    const lastIndex = points.length - 1
    const controls = points.map((point, index) => {
        if (index === 0 || index === lastIndex) {
            return {incoming: point, outgoing: point}
        }

        const previous = points[index - 1]
        const next = points[index + 1]
        const vectorX = next.x - previous.x
        const vectorY = next.y - previous.y
        const previousLength = Math.hypot(point.x - previous.x, point.y - previous.y)
        const nextLength = Math.hypot(next.x - point.x, next.y - point.y)
        const length = previousLength + nextLength
        const nextRatio = length > 0 ? nextLength / length : 0.5
        const incoming = {
            x: point.x - vectorX * 0.5 * (1 - nextRatio),
            y: point.y - vectorY * 0.5 * (1 - nextRatio),
        }
        const outgoing = {
            x: point.x + vectorX * 0.5 * nextRatio,
            y: point.y + vectorY * 0.5 * nextRatio,
        }

        let constrainedOutgoing = {
            x: clampBetween(outgoing.x, point.x, next.x),
            y: clampBetween(outgoing.y, point.y, next.y),
        }

        if (previousLength > 0 && nextLength > 0) {
            const constrainedIncoming = {
                x: point.x - (constrainedOutgoing.x - point.x) * previousLength / nextLength,
                y: point.y - (constrainedOutgoing.y - point.y) * previousLength / nextLength,
            }
            constrainedIncoming.x = clampBetween(constrainedIncoming.x, previous.x, point.x)
            constrainedIncoming.y = clampBetween(constrainedIncoming.y, previous.y, point.y)
            constrainedOutgoing = {
                x: point.x + (point.x - constrainedIncoming.x) * nextLength / previousLength,
                y: point.y + (point.y - constrainedIncoming.y) * nextLength / previousLength,
            }
            return {incoming: constrainedIncoming, outgoing: constrainedOutgoing}
        }

        return {incoming, outgoing: constrainedOutgoing}
    })

    const sampled = []
    for (let index = 0; index < lastIndex; index += 1) {
        const start = points[index]
        const end = points[index + 1]
        const controlStart = index === 0 ? start : controls[index].outgoing
        const controlEnd = index + 1 === lastIndex ? end : controls[index + 1].incoming
        const steps = Math.max(1, Math.ceil(Math.abs(end.x - start.x) * 1.5))

        for (let step = 0; step < steps; step += 1) {
            const ratio = step / steps
            const inverseRatio = 1 - ratio
            sampled.push({
                x: inverseRatio ** 3 * start.x
                    + 3 * inverseRatio ** 2 * ratio * controlStart.x
                    + 3 * inverseRatio * ratio ** 2 * controlEnd.x
                    + ratio ** 3 * end.x,
                y: inverseRatio ** 3 * start.y
                    + 3 * inverseRatio ** 2 * ratio * controlStart.y
                    + 3 * inverseRatio * ratio ** 2 * controlEnd.y
                    + ratio ** 3 * end.y,
            })
        }
    }
    sampled.push(points[lastIndex])
    return sampled
}

/**
 * Create a transparent image whose fill fades from each profile point to its area baseline.
 * @param {Object} options - Raster dimensions, profile segments, color, and plot bounds.
 * @returns {HTMLCanvasElement|null} The generated curve-relative gradient image.
 */
export const createProfileCurveGradient = ({
    width,
    height,
    plotRect,
    baseline,
    segments,
    color,
    alpha = 0.5,
    fade = true,
} = {}) => {
    const canvasWidth = Math.ceil(Number(width))
    const canvasHeight = Math.ceil(Number(height))
    if (typeof document === 'undefined'
        || !Number.isFinite(canvasWidth)
        || !Number.isFinite(canvasHeight)
        || canvasWidth < 1
        || canvasHeight < 1
        || !plotRect
        || !Array.isArray(segments)
        || !Array.isArray(color)) {
        return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const context = canvas.getContext('2d')
    if (!context) {
        return null
    }

    const image = context.createImageData(canvasWidth, canvasHeight)
    const [red, green, blue] = color.map(value => Math.max(0, Math.min(255, Math.round(Number(value) || 0))))
    const maxAlpha = Math.max(0, Math.min(1, Number(alpha) || 0))
    const plotLeft = Math.max(0, Math.floor(plotRect.x))
    const plotRight = Math.min(canvasWidth, Math.ceil(plotRect.x + plotRect.width))
    const plotTop = Math.max(0, Math.floor(plotRect.y))
    const plotBottom = Math.min(canvasHeight, Math.ceil(plotRect.y + plotRect.height))
    const areaBaseline = Math.max(plotTop, Math.min(plotBottom, Number(baseline)))

    segments.forEach(segment => {
        if (!Array.isArray(segment) || segment.length < 2) {
            return
        }

        const smoothedSegment = smoothProfileSegment(segment)
        for (let index = 1; index < smoothedSegment.length; index += 1) {
            const firstPoint = smoothedSegment[index - 1]
            const secondPoint = smoothedSegment[index]
            const distanceX = secondPoint.x - firstPoint.x
            if (!Number.isFinite(distanceX) || Math.abs(distanceX) < 0.001) {
                continue
            }

            const startX = Math.max(plotLeft, Math.floor(Math.min(firstPoint.x, secondPoint.x)))
            const endX = Math.min(plotRight - 1, Math.ceil(Math.max(firstPoint.x, secondPoint.x)))
            for (let x = startX; x <= endX; x += 1) {
                const ratio = (x + 0.5 - firstPoint.x) / distanceX
                if (ratio < 0 || ratio > 1) {
                    continue
                }

                const curveY = firstPoint.y + (secondPoint.y - firstPoint.y) * ratio
                const verticalSpan = areaBaseline - curveY
                if (!Number.isFinite(verticalSpan) || Math.abs(verticalSpan) < 0.5) {
                    continue
                }

                const startY = Math.max(plotTop, Math.floor(Math.min(curveY, areaBaseline)))
                const endY = Math.min(plotBottom - 1, Math.ceil(Math.max(curveY, areaBaseline)))
                for (let y = startY; y <= endY; y += 1) {
                    const progress = fade ? Math.abs((y + 0.5 - curveY) / verticalSpan) : 0
                    if (progress > 1) {
                        continue
                    }

                    const fadeOpacity = (1 - progress) ** 4
                    const pixelAlpha = Math.round(maxAlpha * fadeOpacity * 255)
                    const pixelIndex = (y * canvasWidth + x) * 4
                    if (pixelAlpha <= image.data[pixelIndex + 3]) {
                        continue
                    }

                    image.data[pixelIndex] = red
                    image.data[pixelIndex + 1] = green
                    image.data[pixelIndex + 2] = blue
                    image.data[pixelIndex + 3] = pixelAlpha
                }
            }
        }
    })

    context.putImageData(image, 0, 0)
    return canvas
}
