/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayMediaMetadata.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-19
 * Last modified: 2026-11-11
 *
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

/**
 * Append the selected filename resolution details to the existing media comment.
 * @param {string|null} existingComment - Existing MP4 comment metadata.
 * @param {Object} filenameTagInfo - Selected output label, format, and dimensions.
 * @returns {string} Combined comment metadata.
 */
const appendFilenameTagMetadataComment = (existingComment, filenameTagInfo) => {
    const {dimensions = {}} = filenameTagInfo
    const width = Math.round(Number(dimensions.width) || 0)
    const height = Math.round(Number(dimensions.height) || 0)
    const filenameDetails = [
        `Filename tag: ${filenameTagInfo.suffix}`,
        `Resolution profile: ${filenameTagInfo.resolutionLabel}`,
        `Format: ${filenameTagInfo.formatLabel}`,
        `Aspect ratio: ${filenameTagInfo.aspectRatioLabel}`,
        ...(width > 0 && height > 0 ? [`Dimensions: ${width}x${height}`] : []),
    ].join('\n')
    const previousComment = `${existingComment ?? ''}`.trim()

    return [previousComment, filenameDetails].filter(Boolean).join('\n\n')
}

/**
 * Rewrite MP4 metadata while copying every encoded media track without transcoding.
 * @param {Object} options - MP4 metadata rewrite options.
 * @param {Blob} options.blob - Original MP4 file.
 * @param {Object} options.filenameTagInfo - Filename tag and associated video format details.
 * @returns {Promise<Blob>} MP4 blob with the selected details added to its comment metadata.
 */
export const rewriteReplayVideoMetadata = async ({blob, filenameTagInfo} = {}) => {
    if (!(blob instanceof Blob) || blob.size === 0) {
        throw new TypeError('MP4 metadata rewrite requires a non-empty Blob.')
    }
    if (!filenameTagInfo?.suffix) {
        return blob
    }

    const {ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output} = await import('mediabunny')
    const input = new Input({source: new BlobSource(blob), formats: ALL_FORMATS})

    try {
        const target = new BufferTarget()
        const output = new Output({format: new Mp4OutputFormat(), target})
        const conversion = await Conversion.init({
            input,
            output,
            copy: {mode: 'forced'},
            tags: inputTags => ({
                ...normalizeMediabunnyMetadataTags(inputTags),
                comment: appendFilenameTagMetadataComment(inputTags.comment, filenameTagInfo),
            }),
        })

        if (!conversion.isValid || conversion.discardedTracks.length > 0) {
            throw new Error('The video metadata cannot be updated without dropping or transcoding a media track.')
        }

        await conversion.execute()
        if (!(target.buffer instanceof ArrayBuffer) || target.buffer.byteLength === 0) {
            throw new Error('The MP4 metadata rewrite produced an empty file.')
        }

        return new Blob([target.buffer], {type: blob.type || 'video/mp4'})
    }
    finally {
        input.dispose()
    }
}
