/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-09-04
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * @file VideoDownloadAndShareDialog.jsx
 * @description Optimized component for previewing and downloading recorded videos.
 * Keeps preview state render-safe while using captured media data with fallbacks.
 * Uses Web Awesome components and icons.
 * All refs prefixed with _, no default export, no semicolons.
 */
import { RecordingInfo } from '@Components/MainUI/video/RecordingInfo'
import { LGSPopup }      from '@Components/LGSPopup'
import {ReplayMediaCapture} from '@Core/ui/replay/ReplayMediaCapture'
import { REPLAY_DEFERRED_EXPORT_READY_EVENT } from '@Core/ui/replay/ReplayRecordingMonitor'
import {REPLAY_VIDEO_RESOLUTION_PROFILES} from '@Core/ui/replay/ReplayVideoRenderSpec'
import {rewriteReplayVideoMetadata} from '@Core/ui/replay/ReplayMediaMetadata'
import { cancelVideoEditing } from '@Components/MainUI/video/videoEditingCleanup'
import { UI_ACTIONS, UI_ICONS } from '@Core/ui/metadata/uiActionCatalog'
import {
    WaButton, WaDialog, WaIcon, WaInput, WaTooltip,
}                        from '@awesome.me/webawesome/dist/react'
import {
    UIToast,
}                      from '@Utils/UIToast'
import { useCallback, useEffect, useRef, useState } from 'react'
import './style.css'

const DEFAULT_VIDEO_FILENAME = 'video'
const DEFAULT_IMAGE_FILENAME = 'record'
const VIDEO_RESOLUTION_PROFILE_LABELS = Object.freeze({
    [REPLAY_VIDEO_RESOLUTION_PROFILES.HD_720]: '720p',
    [REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD]: '1080p',
    [REPLAY_VIDEO_RESOLUTION_PROFILES.QHD_1440]: '1440p',
    [REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K]: '4K',
})
const STANDARD_VIDEO_RESOLUTION_LABELS = Object.freeze({
    720:  '720p',
    1080: '1080p',
    1440: '1440p',
    2160: '4K',
})

/**
 * Keep Unicode letters in a media filename while removing unsafe characters.
 * @param {string} value - Raw filename stem.
 * @param {string} [fallback=DEFAULT_VIDEO_FILENAME] - Value used when the stem is empty after sanitization.
 * @returns {string} A trimmed, filesystem-safe filename stem.
 */
const sanitizeFilenameStem = (value, fallback = DEFAULT_VIDEO_FILENAME) => {
    const sanitized = `${value ?? ''}`
        .normalize('NFC')
        .replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '')
        .trim()
    return sanitized || fallback
}

/**
 * Stop replay playback and wait until its camera and scene focus restoration has settled.
 *
 * @returns {Promise<void>} Promise resolved after the final view is ready to reveal
 */
const preFocusVideoReplayScene = async ({linked = false} = {}) => {
    if (!linked) {
        return
    }

    await Promise.resolve(globalThis.__?.ui?.replay?.restorePlaybackScene?.({force: true}))
}

/**
 * Release transient replay state after the final camera view is ready.
 */
const clearVideoReplayRuntimeState = () => {
    const replayStore = globalThis.lgs?.stores?.replay
    if (!replayStore) {
        return
    }

    replayStore.dynamicFrameState = null
    replayStore.resolvedFrameState = null
    replayStore.replayFramePhase = null
}

const normalizeExtension = (value, fallback = 'mp4') => {
    const extension = `${value ?? ''}`.replace(/^\.+/, '').replace(/[^a-zA-Z0-9]/g, '')
    return extension || fallback
}

const buildMediaFilename = (stem, extension, fallback = DEFAULT_VIDEO_FILENAME) => (
    `${sanitizeFilenameStem(stem, fallback)}.${normalizeExtension(extension)}`
)

/**
 * Convert a display label into a lowercase filename tag.
 * @param {string} value - User-facing format or resolution label.
 * @returns {string} A filesystem-safe, hyphen-separated tag.
 */
const filenameTagFromLabel = value => `${value ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Resolve a concise resolution label from the selected profile or actual dimensions.
 * @param {Object} options - Export dimensions and selected resolution profile.
 * @returns {string} The selected profile label or actual pixel dimensions.
 */
const resolveVideoResolutionLabel = ({width, height, resolutionProfile}) => {
    const profileLabel = VIDEO_RESOLUTION_PROFILE_LABELS[resolutionProfile]
    if (profileLabel) {
        return profileLabel
    }

    const standardResolution = STANDARD_VIDEO_RESOLUTION_LABELS[Math.min(width, height)]

    return standardResolution ?? `${width}x${height}`
}

export const VideoDownloadAndShareDialog = () => {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
    const [filename, setFilename] = useState('')
    const [canDownloadAndShare, setCanDownloadAndShare] = useState(false)
    const [isMediaOperationActive, setIsMediaOperationActive] = useState(false)
    const [isRecordingInfoOpen, setIsRecordingInfoOpen] = useState(false)
    const [mediaUrl, setMediaUrl] = useState(null)
    const [deferredMediaData, setDeferredMediaData] = useState(null)
    const _mainVideo = useRef(null)
    const _blurredVideo = useRef(null)
    const _recordingInfoButton = useRef(null)
    const _recordingInfoPopup = useRef(null)
    const _mediaBlob = useRef({blob: null, url: null, filename: ''})
    const _filenameSuffix = useRef('')
    const _mediaDownloaded = useRef(false)
    const _mediaActionInFlight = useRef(false)
    const _dialogCleanupDone = useRef(true)
    const _replayScenePreFocused = useRef(false)
    const _mediaRequestToken = useRef(0)
    /** Release the previous preview URL and reset download completion for replacement media. */
    const releaseMediaUrl = useCallback(() => {
        _mediaDownloaded.current = false
        const url = _mediaBlob.current.url
        if (url) {
            _mediaBlob.current.url = null
            URL.revokeObjectURL(url)
        }
        const metadataUrl = _mediaBlob.current.metadataBlobUrl
        if (metadataUrl) {
            _mediaBlob.current.metadataBlobUrl = null
            URL.revokeObjectURL(metadataUrl)
        }
        _mediaBlob.current.metadataBlob = null
        _mediaBlob.current.metadataTagSignature = ''
    }, [])
    const getVideoExtension = useCallback(() => deferredMediaData?.extension
        || __.mediaCapture.mediaData?.extension
        || lgs.settings.ui.video.format, [deferredMediaData])
    const getVideoMimeType = useCallback(() => deferredMediaData?.mimeType
        || __.mediaCapture.mediaData?.mimeType
        || 'video/mp4', [deferredMediaData])
    const getMediaFilenameStem = useCallback((fallback = DEFAULT_VIDEO_FILENAME) => (
        sanitizeFilenameStem(__.mediaCapture.filename?.({}) || fallback, fallback)
    ), [])
    const getVideoFilenameStem = useCallback(() => (
        sanitizeFilenameStem(_mediaBlob.current.filename || getMediaFilenameStem(), DEFAULT_VIDEO_FILENAME)
    ), [getMediaFilenameStem])

    /**
     * Prepare the final replay camera view before showing the media dialog.
     *
     * @param {object} [options] - Preparation options
     * @param {boolean} [options.force=false] - Repeat preparation when a previous attempt completed
     * @returns {Promise<void>} Promise resolved when the final view has settled
     */
    const prepareReplaySceneForDialog = useCallback(async ({force = false} = {}) => {
        if (!force && _replayScenePreFocused.current) {
            return
        }

        try {
            // Read live lifecycle state without reconnecting the media subscription or releasing its URL.
            const isReplayVideoLinked = lgs.stores?.replay?.recordingSync === true
                || lgs.stores?.replay?.basicPreparationActive === true
            const exportCleanup = lgs.stores?.replay?.deferredExportPlan?.runtime?.exportPromise
            if (exportCleanup) {
                try {
                    await exportCleanup
                }
                catch (error) {
                    console.error('Unable to finish Replay export cleanup before scene restoration:', error)
                }
            }
            await preFocusVideoReplayScene({linked: isReplayVideoLinked})
            _replayScenePreFocused.current = true
        }
        catch (error) {
            console.error('Unable to pre-focus the replay scene:', error)
        }
    }, [])

    /**
     * Safely accesses media data with fallback values.
     * @returns {Object} Media stats with default values
     */
    const getMediaData = useCallback(() => {
        const fallback = {
            size:       0,
            duration:   0,
            fps:        0,
            averageFps: 0,
            dimensions: {width: 0, height: 0},
            quality:    {name: 'Unknown'},
            ratio:      {label: 'Unknown'},
            metadata:   {},
            filenameTagInfo: _mediaBlob.current.filenameTagInfo ?? null,
        }

        try {
            if (deferredMediaData) {
                return {
                    ...fallback,
                    ...deferredMediaData,
                    filenameTagInfo: _mediaBlob.current.filenameTagInfo ?? null,
                }
            }
            const data = __.mediaCapture?.mediaData
            if (!data || typeof data !== 'object') {
                return fallback
            }
            if (__.mediaCapture.isVideo()) {
                return {
                    size:       Number(data.size) || 0,
                    duration:   Number(data.duration) || 0,
                    fps:        Number(data.fps) || 0,
                    averageFps: Number(data.averageFps) || 0,
                    dimensions: {
                        width:  Number(data.dimensions?.width) || 0,
                        height: Number(data.dimensions?.height) || 0,
                    },
                    quality:    data.quality || {name: 'Unknown'},
                    ratio:      data.ratio || {label: 'Unknown'},
                    metadata:   data.metadata || {},
                    filenameTagInfo: _mediaBlob.current.filenameTagInfo ?? null,
                }
            }
            else {
                return {
                    ratio:      data.ratio || {label: 'Unknown'},
                    size:       Number(data.size) || 0,
                    dimensions: {
                        width:  Number(data.dimensions?.width) || 0,
                        height: Number(data.dimensions?.height) || 0,
                    },
                    metadata:   data.metadata || {},
                    filenameTagInfo: null,
                }
            }

        }
        catch {
            return fallback
        }
    }, [deferredMediaData])

    useEffect(() => {
        /** Replace pending video handoff with a completed screenshot. */
        const handleCapture = (event) => {
            _mediaRequestToken.current += 1
            try {
                const imageBlob = event.detail?.blob
                if (!(imageBlob instanceof Blob) || imageBlob.size === 0) {
                    throw new Error('Invalid screenshot blob received')
                }

                releaseMediaUrl()
                const imageUrl = URL.createObjectURL(imageBlob)
                const safeFilename = sanitizeFilenameStem(getMediaFilenameStem(DEFAULT_IMAGE_FILENAME), DEFAULT_IMAGE_FILENAME)
                _filenameSuffix.current = ''
                _mediaBlob.current = {
                    blob:     imageBlob,
                    url:      imageUrl,
                    filename: safeFilename,
                    type:     ReplayMediaCapture.IMAGE,
                    filenameTagInfo: null,
                    metadataBlob: null,
                    metadataBlobUrl: null,
                    metadataTagSignature: '',
                }
                _dialogCleanupDone.current = false
                setMediaUrl(imageUrl)
                setFilename(safeFilename)
                setCanDownloadAndShare(true)
                setDeferredMediaData(null)
                setDialogOpen(true)
            }
            catch (error) {
                console.error('Invalid screenshot blob received', error)
                UIToast.error({caption: 'Screenshot', text: 'Unable to finalize screenshot.'})
            }
            finally {
                lgs.stores.ui.video.snapshot = false
                lgs.stores.ui.video.finalizing = false
            }
        }

        /** Present only the latest still-current recording after scene restoration settles. */
        const handleDeferredReplayExport = async (event) => {
            const {blob, filename = DEFAULT_VIDEO_FILENAME, mediaData = {}, mediaHandoffRevision} = event.detail ?? {}
            /** Keep delivered media valid across producer unmounts until capture or cancellation supersedes it. */
            const isCurrentMedia = () => mediaHandoffRevision === undefined
                || mediaHandoffRevision === lgs.stores.ui.video.mediaHandoffRevision
            if (!isCurrentMedia()) {
                return
            }
            if (!(blob instanceof Blob) || blob.size <= 0) {
                UIToast.error({caption: 'Replay video', text: 'The generated video is empty.'})
                return
            }

            let requestToken = null
            try {
                requestToken = ++_mediaRequestToken.current
                _replayScenePreFocused.current = false
                releaseMediaUrl()
                const url = URL.createObjectURL(blob)
                const safeFilename = sanitizeFilenameStem(`${filename}`.replace(/\.[^.]+$/, ''), DEFAULT_VIDEO_FILENAME)
                _filenameSuffix.current = ''
                _mediaBlob.current = {
                    blob,
                    url,
                    filename: safeFilename,
                    type: ReplayMediaCapture.VIDEO,
                    source: 'deferred-replay',
                    mediaData,
                    filenameTagInfo: null,
                    metadataBlob: null,
                    metadataBlobUrl: null,
                    metadataTagSignature: '',
                }
                __.mediaCapture.type = ReplayMediaCapture.VIDEO
                setDeferredMediaData(mediaData)
                _dialogCleanupDone.current = false
                setMediaUrl(url)
                setFilename(safeFilename)
                setCanDownloadAndShare(true)
                // Show the generated file immediately; scene restoration must not gate access to download.
                setDialogOpen(true)
                await prepareReplaySceneForDialog()
                if (requestToken !== _mediaRequestToken.current) {
                    return
                }
                if (!isCurrentMedia()) {
                    releaseMediaUrl()
                    _mediaBlob.current = {blob: null, url: null, filename: ''}
                    _dialogCleanupDone.current = true
                    setMediaUrl(null)
                    setDeferredMediaData(null)
                    setCanDownloadAndShare(false)
                    setDialogOpen(false)
                    void __.mediaCapture?.releaseMedia?.()
                }
            }
            catch (error) {
                console.error('[Replay video] Failed to prepare the generated video dialog:', error)
                if (requestToken === _mediaRequestToken.current) {
                    releaseMediaUrl()
                    _mediaBlob.current = {blob: null, url: null, filename: ''}
                    _dialogCleanupDone.current = true
                    setMediaUrl(null)
                    setDeferredMediaData(null)
                    setCanDownloadAndShare(false)
                    setDialogOpen(false)
                    void __.mediaCapture?.releaseMedia?.()
                }
                UIToast.error({
                    caption: 'Replay video',
                    text: error?.message ?? 'Unable to open the generated video.',
                })
            }
        }


        __.mediaCapture.addEventListener(ReplayMediaCapture.events.CAPTURED, handleCapture)
        globalThis.window?.addEventListener(REPLAY_DEFERRED_EXPORT_READY_EVENT, handleDeferredReplayExport)

        return () => {
            _mediaRequestToken.current += 1
            __.mediaCapture.removeEventListener(ReplayMediaCapture.events.CAPTURED, handleCapture)
            globalThis.window?.removeEventListener(REPLAY_DEFERRED_EXPORT_READY_EVENT, handleDeferredReplayExport)
            releaseMediaUrl()
            void __.mediaCapture?.releaseMedia?.()
        }
    }, [getMediaFilenameStem, prepareReplaySceneForDialog, releaseMediaUrl])

    useEffect(() => {
        if (!dialogOpen) {
            return
        }

        /** Protect the current media until its download action completes successfully. */
        const handleBeforeUnload = (event) => {
            if (_dialogCleanupDone.current
                || _mediaDownloaded.current) {
                return
            }

            event.preventDefault()
            event.returnValue = ''
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [dialogOpen])

    /**
     * Sync blurred video with main video playback.
     */
    useEffect(() => {
        if (!dialogOpen || !_mainVideo.current || !_blurredVideo.current) {
            return
        }

        const mainVideo = _mainVideo.current
        const blurredVideo = _blurredVideo.current

        const syncTime = () => {
            try {
                if (Math.abs(blurredVideo.currentTime - mainVideo.currentTime) > 0.05) {
                    blurredVideo.currentTime = mainVideo.currentTime
                }
            }
            catch {
                // Ignore sync errors during seek
            }
        }

        const handlePlay = () => blurredVideo.play().catch(() => {
        })
        const handlePause = () => blurredVideo.pause()
        const handleRateChange = () => {
            blurredVideo.playbackRate = mainVideo.playbackRate
        }
        const handleLoadedMeta = () => {
            blurredVideo.muted = true
            blurredVideo.playbackRate = mainVideo.playbackRate
            syncTime()
        }

        mainVideo.addEventListener('play', handlePlay)
        mainVideo.addEventListener('pause', handlePause)
        mainVideo.addEventListener('timeupdate', syncTime)
        mainVideo.addEventListener('ratechange', handleRateChange)
        mainVideo.addEventListener('loadedmetadata', handleLoadedMeta)
        mainVideo.addEventListener('seeking', syncTime)

        return () => {
            mainVideo.removeEventListener('play', handlePlay)
            mainVideo.removeEventListener('pause', handlePause)
            mainVideo.removeEventListener('timeupdate', syncTime)
            mainVideo.removeEventListener('ratechange', handleRateChange)
            mainVideo.removeEventListener('loadedmetadata', handleLoadedMeta)
            mainVideo.removeEventListener('seeking', syncTime)
        }
    }, [dialogOpen])

    useEffect(() => {
        if (!isRecordingInfoOpen) {
            return
        }

        const handlePointerDown = (event) => {
            const path = event.composedPath()
            if (!_recordingInfoButton.current || !_recordingInfoPopup.current) {
                return
            }

            if (!path.includes(_recordingInfoButton.current) && !path.includes(_recordingInfoPopup.current)) {
                setIsRecordingInfoOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown, true)
        return () => document.removeEventListener('pointerdown', handlePointerDown, true)
    }, [isRecordingInfoOpen])

    /**
     * Preserve the user's text while editing and validate it for download availability.
     * @param {Event} event - Native Web Awesome input event.
     */
    const handleFilenameChange = useCallback((event) => {
        const value = `${event.target?.value ?? ''}`
        const canProceed = sanitizeFilenameStem(value, '').length > 0
        _mediaBlob.current.filename = value
        setCanDownloadAndShare(canProceed)
        setFilename(value)
    }, [])

    /**
     * Append the current export resolution and video format as filename tags.
     * @returns {void}
     */
    const handleAddVideoTags = useCallback(() => {
        if (!__.mediaCapture.isVideo()) {
            return
        }

        const {dimensions = {}, ratio: mediaRatio = null} = getMediaData()
        const width = Math.max(0, Math.round(Number(dimensions.width) || 0))
        const height = Math.max(0, Math.round(Number(dimensions.height) || 0))
        if (width <= 0 || height <= 0) {
            return
        }

        const dimensionsTag = width > 0 && height > 0 ? `${width}x${height}` : ''
        const videoState = lgs.stores?.ui?.video
        const videoSettings = lgs.settings?.ui?.video
        const currentRatio = videoState?.ratio ?? videoSettings?.ratio ?? mediaRatio
        const selectedRatio = currentRatio?.value ?? currentRatio ?? mediaRatio?.value ?? mediaRatio
        const ratioDefinition = lgs.configuration?.videoFormats?.find(format => format.value === selectedRatio)
        const resolutionProfile = videoSettings?.resolutionProfile
                                   ?? videoState?.resolutionProfile
                                   ?? REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC
        const resolutionLabel = resolveVideoResolutionLabel({width, height, resolutionProfile})
        const formatLabel = ratioDefinition?.label ?? currentRatio?.label ?? 'Custom'
        const formatTag = ratioDefinition?.locked === true
            ? filenameTagFromLabel(formatLabel)
            : `custom-${dimensionsTag}`
        const suffix = `${filenameTagFromLabel(resolutionLabel)}-${formatTag || `custom-${dimensionsTag}`}`
        const filenameTagInfo = {
            suffix,
            resolutionLabel,
            formatLabel,
            aspectRatioLabel: formatLabel,
            dimensions: {width, height},
        }
        const previousSuffixMarker = _filenameSuffix.current ? `-${_filenameSuffix.current}` : ''
        const baseFilename = previousSuffixMarker && filename.endsWith(previousSuffixMarker)
            ? filename.slice(0, -previousSuffixMarker.length)
            : filename
        const nextSuffixMarker = `-${suffix}`
        const safeBaseFilename = sanitizeFilenameStem(baseFilename, DEFAULT_VIDEO_FILENAME)
        const nextFilename = safeBaseFilename.endsWith(nextSuffixMarker)
            ? safeBaseFilename
            : `${safeBaseFilename}${nextSuffixMarker}`
        const staleMetadataUrl = _mediaBlob.current.metadataBlobUrl
        if (staleMetadataUrl) {
            URL.revokeObjectURL(staleMetadataUrl)
        }

        _filenameSuffix.current = suffix
        _mediaBlob.current.filenameTagInfo = filenameTagInfo
        _mediaBlob.current.metadataBlob = null
        _mediaBlob.current.metadataBlobUrl = null
        _mediaBlob.current.metadataTagSignature = ''
        _mediaBlob.current.filename = nextFilename
        setCanDownloadAndShare(true)
        setFilename(nextFilename)
    }, [filename, getMediaData])

    /**
     * Resolve the video or screenshot already present in the dialog.
     */
    const resolveSmartVideoBlob = useCallback(async () => {
        if (!__.mediaCapture.isVideo()) {
            return {
                blob:      _mediaBlob.current.blob,
                filename:   sanitizeFilenameStem(_mediaBlob.current.filename, DEFAULT_IMAGE_FILENAME),
                extension:  getVideoExtension(),
                mimeType:   getVideoMimeType(),
                url:        _mediaBlob.current.url,
            }
        }

        const sourceBlob = _mediaBlob.current.blob
        const filenameTagInfo = _mediaBlob.current.filenameTagInfo
        const requestToken = _mediaRequestToken.current
        let blob = sourceBlob
        let url = _mediaBlob.current.url

        if (filenameTagInfo) {
            const metadataTagSignature = JSON.stringify(filenameTagInfo)
            if (_mediaBlob.current.metadataBlob
                && _mediaBlob.current.metadataTagSignature === metadataTagSignature) {
                blob = _mediaBlob.current.metadataBlob
                url = _mediaBlob.current.metadataBlobUrl
            }
            else {
                const metadataBlob = await rewriteReplayVideoMetadata({blob: sourceBlob, filenameTagInfo})
                if (requestToken !== _mediaRequestToken.current || sourceBlob !== _mediaBlob.current.blob) {
                    return {blob: null, filename: '', extension: getVideoExtension(), mimeType: getVideoMimeType(), url: null}
                }

                const metadataBlobUrl = URL.createObjectURL(metadataBlob)
                const previousMetadataUrl = _mediaBlob.current.metadataBlobUrl
                if (previousMetadataUrl) {
                    URL.revokeObjectURL(previousMetadataUrl)
                }
                _mediaBlob.current.metadataBlob = metadataBlob
                _mediaBlob.current.metadataBlobUrl = metadataBlobUrl
                _mediaBlob.current.metadataTagSignature = metadataTagSignature
                blob = metadataBlob
                url = metadataBlobUrl
            }
        }

        return {
            blob,
            filename:   getVideoFilenameStem(),
            extension:  getVideoExtension(),
            mimeType:   getVideoMimeType(),
            url,
        }
    }, [getVideoFilenameStem, getVideoExtension, getVideoMimeType])

    /**
     * Handle share action with Web Share API fallback.
     */
    const handleShare = useCallback(async () => {
        if (_mediaActionInFlight.current) {
            return
        }
        const exportMedia = await resolveSmartVideoBlob()
        const blob = exportMedia.blob
        if (!(blob instanceof Blob) || blob.size === 0) {
            UIToast.error({
                              caption: 'Share',
                              text:    'No media is available to share.',
            })
            return
        }

        _mediaActionInFlight.current = true
        const isVideo = __.mediaCapture.isVideo()
        const extension = isVideo ? exportMedia.extension || getVideoExtension() : lgs.settings.ui.video.image
        const file = new File(
            [blob],
            buildMediaFilename(exportMedia.filename, extension, isVideo ? DEFAULT_VIDEO_FILENAME : DEFAULT_IMAGE_FILENAME),
            {type: blob.type || (isVideo ? (exportMedia.mimeType || getVideoMimeType()) : `image/${extension}`)},
        )
        const shareMediaLabel = isVideo ? 'video' : 'shot'
        const shareData = {
            title: 'LGS1920 Studio Video',
            text:  `Check out my last ${shareMediaLabel} created with LGS1920 Studio!`,
            files: [file],
        }

        try {
            if (navigator.share) {
                try {
                    await navigator.share(shareData)
                    return
                }
                catch (error) {
                    if (error?.name === 'AbortError') {
                        return
                    }

                    if (!['TypeError', 'DataError', 'NotSupportedError'].includes(error?.name)) {
                        throw error
                    }
                }

                await navigator.share({
                                          title: shareData.title,
                                          text:  shareData.text,
                                      })
                return
            }

            UIToast.warning({
                                caption: `Share your ${shareMediaLabel}`,
                                text: 'This browser cannot share this media file directly.',
                            })

        }
        catch (error) {
            if (error?.name === 'AbortError') {
                return
            }
            console.error('Share failed:', error.message)
            UIToast.error({
                              caption: 'Share failed',
                              text:    'Unable to open the share dialog on this device.',
                          })
        }
        finally {
            _mediaActionInFlight.current = false
        }
    }, [getVideoExtension, getVideoMimeType, resolveSmartVideoBlob])

    const mediaData = getMediaData()
    const isVideo = __.mediaCapture.isVideo()
    const canShare = __.app.canShare()
    const previewMediaUrl = mediaUrl

    /**
     * Download the available Replay video or screenshot.
     */
    const handleDownload = useCallback(async () => {
        const requestToken = _mediaRequestToken.current
        try {
            if (__.mediaCapture.isVideo()) {
                const media = await resolveSmartVideoBlob()
                if (requestToken !== _mediaRequestToken.current) {
                    return
                }
                const blob = media.blob
                if (!blob || blob.size === 0) {
                    return
                }
                const downloadFilename = buildMediaFilename(media.filename, media.extension || getVideoExtension(), DEFAULT_VIDEO_FILENAME)
                const link = document.createElement('a')
                link.href = media.url
                link.download = downloadFilename
                link.click()
            }
            else {
                await __.mediaCapture.download({
                                               filename: buildMediaFilename(_mediaBlob.current.filename, lgs.settings.ui.video.image, DEFAULT_IMAGE_FILENAME),
                                           })
            }
            if (requestToken === _mediaRequestToken.current) {
                _mediaDownloaded.current = true
            }
        }
        catch (error) {
            console.error('Download failed:', error.message)
        }
    }, [getVideoExtension, resolveSmartVideoBlob])

    /**
     * Handle cancel and cleanup.
     */
    const handleCancel = useCallback(async () => {
        setCloseConfirmationOpen(false)
        if (_dialogCleanupDone.current) {
            setDialogOpen(false)
            return
        }
        _dialogCleanupDone.current = true
        const requestToken = ++_mediaRequestToken.current
        await prepareReplaySceneForDialog()
        if (requestToken !== _mediaRequestToken.current) {
            return
        }
        _replayScenePreFocused.current = false
        clearVideoReplayRuntimeState()
        setDialogOpen(false)
        setIsRecordingInfoOpen(false)
        cancelVideoEditing()
        releaseMediaUrl()
        _mediaBlob.current = {blob: null, url: null, filename: ''}
        setMediaUrl(null)
        Object.assign(lgs.stores.ui.video, {
            preRecording:     false,
            exporting:      false,
            paused:           false,
            size:             0,
            editing:          false,
            finalizing:       false,
        })
        setCanDownloadAndShare(false)
        setFilename('')
        _filenameSuffix.current = ''
        void __.mediaCapture?.releaseMedia?.()
        setDeferredMediaData(null)
    }, [prepareReplaySceneForDialog, releaseMediaUrl])

    /**
     * Confirm video disposal before releasing the preview and its media.
     */
    const requestClose = useCallback(() => {
        if (_dialogCleanupDone.current) {
            return
        }
        if (__.mediaCapture.isVideo() && !_mediaDownloaded.current) {
            setCloseConfirmationOpen(true)
            return
        }
        void handleCancel()
    }, [handleCancel])

    /**
     * Cancel disposal while keeping the exported video available.
     */
    const cancelCloseConfirmation = useCallback((event) => {
        if (event?.target && event?.currentTarget && event.target !== event.currentTarget) {
            return
        }
        setCloseConfirmationOpen(false)
    }, [])

    /**
     * Intercept native close requests before they can discard the video.
     */
    const handleDialogHide = useCallback((event) => {
        if (event?.target && event?.currentTarget && event.target !== event.currentTarget) {
            return
        }

        if (!_dialogCleanupDone.current) {
            event.preventDefault()
            requestClose()
        }
    }, [requestClose])

    return (
        <>
            {dialogOpen && <div className="video-preview-dialog-brand-overlay" aria-hidden="true"/>}
            <WaDialog
                id="video-preview-dialog"
                open={dialogOpen}
                onWaHide={handleDialogHide}
                lightDismiss={false}
                className="lgs-theme"
            >
            <div slot="label" className="video-preview-dialog-title">
                <WaIcon
                    className="video-preview-title-icon"
                    name={isVideo ? 'film' : 'camera-polaroid'}
                    variant="regular"
                />
                <span>
                    {`Download ${canShare ? 'and Share ' : ''}${isVideo ? 'your video' : 'your screenshot'}`}
                </span>
            </div>

            <div className="video-container">
                {isVideo ? (
                    <>
                        <video
                            ref={_mainVideo}
                            src={previewMediaUrl}
                            controls
                            autoPlay
                            className="main-video"
                        />

                        <div className="blurred-video-wrapper">
                            <video
                                ref={_blurredVideo}
                                src={previewMediaUrl}
                                className="blurred-video"
                                muted
                                autoPlay
                            />
                        </div>
                    </>
                ) : (
                     <>
                         <img src={previewMediaUrl} alt="Screenshot" className="main-video"/>
                         <div className="blurred-video-wrapper">
                             <img src={previewMediaUrl} alt="" className="blurred-video"/>
                         </div>
                     </>
                 )}
            </div>

            <div className="video-file-actions">
                <WaInput
                    appearance="filled"
                    size="s"
                    name="video-file-name"
                    label-at-start
                    onInput={handleFilenameChange}
                    value={filename}
                >
                    <span slot="label" className="video-file-label">{'File name'}</span>
                    <span slot="end" className="video-file-extension">
                        .{isVideo ? getVideoExtension() : lgs.settings.ui.video.image}
                    </span>
                </WaInput>
                {isVideo && (
                    <WaButton
                        className="video-file-tag-button"
                        appearance="outlined"
                        size="s"
                        variant="neutral"
                        disabled={!canDownloadAndShare
                            || mediaData.dimensions.width <= 0
                            || mediaData.dimensions.height <= 0}
                        onClick={handleAddVideoTags}
                    >
                        <WaIcon slot="start" {...UI_ACTIONS.addVideoTags.icon}/>
                        {UI_ACTIONS.addVideoTags.label}
                    </WaButton>
                )}
                <div className="video-file-info-action">
                    <WaTooltip for="video-recording-info-trigger" placement="top">
                        {'Recording information'}
                    </WaTooltip>
                    <WaButton
                        id="video-recording-info-trigger"
                        ref={_recordingInfoButton}
                        className="video-recording-info-trigger"
                        appearance="plain"
                        size="s"
                        variant="brand"
                        onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setIsRecordingInfoOpen((open) => !open)
                        }}
                    >
                        <WaIcon {...UI_ICONS.info}/>
                    </WaButton>
                </div>
                <LGSPopup
                    ref={_recordingInfoPopup}
                    anchor="video-recording-info-trigger"
                    active={isRecordingInfoOpen}
                    onRequestClose={() => setIsRecordingInfoOpen(false)}
                    placement="top-end"
                    distance={lgs.gutter.xs}
                    flip
                    shift
                    strategy="fixed"
                >
                    <RecordingInfo
                        mediaData={mediaData}
                        isVideo={isVideo}
                    />
                </LGSPopup>
            </div>

            <div slot="footer" id="video-preview-dialog-footer">
                <div className="buttons-bar">
                    <div className="video-preview-close-action">
                        <WaTooltip for="video-preview-close">{UI_ACTIONS.close.label}</WaTooltip>
                        <WaButton
                            id="video-preview-close"
                            className="video-preview-close-button"
                            appearance="outlined"
                            onClick={requestClose}
                        >
                            <WaIcon slot="start" className="video-preview-action-icon" {...UI_ACTIONS.close.icon}/>
                            {UI_ACTIONS.close.label}
                        </WaButton>
                    </div>
                    {canShare && (
                        <>
                            <WaTooltip for="video-preview-share">{'Share your video'}</WaTooltip>
                            <WaButton
                                id="video-preview-share"
                                appearance="filled"
                                variant="brand"
                                disabled={!canDownloadAndShare}
                                onClick={() => void handleShare()}
                            >
                                <WaIcon slot="start" className="video-preview-action-icon" name="share-nodes" variant="regular"/>
                                {'Share'}
                            </WaButton>
                        </>
                    )}
                    <WaTooltip for="video-preview-download">{'Save your video'}</WaTooltip>
                    <WaButton
                        id="video-preview-download"
                        appearance="filled"
                        variant="brand"
                        disabled={!canDownloadAndShare}
                        onClick={() => void handleDownload()}
                    >
                        <WaIcon slot="start" className="video-preview-action-icon" name="download" variant="regular"/>
                        {'Download'}
                    </WaButton>
                </div>
            </div>
            </WaDialog>
            {closeConfirmationOpen && (
                <WaDialog
                    id="video-preview-close-confirmation"
                    open
                    label="Close without saving your video?"
                    lightDismiss={false}
                    onWaHide={cancelCloseConfirmation}
                    className="lgs-theme"
                >
                    <p>{'If you close this window, you will lose your video. Download it first if you want to keep it.'}</p>
                    <div slot="footer" className="video-preview-close-confirmation-actions">
                        <WaButton appearance="outlined" variant="danger" onClick={() => void handleCancel()}>
                            <WaIcon slot="start" {...UI_ACTIONS.confirm.icon}/>
                            {'Yes I confirm'}
                        </WaButton>
                        <WaButton autoFocus onClick={() => setCloseConfirmationOpen(false)}>
                            <WaIcon slot="start" {...UI_ACTIONS.cancel.icon}/>
                            {UI_ACTIONS.cancel.label}
                        </WaButton>
                    </div>
                </WaDialog>
            )}
        </>
    )
}
