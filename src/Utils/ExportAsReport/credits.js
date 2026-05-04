/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: credits.js
 *
 ******************************************************************************/

import {
    BASE_ENTITY,
    OVERLAY_ENTITY,
    TERRAIN_ENTITY,
} from '@Core/constants'
import {
    STUDIO_NAME,
    STUDIO_URL,
} from './constants'
import {
    escapeHtml,
    oneLineText,
} from './format'

const OVERLAY_CREDIT_LABELS = ['Terrain', 'Overlay', 'Base map', 'Map data']
const HIDDEN_CREDIT_LABELS = ['Geocoding', 'Provider data credits']
const OBJECT_TEXT_PATTERN = /^\s*\[?\s*object\s+object\s*\]?\s*$/i
const OBJECT_TEXT_PATTERN_FR = /^\s*\[?\s*objet\s+objet\s*\]?\s*$/i

export const safeText = value => {
    const text = oneLineText(value)
    return !text || OBJECT_TEXT_PATTERN.test(text) || OBJECT_TEXT_PATTERN_FR.test(text) ? '' : text
}

export const isReportCreditVisible = credit => !HIDDEN_CREDIT_LABELS
    .map(label => label.toLowerCase())
    .includes(safeText(credit?.label).toLowerCase())

export const creditHTMLSource = value => {
    if (!value) {
        return ''
    }
    if (typeof value === 'string') {
        return value
    }
    if (typeof Element !== 'undefined' && value instanceof Element) {
        return value.outerHTML
    }
    if (Array.isArray(value)) {
        return value.map(creditHTMLSource).filter(Boolean).join('')
    }
    if (typeof value === 'object') {
        return creditHTMLSource(value.html)
               || creditHTMLSource(value._html)
               || creditHTMLSource(value.element)
               || creditHTMLSource(value._element)
               || creditHTMLSource(value.credit)
    }

    return ''
}

export const creditTextSource = value => {
    if (value === undefined || value === null) {
        return ''
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return safeText(value)
    }
    if (typeof Element !== 'undefined' && value instanceof Element) {
        return safeText(value.textContent)
    }
    if (Array.isArray(value)) {
        return safeText(value.map(creditTextSource).filter(Boolean).join(' '))
    }
    if (typeof value === 'object') {
        const text = creditTextSource(value.text)
                     || creditTextSource(value.name)
                     || creditTextSource(value.label)
                     || creditTextSource(value.title)
                     || htmlCreditText(creditHTMLSource(value))
        if (text) {
            return text
        }
        const toStringValue = value.toString?.()
        return safeText(toStringValue)
    }

    return ''
}

export const htmlCreditText = html => {
    const source = creditHTMLSource(html) || (typeof html === 'string' ? html : '')
    if (!source) {
        return ''
    }
    if (typeof document === 'undefined') {
        return safeText(source)
    }

    const element = document.createElement('div')
    element.innerHTML = source
    element.querySelectorAll('img').forEach(image => {
        image.replaceWith(document.createTextNode(image.alt || image.title || ''))
    })

    return safeText(element.textContent)
}

export const sanitizeCreditHTML = html => {
    const source = creditHTMLSource(html)
    if (!source) {
        return ''
    }
    if (typeof document === 'undefined') {
        return escapeHtml(htmlCreditText(source))
    }

    const element = document.createElement('div')
    element.innerHTML = source
    element.querySelectorAll('script, style, iframe, object, embed').forEach(node => node.remove())
    element.querySelectorAll('*').forEach(node => {
        ;[...node.attributes].forEach(attribute => {
            if (/^on/i.test(attribute.name)) {
                node.removeAttribute(attribute.name)
            }
        })
        if (node.tagName.toLowerCase() === 'a') {
            node.setAttribute('target', '_blank')
            node.setAttribute('rel', 'noopener noreferrer')
        }
    })

    return element.innerHTML.trim()
}

export const addUniqueCredit = (credits, credit, used) => {
    const html = creditHTMLSource(credit?.html)
    const text = creditTextSource(credit?.text) || htmlCreditText(html)
    if (!text) {
        return
    }

    const label = safeText(credit?.label) || 'Credit'
    if (!isReportCreditVisible({label})) {
        return
    }

    const key = `${label}:${text}`.toLowerCase()
    if (used.has(key)) {
        return
    }

    used.add(key)
    credits.push({
        label,
        text,
        url:   credit?.url ?? '',
        html,
    })
}

export const providerDisplayName = provider => creditTextSource(provider?.name)
                                               || creditTextSource(provider?.credits)
                                               || creditTextSource(provider?.label)
                                               || creditTextSource(provider?.id)

export const providerCreditText = provider => creditTextSource(provider?.credits) || providerDisplayName(provider)

export const providerCreditHTML = provider => provider?.logo
                                             ? `<a href="${escapeHtml(provider.url ?? '')}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(provider.logo)}" alt="${escapeHtml(providerDisplayName(provider))}"></a>`
                                             : ''

export const cesiumCreditEntries = used => {
    const creditDisplay = globalThis.lgs?.viewer?.creditDisplay
                          ?? globalThis.lgs?.scene?.frameState?.creditDisplay
                          ?? globalThis.lgs?.viewer?.scene?.frameState?.creditDisplay
                          ?? null
    const creditValues = [
        ...(creditDisplay?._currentFrameCredits?.screenCredits?.values ?? []),
        ...(creditDisplay?._currentFrameCredits?.lightboxCredits?.values ?? []),
        ...(creditDisplay?._staticCredits ?? []).map(credit => ({credit})),
    ]
    const credits = []

    creditValues.forEach(item => {
        const source = item?.credit ?? item
        const html = creditHTMLSource(source)
        const text = htmlCreditText(html) || creditTextSource(source)
        if (!text || ['base', 'overlay', 'terrain'].includes(text.toLowerCase())) {
            return
        }

        addUniqueCredit(credits, {label: 'Map data', text, html}, used)
    })

    return credits
}

export const activeProviderCredits = used => {
    const manager = globalThis.__?.layersAndTerrainManager
    const settings = globalThis.lgs?.settings?.layers
    if (!manager || !settings) {
        return []
    }

    return [
        {key: TERRAIN_ENTITY, label: 'Terrain'},
        {key: OVERLAY_ENTITY, label: 'Layer'},
        {key: BASE_ENTITY, label: 'Base Map'},
    ]
        .map(({key, label}) => {
            const provider = manager.getProviderProxyByEntity?.(settings[key])
            if (!provider || provider.id === 'cesium') {
                return null
            }

            return {
                label,
                text: providerCreditText(provider),
                url:  provider.url,
                html: providerCreditHTML(provider),
            }
        })
        .filter(Boolean)
        .reduce((credits, credit) => {
            addUniqueCredit(credits, credit, used)
            return credits
        }, [])
}

export const getReportCredits = () => {
    const used = new Set()
    const credits = []
    addUniqueCredit(credits, {label: 'Application', text: STUDIO_NAME, url: STUDIO_URL}, used)
    addUniqueCredit(credits, {label: '3D engine', text: 'CesiumJS', url: 'https://cesium.com/'}, used)
    activeProviderCredits(used).forEach(credit => credits.push(credit))

    return credits
}

export const creditsOverlayHTML = credits => credits
    .filter(credit => OVERLAY_CREDIT_LABELS.includes(credit.label) || credit.label === 'Layer' || credit.label === 'Base Map')
    .map(credit => sanitizeCreditHTML(credit.html))
    .filter(html => html && /<img\b/i.test(html))
    .join('')
