/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: format.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MILLIS } from '@Core/constants'
import { PDF_COLORS } from './constants'
import {
    UnitUtils,
} from '@Utils/UnitUtils'
import { decodeHTMLEntities } from '@Utils/TextUtils'
import { formatTimestampInTimeZone } from '@Utils/TimeZoneUtils'

export const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

export const plainText = value => decodeHTMLEntities(`${value ?? ''}`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const formatMetric = (value, options = {}) => {
    const number = finiteNumber(value)
    if (number === null) {
        return ''
    }

    return UnitUtils.formatMetric(number, options).full
}

export const formatDuration = seconds => {
    const number = finiteNumber(seconds)
    return number === null ? '' : UnitUtils.convert(number * MILLIS).toTime(false)
}

export const formatCoordinate = value => {
    const number = finiteNumber(value)
    if (number === null) {
        return ''
    }

    const coordinateSystem = globalThis.lgs?.settings?.coordinateSystem?.current
    return coordinateSystem ? UnitUtils.convert(number).to(coordinateSystem) : number.toFixed(6)
}

/** Formats journey report timestamps in UTC without applying the interactive display zone. */
const formatJourneyDateTimes = ({start, stop} = {}) => {
    if (!start && !stop) {
        return []
    }

    return [start, stop]
        .filter(Boolean)
        .map(value => formatTimestampInTimeZone(value, 'UTC', {includeTimeZone: true}))
        .filter(Boolean)
}

/** Formats a journey's start and stop timestamps for an exported report in UTC. */
export const formatDateTimeParts = data => {
    const [first, second = first] = formatJourneyDateTimes(data)
    if (!first) {
        return {date: '', time: ''}
    }

    const firstDay = first.date
    const secondDay = second.date
    const firstTime = first.time
    const secondTime = second.time
    const sameDay = firstDay === secondDay
    const sameTime = firstTime === secondTime

    return {
        date: sameDay ? firstDay : `${firstDay} - ${secondDay}`,
        time: sameTime ? firstTime : `${firstTime} - ${secondTime}`,
    }
}

export const splitDisplayRange = value => plainText(value)
    .split(/\s+-\s+/)
    .map(part => part.trim())
    .filter(Boolean)

export const reportLocationPhrase = journey => {
    const parts = splitDisplayRange(journey?.location)
    if (parts.length === 0) {
        return ''
    }

    const first = parts[0]
    const last = parts[parts.length - 1]
    return first && last && first !== last ? `from ${first} to ${last}` : `at ${first}`
}

/** Returns UTC calendar-date labels for an exported journey report. */
export const journeyDateLabels = journey => {
    const [first, second = first] = formatJourneyDateTimes(journey?.getDate?.())
    if (!first) {
        return []
    }

    return first.date === second.date ? [first.date] : [first.date, second.date]
}

/** Builds the exported report's date phrase using UTC dates. */
export const reportDatePhrase = journey => {
    const dates = journeyDateLabels(journey)
    if (dates.length === 0) {
        return ''
    }

    return dates.length === 1 ? `on ${dates[0]}` : `from ${dates[0]} to ${dates[1]}`
}

/** Builds an exported report subtitle while keeping its journey date in UTC. */
export const reportSubtitle = journey => {
    const activity = plainText(journey?.activitySettings?.label ?? journey?.activity)
    return [
        activity ? `Your ${activity}` : 'Your journey',
        reportLocationPhrase(journey),
        reportDatePhrase(journey),
    ].filter(Boolean).join(' ')
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const parseCssColor = (value, fallback = [34, 91, 155]) => {
    const color = `${value ?? ''}`.trim()
    const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
    if (hex) {
        const raw = hex[1].length === 3
                    ? hex[1].split('').map(char => `${char}${char}`).join('')
                    : hex[1]
        return [
            parseInt(raw.slice(0, 2), 16),
            parseInt(raw.slice(2, 4), 16),
            parseInt(raw.slice(4, 6), 16),
        ]
    }

    const rgb = color.match(/^rgba?\(([^)]+)\)$/i)
    if (rgb) {
        const channels = rgb[1].split(',').slice(0, 3).map(channel => Number.parseFloat(channel.trim()))
        if (channels.every(Number.isFinite)) {
            return channels.map(channel => Math.max(0, Math.min(255, Math.round(channel))))
        }
    }

    return fallback
}

export const setColor = (doc, method, color) => {
    doc[method](color[0], color[1], color[2])
}

export const normalizeColor = (value, fallback = [34, 91, 155]) =>
    Array.isArray(value) && value.length >= 3
    ? value.slice(0, 3).map(channel => Math.max(0, Math.min(255, Math.round(Number(channel) || 0))))
    : parseCssColor(value, fallback)

export const escapeHtml = value => `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const cssColor = color => {
    const [red, green, blue] = normalizeColor(color)
    return `rgb(${red}, ${green}, ${blue})`
}

export const splitTrailingPunctuation = value => {
    const match = `${value}`.match(/^(.+?)([),.;:!?]*)$/)
    return match ? {content: match[1], trailing: match[2]} : {content: value, trailing: ''}
}

export const linkifyEscapedText = value => `${value}`
    .replace(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi, email => (
        `<a href="mailto:${email}">${email}</a>`
    ))
    .replace(/\b((?:https?:\/\/|www\.)[^\s<]+)/gi, match => {
        const {content, trailing} = splitTrailingPunctuation(match)
        const href = content.startsWith('www.') ? `https://${content}` : content
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${content}</a>${trailing}`
    })

export const htmlLink = ({href, text}) => {
    const safeHref = escapeHtml(href)
    const external = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${safeHref}"${external}>${escapeHtml(plainText(text) || href)}</a>`
}

export const htmlText = value => {
    const links = []
    const source = `${value ?? ''}`.replace(
        /<a\s+[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
        (match, quote, href, text) => {
            const token = `LGS_LINK_TOKEN_${links.length}`
            links.push({href, text})
            return ` ${token} `
        },
    )
    let result = linkifyEscapedText(escapeHtml(plainText(source))).replace(/\n/g, '<br>')
    links.forEach((link, index) => {
        result = result.replace(`LGS_LINK_TOKEN_${index}`, htmlLink(link))
    })
    return result
}

export const oneLineText = value => plainText(value).replace(/\s+/g, ' ').trim()

export const slugPart = value => `${value ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item'

export const runtimeCSSColor = (value, fallback, property = 'color') => {
    if (typeof document === 'undefined' || !document.body) {
        return fallback
    }

    const element = document.createElement('span')
    element.style.display = 'none'
    element.style[property] = value
    document.body.appendChild(element)
    const color = getComputedStyle(element)[property]
    element.remove()

    if (!color || color === 'rgba(0, 0, 0, 0)') {
        return fallback
    }

    const canvas = document.createElement('canvas')
    const context = canvas.getContext?.('2d')
    if (!context) {
        return color
    }

    context.fillStyle = fallback
    context.fillStyle = color
    return context.fillStyle || color
}

export const getExportTheme = () => {
    const background = runtimeCSSColor('var(--wa-color-surface-default, #ffffff)', '#ffffff', 'backgroundColor')
    const surface = runtimeCSSColor('var(--wa-color-surface-raised, #f7f9fc)', '#f7f9fc', 'backgroundColor')
    const headerSurface = runtimeCSSColor('var(--wa-color-brand-fill-quiet, #f1f4f8)', '#f1f4f8', 'backgroundColor')
    const line = runtimeCSSColor('var(--wa-color-surface-border, #d8dee6)', '#d8dee6', 'borderColor')
    const brand = runtimeCSSColor('var(--wa-color-brand, #255f91)', '#255f91')

    return {
        background,
        surface,
        headerSurface,
        line,
        brand,
        brandOn: runtimeCSSColor('var(--wa-color-brand-on, #ffffff)', '#ffffff'),
        text:    runtimeCSSColor('var(--wa-color-neutral-on-normal, #18202c)', '#18202c'),
        muted:   runtimeCSSColor('var(--wa-color-neutral-on-quiet, #747c8c)', '#747c8c'),
        link:    runtimeCSSColor('var(--wa-color-text-link, var(--wa-color-brand, #255f91))', brand),
    }
}

/**
 * Converts the HTML export theme into the RGB palette consumed by jsPDF.
 *
 * @param {object} theme - CSS color values used by the HTML report.
 * @returns {object} The RGB colors used by the PDF report.
 */
export const getPDFReportColors = (theme = getExportTheme()) => {
    const [red, green, blue] = parseCssColor(theme.background, PDF_COLORS.white)
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

    return {
        background:  parseCssColor(theme.background, PDF_COLORS.white),
        surface:     parseCssColor(theme.surface, PDF_COLORS.mapFill),
        headerFill:  parseCssColor(theme.headerSurface, PDF_COLORS.headerFill),
        text:        luminance < 0.5 ? parseCssColor(theme.text, PDF_COLORS.text) : PDF_COLORS.text,
        muted:       luminance < 0.5 ? parseCssColor(theme.text, PDF_COLORS.trace) : PDF_COLORS.muted,
        line:        parseCssColor(theme.line, PDF_COLORS.line),
        brand:       parseCssColor(theme.brand, PDF_COLORS.text),
        brandOn:     parseCssColor(theme.brandOn, PDF_COLORS.white),
        link:        parseCssColor(theme.link, PDF_COLORS.text),
        trace:       luminance < 0.5 ? parseCssColor(theme.text, PDF_COLORS.trace) : PDF_COLORS.trace,
        white:       PDF_COLORS.white,
    }
}
