/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journeySamples.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-11
 * Last modified: 2026-07-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { FileUtils } from '@Utils/FileUtils'

export const DEFAULT_JOURNEY_SAMPLES_BASE_PATH = 'samples/journeys'

const normalizePathSegment = value => String(value ?? '').trim().replace(/^\/+|\/+$/g, '')

const encodePathSegment = value => encodeURIComponent(normalizePathSegment(value))

export const journeySampleFileInfo = (filename = '') => {
    const info = FileUtils.getFileNameAndExtension(String(filename ?? '').trim())

    return {
        name:      info.name,
        extension: String(info.extension ?? '').toLowerCase(),
    }
}

export const journeySampleSlug = (sample = {}) => {
    const slug = String(sample?.slug ?? '').trim()
    if (slug) {
        return slug
    }

    const filename = String(sample?.filename ?? '').trim()
    if (!filename) {
        return ''
    }

    const info = journeySampleFileInfo(filename)
    const app = globalThis.__?.app
    if (app?.setSlug) {
        return app.setSlug({content: [info.name, info.extension]})
    }

    return [info.name, info.extension]
        .map(part => String(part ?? '').trim().toLowerCase())
        .filter(Boolean)
        .join('#')
}

export const normalizeJourneySamplesCatalog = (settings = {}) => {
    const journeySettings = settings?.journeys ?? settings ?? {}
    const basePath = normalizePathSegment(journeySettings.basePath ?? DEFAULT_JOURNEY_SAMPLES_BASE_PATH)
    const items = Array.isArray(journeySettings.items) ? journeySettings.items : []

    return items
        .map(sample => {
            const filename = String(sample?.filename ?? '').trim()
            if (!filename) {
                return null
            }

            const file = journeySampleFileInfo(filename)
            const slug = journeySampleSlug(sample)
            if (!slug || !file.extension) {
                return null
            }

            return {
                ...sample,
                basePath,
                description: String(sample?.description ?? '').trim(),
                filename,
                file,
                format:      String(sample?.format ?? file.extension).toLowerCase(),
                name:        String(sample?.name ?? file.name).trim() || file.name,
                slug,
            }
        })
        .filter(Boolean)
}

export const getLoadableJourneySamples = (samples = [], journeys = new Map()) => {
    return samples.filter(sample => sample?.slug && !journeys?.has?.(sample.slug))
}

export const journeySampleUrl = (sample, {isDevelopment = false} = {}) => {
    const path = [sample?.basePath, sample?.filename]
        .flatMap(segment => String(segment ?? '').split('/'))
        .map(encodePathSegment)
        .filter(Boolean)
        .join('/')

    return `${isDevelopment ? '/public' : ''}/${path}`
}
