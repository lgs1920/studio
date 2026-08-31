/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: shortcutsPdfReport.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-06
 * Last modified: 2026-05-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { jsPDF } from 'jspdf'
import {
    PAGE_MARGIN,
    PDF_COLORS,
    SECTION_GAP,
    STUDIO_NAME,
} from './constants'
import { plainText, setColor } from './format'
import { addFooter } from './pdfReport'

const DEFAULT_SHORTCUTS_PDF_FILENAME = 'LGS1920-shortcuts'
const DEFAULT_SHORTCUTS_PDF_TITLE = `${STUDIO_NAME} shortcuts`
const TABLE_PADDING = 2.3
const HEADER_HEIGHT = 8.4
const TEXT_LINE_HEIGHT = 4.7
const MIN_ROW_HEIGHT = 10.8
const KEY_HEIGHT = 6.2
const KEY_RADIUS = 1.35
const KEY_PADDING_X = 2.1
const KEY_GAP = 1.2
const COMBO_GAP = 1.6
const COMBO_LINE_GAP = 1.1
const KEY_FONT_SIZE = 8.2
const TEXT_FONT_SIZE = 8.9
const COLUMN_DEFS = [
    {key: 'keys', label: 'Shortcut', width: 0.29},
    {key: 'action', label: 'Action', width: 0.23},
    {key: 'description', label: 'Description', width: 0.34},
    {key: 'platform', label: 'Platform', width: 0.14},
]
const KEY_TOKEN_LABELS = {
    ArrowDown:  'Down',
    ArrowLeft:  'Left',
    ArrowRight: 'Right',
    ArrowUp:    'Up',
    Minus:      '-',
    Plus:       '+',
}

const ensurePdfExtension = fileName => {
    const normalized = `${fileName || DEFAULT_SHORTCUTS_PDF_FILENAME}`.trim()
    return /\.pdf$/i.test(normalized) ? normalized : `${normalized}.pdf`
}

const shortcutTokens = combo => `${combo ?? ''}`
    .split('+')
    .map(token => token.trim())
    .filter(Boolean)

const keyLabel = token => KEY_TOKEN_LABELS[token] ?? token

const createPalette = () => ({
    headerFill: PDF_COLORS.headerFill,
    keyBorder:  PDF_COLORS.line,
    keyFill:    PDF_COLORS.headerFill,
    line:       PDF_COLORS.line,
    muted:      PDF_COLORS.text,
    text:       PDF_COLORS.text,
})

const contentBottom = doc => doc.internal.pageSize.getHeight() - PAGE_MARGIN

const applyTextStyle = (doc, palette, {
    color = palette.text,
    size = TEXT_FONT_SIZE,
    style = 'normal',
} = {}) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    setColor(doc, 'setTextColor', color)
}

const ensureSpace = (doc, state, needed) => {
    if (state.y + needed <= contentBottom(doc)) {
        return false
    }

    addFooter(doc)
    doc.addPage()
    state.y = PAGE_MARGIN
    return true
}

const columnLayout = doc => {
    const tableWidth = doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2
    let x = PAGE_MARGIN

    return COLUMN_DEFS.map(column => {
        const layout = {
            ...column,
            width: tableWidth * column.width,
            x,
        }
        x += layout.width
        return layout
    })
}

const splitCellText = (doc, value, width, style = 'normal') => {
    applyTextStyle(doc, {text: PDF_COLORS.text}, {style, size: TEXT_FONT_SIZE})
    const text = plainText(value)
    return text ? doc.splitTextToSize(text, width) : []
}

const keyWidth = (doc, label) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(KEY_FONT_SIZE)
    return Math.max(KEY_HEIGHT, doc.getTextWidth(label) + KEY_PADDING_X * 2)
}

const measureCombo = (doc, combo, maxWidth) => {
    const tokens = shortcutTokens(combo)
    if (tokens.length === 0) {
        return KEY_HEIGHT
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(KEY_FONT_SIZE)
    const plusWidth = doc.getTextWidth('+')
    let lineWidth = 0
    let lines = 1

    tokens.forEach((token, index) => {
        const width = keyWidth(doc, keyLabel(token))
        const needed = index === 0 ? width : plusWidth + KEY_GAP * 2 + width
        if (lineWidth > 0 && lineWidth + needed > maxWidth) {
            lines += 1
            lineWidth = width
            return
        }
        lineWidth += needed
    })

    return lines * KEY_HEIGHT + (lines - 1) * COMBO_LINE_GAP
}

const measureKeyCombos = (doc, keys, maxWidth) => {
    const combos = keys?.length ? keys : ['']
    return combos.reduce((height, combo, index) => (
        height + measureCombo(doc, combo, maxWidth) + (index > 0 ? COMBO_GAP : 0)
    ), 0)
}

const drawKeyBadge = (doc, palette, label, x, y, width) => {
    setColor(doc, 'setFillColor', palette.keyFill)
    setColor(doc, 'setDrawColor', palette.keyBorder)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, y, width, KEY_HEIGHT, KEY_RADIUS, KEY_RADIUS, 'FD')

    applyTextStyle(doc, palette, {color: palette.text, size: KEY_FONT_SIZE})
    doc.text(label, x + width / 2, y + KEY_HEIGHT / 2, {
        align:    'center',
        baseline: 'middle',
    })
}

const drawCombo = (doc, palette, combo, x, y, maxWidth) => {
    const tokens = shortcutTokens(combo)
    if (tokens.length === 0) {
        return 0
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(KEY_FONT_SIZE)
    const plusWidth = doc.getTextWidth('+')
    let cursorX = x
    let cursorY = y
    let lineWidth = 0

    tokens.forEach((token, index) => {
        const label = keyLabel(token)
        const width = keyWidth(doc, label)
        const needed = index === 0 ? width : plusWidth + KEY_GAP * 2 + width
        if (lineWidth > 0 && lineWidth + needed > maxWidth) {
            cursorX = x
            cursorY += KEY_HEIGHT + COMBO_LINE_GAP
            lineWidth = 0
        }

        if (index > 0 && lineWidth > 0) {
            applyTextStyle(doc, palette, {color: palette.text, size: KEY_FONT_SIZE, style: 'bold'})
            doc.text('+', cursorX + plusWidth / 2, cursorY + KEY_HEIGHT / 2, {
                align:    'center',
                baseline: 'middle',
            })
            cursorX += plusWidth + KEY_GAP
            lineWidth += plusWidth + KEY_GAP
        }

        drawKeyBadge(doc, palette, label, cursorX, cursorY, width)
        cursorX += width + KEY_GAP
        lineWidth += width + KEY_GAP
    })

    return cursorY - y + KEY_HEIGHT
}

const drawKeyCombos = (doc, palette, keys, x, y, maxWidth) => {
    const combos = keys ?? []
    let cursorY = y
    combos.forEach((combo, index) => {
        if (index > 0) {
            cursorY += COMBO_GAP
        }
        cursorY += drawCombo(doc, palette, combo, x, cursorY, maxWidth)
    })
}

const drawHeader = (doc, state, palette, columns) => {
    columns.forEach(column => {
        setColor(doc, 'setFillColor', palette.headerFill)
        setColor(doc, 'setDrawColor', palette.line)
        doc.setLineWidth(0.2)
        doc.rect(column.x, state.y, column.width, HEADER_HEIGHT, 'FD')
        applyTextStyle(doc, palette, {color: palette.text, size: 9.6, style: 'bold'})
        doc.text(column.label, column.x + TABLE_PADDING, state.y + HEADER_HEIGHT / 2, {baseline: 'middle'})
    })
    state.y += HEADER_HEIGHT
}

const drawTitle = (doc, state, palette, title) => {
    const width = doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2
    const safeTitle = plainText(title || DEFAULT_SHORTCUTS_PDF_TITLE)
    applyTextStyle(doc, palette, {size: 22, style: 'bold'})
    const titleLines = doc.splitTextToSize(safeTitle, width)
    ensureSpace(doc, state, titleLines.length * 10 + 7)
    doc.text(titleLines, PAGE_MARGIN, state.y)
    state.y += titleLines.length * 10

    applyTextStyle(doc, palette, {color: palette.muted, size: 9})
    doc.text(`Proudly made with ${STUDIO_NAME}`, PAGE_MARGIN, state.y)
    state.y += 8
}

const drawSectionTitle = (doc, state, palette, title) => {
    ensureSpace(doc, state, 14)
    applyTextStyle(doc, palette, {size: 10.8, style: 'bold'})
    doc.text(plainText(title), PAGE_MARGIN, state.y)
    setColor(doc, 'setDrawColor', palette.line)
    doc.setLineWidth(0.25)
    doc.line(PAGE_MARGIN, state.y + 1.6, doc.internal.pageSize.getWidth() - PAGE_MARGIN, state.y + 1.6)
    state.y += 6.4
}

const rowMetrics = (doc, shortcut, columns) => {
    const availableWidth = column => column.width - TABLE_PADDING * 2
    const keyHeight = measureKeyCombos(doc, shortcut.keys, availableWidth(columns[0]))
    const actionLines = splitCellText(doc, shortcut.action, availableWidth(columns[1]), 'bold')
    const descriptionLines = splitCellText(doc, shortcut.description, availableWidth(columns[2]))
    const platformLines = splitCellText(doc, shortcut.platform ?? '', availableWidth(columns[3]))
    const rowHeight = Math.max(
        MIN_ROW_HEIGHT,
        keyHeight + TABLE_PADDING * 2,
        actionLines.length * TEXT_LINE_HEIGHT + TABLE_PADDING * 2,
        descriptionLines.length * TEXT_LINE_HEIGHT + TABLE_PADDING * 2,
        platformLines.length * TEXT_LINE_HEIGHT + TABLE_PADDING * 2,
    )

    return {actionLines, descriptionLines, platformLines, rowHeight}
}

const drawTextLines = (doc, palette, lines, x, y, {color = palette.text, style = 'normal'} = {}) => {
    if (lines.length === 0) {
        return
    }

    applyTextStyle(doc, palette, {color, style})
    doc.text(lines, x, y, {baseline: 'top'})
}

const drawRow = (doc, state, palette, columns, shortcut, metrics) => {
    columns.forEach(column => {
        setColor(doc, 'setDrawColor', palette.line)
        doc.setLineWidth(0.2)
        doc.rect(column.x, state.y, column.width, metrics.rowHeight)
    })

    const cellY = state.y + TABLE_PADDING
    drawKeyCombos(doc, palette, shortcut.keys, columns[0].x + TABLE_PADDING, cellY, columns[0].width - TABLE_PADDING * 2)
    drawTextLines(doc, palette, metrics.actionLines, columns[1].x + TABLE_PADDING, cellY, {style: 'bold'})
    drawTextLines(doc, palette, metrics.descriptionLines, columns[2].x + TABLE_PADDING, cellY)
    drawTextLines(doc, palette, metrics.platformLines, columns[3].x + TABLE_PADDING, cellY)

    state.y += metrics.rowHeight
}

const drawShortcutsTable = (doc, state, palette, shortcuts) => {
    if (!shortcuts?.length) {
        return
    }

    let columns = columnLayout(doc)
    ensureSpace(doc, state, HEADER_HEIGHT + MIN_ROW_HEIGHT)
    drawHeader(doc, state, palette, columns)

    shortcuts.forEach(shortcut => {
        let metrics = rowMetrics(doc, shortcut, columns)
        if (state.y + metrics.rowHeight > contentBottom(doc)) {
            addFooter(doc)
            doc.addPage()
            state.y = PAGE_MARGIN
            columns = columnLayout(doc)
            drawHeader(doc, state, palette, columns)
            metrics = rowMetrics(doc, shortcut, columns)
        }
        drawRow(doc, state, palette, columns, shortcut, metrics)
    })
}

export const exportShortcutsToPDF = (sections = [], {
    fileName = DEFAULT_SHORTCUTS_PDF_FILENAME,
    title = DEFAULT_SHORTCUTS_PDF_TITLE,
} = {}) => {
    const doc = new jsPDF({
        compress:    true,
        format:      'a4',
        orientation: 'portrait',
        unit:        'mm',
    })
    const palette = createPalette()
    const state = {y: PAGE_MARGIN}
    const normalizedFileName = ensurePdfExtension(fileName)

    doc.setProperties({
        subject: 'LGS1920 Studio keyboard shortcuts',
        title,
    })

    drawTitle(doc, state, palette, title)

    sections.forEach(({scope, shortcuts}) => {
        ensureSpace(doc, state, 14 + HEADER_HEIGHT + MIN_ROW_HEIGHT)
        drawSectionTitle(doc, state, palette, scope)
        drawShortcutsTable(doc, state, palette, shortcuts)
        state.y += SECTION_GAP
    })

    addFooter(doc)
    doc.save(normalizedFileName)

    return {
        fileName:      normalizedFileName,
        sectionCount:  sections.length,
        shortcutCount: sections.reduce((count, section) => count + section.shortcuts.length, 0),
    }
}
