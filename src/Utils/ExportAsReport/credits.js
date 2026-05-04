/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: credits.js
 *
 ******************************************************************************/

import {
    CREDIT_LAYER_TYPES,
    STUDIO_NAME,
    STUDIO_URL,
} from './constants'
import {
    escapeHtml,
    oneLineText,
} from './format'
import { snapdom } from '@zumer/snapdom'

const OVERLAY_CREDIT_LABELS = ['Terrain', 'Overlay', 'Base map', 'Map data']
const CREDIT_IMAGE_TIMEOUT = 600
const CREDIT_OVERLAY_TIMEOUT = 1800

const resolveAfter = (milliseconds, value = null) => new Promise(resolve => {
    setTimeout(() => resolve(value), milliseconds)
})

export const htmlCreditText = html => {
    if (!html) {
        return ''
    }
    if (typeof document === 'undefined') {
        return oneLineText(html)
    }

    const element = document.createElement('div')
    element.innerHTML = html
    element.querySelectorAll('img').forEach(image => {
        image.replaceWith(document.createTextNode(image.alt || image.title || ''))
    })

    return oneLineText(element.textContent)
}

export const sanitizeCreditHTML = html => {
    if (!html) {
        return ''
    }
    if (typeof document === 'undefined') {
        return escapeHtml(htmlCreditText(html))
    }

    const element = document.createElement('div')
    element.innerHTML = html
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
    const text = oneLineText(credit?.text)
    if (!text) {
        return
    }

    const key = `${credit?.label ?? ''}:${text}`.toLowerCase()
    if (used.has(key)) {
        return
    }

    used.add(key)
    credits.push({
        label: credit?.label ?? 'Credit',
        text,
        url:   credit?.url ?? '',
        html:  credit?.html ?? '',
    })
}

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
        const html = item?.credit?.html ?? item?.html
        const text = htmlCreditText(html)
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

    return CREDIT_LAYER_TYPES
        .map(({key, label}) => {
            const provider = manager.getProviderProxyByEntity?.(settings[key])
            if (!provider || provider.id === 'cesium') {
                return null
            }

            return {
                label,
                text: provider.name,
                url:  provider.url,
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
    cesiumCreditEntries(used).forEach(credit => credits.push(credit))

    return credits
}

export const creditsOverlayHTML = credits => credits
    .filter(credit => OVERLAY_CREDIT_LABELS.includes(credit.label))
    .map(credit => sanitizeCreditHTML(credit.html))
    .filter(html => html && /<img\b/i.test(html))
    .join('')

export const waitForCreditImages = async element => {
    const images = [...(element?.querySelectorAll?.('img') ?? [])]
    await Promise.all(images.map(image => {
        image.setAttribute('crossorigin', 'anonymous')
        if (image.complete) {
            return Promise.resolve()
        }

        return new Promise(resolve => {
            const timeout = setTimeout(resolve, CREDIT_IMAGE_TIMEOUT)
            image.onload = () => {
                clearTimeout(timeout)
                resolve()
            }
            image.onerror = () => {
                clearTimeout(timeout)
                resolve()
            }
        })
    }))
}

export async function createCreditsOverlayImage(credits) {
    const html = creditsOverlayHTML(credits)
    if (!html || typeof document === 'undefined') {
        return null
    }

    const element = document.createElement('div')
    element.innerHTML = html
    Object.assign(element.style, {
        position:     'fixed',
        left:         '-10000px',
        top:          '0',
        zIndex:       '-1',
        display:      'inline-flex',
        alignItems:   'center',
        flexWrap:     'wrap',
        gap:          '4px',
        maxWidth:     '560px',
        padding:      '4px 7px',
        borderRadius: '4px',
        background:   'rgba(255, 255, 255, .84)',
        color:        '#111111',
        font:         '10px/1.25 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    })
    element.querySelectorAll('img').forEach(image => {
        Object.assign(image.style, {
            display:   'block',
            maxWidth:  '120px',
            maxHeight: '24px',
            width:     'auto',
            height:    'auto',
        })
    })

    document.body.appendChild(element)
    try {
        await waitForCreditImages(element)
        const snapshot = await Promise.race([
                                                snapdom(element, {scale: 1}),
                                                resolveAfter(CREDIT_OVERLAY_TIMEOUT),
                                            ])
        if (!snapshot) {
            return null
        }
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
    finally {
        element.remove()
    }
}
