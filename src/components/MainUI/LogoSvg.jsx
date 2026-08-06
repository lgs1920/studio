/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LogoSvg.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-07
 * Last modified: 2026-07-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { memo, useEffect, useId, useMemo, useState } from 'react'

const LOGO_STYLE_URL = '/assets/logo/style.css'
const LOGO_STANDALONE_URL = '/assets/logo/logo.svg'
const LOGO_TEXT_CACHE = new Map()

const loadText = async (url) => {
    if (!LOGO_TEXT_CACHE.has(url)) {
        LOGO_TEXT_CACHE.set(url, fetch(url).then(async (response) => {
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.status}`)
            }
            return response.text()
        }))
    }

    return LOGO_TEXT_CACHE.get(url)
}

const normalizeStandaloneLogo = (svgText) => {
    return svgText
        .replace(/<\?xml-stylesheet[^>]*>\s*/i, '')
        .replace(/<\?xml[^>]*>\s*/i, '')
        .replace(/xmlns:ns0="http:\/\/www\.w3\.org\/2000\/svg"/i, 'xmlns="http://www.w3.org/2000/svg"')
        .replace(/\sxmlns:ns1="http:\/\/www\.w3\.org\/1999\/xlink"/i, '')
        .replace(/<\/?ns0:/g, match => match === '</ns0:' ? '</' : '<')
        .replace(/ns1:href=/g, 'href=')
}

const extractStandaloneLogoInnerMarkup = (svgText) => {
    return normalizeStandaloneLogo(svgText)
        .replace(/^[\s\S]*?<svg\b[^>]*>/i, '')
        .replace(/<\/svg>\s*$/i, '')
}

const extractLogoPlacement = (svgText) => {
    const imageTag = svgText.match(/<[^>]*image[^>]*href="(?:\/assets\/logo\/)?logo\.svg"[^>]*\/>/i)?.[0]
    const x = imageTag?.match(/\sx="([^"]+)"/i)?.[1] ?? '0'
    const y = imageTag?.match(/\sy="([^"]+)"/i)?.[1] ?? '0'

    return {x, y}
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const prefixSvgIds = (svgText, idPrefix) => {
    const ids = [...svgText.matchAll(/\sid="([^"]+)"/g)].map(match => match[1])
    const uniqueIds = [...new Set(ids)]

    return uniqueIds.reduce((prefixedSvg, id) => {
        const prefixedId = `${idPrefix}-${id}`
        const escapedId = escapeRegExp(id)

        return prefixedSvg
            .replace(new RegExp(`id="${escapedId}"`, 'g'), `id="${prefixedId}"`)
            .replace(new RegExp(`href="#${escapedId}"`, 'g'), `href="#${prefixedId}"`)
            .replace(new RegExp(`url\\(#${escapedId}\\)`, 'g'), `url(#${prefixedId})`)
    }, svgText)
}

const normalizeSvg = ({
    svgText,
    styleText,
    primaryColor,
    secondaryColor,
    textPrimaryColor,
    textSecondaryColor,
    secondaryOpacity,
    idPrefix,
    dimensions,
    title,
    inlineLogoMarkup = null,
}) => {
    const styleAttributes = [
        'display:block',
        'overflow:visible',
        dimensions.width ? `width:${dimensions.width}` : null,
        dimensions.height ? `height:${dimensions.height}` : null,
        primaryColor ? `--lgs--logo-primary:${primaryColor}` : null,
        secondaryColor ? `--lgs--logo-secondary:${secondaryColor}` : null,
        textPrimaryColor ? `--lgs--logo-text-primary:${textPrimaryColor}` : null,
        textSecondaryColor ? `--lgs--logo-text-secondary:${textSecondaryColor}` : null,
        secondaryOpacity !== null ? `--lgs--logo-secondary-opacity:${secondaryOpacity}` : null,
    ].filter(Boolean).join(';')

    let normalized = svgText
        .replace(/<\?xml-stylesheet[^>]*>\s*/i, '')
        .replace(/<\?xml[^>]*>\s*/i, '')
        .replace(/xmlns:ns0="http:\/\/www\.w3\.org\/2000\/svg"/i, 'xmlns="http://www.w3.org/2000/svg"')
        .replace(/\sxmlns:ns1="http:\/\/www\.w3\.org\/1999\/xlink"/i, '')
        .replace(/<\/?ns0:/g, match => match === '</ns0:' ? '</' : '<')
        .replace(/ns1:href=/g, 'href=')
        .replace(/href="logo\.svg"/g, 'href="/assets/logo/logo.svg"')
        .replace(/href="LGS1920_logo\.svg"/g, 'href="/assets/logo/logo.svg"')
        .replace(/(<svg\b[^>]*)(>)/i, `$1 style="${styleAttributes}"$2`)
        .replace(/(<svg\b[^>]*>)/i, `$1<style>${styleText}</style>`)

    if (inlineLogoMarkup) {
        normalized = normalized.replace(
            /<image\b[^>]*href="\/assets\/logo\/logo\.svg"[^>]*\/>/i,
            inlineLogoMarkup,
        )
    }

    if (title) {
        normalized = normalized.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    }

    return prefixSvgIds(normalized, idPrefix)
}

const LogoSvgComponent = ({
    src = '/assets/logo/logo.svg',
    primaryColor = null,
    secondaryColor = null,
    secondaryOpacity = null,
    textPrimaryColor = null,
    textSecondaryColor = null,
    width = null,
    height = null,
    className = '',
    style = null,
    title = null,
    ariaHidden = true,
}) => {
    const reactId = useId()
    const [markup, setMarkup] = useState('')
    const idPrefix = useMemo(() => `lgs-logo-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [reactId])

    const dimensions = useMemo(() => ({
        width,
        height,
    }), [height, width])

    useEffect(() => {
        let active = true

        const loadings = [loadText(src), loadText(LOGO_STYLE_URL)]
        if (src !== LOGO_STANDALONE_URL) {
            loadings.push(loadText(LOGO_STANDALONE_URL))
        }

        Promise.all(loadings)
            .then((loaded) => {
                if (!active) {
                    return
                }

                const [svgText, styleText, standaloneText = null] = loaded
                const placement = standaloneText ? extractLogoPlacement(svgText) : {x: '0', y: '0'}
                const inlineLogoMarkup = standaloneText ? `<g transform="translate(${placement.x} ${placement.y})">${extractStandaloneLogoInnerMarkup(standaloneText)}</g>` : null

                setMarkup(normalizeSvg({
                                       svgText,
                                       styleText,
                                       primaryColor,
                                       secondaryColor,
                                       textPrimaryColor,
                                       textSecondaryColor,
                                       secondaryOpacity,
                                       idPrefix,
                                       dimensions,
                                       title,
                                       inlineLogoMarkup,
                                   }))
            })
            .catch((error) => {
                console.error(error)
                if (active) {
                    setMarkup('')
                }
            })

        return () => {
            active = false
        }
    }, [dimensions, idPrefix, primaryColor, secondaryColor, secondaryOpacity, src, textPrimaryColor, textSecondaryColor, title])

    if (!markup) {
        return null
    }

    return <span aria-hidden={ariaHidden} className={className} style={style} dangerouslySetInnerHTML={{__html: markup}}/>
}

export const LogoSvg = memo(LogoSvgComponent)
