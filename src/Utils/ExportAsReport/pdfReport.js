/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: pdfReport.js
 *
 ******************************************************************************/

import { jsPDF } from 'jspdf'
import { DateTime } from 'luxon'
import {
    CARDINAL_VIEWS,
    PAGE_MARGIN,
    PDF_COLORS,
    SECTION_GAP,
    STUDIO_CONTACT,
    STUDIO_SIGNATURE,
    STUDIO_NAME,
    STUDIO_URL,
    TABLE_BADGE_RADIUS,
    TEXT_LINE_HEIGHT,
} from './constants'
import * as ReportCredits from './credits'
import {
    cssColor,
    formatDateTimeParts,
    formatDuration,
    formatMetric,
    getExportTheme,
    parseCssColor,
    plainText,
    reportSubtitle,
    setColor,
} from './format'
import {
    DISTANCE_UNITS,
    ELEVATION_UNITS,
    PACE_UNITS,
    SPEED_UNITS,
} from '@Utils/UnitUtils'
import {
    canvasToDataUrl,
    drawInlineLinks,
    drawPDFIcon,
    drawStudioLogo,
    drawTextLink,
    loadDataUrlImage,
    loadPDFIcons,
    loadStudioLogo,
} from './assets'
import {
    fitImageToBox,
    scaleTrackInfoToBox,
} from './geometry'
import {
    formatPOIAltitude,
    formatPOIBadge,
    formatPOICoordinates,
    formatPOIName,
    getJourneyExportContent,
    getPOIBadgeColor,
    REPORT_RENDER_TRACK_POINT_LIMIT,
} from './journeyData'
import {
    build2DMapSVG,
    drawBadge,
    drawMapBorder,
    drawNorthArrow,
    drawProgressMarkers,
} from './mapRender'
import { captureJourneyProfileImage } from './profile'
import {
    captureJourney3DMapSnapshots,
    currentViewerSnapshot,
    withReportJourneyVisibility,
    yieldToUI,
} from './snapshots'

const PDF_IMAGE_MAX_WIDTH = 1800
const PDF_IMAGE_MAX_HEIGHT = 1200
const PDF_IMAGE_QUALITY = 0.86
const PDF_2D_MAP_IMAGE_WIDTH = 1200
const PDF_2D_MAP_IMAGE_HEIGHT = 760
const PDF_2D_MAP_IMAGE_QUALITY = 0.9

const PDF_2D_MAP_THEME = {
    surface: cssColor(PDF_COLORS.mapFill),
    line:    cssColor(PDF_COLORS.line),
    brand:   cssColor(PDF_COLORS.text),
    text:    cssColor(PDF_COLORS.text),
}

export const svgToDataUrl = svg => svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : ''

export const normalizeImageForPDF = async (image, options = {}) => {
    if (!image?.dataUrl || typeof document === 'undefined') {
        return image
    }

    const source = await loadDataUrlImage(image.dataUrl)
    if (!source) {
        return null
    }

    const maxWidth = options.maxWidth ?? PDF_IMAGE_MAX_WIDTH
    const maxHeight = options.maxHeight ?? PDF_IMAGE_MAX_HEIGHT
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height, 1)
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext?.('2d')
    if (!context) {
        return null
    }

    context.fillStyle = options.background ?? '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(source, 0, 0, width, height)
    const dataUrl = await canvasToDataUrl(canvas, 'image/jpeg', options.quality ?? PDF_IMAGE_QUALITY)
    if (!dataUrl) {
        return null
    }

    return {
        ...image,
        dataUrl,
        width,
        height,
        pdfFormat: 'JPEG',
    }
}

export const createPDF2DMapImages = async ({
    trackDrawings,
    pois,
    endpointMarkers,
    theme = PDF_2D_MAP_THEME,
} = {}) => {
    const mapImages = []

    for (const view of CARDINAL_VIEWS) {
        const svg = build2DMapSVG({
            view,
            trackDrawings,
            pois,
            endpointMarkers,
            theme,
        })

        if (!svg) {
            await yieldToUI()
            continue
        }

        const image = await normalizeImageForPDF({
            dataUrl: svgToDataUrl(svg),
            width:   PDF_2D_MAP_IMAGE_WIDTH,
            height:  PDF_2D_MAP_IMAGE_HEIGHT,
        }, {
            maxWidth:  PDF_2D_MAP_IMAGE_WIDTH,
            maxHeight: PDF_2D_MAP_IMAGE_HEIGHT,
            quality:   PDF_2D_MAP_IMAGE_QUALITY,
        })

        if (image) {
            mapImages.push({
                ...image,
                view,
            })
        }
        await yieldToUI()
    }

    return mapImages
}

export const addFooter = (doc) => {
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    setColor(doc, 'setTextColor', PDF_COLORS.muted)
    doc.text(
        `Created on ${DateTime.now().toLocaleString(DateTime.DATETIME_MED)} | Page ${doc.getCurrentPageInfo().pageNumber}`,
        PAGE_MARGIN,
        height - 6,
    )
    drawInlineLinks(doc, [
        {text: STUDIO_SIGNATURE, url: STUDIO_URL},
        {text: STUDIO_URL, url: STUDIO_URL},
        {text: STUDIO_CONTACT, url: `mailto:${STUDIO_CONTACT}`},
    ], width - PAGE_MARGIN, height - 6)
}

export const createTextWriter = (doc, studioLogo, icons = {}) => {
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    const brandColor = PDF_COLORS.text
    const textColor = PDF_COLORS.text
    const lineColor = PDF_COLORS.line
    const headerFillColor = PDF_COLORS.headerFill
    let y = PAGE_MARGIN

    const ensureSpace = needed => {
        if (y + needed <= height - PAGE_MARGIN) {
            return
        }
        addFooter(doc)
        doc.addPage()
        y = PAGE_MARGIN
    }

    const heading = text => {
        ensureSpace(12)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        setColor(doc, 'setTextColor', textColor)
        doc.text(text, PAGE_MARGIN, y)
        y += 7
    }

    const reportHeader = ({title, subtitle}) => {
        const safeTitle = plainText(title || 'Journey')
        const safeSubtitle = plainText(subtitle)
        const logoReservedWidth = 42
        const titleWidth = width - PAGE_MARGIN * 2 - logoReservedWidth
        const titleLines = doc.splitTextToSize(safeTitle, titleWidth)
        const subtitleLines = safeSubtitle ? doc.splitTextToSize(safeSubtitle, titleWidth) : []
        ensureSpace(titleLines.length * 10 + subtitleLines.length * 5.6 + 10)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(22)
        setColor(doc, 'setTextColor', textColor)
        doc.text(titleLines, PAGE_MARGIN, y)
        y += titleLines.length * 10

        if (subtitleLines.length > 0) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(11)
            setColor(doc, 'setTextColor', textColor)
            doc.text(subtitleLines, PAGE_MARGIN, y)
            y += subtitleLines.length * 5.6
        }

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        setColor(doc, 'setTextColor', PDF_COLORS.muted)
        const prefix = 'Proudly made with '
        doc.text(prefix, PAGE_MARGIN, y)
        drawTextLink(doc, STUDIO_NAME, PAGE_MARGIN + doc.getTextWidth(prefix), y, STUDIO_URL)
        y += 8
    }

    const subheading = text => {
        ensureSpace(9)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10.8)
        setColor(doc, 'setTextColor', textColor)
        doc.text(text, PAGE_MARGIN, y)
        setColor(doc, 'setDrawColor', lineColor)
        doc.setLineWidth(0.25)
        doc.line(PAGE_MARGIN, y + 1.6, width - PAGE_MARGIN, y + 1.6)
        y += 6.4
    }

    const paragraph = (text, {indent = 0} = {}) => {
        const content = plainText(text)
        if (!content) {
            return
        }
        const lines = doc.splitTextToSize(content, width - PAGE_MARGIN * 2 - indent)
        ensureSpace(lines.length * TEXT_LINE_HEIGHT + 1)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.4)
        setColor(doc, 'setTextColor', textColor)
        doc.text(lines, PAGE_MARGIN + indent, y)
        y += lines.length * TEXT_LINE_HEIGHT + 2
    }

    const row = (label, value, {url = null} = {}) => {
        if (value === undefined || value === null || value === '') {
            return
        }
        ensureSpace(TEXT_LINE_HEIGHT + 1)
        doc.setFontSize(9.4)
        doc.setFont('helvetica', 'bold')
        setColor(doc, 'setTextColor', brandColor)
        doc.text(`${label}:`, PAGE_MARGIN, y)
        doc.setFont('helvetica', 'normal')
        setColor(doc, 'setTextColor', textColor)
        if (url) {
            drawTextLink(doc, `${value}`, PAGE_MARGIN + 42, y, url)
        }
        else {
            doc.text(`${value}`, PAGE_MARGIN + 42, y)
        }
        y += TEXT_LINE_HEIGHT
    }

    const summaryRows = (rows, {profileImage = null} = {}) => {
        const data = rows.filter(row => row?.label && row.value !== undefined && row.value !== null && row.value !== '')
        if (data.length === 0 && !profileImage?.dataUrl) {
            return
        }

        const gutter = 7
        const fullWidth = width - PAGE_MARGIN * 2
        const leftWidth = profileImage?.dataUrl ? (fullWidth - gutter) / 2 : fullWidth
        const rightWidth = profileImage?.dataUrl ? (fullWidth - gutter) / 2 : 0
        const rowHeight = 8.5
        const profileHeight = profileImage?.dataUrl ? Math.min(rightWidth / profileImage.ratio, data.length * rowHeight + 12) : 0
        const blockHeight = Math.max(data.length * rowHeight, profileHeight)
        ensureSpace(blockHeight + 3)

        data.forEach((item, index) => {
            const rowY = y + index * rowHeight
            setColor(doc, 'setDrawColor', lineColor)
            doc.setLineWidth(0.2)
            doc.rect(PAGE_MARGIN, rowY, leftWidth, rowHeight)

            const iconX = PAGE_MARGIN + 2.1
            const iconSize = 4.5
            const iconY = rowY + (rowHeight - iconSize) / 2
            const labelX = drawPDFIcon(doc, icons, item.icon, iconX, iconY, iconSize) ? iconX + 6.2 : iconX
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9.6)
            setColor(doc, 'setTextColor', textColor)
            doc.text(`${item.label}:`, labelX, rowY + rowHeight / 2, {baseline: 'middle'})

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9.6)
            setColor(doc, 'setTextColor', textColor)
            const valueX = PAGE_MARGIN + Math.min(42, leftWidth * 0.39)
            const lines = doc.splitTextToSize(`${item.value}`, leftWidth - (valueX - PAGE_MARGIN) - 3)
            doc.text(lines.slice(0, 2), valueX, rowY + rowHeight / 2, {baseline: 'middle'})
        })

        if (profileImage?.dataUrl) {
            const imageBox = fitImageToBox(profileImage, {
                x:      PAGE_MARGIN + leftWidth + gutter,
                y,
                width:  rightWidth,
                height: blockHeight,
            })
            doc.addImage(profileImage.dataUrl, profileImage.pdfFormat ?? 'PNG', imageBox.x, imageBox.y, imageBox.width, imageBox.height)
            setColor(doc, 'setDrawColor', lineColor)
            doc.setLineWidth(0.25)
            doc.roundedRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height, 1.4, 1.4, 'S')
        }

        y += blockHeight + 3
    }

    const table = (rows, {columns = 2} = {}) => {
        const data = rows.filter(row => row?.label && row.value !== undefined && row.value !== null && row.value !== '')
        if (data.length === 0) {
            return
        }

        const tableWidth = width - PAGE_MARGIN * 2
        const columnWidth = tableWidth / columns
        const labelWidth = columnWidth * 0.46
        const rowHeight = 8.2

        for (let index = 0; index < data.length; index += columns) {
            ensureSpace(rowHeight)
            data.slice(index, index + columns).forEach((cell, columnIndex) => {
                const x = PAGE_MARGIN + columnIndex * columnWidth
                setColor(doc, 'setDrawColor', lineColor)
                doc.setLineWidth(0.2)
                doc.rect(x, y, columnWidth, rowHeight)
                doc.line(x + labelWidth, y, x + labelWidth, y + rowHeight)
                doc.setFontSize(9.2)
                doc.setFont('helvetica', 'bold')
                setColor(doc, 'setTextColor', brandColor)
                doc.text(cell.label, x + 2, y + 5.3)
                doc.setFont('helvetica', 'normal')
                setColor(doc, 'setTextColor', textColor)
                doc.text(`${cell.value}`, x + labelWidth + 2, y + 5.3)
            })
            y += rowHeight
        }
        y += 2
    }

    const dataTable = (rows, columns) => {
        const data = rows.filter(Boolean)
        if (data.length === 0 || columns.length === 0) {
            return
        }

        const tableWidth = width - PAGE_MARGIN * 2
        const headerHeight = 8.4
        const lineHeight = 4.7
        const padding = 2.4
        const columnWidths = columns.map(column => tableWidth * column.width)
        const ensureTableSpace = needed => {
            if (y + needed <= height - PAGE_MARGIN) {
                return false
            }
            addFooter(doc)
            doc.addPage()
            y = PAGE_MARGIN
            return true
        }
        const drawHeader = () => {
            ensureTableSpace(headerHeight)
            let x = PAGE_MARGIN
            columns.forEach((column, index) => {
                setColor(doc, 'setFillColor', headerFillColor)
                setColor(doc, 'setDrawColor', lineColor)
                doc.setLineWidth(0.2)
                doc.rect(x, y, columnWidths[index], headerHeight, 'FD')
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(9.8)
                setColor(doc, 'setTextColor', brandColor)
                if (column.icon === 'mountains') {
                    const iconDrawn = drawPDFIcon(doc, icons, 'mountains', x + padding, y + 2.25, 3.9)
                    doc.text(column.label, x + padding + (iconDrawn ? 5.8 : 0), y + headerHeight / 2, {baseline: 'middle'})
                }
                else {
                    doc.text(column.label, x + padding, y + headerHeight / 2, {baseline: 'middle'})
                }
                x += columnWidths[index]
            })
            y += headerHeight
        }

        drawHeader()
        data.forEach(row => {
            const cells = columns.map((column, index) => {
                if (column.type === 'badge') {
                    return {
                        badge: row[column.key],
                        color: row[column.colorKey ?? `${column.key}Color`] ?? [34, 91, 155],
                        lines: [],
                    }
                }

                const value = plainText(row[column.key])
                return {
                    lines: doc.splitTextToSize(value, columnWidths[index] - padding * 2),
                }
            })
            const rowHeight = Math.max(10.5, ...cells.map(cell => cell.lines.length * lineHeight + padding * 2))
            if (ensureTableSpace(rowHeight + headerHeight)) {
                drawHeader()
            }

            let x = PAGE_MARGIN
            cells.forEach((lines, index) => {
                setColor(doc, 'setDrawColor', lineColor)
                doc.setLineWidth(0.2)
                doc.rect(x, y, columnWidths[index], rowHeight)
                if (columns[index].type === 'badge' && lines.badge) {
                    drawBadge(doc, {
                        x:      x + columnWidths[index] / 2,
                        y:      y + rowHeight / 2,
                        label:  `${lines.badge}`,
                        color:  lines.color,
                        radius: columns[index].radius ?? TABLE_BADGE_RADIUS,
                    })
                }
                else {
                    doc.setFont('helvetica', 'normal')
                    doc.setFontSize(9)
                    setColor(doc, 'setTextColor', textColor)
                    doc.text(lines.lines.length ? lines.lines : [''], x + padding, y + padding, {baseline: 'top'})
                }
                x += columnWidths[index]
            })
            y += rowHeight
        })
        y += 2
    }

    const gap = (size = SECTION_GAP) => {
        y += size
    }

    return {heading, reportHeader, subheading, paragraph, row, summaryRows, table, dataTable, gap, footer: () => addFooter(doc)}
}

export const drawOverviewPage = (doc, journey, mapImages, studioLogo, {addPage = false} = {}) => {
    if (addPage) {
        doc.addPage()
    }

    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    const title = journey?.title || 'Journey'
    const imageByLabel = new Map((mapImages ?? []).map(image => [image.view?.label, image]))

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    setColor(doc, 'setTextColor', PDF_COLORS.text)
    doc.text(title, PAGE_MARGIN, 13)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setColor(doc, 'setTextColor', PDF_COLORS.text)
    doc.text('2D', PAGE_MARGIN, 18)

    drawStudioLogo(doc, studioLogo, {
        x:     width - PAGE_MARGIN - 34,
        y:     6,
        width: 34,
    })

    const gutter = 5
    const top = 24
    const boxWidth = (width - PAGE_MARGIN * 2 - gutter) / 2
    const boxHeight = (height - top - PAGE_MARGIN - gutter) / 2

    CARDINAL_VIEWS.forEach((view, index) => {
        const column = index % 2
        const row = Math.floor(index / 2)
        const box = {
            x:      PAGE_MARGIN + column * (boxWidth + gutter),
            y:      top + row * (boxHeight + gutter),
            width:  boxWidth,
            height: boxHeight,
        }
        const mapImage = imageByLabel.get(view.label) ?? mapImages?.[index]

        if (!mapImage?.dataUrl) {
            drawMapBorder(doc, box)
            return
        }

        const imageBox = fitImageToBox(mapImage, box)
        doc.addImage(
            mapImage.dataUrl,
            mapImage.pdfFormat ?? 'JPEG',
            imageBox.x,
            imageBox.y,
            imageBox.width,
            imageBox.height,
            undefined,
            'FAST',
        )
    })

    addFooter(doc)
}

export const draw3DMapPage = (doc, journey, mapSnapshot, studioLogo, {addPage = true, icons = {}, brandColor = PDF_COLORS.text} = {}) => {
    if (!mapSnapshot?.dataUrl) {
        return
    }

    if (addPage) {
        doc.addPage()
    }
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    const title = journey?.title || 'Journey'
    const view = mapSnapshot.view
    const viewTitle = view?.label ?? '3D'

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    setColor(doc, 'setTextColor', PDF_COLORS.text)
    doc.text(title, PAGE_MARGIN, 13)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setColor(doc, 'setTextColor', PDF_COLORS.text)
    doc.text(viewTitle, PAGE_MARGIN, 18)
    drawStudioLogo(doc, studioLogo, {
        x:     width - PAGE_MARGIN - 34,
        y:     6,
        width: 34,
    })

    const box = {
        x:      PAGE_MARGIN,
        y:      24,
        width:  width - PAGE_MARGIN * 2,
        height: height - PAGE_MARGIN - 30,
    }
    const imageBox = fitImageToBox(mapSnapshot, {
        x:      box.x + 2,
        y:      box.y + 2,
        width:  box.width - 4,
        height: box.height - 4,
    })
    doc.addImage(mapSnapshot.dataUrl, mapSnapshot.pdfFormat ?? 'PNG', imageBox.x, imageBox.y, imageBox.width, imageBox.height)
    drawMapBorder(doc, box)
    drawNorthArrow(doc, {
        box,
        rotation: view?.heading ?? 0,
        icons,
        iconKey:  'northBrand',
        color:    brandColor,
    })
    drawProgressMarkers(doc, {
        trackInfo: scaleTrackInfoToBox(mapSnapshot.trackInfo, mapSnapshot, imageBox),
        container: imageBox,
        icons,
        iconKey:   'progressBrand',
    })
    addFooter(doc)
}

export const addJourneyDetails = (doc, journey, pois, studioLogo, {profileImage = null, icons = {}, addPage = true} = {}) => {
    if (addPage) {
        doc.addPage()
    }
    drawStudioLogo(doc, studioLogo, {
        x:     doc.internal.pageSize.getWidth() - PAGE_MARGIN - 30,
        y:     8,
        width: 30,
    })
    const writer = createTextWriter(doc, studioLogo, icons)
    const {metrics} = journey.getMetrics()
    const dateTime = formatDateTimeParts(journey.getDate())

    writer.reportHeader({
        title:    journey.title || 'Journey',
        subtitle: reportSubtitle(journey),
    })
    writer.summaryRows([
        {label: 'Location', value: journey.location, icon: 'location'},
        {label: 'Date', value: dateTime.date, icon: 'date'},
        {label: 'Time', value: dateTime.time, icon: 'time'},
        {label: 'Activity', value: journey.activitySettings?.label ?? journey.activity, icon: 'activity'},
        {label: 'Tracks', value: journey.tracks?.size ?? 0, icon: 'route'},
        {label: 'POIs', value: pois.length, icon: 'location'},
    ], {profileImage})

    writer.gap()
    writer.subheading('Stats')
    writer.table([
        {label: 'Distance', value: formatMetric(metrics.distance, {units: DISTANCE_UNITS})},
        {label: 'Duration', value: formatDuration(metrics.duration)},
        {label: 'Moving time', value: formatDuration(metrics.duration - metrics.idleTime)},
        {label: 'Idle time', value: formatDuration(metrics.idleTime)},
        {label: 'Elevation +', value: formatMetric(metrics.positive?.elevation, {units: ELEVATION_UNITS, format: '%d'})},
        {label: 'Elevation -', value: formatMetric(metrics.negative?.elevation, {units: ELEVATION_UNITS, format: '%d'})},
        {label: 'Min altitude', value: formatMetric(metrics.minHeight, {units: ELEVATION_UNITS, format: '%d'})},
        {label: 'Max altitude', value: formatMetric(metrics.maxHeight, {units: ELEVATION_UNITS, format: '%d'})},
        {label: 'Average speed', value: formatMetric(metrics.averageSpeed, {units: SPEED_UNITS})},
        {label: 'Max speed', value: formatMetric(metrics.maxSpeed, {units: SPEED_UNITS})},
        {label: 'Average pace', value: formatMetric(metrics.averagePace, {units: PACE_UNITS})},
        {label: 'Best pace', value: formatMetric(metrics.minPace, {units: PACE_UNITS})},
    ])

    const description = plainText(journey.description)
    if (description) {
        writer.gap()
        writer.subheading('Description')
        writer.paragraph(description)
    }

    const tracks = Array.from(journey.tracks?.values?.() ?? [])
    if (tracks.length > 0) {
        writer.gap()
        writer.subheading('Tracks')
        tracks.forEach((track, index) => {
            const trackMetrics = track.metrics?.global ?? {}
            writer.row(`${index + 1}. ${track.title || 'Track'}`, formatMetric(trackMetrics.distance, {units: DISTANCE_UNITS}))
            if (plainText(track.description)) {
                writer.paragraph(track.description, {indent: 6})
            }
        })
    }

    if (pois.length > 0) {
        writer.gap()
        writer.subheading('POIs')
        writer.dataTable(
            pois.map(poi => ({
                badge:       formatPOIBadge(poi),
                badgeColor:  getPOIBadgeColor(poi),
                name:        formatPOIName(poi),
                coordinates: formatPOICoordinates(poi),
                altitude:    formatPOIAltitude(poi),
                description: plainText(poi.description),
            })),
            [
                {key: 'badge', label: 'POI', width: 0.09, type: 'badge'},
                {key: 'name', label: 'Name', width: 0.20},
                {key: 'coordinates', label: 'Coordinates (lat,long)', width: 0.23},
                {key: 'altitude', label: 'Altitude', width: 0.14, icon: 'mountains'},
                {key: 'description', label: 'Description', width: 0.34},
            ],
        )
    }

    writer.footer()
}

export const addReportCredits = (doc, studioLogo, {credits = []} = {}) => {
    doc.addPage()
    drawStudioLogo(doc, studioLogo, {
        x:     doc.internal.pageSize.getWidth() - PAGE_MARGIN - 30,
        y:     8,
        width: 30,
    })

    const writer = createTextWriter(doc, studioLogo)
    writer.heading('Credits')
    credits.filter(ReportCredits.isReportCreditVisible).forEach(credit => {
        writer.row(credit.label, ReportCredits.creditTextSource(credit.text), {url: credit.url})
    })
    writer.footer()
}

export const exportJourneyToPDF = async (journey, {
    pois = undefined,
    fileName = 'journey.pdf',
    onReportStage = null,
} = {}) => {
    const setReportStage = stage => {
        try {
            onReportStage?.(stage)
        }
        catch (error) {
            console.error(error)
        }
    }
    const {
              trackDrawings,
              endpointMarkers,
              exportablePois,
              listedPois,
          } = getJourneyExportContent(journey, pois, {
        trackDrawingOptions: {maxTotalPoints: REPORT_RENDER_TRACK_POINT_LIMIT},
    })

    if (trackDrawings.length === 0) {
        throw new Error('No track geometry to export.')
    }

    const theme = getExportTheme()
    const brandColor = parseCssColor(theme.brand, PDF_COLORS.text)
    const studioLogoPromise = loadStudioLogo()
    const pdfIconsPromise = loadPDFIcons(theme, {
        trackColors: [
            ...trackDrawings.map(({color}) => color),
            PDF_COLORS.trace,
        ],
    })
    const {profileImage, mapSnapshots} = await withReportJourneyVisibility(journey, async () => {
        const viewerSnapshot = await currentViewerSnapshot()
        await yieldToUI()
        const profileImagePromise = captureJourneyProfileImage({
                                                                                                                  journey,
                                                                                                                  trackDrawings,
                                                                                                                  backgroundSnapshot: viewerSnapshot,
                                                                                                                  theme,
                                                                                                              })
        const mapSnapshotsPromise = captureJourney3DMapSnapshots(journey, {
            trackDrawings,
            onSnapshotFlash: ({index}) => setReportStage({
                stage: 'snapshots',
                id:    `snapshot-${index}-${Date.now()}`,
            }),
        })
            .finally(() => setReportStage('writing'))
        const [profileImage, mapSnapshots] = await Promise.all([
                                                                    profileImagePromise,
                                                                    mapSnapshotsPromise,
                                                                ])
        return {profileImage, mapSnapshots}
    })
    const [studioLogo, pdfIcons] = await Promise.all([
        studioLogoPromise,
        pdfIconsPromise,
    ])
    const reportCredits = ReportCredits.getReportCredits()
    const [pdfProfileImage, pdfMapSnapshots] = await Promise.all([
                                                                     normalizeImageForPDF(profileImage, {maxWidth: 1400, maxHeight: 800}),
                                                                     Promise.all(mapSnapshots.map(snapshot => normalizeImageForPDF(snapshot))),
                                                                 ])
    const exportableMapSnapshots = pdfMapSnapshots.filter(Boolean)
    const pdf2DMapImages = await createPDF2DMapImages({
        trackDrawings,
        pois: exportablePois,
        endpointMarkers,
    })

    await yieldToUI()
    const doc = new jsPDF({
                              orientation: 'landscape',
                              unit:        'mm',
                              format:      'a4',
                          })

    addJourneyDetails(doc, journey, listedPois, studioLogo, {profileImage: pdfProfileImage, icons: pdfIcons, addPage: false})
    await yieldToUI()
    drawOverviewPage(doc, journey, pdf2DMapImages, studioLogo, {
        addPage: true,
    })
    await yieldToUI()
    if (exportableMapSnapshots.length > 0) {
        for (const mapSnapshot of exportableMapSnapshots) {
            draw3DMapPage(doc, journey, mapSnapshot, studioLogo, {
                addPage: true,
                icons:   pdfIcons,
                brandColor,
            })
            await yieldToUI()
        }
    }
    addReportCredits(doc, studioLogo, {credits: reportCredits})
    await yieldToUI()
    doc.save(fileName)

    return {
        fileName,
        poiCount: listedPois.length,
        has3DMapSnapshot: exportableMapSnapshots.length > 0,
        mapSnapshotCount: exportableMapSnapshots.length,
    }
}
