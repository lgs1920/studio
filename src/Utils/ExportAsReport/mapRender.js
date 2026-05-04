/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: mapRender.js
 *
 ******************************************************************************/

import {
    ENDPOINT_BADGE_RADIUS,
    MAP_ICON_DEFS,
    MAP_STROKE_WIDTH,
    PDF_COLORS,
    POI_BADGE_RADIUS,
} from './constants'
import {
    cssColor,
    escapeHtml,
    finiteNumber,
    normalizeColor,
    setColor,
} from './format'
import {
    createProjection,
    directionPoint,
    getBounds,
    getProjectedTrackInfo,
    pdfRotationFromScreenAngle,
    progressMarkerPlacements,
    svgNumber,
    svgRotationFromScreenAngle,
} from './geometry'
import {
    coordinateFromPOI,
    getPOIBadgeColor,
    getReferencePoints,
} from './journeyData'
import {
    drawPDFIcon,
    fontAwesomePositionedSVG,
} from './assets'
import { yieldToUI } from './snapshots'

const PDF_MAP_YIELD_LINE_INTERVAL = 2500

export const drawBadge = (doc, {x, y, label, color, radius = POI_BADGE_RADIUS}) => {
    setColor(doc, 'setFillColor', color)
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.45)
    doc.circle(x, y, radius, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(Math.min(radius * (label.length > 2 ? 1.55 : 1.9), 7))
    doc.setTextColor(255, 255, 255)
    doc.text(label, x, y, {align: 'center', baseline: 'middle'})
}

export const drawMapFrame = (doc, box) => {
    setColor(doc, 'setDrawColor', PDF_COLORS.line)
    setColor(doc, 'setFillColor', PDF_COLORS.mapFill)
    doc.setLineWidth(0.25)
    doc.roundedRect(box.x, box.y, box.width, box.height, 1.4, 1.4, 'FD')
}

export const drawMapBorder = (doc, box) => {
    setColor(doc, 'setDrawColor', PDF_COLORS.line)
    doc.setLineWidth(0.25)
    doc.roundedRect(box.x, box.y, box.width, box.height, 1.4, 1.4, 'S')
}

export const drawNorthArrow = (doc, {box, rotation, icons, iconKey = 'northBlack', color = PDF_COLORS.text}) => {
    const center = {
        x: box.x + box.width - 24,
        y: box.y + box.height / 3,
    }
    const northRotation = finiteNumber(rotation) ?? 0
    const arrowColor = normalizeColor(color, PDF_COLORS.text)
    const iconSize = 8
    const tip = directionPoint(center, northRotation, iconSize / 2)
    const rotationValue = pdfRotationFromScreenAngle(northRotation, 90)
    drawPDFIcon(doc, icons, iconKey, center.x - iconSize / 2, center.y - iconSize / 2, iconSize, {rotation: rotationValue})

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.2)
    const labelWidth = doc.getTextWidth('N')
    const label = directionPoint(tip, northRotation, labelWidth)
    setColor(doc, 'setTextColor', arrowColor)
    doc.text('N', label.x, label.y, {align: 'center', baseline: 'middle'})
}

export const drawProgressMarkers = (doc, {trackInfo, container, icons, iconKey = 'progressBlack'}) => {
    const size = 4.3
    const positions = progressMarkerPlacements({
                                                 trackInfo,
                                                 container,
                                                 size,
                                                 gap: 2,
                                             })

    positions.forEach(position => {
        drawPDFIcon(doc, icons, iconKey, position.x, position.y, size, {rotation: pdfRotationFromScreenAngle(position.angle)})
    })
}

export const drawCreditsOverlay = (doc, {imageBox, overlayImage}) => {
    if (!overlayImage?.dataUrl || !overlayImage.width || !overlayImage.height) {
        return
    }

    const maxWidth = imageBox.width * 0.42
    const maxHeight = imageBox.height * 0.12
    const ratio = overlayImage.width / overlayImage.height
    let width = Math.min(maxWidth, overlayImage.width / 8)
    let height = width / ratio
    if (height > maxHeight) {
        height = maxHeight
        width = height * ratio
    }

    try {
        doc.addImage(
            overlayImage.dataUrl,
            'PNG',
            imageBox.x + imageBox.width - width - 2,
            imageBox.y + imageBox.height - height - 2,
            width,
            height,
            undefined,
            'FAST',
        )
    }
    catch (error) {
        console.error(error)
    }
}

export const drawMapPanel = async (doc, {box, view, bounds, trackDrawings, pois, endpointMarkers, referencePoints, icons}) => {
    drawMapFrame(doc, box)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setColor(doc, 'setTextColor', PDF_COLORS.text)
    doc.text(view.label, box.x + 4, box.y + 6)
    drawNorthArrow(doc, {box, rotation: view.rotation, icons, iconKey: 'northBlack', color: PDF_COLORS.text})

    const innerBox = {
        x:      box.x + 7,
        y:      box.y + 14,
        width:  box.width - 14,
        height: box.height - 21,
    }
    const project = createProjection({
                                         bounds,
                                         points: referencePoints,
                                         box:    innerBox,
                                         rotation: view.rotation,
                                     })
    const trackInfo = getProjectedTrackInfo(trackDrawings, project)

    let drawnLineCount = 0
    for (const {segments, color} of trackDrawings) {
        setColor(doc, 'setDrawColor', color)
        doc.setLineWidth(MAP_STROKE_WIDTH)
        for (const segment of segments) {
            for (let index = 1; index < segment.length; index++) {
                const point = segment[index]
                const previous = project(segment[index - 1])
                const current = project(point)
                doc.line(previous.x, previous.y, current.x, current.y)
                drawnLineCount++
                if (drawnLineCount % PDF_MAP_YIELD_LINE_INTERVAL === 0) {
                    await yieldToUI()
                }
            }
        }
    }
    drawProgressMarkers(doc, {trackInfo, container: innerBox, icons, iconKey: 'progressBlack'})

    pois.forEach(poi => {
        const poiPoint = coordinateFromPOI(poi)
        if (!poiPoint) {
            return
        }

        drawBadge(doc, {
            ...project(poiPoint),
            label: `${poi.pdfNumber}`,
            color: getPOIBadgeColor(poi),
        })
    })

    endpointMarkers.forEach(marker => {
        const markerPoint = coordinateFromPOI(marker)
        if (!markerPoint) {
            return
        }

        drawBadge(doc, {
            ...project(markerPoint),
            label:  marker.label,
            color:  getPOIBadgeColor(marker),
            radius: ENDPOINT_BADGE_RADIUS,
        })
    })
}


export const buildSVGNorthArrow = ({box, rotation}) => {
    const center = {
        x: box.x + box.width - 118,
        y: box.y + box.height / 3,
    }
    const iconWidth = 78
    const iconHeight = 29
    const tip = directionPoint(center, rotation, iconWidth / 2)
    const label = directionPoint(tip, rotation, 23)
    const icon = fontAwesomePositionedSVG({
                                              iconDefinition: MAP_ICON_DEFS.north,
                                              className:      'north-arrow-icon',
                                              x:              center.x - iconWidth / 2,
                                              y:              center.y - iconHeight / 2,
                                              width:          iconWidth,
                                              height:         iconHeight,
                                              color:          '#000000',
                                              rotation:       svgRotationFromScreenAngle(rotation, 90),
                                          })

    return `
        <g class="north-arrow">
            ${icon}
            <text x="${svgNumber(label.x)}" y="${svgNumber(label.y)}" text-anchor="middle" dominant-baseline="central">N</text>
        </g>`
}

export const buildSVGProgressMarkers = ({trackInfo, container}) => {
    const size = 28
    const positions = progressMarkerPlacements({
                                                 trackInfo,
                                                 container,
                                                 size,
                                                 gap: 10,
                                             })

    return positions.map(position => fontAwesomePositionedSVG({
                                                                  iconDefinition: MAP_ICON_DEFS.progress,
                                                                  className:      'progress-marker',
                                                                  x:              position.x,
                                                                  y:              position.y,
                                                                  width:          size,
                                                                  height:         size,
                                                                  color:          '#000000',
                                                                  rotation:       svgRotationFromScreenAngle(position.angle),
                                                              })).join('')
}

export const buildSVGBadge = ({point, label, color, radius}) => `
        <g class="badge">
            <circle cx="${svgNumber(point.x)}" cy="${svgNumber(point.y)}" r="${radius}" fill="${cssColor(color)}"/>
            <text x="${svgNumber(point.x)}" y="${svgNumber(point.y)}" text-anchor="middle" dominant-baseline="central">${escapeHtml(label)}</text>
        </g>`

export const build2DMapSVG = ({view, trackDrawings, pois, endpointMarkers, theme}) => {
    const width = 1200
    const height = 760
    const box = {
        x:      34,
        y:      34,
        width:  width - 68,
        height: height - 68,
    }
    const innerBox = {
        x:      box.x + 58,
        y:      box.y + 98,
        width:  box.width - 116,
        height: box.height - 146,
    }
    const referencePoints = getReferencePoints(trackDrawings, pois, endpointMarkers)
    if (referencePoints.length === 0) {
        return ''
    }

    const bounds = getBounds(referencePoints)
    const project = createProjection({
                                         bounds,
                                         points: referencePoints,
                                         box:    innerBox,
                                         rotation: view.rotation,
                                     })
    const trackLines = trackDrawings.flatMap(({segments, color}) => segments.map(segment => {
        const points = segment.map(point => {
            const projected = project(point)
            return `${svgNumber(projected.x)},${svgNumber(projected.y)}`
        }).join(' ')

        return `<polyline points="${points}" stroke="${cssColor(color)}"/>`
    })).join('\n')
    const trackInfo = getProjectedTrackInfo(trackDrawings, project)
    const progressMarkers = buildSVGProgressMarkers({trackInfo, container: innerBox})
    const poiBadges = pois.map(poi => {
        const point = coordinateFromPOI(poi)
        return point ? buildSVGBadge({
            point:  project(point),
            label:  `${poi.pdfNumber}`,
            color:  getPOIBadgeColor(poi),
            radius: 18,
        }) : ''
    }).join('')
    const endpointBadges = endpointMarkers.map(marker => {
        const point = coordinateFromPOI(marker)
        return point ? buildSVGBadge({
            point:  project(point),
            label:  marker.label,
            color:  getPOIBadgeColor(marker),
            radius: 17,
        }) : ''
    }).join('')

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <style>
        .frame { fill: ${theme.surface}; stroke: ${theme.line}; stroke-width: 2; }
        .title { fill: ${theme.brand}; font: 700 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        polyline { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 8; }
        .badge circle { stroke: #fff; stroke-width: 3; }
        .badge text { fill: #fff; font: 700 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .north-arrow-icon, .progress-marker { overflow: visible; }
        .north-arrow text { fill: #000; font: 800 36px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    </style>
    <rect class="frame" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="14"/>
    <text class="title" x="${box.x + 34}" y="${box.y + 52}">${escapeHtml(view.label)}</text>
    ${buildSVGNorthArrow({box, rotation: view.rotation})}
    <g>${trackLines}</g>
    <g>${progressMarkers}</g>
    <g>${poiBadges}</g>
    <g>${endpointBadges}</g>
</svg>`
}
