/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: assets.js
 *
 ******************************************************************************/

import { icon as fontAwesomeIcon, library as fontAwesomeLibrary } from '@fortawesome/fontawesome-svg-core'
import { strToU8 } from 'fflate'
import {
    MAP_ICON_DEFS,
    PDF_COLORS,
    PDF_ICON_DEFS,
    STUDIO_LOGO_RATIO,
    STUDIO_LOGO_URL,
    STUDIO_URL,
} from './constants'
import {
    cssColor,
    getExportTheme,
    normalizeColor,
    parseCssColor,
    setColor,
} from './format'
import { svgNumber } from './geometry'

export const loadImageDataUrl = async url => {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            return null
        }
        const blob = await response.blob()

        return await new Promise(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
        })
    }
    catch (error) {
        console.error(error)
        return null
    }
}

export const loadStudioLogo = async () => {
    const dataUrl = await loadImageDataUrl(STUDIO_LOGO_URL)
    return dataUrl ? {dataUrl, ratio: STUDIO_LOGO_RATIO} : null
}

export const fontAwesomeSVG = (iconDefinition, {className = '', color = 'currentColor'} = {}) => {
    if (!iconDefinition) {
        return ''
    }

    fontAwesomeLibrary.add(iconDefinition)
    const html = fontAwesomeIcon(iconDefinition).html?.[0] ?? ''
    if (!html) {
        return ''
    }

    const svg = new DOMParser().parseFromString(html, 'image/svg+xml').querySelector('svg')
    if (!svg) {
        return html
    }

    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    if (className) {
        svg.setAttribute('class', className)
    }
    svg.querySelectorAll('path').forEach(path => path.setAttribute('fill', color))

    return svg.outerHTML
}

export const fontAwesomeSVGDataUrl = (iconDefinition, color = '#000000') => {
    const svg = fontAwesomeSVG(iconDefinition, {color})
    return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : ''
}

export const fontAwesomePositionedSVG = ({
    iconDefinition,
    className = '',
    x,
    y,
    width,
    height,
    color = 'currentColor',
    rotation = 0,
}) => {
    const svgMarkup = fontAwesomeSVG(iconDefinition, {className, color})
    if (!svgMarkup || typeof DOMParser === 'undefined') {
        return ''
    }

    const svg = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml').querySelector('svg')
    if (!svg) {
        return ''
    }

    svg.setAttribute('x', svgNumber(x))
    svg.setAttribute('y', svgNumber(y))
    svg.setAttribute('width', svgNumber(width))
    svg.setAttribute('height', svgNumber(height))
    svg.setAttribute('overflow', 'visible')
    const transform = `rotate(${svgNumber(rotation)} ${svgNumber(x + width / 2)} ${svgNumber(y + height / 2)})`

    return rotation ? `<g transform="${transform}">${svg.outerHTML}</g>` : svg.outerHTML
}

export const loadDataUrlImage = dataUrl => new Promise(resolve => {
    if (!dataUrl || typeof Image === 'undefined') {
        resolve(null)
        return
    }

    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = dataUrl
})

export const blobToDataUrl = blob => new Promise(resolve => {
    if (!blob || typeof FileReader === 'undefined') {
        resolve('')
        return
    }

    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
})

export const canvasToDataUrl = (canvas, type = 'image/png', quality = undefined) => new Promise(resolve => {
    if (!canvas) {
        resolve('')
        return
    }

    const fallback = () => {
        try {
            resolve(canvas.toDataURL(type, quality))
        }
        catch (error) {
            console.error(error)
            resolve('')
        }
    }

    if (typeof canvas.toBlob !== 'function') {
        fallback()
        return
    }

    try {
        canvas.toBlob(async blob => {
            const dataUrl = await blobToDataUrl(blob)
            if (dataUrl) {
                resolve(dataUrl)
                return
            }

            fallback()
        }, type, quality)
    }
    catch (error) {
        console.error(error)
        fallback()
    }
})

export const svgIconToPNG = async (iconDefinition, {size = 96, color = '#000000'} = {}) => {
    if (typeof document === 'undefined') {
        return null
    }

    const image = await loadDataUrlImage(fontAwesomeSVGDataUrl(iconDefinition, color))
    if (!image) {
        return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext?.('2d')
    if (!context) {
        return null
    }

    context.clearRect(0, 0, size, size)
    context.drawImage(image, 0, 0, size, size)

    return await canvasToDataUrl(canvas)
}

export const pdfIconColorKey = (prefix, color) => {
    const [red, green, blue] = normalizeColor(color, [0, 0, 0])
    return `${prefix}-${red}-${green}-${blue}`
}

export const uniqueIconColors = colors => Array.from(
    new Map((colors ?? [])
        .filter(Boolean)
        .map(color => [pdfIconColorKey('color', color), normalizeColor(color, [0, 0, 0])])).values(),
)

export const loadPDFIcons = async (theme = getExportTheme(), {trackColors = []} = {}) => {
    const brandColor = cssColor(parseCssColor(theme.brand, [34, 91, 155]))
    const iconEntries = [
        ...Object.entries(PDF_ICON_DEFS).map(([key, iconDefinition]) => [key, iconDefinition, '#000000']),
        ['northBlack', MAP_ICON_DEFS.north, '#000000'],
        ['northBrand', MAP_ICON_DEFS.north, brandColor],
        ['progressBlack', MAP_ICON_DEFS.progress, '#000000'],
        ['progressBrand', MAP_ICON_DEFS.progress, brandColor],
        ...uniqueIconColors(trackColors).map(color => [
            pdfIconColorKey('progressTrack', color),
            MAP_ICON_DEFS.progress,
            cssColor(color),
        ]),
    ]
    const entries = await Promise.all(iconEntries.map(async ([key, iconDefinition, color]) => [
        key,
        await svgIconToPNG(iconDefinition, {color}),
    ]))

    return Object.fromEntries(entries.filter(([, value]) => value))
}

export const drawPDFIcon = (doc, icons, key, x, y, size = 3.8, options = {}) => {
    const iconDataUrl = icons?.[key]
    if (!iconDataUrl) {
        return false
    }
    const width = options.width ?? size
    const height = options.height ?? size
    const rotation = options.rotation ?? 0
    let drawX = x
    let drawY = y
    if (rotation) {
        const centerX = x + width / 2
        const centerY = y + height / 2
        const radians = rotation * Math.PI / 180
        const cos = Math.cos(radians)
        const sin = Math.sin(radians)
        drawX = centerX - (cos * width / 2 - sin * height / 2)
        drawY = centerY + sin * width / 2 + cos * height / 2 - height
    }

    doc.addImage(
        iconDataUrl,
        'PNG',
        drawX,
        drawY,
        width,
        height,
        undefined,
        'FAST',
        rotation,
    )
    return true
}

export const linkBoundsForText = (doc, text, x, y, {align = 'left'} = {}) => {
    const width = doc.getTextWidth(text)
    const left = align === 'right'
                 ? x - width
                 : align === 'center'
                   ? x - width / 2
                   : x

    return {
        x:      left,
        y:      y - 3.4,
        width,
        height: 4.6,
    }
}

export const drawTextLink = (doc, text, x, y, url, options = {}) => {
    const align = options.align ?? 'left'
    doc.text(text, x, y, {align})
    if (url) {
        const bounds = linkBoundsForText(doc, text, x, y, {align})
        doc.link(bounds.x, bounds.y, bounds.width, bounds.height, {url})
    }
}

export const drawInlineLinks = (doc, items, rightX, y) => {
    const separator = ' | '
    const separatorWidth = doc.getTextWidth(separator)
    const totalWidth = items.reduce((width, item, index) => (
        width + doc.getTextWidth(item.text) + (index > 0 ? separatorWidth : 0)
    ), 0)
    let x = rightX - totalWidth

    items.forEach((item, index) => {
        if (index > 0) {
            setColor(doc, 'setTextColor', PDF_COLORS.muted)
            doc.text(separator, x, y)
            x += separatorWidth
        }

        setColor(doc, 'setTextColor', item.color ?? PDF_COLORS.text)
        drawTextLink(doc, item.text, x, y, item.url)
        x += doc.getTextWidth(item.text)
    })
}

export const drawStudioLogo = (doc, logo, {x, y, width, url = STUDIO_URL}) => {
    if (!logo?.dataUrl || !width) {
        return false
    }

    const height = width / logo.ratio
    doc.addImage(logo.dataUrl, 'PNG', x, y, width, height)
    if (url) {
        doc.link(x, y, width, height, {url})
    }
    return true
}

export const dataUrlToBytes = dataUrl => {
    const [header, data] = `${dataUrl ?? ''}`.split(',')
    if (!data) {
        return new Uint8Array()
    }

    if (header.includes(';base64')) {
        const binary = atob(data)
        const bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index)
        }
        return bytes
    }

    return strToU8(decodeURIComponent(data))
}

export const downloadBlob = (content, fileName, type) => {
    const link = document.createElement('a')
    const blob = content instanceof Blob ? content : new Blob([content], {type})
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
    URL.revokeObjectURL(link.href)
}
