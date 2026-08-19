/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MediaMetadata.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const MEDIABUNNY_METADATA_KEYS = new Set([
    'title',
    'description',
    'artist',
    'album',
    'albumArtist',
    'trackNumber',
    'tracksTotal',
    'discNumber',
    'discsTotal',
    'genre',
    'date',
    'lyrics',
    'comment',
    'images',
    'raw',
])

/**
 * Keeps application metadata separate from the metadata tags accepted by Mediabunny.
 *
 * @param {Object|null} metadata - Metadata collected by the Studio application.
 * @returns {Object} Metadata tags supported by Mediabunny.
 */
export const normalizeMediabunnyMetadataTags = (metadata = null) => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {}
    }

    return Object.fromEntries(
        Object.entries(metadata).filter(([key]) => MEDIABUNNY_METADATA_KEYS.has(key)),
    )
}
