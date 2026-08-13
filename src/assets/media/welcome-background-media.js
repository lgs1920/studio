/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-background-media.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const MOBILE_VIEWPORT_QUERY = '(max-width: 700px)'
const DEFAULT_FALLBACK_COLOR = '#050807'

/**
 * Lists the welcome media shared with the LGS1920 public site banner catalog.
 *
 * Keep this shape aligned with `site/src/assets/banner-media-catalog.js`.
 * Every video entry must provide a matching WebP fallback image.
 */
export const bannerMediaCatalog = {
    outdoor: [
        {
            desktopSrc:    '/assets/media/20260812-10548975-hd-3840x2160.mp4',
            fallbackImage: '/assets/media/20260812-10548975-hd-3840x2160.webp',
            id:            '20260812-10548975',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/10548975/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/20260812-15404528-3840x2160.mp4',
            fallbackImage: '/assets/media/20260812-15404528-3840x2160.webp',
            id:            '20260812-15404528',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/15404528/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/10713475-hd_1920_1080_24fps.mp4',
            fallbackImage: '/assets/media/10713475-hd_1920_1080_24fps.webp',
            id:            '10713475-hd-1920-1080-24fps',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/10713475/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/9733919-uhd_4096_2160_30fps.mp4',
            fallbackImage: '/assets/media/9733919-uhd_4096_2160_30fps.webp',
            id:            '9733919-uhd-4096-2160-30fps',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/9733919/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/11212807-hd_1920_1080_24fps.mp4',
            fallbackImage: '/assets/media/11212807-hd_1920_1080_24fps.webp',
            id:            '11212807-hd-1920-1080-24fps',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/11212807/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/12241795_3840_2160_25fps.mp4',
            fallbackImage: '/assets/media/12241795_3840_2160_25fps.webp',
            id:            '12241795-3840-2160-25fps',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/12241795/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/13574273_3840_2160_30fps.mp4',
            fallbackImage: '/assets/media/13574273_3840_2160_30fps.webp',
            id:            '13574273-3840-2160-30fps',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/13574273/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/13633344_3840_2160_60fps.mp4',
            fallbackImage: '/assets/media/13633344_3840_2160_60fps.webp',
            id:            '13633344-3840-2160-60fps',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/13633344/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/5837793-uhd_3840_2160_24fps.mp4',
            fallbackImage: '/assets/media/5837793-uhd_3840_2160_24fps.webp',
            id:            '5837793-uhd-3840-2160-24fps',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/5837793/'},
            type:          'video',
        },
        {
            desktopSrc:    '/assets/media/8557574-uhd_2560_1440_30fps.mp4',
            fallbackImage: '/assets/media/8557574-uhd_2560_1440_30fps.webp',
            id:            '8557574-uhd-2560-1440-30fps',
            credit:        {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/8557574/'},
            type:          'video',
        },
    ],
}

let sessionSelection
const preloadedMediaElements = new Map()

/**
 * Returns selectable media choices from a catalog category.
 *
 * @param {object} catalog - Banner media catalog.
 * @param {string} catalogKey - Catalog category.
 * @returns {Array<object>} Selectable media choices.
 */
export const getBannerMediaChoices = (catalog, catalogKey = 'default') => {
    const choices = catalog?.[catalogKey] ?? catalog?.default ?? []

    return Array.isArray(choices)
        ? choices.filter(choice => choice?.id && choice.type && choice.selectable !== false)
        : []
}

/**
 * Selects one media choice while honoring an explicit identifier.
 *
 * @param {object} catalog - Banner media catalog.
 * @param {string} catalogKey - Catalog category.
 * @param {string|null} selectedId - Optional media identifier.
 * @param {() => number} random - Random source used when no identifier is provided.
 * @param {string|null} excludedId - Optional choice to exclude.
 * @returns {object|null} Selected media choice.
 */
export const selectBannerMedia = (
    catalog,
    catalogKey = 'default',
    selectedId = null,
    random = Math.random,
    excludedId = null,
) => {
    const choices = getBannerMediaChoices(catalog, catalogKey)
    const selectedChoice = choices.find(choice => choice.id === selectedId)

    if (selectedChoice) {
        return selectedChoice
    }

    const availableChoices = choices.length > 1 && excludedId
        ? choices.filter(choice => choice.id !== excludedId)
        : choices

    if (availableChoices.length === 0) {
        return null
    }

    return availableChoices[Math.min(availableChoices.length - 1, Math.floor(random() * availableChoices.length))]
}

/**
 * Resolves a responsive source from a site-compatible media choice.
 *
 * @param {object|null} choice - Selected media choice.
 * @param {boolean} isMobile - Whether the mobile source is preferred.
 * @returns {string|null} Resolved media source.
 */
export const getBannerMediaSource = (choice, isMobile = false) => {
    if (!choice) {
        return null
    }

    return choice.type === 'video'
        ? (isMobile ? choice.mobileSrc : choice.desktopSrc) || choice.desktopSrc || choice.mobileSrc
        : choice.src
}

/**
 * Resolves a responsive fallback image from a site-compatible media choice.
 *
 * @param {object|null} choice - Selected media choice.
 * @param {boolean} isMobile - Whether the mobile fallback is preferred.
 * @returns {string|null} Resolved fallback image.
 */
export const getBannerMediaFallback = (choice, isMobile = false) => {
    if (!choice) {
        return null
    }

    if (choice.type === 'video') {
        return (isMobile ? choice.mobileFallbackImage : choice.desktopFallbackImage)
            || choice.fallbackImage
            || choice.mobileFallbackImage
            || choice.desktopFallbackImage
            || null
    }

    return choice.src
}

/**
 * Resolves the welcome background without coupling selection to React rendering.
 *
 * @param {{catalog?: object, catalogKey?: string, isMobile?: boolean, selectedId?: string|null, random?: () => number}} options - Resolution options.
 * @returns {{id: string|null, variant: string, videoSources: Array<object>, imageSources: Array<object>, fallbackColor: string, credit: object|null}} Stable media description.
 */
export const resolveWelcomeBackgroundMedia = ({
                                             catalog = bannerMediaCatalog,
                                             catalogKey = 'outdoor',
                                             isMobile = globalThis.matchMedia?.(MOBILE_VIEWPORT_QUERY)?.matches ?? false,
                                             selectedId = null,
                                             random = Math.random,
                                         } = {}) => {
    const choice = selectBannerMedia(catalog, catalogKey, selectedId, random)
    const videoSource = getBannerMediaSource(choice, isMobile)
    const fallbackImage = getBannerMediaFallback(choice, isMobile)

    return {
        id:           choice?.id ?? null,
        variant:      isMobile ? 'mobile' : 'desktop',
        videoSources: videoSource ? [{src: videoSource, type: 'video/mp4'}] : [],
        imageSources: fallbackImage ? [{src: fallbackImage, type: 'image/webp'}] : [],
        fallbackColor: DEFAULT_FALLBACK_COLOR,
        credit:       choice?.credit ?? null,
    }
}

/**
 * Returns the welcome background selected for the current application session.
 *
 * @returns {{id: string|null, variant: string, videoSources: Array<object>, imageSources: Array<object>, fallbackColor: string, credit: object|null}} Cached session selection.
 */
export const getWelcomeBackgroundMedia = () => {
    sessionSelection ??= resolveWelcomeBackgroundMedia()
    return sessionSelection
}

/**
 * Preloads every asset in the selected media choice.
 *
 * @param {{videoSources?: Array<object>, imageSources?: Array<object>}} selection - Resolved media selection.
 * @returns {void}
 */
export const preloadWelcomeBackgroundMedia = selection => {
    if (!selection || typeof document === 'undefined') {
        return
    }

    const assets = [...(selection.videoSources ?? []), ...(selection.imageSources ?? [])]
    for (const asset of assets) {
        if (!asset?.src || preloadedMediaElements.has(asset.src)) {
            continue
        }

        const isVideo = typeof asset.type === 'string' && asset.type.startsWith('video/')
        const mediaElement = isVideo ? document.createElement('video') : document.createElement('img')
        if (isVideo) {
            mediaElement.preload = 'auto'
        }
        mediaElement.src = asset.src

        if (isVideo) {
            mediaElement.muted = true
            try {
                mediaElement.load()
            }
            catch {
                // jsdom and a few embedded browsers do not implement media loading.
            }
        }

        preloadedMediaElements.set(asset.src, mediaElement)
    }
}

/**
 * Applies the resolved video source to the boot splash element.
 *
 * @param {HTMLVideoElement|null} videoElement - Boot splash video element.
 * @param {{videoSources?: Array<object>}} selection - Resolved media selection.
 * @returns {boolean} Whether a video source was applied.
 */
export const applyWelcomeBackgroundToVideo = (videoElement, selection) => {
    if (!videoElement) {
        return false
    }

    const videoSources = (selection?.videoSources ?? []).filter(asset => asset?.src)
    videoElement.replaceChildren(...videoSources.map(asset => {
        const sourceElement = videoElement.ownerDocument.createElement('source')
        sourceElement.src = asset.src
        if (asset.type) {
            sourceElement.type = asset.type
        }
        return sourceElement
    }))
    videoElement.hidden = videoSources.length === 0

    if (videoSources.length > 0) {
        try {
            videoElement.load()
        }
        catch {
            // jsdom and a few embedded browsers do not implement media loading.
        }
    }

    return videoSources.length > 0
}

/**
 * Describes the fields shared with the public site's banner catalog.
 *
 * @returns {Array<string>} Supported catalog fields.
 */
export const getWelcomeBackgroundCatalogSchema = () => [
    'id',
    'type',
    'desktopSrc',
    'mobileSrc',
    'fallbackImage',
    'desktopFallbackImage',
    'mobileFallbackImage',
    'credit',
]
