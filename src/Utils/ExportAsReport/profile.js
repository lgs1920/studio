/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profile.js
 *
 ******************************************************************************/

import { snapdom } from '@zumer/snapdom'
import {
    DISTANCE_UNITS,
    ELEVATION_UNITS,
    UnitUtils,
} from '@Utils/UnitUtils'
import { loadDataUrlImage } from './assets'
import {
    cssColor,
    finiteNumber,
    normalizeColor,
} from './format'
import { geoDistance } from './geometry'
import { getJourneyTrackDrawings } from './journeyData'
import { waitForAnimationFrames } from './snapshots'

export const getTrackProfileSourcePoints = ({track, segments}) => {
    const metricPoints = Array.isArray(track?.metrics?.points) ? track.metrics.points : []
    const metricProfile = metricPoints
        .map(point => ({
            distance: finiteNumber(point.distance) ?? 0,
            altitude: finiteNumber(point.altitude),
        }))
        .filter(point => point.altitude !== null)

    if (metricProfile.length > 1) {
        return metricProfile
    }

    return (segments ?? []).flatMap(segment => segment.map((point, index) => ({
        distance: index === 0 ? 0 : geoDistance(segment[index - 1], point),
        altitude: finiteNumber(point.altitude),
    })).filter(point => point.altitude !== null))
}

export const getJourneyProfileData = (journey, trackDrawings = getJourneyTrackDrawings(journey)) => {
    const unitSystem = Number(globalThis.lgs?.settings?.unitSystem?.current ?? 0)
    const distanceUnit = DISTANCE_UNITS[unitSystem] ?? DISTANCE_UNITS[0]
    const elevationUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[0]
    const datasets = []
    let cumulativeDistance = 0

    trackDrawings.forEach(trackDrawing => {
        const points = []
        getTrackProfileSourcePoints(trackDrawing).forEach(point => {
            cumulativeDistance += point.distance
            points.push({
                distance:  UnitUtils.convert(cumulativeDistance).to(distanceUnit),
                elevation: UnitUtils.convert(point.altitude).to(elevationUnit),
            })
        })

        if (points.length > 1) {
            datasets.push({
                title:  trackDrawing.track?.title || 'Track',
                color:  cssColor(trackDrawing.color),
                points,
            })
        }
    })

    const allPoints = datasets.flatMap(dataset => dataset.points)
    if (allPoints.length < 2) {
        return null
    }

    const distances = allPoints.map(point => point.distance)
    const elevations = allPoints.map(point => point.elevation)
    const minElevation = Math.min(...elevations)
    const maxElevation = Math.max(...elevations)
    const elevationPadding = Math.max((maxElevation - minElevation) * 0.12, 10)

    return {
        datasets,
        distanceUnit,
        elevationUnit,
        minDistance: Math.min(...distances),
        maxDistance: Math.max(...distances),
        minElevation: minElevation - elevationPadding,
        maxElevation: maxElevation + elevationPadding,
    }
}

export const rgba = (color, alpha) => {
    const [red, green, blue] = normalizeColor(color)
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export const colorLuminance = color => {
    const [red, green, blue] = normalizeColor(color)
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
}

export const coverImageBox = (source, target) => {
    const sourceRatio = Math.max((source?.width ?? 1) / (source?.height ?? 1), 0.000001)
    const targetRatio = Math.max(target.width / target.height, 0.000001)
    let sourceWidth = source?.width ?? target.width
    let sourceHeight = source?.height ?? target.height
    let sourceX = 0
    let sourceY = 0

    if (sourceRatio > targetRatio) {
        sourceWidth = sourceHeight * targetRatio
        sourceX = ((source?.width ?? sourceWidth) - sourceWidth) / 2
    }
    else {
        sourceHeight = sourceWidth / targetRatio
        sourceY = ((source?.height ?? sourceHeight) - sourceHeight) / 2
    }

    return {sourceX, sourceY, sourceWidth, sourceHeight}
}

export const drawProfileAxes = (context, profileData, box, theme) => {
    const textColor = theme.text
    const lineColor = theme.line
    context.save()
    context.strokeStyle = lineColor
    context.fillStyle = textColor
    context.lineWidth = 1
    context.font = '600 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    context.textAlign = 'left'
    context.textBaseline = 'top'
    context.fillText('Elevation profile', box.x, 18)

    context.font = '13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    context.textBaseline = 'middle'
    for (let index = 0; index <= 4; index++) {
        const ratio = index / 4
        const y = box.y + box.height * ratio
        const elevation = profileData.maxElevation - (profileData.maxElevation - profileData.minElevation) * ratio
        context.globalAlpha = index === 4 ? 1 : 0.55
        context.beginPath()
        context.moveTo(box.x, y)
        context.lineTo(box.x + box.width, y)
        context.stroke()
        context.globalAlpha = 1
        context.textAlign = 'right'
        context.fillText(`${Math.round(elevation)} ${profileData.elevationUnit}`, box.x - 10, y)
    }

    context.textAlign = 'center'
    context.textBaseline = 'top'
    for (let index = 0; index <= 4; index++) {
        const ratio = index / 4
        const x = box.x + box.width * ratio
        const distance = profileData.minDistance + (profileData.maxDistance - profileData.minDistance) * ratio
        context.globalAlpha = index === 0 ? 1 : 0.38
        context.beginPath()
        context.moveTo(x, box.y)
        context.lineTo(x, box.y + box.height)
        context.stroke()
        context.globalAlpha = 1
        context.fillText(`${distance.toFixed(distance >= 10 ? 0 : 1)} ${profileData.distanceUnit}`, x, box.y + box.height + 10)
    }
    context.restore()
}

export const drawProfileDataset = (context, dataset, profileData, box) => {
    const xRange = Math.max(profileData.maxDistance - profileData.minDistance, 0.000001)
    const yRange = Math.max(profileData.maxElevation - profileData.minElevation, 0.000001)
    const project = point => ({
        x: box.x + (point.distance - profileData.minDistance) / xRange * box.width,
        y: box.y + box.height - (point.elevation - profileData.minElevation) / yRange * box.height,
    })

    const points = dataset.points.map(project)
    if (points.length < 2) {
        return
    }

    context.save()
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.beginPath()
    points.forEach((point, index) => {
        if (index === 0) {
            context.moveTo(point.x, point.y)
        }
        else {
            context.lineTo(point.x, point.y)
        }
    })
    context.lineTo(points[points.length - 1].x, box.y + box.height)
    context.lineTo(points[0].x, box.y + box.height)
    context.closePath()
    context.fillStyle = rgba(dataset.color, 0.18)
    context.fill()

    context.beginPath()
    points.forEach((point, index) => {
        if (index === 0) {
            context.moveTo(point.x, point.y)
        }
        else {
            context.lineTo(point.x, point.y)
        }
    })
    context.strokeStyle = dataset.color
    context.lineWidth = 4
    context.stroke()
    context.restore()
}

export const createJourneyProfileImage = async ({journey, trackDrawings, backgroundSnapshot, theme}) => {
    const profileData = getJourneyProfileData(journey, trackDrawings)
    if (!profileData || typeof document === 'undefined') {
        return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = 980
    canvas.height = 430
    const context = canvas.getContext?.('2d')
    if (!context) {
        return null
    }

    const background = await loadDataUrlImage(backgroundSnapshot?.dataUrl)
    context.fillStyle = theme.surface
    context.fillRect(0, 0, canvas.width, canvas.height)
    if (background) {
        const source = coverImageBox(background, canvas)
        context.drawImage(
            background,
            source.sourceX,
            source.sourceY,
            source.sourceWidth,
            source.sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height,
        )
    }

    const lightSurface = colorLuminance(theme.surface) > 0.5
    context.fillStyle = lightSurface ? 'rgba(255, 255, 255, 0.78)' : 'rgba(0, 0, 0, 0.58)'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const chartBox = {
        x:      98,
        y:      58,
        width:  canvas.width - 132,
        height: canvas.height - 118,
    }
    drawProfileAxes(context, profileData, chartBox, theme)
    profileData.datasets.forEach(dataset => drawProfileDataset(context, dataset, profileData, chartBox))

    return {
        dataUrl: canvas.toDataURL('image/png'),
        width:   canvas.width,
        height:  canvas.height,
        ratio:   canvas.width / canvas.height,
    }
}

export const profilePreviewElement = () => {
    if (typeof document === 'undefined') {
        return null
    }

    const chart = document.querySelector('#journey-profile-chart-in-settings')
    return chart?.closest?.('.editor-preview-zone') ?? chart
}

export const captureElementImage = async (element, {scale = 2} = {}) => {
    if (!element) {
        return null
    }

    const rect = element.getBoundingClientRect?.()
    if (!rect?.width || !rect?.height) {
        return null
    }

    try {
        await waitForAnimationFrames(2)
        const snapshot = await snapdom(element, {scale})
        const canvas = await snapshot.toCanvas()
        const dataUrl = canvas.toDataURL('image/png')

        return dataUrl ? {
            dataUrl,
            width:  canvas.width,
            height: canvas.height,
            ratio:  canvas.width / Math.max(canvas.height, 1),
        } : null
    }
    catch (error) {
        console.error(error)
        return null
    }
}

export const captureJourneyProfileImage = async ({journey, trackDrawings, backgroundSnapshot, theme}) => {
    const previewImage = await captureElementImage(profilePreviewElement())
    if (previewImage) {
        return previewImage
    }

    return createJourneyProfileImage({journey, trackDrawings, backgroundSnapshot, theme})
}
