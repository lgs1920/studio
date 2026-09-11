/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: useWebAwesomeKits.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-11
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { icon as renderFontAwesomeIcon } from '@fortawesome/fontawesome-svg-core'
import { registerIconLibrary } from '@web.awesome.me/webawesome-pro'
import { getIconLibrary } from '@web.awesome.me/webawesome-pro/dist/components/icon/library.js'

export const LGS1920_ICON_LIBRARY = 'lgs1920'

const FAMILY_BY_PREFIX = {
    fab: 'brands',
    fad: 'duotone',
    fak: 'classic',
    fakd: 'duotone',
}

const VARIANT_PREFIXES = ['thin', 'light', 'regular', 'solid']

const defaultIconLibrary = getIconLibrary('default')

/**
 * Build an ordered definition registry from Font Awesome kit registrations.
 *
 * @param {Array<Object>} kits - Ordered kit registrations or modules.
 * @returns {Map<string, Object>} First definition found for each family, variant, and icon name.
 */
const buildIconDefinitions = kits => {
    const definitions = new Map()

    kits.forEach(kit => {
        const icons = kit.icons ?? kit

        Object.values(icons).forEach(definition => {
            if (!definition?.iconName) {
                return
            }

            const iconNameParts = definition.iconName.match(new RegExp(`^(${VARIANT_PREFIXES.join('|')})-(.+)$`))
            const name = iconNameParts?.[2] ?? definition.iconName
            const variant = kit.variant ?? iconNameParts?.[1] ?? '*'
            const family = kit.family ?? FAMILY_BY_PREFIX[definition.prefix] ?? 'classic'
            const key = `${family}:${variant}:${name}`

            if (!definitions.has(key)) {
                definitions.set(key, definition)
            }
        })
    })

    return definitions
}

/**
 * Find a definition using the Web Awesome family and variant values.
 *
 * @param {Map<string, Object>} definitions - Font Awesome icon definitions.
 * @param {string} name - Font Awesome icon name.
 * @param {string} family - Web Awesome icon family.
 * @param {string} variant - Web Awesome icon variant.
 * @returns {Object|undefined} Matching Font Awesome definition.
 */
const findIconDefinition = (definitions, name, family, variant) => {
    const resolvedFamily = family ?? 'classic'
    const resolvedVariant = variant ?? 'solid'

    return definitions.get(`${resolvedFamily}:${resolvedVariant}:${name}`)
        ?? definitions.get(`${resolvedFamily}:*:${name}`)
}

/**
 * Create a resolver for an ordered Font Awesome definition registry.
 *
 * @param {Map<string, Object>} definitions - Font Awesome icon definitions.
 * @returns {(name: string, family: string, variant: string) => string} SVG data URL resolver.
 */
const createIconResolver = definitions => (name, family, variant) => {
    const definition = findIconDefinition(definitions, name, family, variant)

    if (!definition) {
        throw new Error(`Unknown LGS1920 icon: ${name}`)
    }

    const svg = renderFontAwesomeIcon(definition)?.html?.join('')

    if (!svg) {
        throw new Error(`Unable to render LGS1920 icon: ${name}`)
    }

    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Create a default-library resolver that delegates non-kit icons to Web Awesome.
 *
 * @param {Map<string, Object>} definitions - Font Awesome icon definitions.
 * @returns {(name: string, family: string, variant: string, autoWidth: boolean) => string|Promise<string>} Resolver.
 */
const createDefaultIconResolver = definitions => {
    const resolveIcon = createIconResolver(definitions)

    return (name, family, variant, autoWidth) => findIconDefinition(definitions, name, family, variant)
        ? resolveIcon(name, family, variant)
        : defaultIconLibrary.resolver(name, family, variant, autoWidth)
}

/**
 * Register Font Awesome kits as a Web Awesome icon library.
 *
 * @param {string} libraryName - Name of the Web Awesome icon library to register.
 * @param {Array<Object>} kits - Ordered Font Awesome kit registrations or modules.
 * @returns {void}
 */
export const registerIconLibraryFromKits = (libraryName, kits) => {
    if (!defaultIconLibrary) {
        throw new Error('Web Awesome default icon library is not registered')
    }

    if (!libraryName) {
        throw new Error('Web Awesome icon library name is required')
    }

    if (!Array.isArray(kits)) {
        throw new Error('Web Awesome icon library kits must be an array')
    }

    const definitions = buildIconDefinitions(kits)
    const resolveIcon = createIconResolver(definitions)

    registerIconLibrary(libraryName, {
        resolver: resolveIcon,
    })

    registerIconLibrary('default', {
        resolver: createDefaultIconResolver(definitions),
        mutator: defaultIconLibrary.mutator,
        spriteSheet: defaultIconLibrary.spriteSheet,
    })
}
