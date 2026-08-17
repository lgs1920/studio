/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyLoaderUI.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyFilesList }                                   from '@Components/FileLoader/JourneyFilesList'
import {
    journeySampleUrl,
    normalizeJourneySamplesCatalog,
}                                                             from '@Components/FileLoader/journeySamples'
import {
    ALREADY_IMPORTED, IMPORT_FAILED, IMPORT_NOT_SUPPORTED, IMPORT_SUCCESS, JOURNEY_EXISTS, JOURNEY_KO, JOURNEY_OK,
    JOURNEY_WAITING, TrackUtils,
}                                                             from '@Utils/cesium/TrackUtils'
import { formatBuildInfo }                                  from '@Utils/BuildInfoUtils'
import { FileUtils }                                          from '@Utils/FileUtils'
import { UIToast }                                            from '@Utils/UIToast'
import {
    WaButton, WaCopyButton, WaDetails, WaDialog, WaDivider, WaIcon, WaInput, WaOption, WaSelect, WaTextarea, WaTooltip,
}                                                             from '@web.awesome.me/webawesome-pro/dist/react'
import { useId, useMemo, useRef, useState }                  from 'react'
import { v4 as uuid }                                         from 'uuid'
import { useSnapshot }                                        from 'valtio'
import './style.css'

const SUPPORTED_EXTENSIONS = ['.geojson', '.json', '.kml', '.gpx']
const ACCEPTED_FILES = 'GPX, KML, JSON, GeoJSON'
const REMOTE_JOURNEY_DEFAULT_NAME = 'remote-journey'
const REMOTE_JOURNEY_IMPORT_TIMEOUT_MS = 25000
const CLOUD_PROVIDER_LABELS = {
    dropbox:   'Dropbox',
    google:    'Google Drive',
    icloud:    'iCloud',
    nextcloud: 'Nextcloud',
    onedrive:  'OneDrive',
    pcloud:    'pCloud',
}
const CLOUD_ERROR_CODES = {
    ACCESS_DENIED:        'cloud_access_denied',
    AUTH_REQUIRED:        'cloud_auth_required',
    ICLOUD_NOT_SUPPORTED: 'icloud_not_supported',
    NOT_CONFIGURED:       'cloud_not_configured',
    PRIVATE_LINK:         'cloud_private_link',
    READ_FAILED:          'cloud_read_failed',
    REMOTE_TIMEOUT:       'remote_timeout',
    REMOTE_TOO_LARGE:     'remote_file_too_large',
    UNSUPPORTED_FORMAT:   'unsupported_format',
}

/**
 * Converts an import failure into copyable diagnostic text.
 * @param {unknown} error
 * @returns {string}
 */
const formatImportError = error => {
    if (typeof error === 'string') {
        return error
    }

    const errorDetails = error?.stack
        ? String(error.stack)
        : error?.message
            ? String(error.message)
            : ''

    if (errorDetails) {
        const attempts = Array.isArray(error?.readAttempts)
            ? error.readAttempts.map(attempt => {
                const code = attempt.code === 'Unknown' ? '' : ` (${attempt.code})`
                return `- ${attempt.strategy}: ${attempt.name}${code}: ${attempt.message}`
            })
            : []

        return attempts.length > 0
            ? `${errorDetails}\n\nRead attempts:\n${attempts.join('\n')}`
            : errorDetails
    }

    try {
        return JSON.stringify(error, null, 2) || 'Unknown import error.'
    }
    catch {
        return error === undefined || error === null
            ? 'Unknown import error.'
            : Object.prototype.toString.call(error)
    }
}

/**
 * Provides a user-facing correction for a known import failure.
 * @param {unknown} error
 * @returns {string}
 */
const getImportErrorRecommendation = error => {
    const details = formatImportError(error)

    if (/NotFoundError|requested file or directory could not be found/i.test(details)) {
        return 'Due to privacy restrictions enforced by your device, this browser cannot read this file from the Downloads location. Please move or copy it to another location, such as Documents, then select it again.\n\nOther workarounds would require exposing your file over the network. As a privacy-first application, we deliberately prohibit ourselves from using such solutions.'
    }

    if (/unsupported|format/i.test(details)) {
        return 'Rename the file so it ends with .gpx, .kml, .geojson, or .json, then import it again.'
    }

    return 'Download the file again, save it locally on the device, and retry the import.'
}

/**
 * Builds a complete diagnostic report for a failed journey import.
 * @param {Object} data import diagnostic data
 * @returns {string}
 */
const formatImportDiagnostic = data => [
    `Studio version: ${data.version}`,
    `Studio build: ${data.build}`,
    `Platform: ${data.platform}`,
    `Browser: ${data.browser}`,
    `File name: ${data.fileName}`,
    `File type: ${data.fileType}`,
    `File size: ${data.fileSize}`,
    `File modified: ${data.fileModified}`,
    `Read strategy: ${data.readStrategy}`,
    `Error name: ${data.errorName}`,
    `Error code: ${data.errorCode}`,
    '',
    `Suggested fix: ${data.recommendation}`,
    '',
    'Original error:',
    data.error,
].join('\n')

const getSupportedExtension = (fileName = '') => {
    const extension = FileUtils.getExtension(fileName).toLowerCase()
    return SUPPORTED_EXTENSIONS.includes(`.${extension}`) ? extension : ''
}

const getPathFilename = (url) => {
    const segment = url.pathname.split('/').filter(Boolean).pop() ?? ''
    try {
        return decodeURIComponent(segment)
    }
    catch {
        return segment
    }
}

const matchesDomain = (hostname, domain) => {
    const host = hostname.toLowerCase()
    return host === domain || host.endsWith(`.${domain}`)
}

const detectRemoteCloudProvider = (url) => {
    const host = url.hostname.toLowerCase()
    if (matchesDomain(host, 'drive.google.com') || matchesDomain(host, 'docs.google.com')) {
        return 'google'
    }
    if (matchesDomain(host, 'dropbox.com') || matchesDomain(host, 'dropboxusercontent.com')) {
        return 'dropbox'
    }
    if (matchesDomain(host, '1drv.ms') || matchesDomain(host, 'onedrive.live.com') || matchesDomain(host, 'sharepoint.com')) {
        return 'onedrive'
    }
    if (matchesDomain(host, 'pcloud.com') || matchesDomain(host, 'pcloud.link')) {
        return 'pcloud'
    }
    if (matchesDomain(host, 'icloud.com') || matchesDomain(host, 'icloud.com.cn')) {
        return 'icloud'
    }
    if (/\/(?:index\.php\/)?s\/[^/?#]+/.test(url.pathname)) {
        return 'nextcloud'
    }

    return ''
}

const getCloudProviderLabel = (provider) => {
    return CLOUD_PROVIDER_LABELS[provider] ?? 'Cloud'
}

const getRemoteDisplayName = (url) => {
    const provider = detectRemoteCloudProvider(url)
    if (provider) {
        return `${getCloudProviderLabel(provider)} import`
    }

    return getPathFilename(url) || REMOTE_JOURNEY_DEFAULT_NAME
}

const createJourneySlug = fileInfo => __.app.setSlug({content: [fileInfo.name, fileInfo.extension]})

const closeJourneyLoader = () => {
    lgs.stores.ui.mainUI.journeyLoader.visible = false
}

const remoteImportFeedback = (error, fallbackProvider = '') => {
    const data = error.response?.data ?? {}
    const provider = data.provider ?? fallbackProvider
    const providerLabel = getCloudProviderLabel(provider)
    const code = data.errorCode ?? (data.authRequired ? CLOUD_ERROR_CODES.AUTH_REQUIRED : '')

    switch (code) {
        case CLOUD_ERROR_CODES.AUTH_REQUIRED:
        case CLOUD_ERROR_CODES.PRIVATE_LINK:
        case CLOUD_ERROR_CODES.NOT_CONFIGURED:
            return {
                caption:  'Private cloud link unavailable',
                itemName: `${providerLabel} private link`,
                message:  'Private cloud links are not available yet. Use a public sharing link.',
            }
        case CLOUD_ERROR_CODES.ACCESS_DENIED:
            return {
                caption:  'Access denied',
                itemName: `${providerLabel} access denied`,
                message:  'The connected account cannot access this file, or the sharing permissions do not allow import.',
            }
        case CLOUD_ERROR_CODES.ICLOUD_NOT_SUPPORTED:
            return {
                caption:  'Private cloud link unavailable',
                itemName: 'iCloud private link',
                message:  'Private cloud links are not available yet. Use a public sharing link.',
            }
        case CLOUD_ERROR_CODES.UNSUPPORTED_FORMAT:
            return {
                caption:  'Unsupported file format',
                itemName: provider ? `${providerLabel} import` : REMOTE_JOURNEY_DEFAULT_NAME,
                message:  'The imported file must be GPX, KML, GeoJSON, or JSON.',
            }
        case CLOUD_ERROR_CODES.READ_FAILED:
            return {
                caption:  'File could not be read',
                itemName: provider ? `${providerLabel} import` : REMOTE_JOURNEY_DEFAULT_NAME,
                message:  provider
                          ? `${providerLabel} did not return a readable file. Check the sharing settings or try again later.`
                          : 'The remote service did not return a readable file. Check the sharing settings or try again later.',
            }
        case CLOUD_ERROR_CODES.REMOTE_TIMEOUT:
            return {
                caption:  'File request timed out',
                itemName: provider ? `${providerLabel} import` : REMOTE_JOURNEY_DEFAULT_NAME,
                message:  'The file request timed out. Please try again later.',
            }
        case CLOUD_ERROR_CODES.REMOTE_TOO_LARGE:
            return {
                caption:  'File too large',
                itemName: provider ? `${providerLabel} import` : REMOTE_JOURNEY_DEFAULT_NAME,
                message:  'The file is too large to import.',
            }
        default:
            break
    }

    if (error.response?.data?.error) {
        return {
            caption:  IMPORT_FAILED.caption,
            itemName: provider ? `${providerLabel} import` : REMOTE_JOURNEY_DEFAULT_NAME,
            message:  error.response.data.error,
        }
    }
    if (error.code === 'ECONNABORTED' || error.name === 'CanceledError') {
        return {
            caption:  'File request timed out',
            itemName: provider ? `${providerLabel} import` : REMOTE_JOURNEY_DEFAULT_NAME,
            message:  'The file request timed out. Please try again later.',
        }
    }

    return {
        caption:  IMPORT_FAILED.caption,
        itemName: provider ? `${providerLabel} import` : REMOTE_JOURNEY_DEFAULT_NAME,
        message:  error.message ?? 'Remote import failed.',
    }
}

/**
 * JourneyLoaderUI Component
 */
export const JourneyLoaderUI = (props) => {
    const $journeyLoader = lgs.stores.ui.mainUI.journeyLoader
    const journeyLoader = useSnapshot($journeyLoader)
    const [remoteUrl, setRemoteUrl] = useState('')
    const [remoteLoading, setRemoteLoading] = useState(false)
    const [sampleLoadingSlug, setSampleLoadingSlug] = useState('')
    const [sampleSelection, setSampleSelection] = useState('')
    const [sampleCatalogRevision, setSampleCatalogRevision] = useState(0)
    const [importError, setImportError] = useState(null)
    const [reportOpen, setReportOpen] = useState(false)

    const {fileList} = useSnapshot(lgs.stores.main.components.fileLoader)
    const samplesSettings = useSnapshot(lgs.settings.samples)

    const _dialog = useRef(null)
    const _filesDropper = useRef(null)
    const _activeImportError = useRef(null)
    const _importErrorQueue = useRef([])

    const _attemptCounter = useRef(0)

    const fileInputId = useId()

    const journeySamples = useMemo(
        () => normalizeJourneySamplesCatalog(samplesSettings),
        [samplesSettings],
    )
    const loadedJourneysCount = lgs.journeys?.size ?? 0
    const selectedSample = useMemo(
        () => journeySamples.find(sample => sample.slug === sampleSelection) ?? null,
        [journeySamples, sampleSelection, sampleCatalogRevision],
    )
    const sampleLoading = Boolean(sampleLoadingSlug)
    const showSampleSelector = journeySamples.length > 0

    /**
     * Stores an import failure for display in the diagnostic dialog.
     * @param {string} fileName
     * @param {unknown} error
     * @param {File|Object} fileMetadata
     */
    const showImportError = (fileName, error, fileMetadata = {}) => {
        const errorDetails = formatImportError(error)
        const browser = typeof navigator === 'undefined' ? 'Unknown browser' : navigator.userAgent
        const recommendation = getImportErrorRecommendation(error)
        const fileSize = Number.isFinite(fileMetadata.size) ? `${fileMetadata.size} bytes` : 'Unknown'
        const fileModified = fileMetadata.lastModified
            ? new Date(fileMetadata.lastModified).toISOString()
            : 'Unknown'
        const diagnostic = {
            version:        lgs?.versions?.studio ?? 'Unknown version',
            build:          formatBuildInfo(lgs?.build),
            platform:       lgs?.platform ?? 'Unknown platform',
            browser,
            fileName:       fileName || fileMetadata.name || 'Unknown file',
            fileType:       fileMetadata.type || 'Unknown',
            fileSize,
            fileModified,
            readStrategy:   Array.isArray(error?.readAttempts)
                ? error.readAttempts.map(attempt => attempt.strategy).join(', ')
                : 'file.text, FileReader.readAsText, file.arrayBuffer, FileReader.readAsArrayBuffer',
            errorName:      error?.name ?? 'Unknown',
            errorCode:      error?.code ?? 'Unknown',
            recommendation,
            error:          errorDetails,
        }

        const nextImportError = {
            fileName:       diagnostic.fileName,
            details:        formatImportDiagnostic(diagnostic),
            recommendation,
            version:        diagnostic.version,
            build:          diagnostic.build,
            platform:       diagnostic.platform,
            browser:        diagnostic.browser,
            fileType:       diagnostic.fileType,
            fileSize,
            fileModified,
            readStrategy:   diagnostic.readStrategy,
            errorName:      diagnostic.errorName,
            errorCode:      diagnostic.errorCode,
        }

        if (_activeImportError.current) {
            _importErrorQueue.current.push(nextImportError)
            return
        }

        _activeImportError.current = nextImportError
        setReportOpen(false)
        setImportError(nextImportError)
    }

    /**
     * Closes the current diagnostic and displays the next queued error.
     */
    const clearImportError = () => {
        const nextImportError = _importErrorQueue.current.shift() ?? null
        _activeImportError.current = nextImportError
        setReportOpen(false)
        setImportError(nextImportError)
    }

    /**
     * Clears the active diagnostic and every queued diagnostic.
     */
    const clearAllImportErrors = () => {
        _importErrorQueue.current = []
        _activeImportError.current = null
        setReportOpen(false)
        setImportError(null)
    }

    /**
     * Updates file status in the Valtio store
     * @param {string} id
     * @param {number} status
     * @param {string} error
     */
    const updateFileStatus = (id, status, error = '') => {
        const item = lgs.stores.main.components.fileLoader.fileList.get(id)
        if (item) {
            lgs.stores.main.components.fileLoader.fileList.set(id, {
                ...item,
                journeyStatus: status,
                error:         error || item.error,
            })
        }
    }

    const updateFileItem = (id, updates) => {
        const item = lgs.stores.main.components.fileLoader.fileList.get(id)
        if (!item) {
            return
        }

        lgs.stores.main.components.fileLoader.fileList.set(id, {
            ...item,
            ...updates,
            file: {
                ...item.file,
                ...(updates.file ?? {}),
            },
        })
    }

    /**
     * Handles file processing logic
     * @param {File} file
     */
    const processLocalFile = async (file) => {
        const validation = validateFile(file)
        const slug = createJourneySlug(validation.file)
        const currentId = `id_${_attemptCounter.current++}`

        const item = createListItem(file, validation)
        item.journeyStatus = JOURNEY_WAITING
        item.internalId = currentId

        lgs.stores.main.components.fileLoader.fileList.set(currentId, item)

        if (lgs.journeys.has(slug)) {
            updateFileStatus(currentId, JOURNEY_EXISTS, ALREADY_IMPORTED.text)
            UIToast.warning({
                                caption: ALREADY_IMPORTED.caption,
                                text:    `<strong>${file.name}</strong> ${ALREADY_IMPORTED.text}`,
                            })
            return
        }

        if (!validation.validated) {
            updateFileStatus(currentId, JOURNEY_KO, 'Format not supported')
            showImportError(file.name, new Error('Format not supported'), file)
            UIToast.error({
                              caption: IMPORT_NOT_SUPPORTED.caption,
                              text:    `<strong>${file.name}</strong> ${IMPORT_NOT_SUPPORTED.text}`,
                          })
            return
        }

        try {
            const content = await FileUtils.readFileAsTextAsync(file)
            const status = await TrackUtils.loadJourneyFromFile({
                                                                    name:      validation.file.name,
                                                                    extension: validation.file.extension,
                                                                    content:   content,
                                                                }, {
                                                                    onError: error => showImportError(file.name, error, file),
                                                                })

            if (status === JOURNEY_OK) {
                lgs.theJourney.globalSettings()
                updateFileStatus(currentId, JOURNEY_OK)
                UIToast.success({
                                    caption: IMPORT_SUCCESS.caption,
                                    text:    `<strong>${file.name}</strong> ${IMPORT_SUCCESS.text}`,
                                })
            }
            else {
                const isDoublon = status === JOURNEY_EXISTS
                updateFileStatus(currentId, isDoublon ? JOURNEY_EXISTS : JOURNEY_KO, isDoublon ? ALREADY_IMPORTED.text : IMPORT_FAILED.text)
                UIToast.warning({
                                    caption: isDoublon ? ALREADY_IMPORTED.caption : IMPORT_FAILED.caption,
                                    text:    `<strong>${file.name}</strong> ${isDoublon ? ALREADY_IMPORTED.text : IMPORT_FAILED.text}`,
                                })
            }
        }
        catch (error) {
            updateFileStatus(currentId, JOURNEY_KO, 'Error during upload')
            triggerFailureEvent(file.name, error, IMPORT_FAILED.text, {fileMetadata: file})
        }
    }

    const importRemoteJourney = async (url) => {
        const response = await lgs.axios.post(
            [lgs.BACKEND_API, 'journey', 'import-url'].join('/'),
            {url},
            {
                headers:         {
                    'content-type': 'application/json',
                    Accept:         'application/json',
                },
                timeout:         REMOTE_JOURNEY_IMPORT_TIMEOUT_MS,
                signal:          AbortSignal.timeout(REMOTE_JOURNEY_IMPORT_TIMEOUT_MS),
                withCredentials: true,
            },
        )

        if (!response.data?.success) {
            const error = new Error(response.data?.error ?? 'Remote import failed.')
            error.response = {data: response.data}
            throw error
        }

        return response.data
    }

    const processRemoteUrl = async (event) => {
        event?.preventDefault()
        const rawUrl = remoteUrl.trim()
        if (!rawUrl || remoteLoading) {
            return
        }

        const currentId = `url_${_attemptCounter.current++}`
        let sourceUrl
        try {
            sourceUrl = new URL(/^[a-z][a-z\d+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
        }
        catch {
            UIToast.error({caption: IMPORT_FAILED.caption, text: 'Invalid URL.'})
            return
        }

        const sourceProvider = detectRemoteCloudProvider(sourceUrl)
        const initialName = getRemoteDisplayName(sourceUrl)
        const initialInfo = FileUtils.getFileNameAndExtension(initialName)
        const item = createListItem(
            {
                name:         initialName,
                lastModified: 0,
                size:         0,
                type:         'text/uri-list',
            },
            {
                validated: true,
                error:     '',
                file:      {
                    name:      initialInfo.name || REMOTE_JOURNEY_DEFAULT_NAME,
                    extension: getSupportedExtension(initialName) || initialInfo.extension,
                },
            },
        )

        item.journeyStatus = JOURNEY_WAITING
        item.internalId = currentId
        lgs.stores.main.components.fileLoader.fileList.set(currentId, item)
        setRemoteLoading(true)

        try {
            const remote = await importRemoteJourney(rawUrl)
            const fileInfo = remote.file

            if (!SUPPORTED_EXTENSIONS.includes(`.${fileInfo.extension}`)) {
                updateFileStatus(currentId, JOURNEY_KO, 'Format not supported')
                UIToast.error({
                                  caption: IMPORT_NOT_SUPPORTED.caption,
                                  text:    `<strong>${sourceUrl.hostname}</strong> ${IMPORT_NOT_SUPPORTED.text}`,
                              })
                return
            }

            const slug = __.app.setSlug({content: [fileInfo.name, fileInfo.extension]})
            updateFileItem(currentId, {
                slug,
                file: {
                    date:      0,
                    fullName:  fileInfo.fullName,
                    name:      fileInfo.name,
                    extension: fileInfo.extension,
                    type:      fileInfo.type,
                    size:      fileInfo.size,
                },
            })

            if (lgs.journeys.has(slug)) {
                updateFileStatus(currentId, JOURNEY_EXISTS, ALREADY_IMPORTED.text)
                UIToast.warning({
                                    caption: ALREADY_IMPORTED.caption,
                                    text:    `<strong>${fileInfo.fullName}</strong> ${ALREADY_IMPORTED.text}`,
                                })
                return
            }

            const status = await TrackUtils.loadJourneyFromFile({
                                                                    name:      fileInfo.name,
                                                                    extension: fileInfo.extension,
                                                                    content:   remote.content,
                                                                }, {
                                                                    onError: error => showImportError(fileInfo.fullName, error),
                                                                })

            if (status === JOURNEY_OK) {
                lgs.theJourney.globalSettings()
                updateFileStatus(currentId, JOURNEY_OK)
                setRemoteUrl('')
                UIToast.success({
                                    caption: IMPORT_SUCCESS.caption,
                                    text:    `<strong>${fileInfo.fullName}</strong> ${IMPORT_SUCCESS.text}`,
                                })
                return
            }

            const isDoublon = status === JOURNEY_EXISTS
            updateFileStatus(currentId, isDoublon ? JOURNEY_EXISTS : JOURNEY_KO, isDoublon ? ALREADY_IMPORTED.text : IMPORT_FAILED.text)
            UIToast.warning({
                                caption: isDoublon ? ALREADY_IMPORTED.caption : IMPORT_FAILED.caption,
                                text:    `<strong>${fileInfo.fullName}</strong> ${isDoublon ? ALREADY_IMPORTED.text : IMPORT_FAILED.text}`,
                            })
        }
        catch (error) {
            const feedback = remoteImportFeedback(error, sourceProvider)
            updateFileItem(currentId, {
                file: {
                    fullName:  feedback.itemName,
                    name:      feedback.itemName,
                    extension: '',
                    size:      0,
                },
            })
            updateFileStatus(currentId, JOURNEY_KO, feedback.message)
            triggerFailureEvent(feedback.itemName, error, feedback.message, {
                caption:     feedback.caption,
                includeName: false,
            })
        }
        finally {
            setRemoteLoading(false)
        }
    }

    /**
     * Clears the native file input value.
     */
    const clearSelectedFiles = () => {
        if (_filesDropper.current) {
            _filesDropper.current.value = ''
        }
    }

    /**
     * Handles a list of selected or dropped files.
     * @param {File[]} files
     * @returns {Promise<void>}
     */
    const processFiles = async (files) => {
        try {
            await Promise.all(files.map(file => processLocalFile(file)))
        }
        finally {
            clearSelectedFiles()
        }
    }

    /**
     * File input change handler
     */
    const handleFilesChange = (event) => {
        const currentFiles = Array.from(event.target.files || [])
        void processFiles(currentFiles)
    }

    /**
     * Reads all entries from a dropped directory.
     * @param {FileSystemDirectoryReader} reader
     * @returns {Promise<FileSystemEntry[]>}
     */
    const readDirectoryEntries = (reader) => {
        return new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject)
        })
    }

    /**
     * Reads a dropped file entry as a File instance.
     * @param {FileSystemFileEntry} entry
     * @returns {Promise<File>}
     */
    const readFileEntry = (entry) => {
        return new Promise((resolve, reject) => {
            entry.file(resolve, reject)
        })
    }

    /**
     * Resolves the browser-specific dropped entry API.
     * Chromium-based browsers can invalidate DataTransferItem access after the first await,
     * so entries must be captured synchronously during the drop event.
     * @param {DataTransferItem} item
     * @returns {FileSystemEntry | null}
     */
    const getDroppedEntry = (item) => {
        return item?.getAsEntry?.() ?? item?.webkitGetAsEntry?.() ?? null
    }

    /**
     * Collects dropped files recursively, including directory contents when the browser exposes entries.
     * @param {FileSystemEntry | null} entry
     * @returns {Promise<File[]>}
     */
    const collectFilesFromEntry = async (entry) => {
        if (!entry) {
            return []
        }

        if (entry.isFile) {
            const file = await readFileEntry(entry)
            return file ? [file] : []
        }

        if (entry.isDirectory) {
            const reader = entry.createReader()
            const files = []

            while (true) {
                const entries = await readDirectoryEntries(reader)
                if (entries.length === 0) {
                    break
                }

                for (const childEntry of entries) {
                    files.push(...await collectFilesFromEntry(childEntry))
                }
            }

            return files
        }

        return []
    }

    /**
     * Normalizes dropped files from the browser data transfer payload.
     * @param {DragEvent} event
     * @returns {Promise<File[]>}
     */
    const getDroppedFiles = async (event) => {
        const dataTransfer = event.dataTransfer
        const directFiles = Array.from(dataTransfer?.files || [])
        const items = Array.from(dataTransfer?.items || [])

        if (items.length === 0) {
            return directFiles
        }

        const droppedItems = items
            .filter(item => item.kind === 'file')
            .map(item => ({
                entry: getDroppedEntry(item),
                file:  item.getAsFile?.() ?? null,
            }))

        const hasDirectoryDrop = droppedItems.some(({entry}) => entry?.isDirectory)
        if (!hasDirectoryDrop && directFiles.length > 0) {
            return directFiles
        }

        const files = []

        for (const {entry, file} of droppedItems) {
            if (entry) {
                files.push(...await collectFilesFromEntry(entry))
                continue
            }

            if (file) {
                files.push(file)
            }
        }

        return files.length > 0 ? files : directFiles
    }

    /**
     * Opens the native file picker.
     */
    const openFilePicker = () => {
        _filesDropper.current?.click()
    }

    /**
     * Keyboard support for the custom dropzone.
     * @param {React.KeyboardEvent<HTMLDivElement>} event
     */
    const handleDropZoneKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openFilePicker()
        }
    }

    /**
     * Keeps the browser from opening dragged files.
     * @param {React.DragEvent<HTMLDivElement>} event
     */
    const handleDragEnter = (event) => {
        event.preventDefault()
        event.stopPropagation()
    }

    /**
     * Keeps the browser from opening dropped files.
     * @param {React.DragEvent<HTMLDivElement>} event
     */
    const handleDragOver = (event) => {
        event.preventDefault()
        event.stopPropagation()
    }

    /**
     * Keeps the browser from opening dragged files when leaving the dropzone.
     * @param {React.DragEvent<HTMLDivElement>} event
     */
    const handleDragLeave = (event) => {
        event.preventDefault()
        event.stopPropagation()
    }

    /**
     * Handles files dropped onto the custom dropzone.
     * @param {React.DragEvent<HTMLDivElement>} event
     * @returns {Promise<void>}
     */
    const handleDrop = async (event) => {
        event.preventDefault()
        event.stopPropagation()

        const droppedFiles = await getDroppedFiles(event.nativeEvent)

        if (droppedFiles.length > 0) {
            await processFiles(droppedFiles)
        }
    }

    /**
     * Loads sample file and updates Valtio store state
     */
    const loadSample = async (sample) => {
        if (sampleLoading) {
            return
        }

        setSampleLoadingSlug(sample.slug)
        const currentId = `sample_${_attemptCounter.current++}`
        const sampleFileInfo = sample.file
        const mockFile = {
            name:         sample.filename,
            lastModified: 0,
            size:         sample.size ?? 0,
            type:         sample.mime ?? 'application/gpx+xml',
        }
        const item = {
            ...createListItem(mockFile, {validated: true, file: sampleFileInfo}),
            slug: sample.slug,
        }

        try {
            if (lgs.journeys.has(sample.slug)) {
                item.journeyStatus = JOURNEY_EXISTS
                item.error = ALREADY_IMPORTED.text
                lgs.stores.main.components.fileLoader.fileList.set(currentId, item)
                UIToast.warning({
                                    caption: ALREADY_IMPORTED.caption,
                                    text:    `The sample <strong>${sample.name}</strong> ${ALREADY_IMPORTED.text}`,
                                })
                return
            }

            item.journeyStatus = JOURNEY_WAITING
            lgs.stores.main.components.fileLoader.fileList.set(currentId, item)

            const response = await lgs.axios.get(
                journeySampleUrl(sample, {isDevelopment: __.app.isDevelopment()}),
            )
            const content = (typeof response.data === 'object') ? JSON.stringify(response.data) : response.data
            const status = await TrackUtils.loadJourneyFromFile({
                                                                    name:      sampleFileInfo.name,
                                                                    extension: sampleFileInfo.extension,
                                                                    content:   content,
                                                                }, {
                                                                    onError: error => showImportError(sample.filename, error),
                                                                })

            if (status === JOURNEY_OK) {
                updateFileStatus(currentId, JOURNEY_OK)
            }
            else {
                const isDoublon = status === JOURNEY_EXISTS
                updateFileStatus(currentId, isDoublon ? JOURNEY_EXISTS : JOURNEY_KO, isDoublon ? ALREADY_IMPORTED.text : 'Sample load failed')
            }
        }
        catch (error) {
            updateFileStatus(currentId, JOURNEY_KO, 'Sample network error')
            triggerFailureEvent(sample.filename, error)
        }
        finally {
            setSampleLoadingSlug('')
            setSampleSelection('')
            setSampleCatalogRevision(revision => revision + 1)
        }
    }

    const handleSampleSelection = (event) => {
        const slug = event.target.value
        setSampleSelection(slug)

        const sample = journeySamples.find(item => item.slug === slug)
        if (sample) {
            void loadSample(sample)
        }
    }

    /**
     * Error handling for failed operations
     */
    const triggerFailureEvent = (fileName, error = null, message = IMPORT_FAILED.text, options = {}) => {
        const caption = options.caption ?? IMPORT_FAILED.caption
        const includeName = options.includeName ?? true
        const text = includeName && fileName ? `<strong>${fileName}</strong> ${message}` : message

        showImportError(fileName, error ?? new Error(message), options.fileMetadata)
        console.error(`[JourneyLoader] Error: ${fileName}`, error)
        UIToast.error({
                          caption,
                          text,
                      })
    }

    /**
     * File validation logic
     */
    const validateFile = (file) => {
        let result = {validated: true, error: ''}
        const info = FileUtils.getFileNameAndExtension(file.name)
        const normalizedInfo = {...info, extension: info.extension.toLowerCase()}
        if (!SUPPORTED_EXTENSIONS.includes(`.${normalizedInfo.extension}`)) {
            result.validated = false
            result.error = 'Format not supported'
        }
        else if (props.validateCB) {
            result = props.validateCB(file)
        }
        result.file = normalizedInfo
        return result
    }

    /**
     * Factory for list item objects
     */
    const createListItem = (file, validation) => {
        return {
            slug:      createJourneySlug(validation.file),
            uuid:      uuid(),
            file:      {
                date:      file.lastModified,
                fullName:  file.name,
                name:      validation.file.name,
                extension: validation.file.extension,
                type:      file.type,
                size:      file.size,
            },
            validated: validation.validated,
            error:     validation.error,
        }
    }

    /**
     * Resets component state and closes dialog
     */
    const close = () => {
        _attemptCounter.current = 0
        clearSelectedFiles()
        clearAllImportErrors()
        lgs.stores.main.components.fileLoader.fileList.clear()
        closeJourneyLoader()
    }


    return (
        <>
            <WaDialog
            open={journeyLoader.visible}
            id={'file-loader-modal'}
            label={'Import Journeys'}
            onWaRequestClose={close}
            className={'lgs-theme'}
            ref={_dialog}
        >
            <div className="download-columns">
                <div
                    className="drag-and-drop-container"
                    role="button"
                    tabIndex={0}
                    onClick={openFilePicker}
                    onKeyDown={handleDropZoneKeyDown}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    aria-describedby={`${fileInputId}-hint`}
                >
                    <input
                        ref={_filesDropper}
                        id={fileInputId}
                        className="standard-file-input"
                        type="file"
                        multiple={props.multiple ?? true}
                        accept={'.gpx,.geojson,.json,.kml,application/gpx+xml,application/xml,text/xml,application/geo+json,application/json'}
                        onChange={handleFilesChange}
                    />

                    <div className="drag-and-drop-trigger">
                        <WaIcon className="dropzone-icon" name="route" variant="regular"/>
                        <strong>Drop your files here</strong>
                        <span>or click to browse</span>
                    </div>

                    <div id={`${fileInputId}-hint`} className="drag-and-drop-hint">
                        {`Accepted formats: ${ACCEPTED_FILES}`}
                    </div>
                </div>

                <div className="remote-import">
                    <form className="add-url" onSubmit={processRemoteUrl}>
                        <WaInput
                            appearance="filled"
                            size="s"
                            name="journey-url"
                            value={remoteUrl}
                            placeholder="Paste public file link"
                            onInput={(event) => setRemoteUrl(event.target.value)}
                            onChange={(event) => setRemoteUrl(event.target.value)}
                            withClear
                        >
                            <WaIcon slot="start" name="cloud-arrow-down" variant="regular"/>
                        </WaInput>

                        <WaTooltip for="import-remote-journey" placement="top">{'Import journey'}</WaTooltip>
                        <WaButton
                            id="import-remote-journey"
                            type="submit"
                            variant="brand"
                            size="s"
                            loading={remoteLoading}
                            disabled={remoteLoading || !remoteUrl.trim()}
                            aria-label="Import journey"
                        >
                            <WaIcon slot="start" variant="regular" name="file-import"/>
                            {'Import'}
                        </WaButton>
                    </form>
                </div>

                {fileList.size > 0 &&
                    <>
                        <WaDivider/>
                        <JourneyFilesList/>
                    </>
                }

                {showSampleSelector &&
                    <>
                        {fileList.size === 0 && <WaDivider/>}
                        <div className="load-sample journey-samples">
                            <div className="journey-samples-copy">
                                <strong>
                                    {'Don\'t have any'}{loadedJourneysCount ? ' more ' : ' '}{'files handy?'}
                                </strong>
                                {selectedSample?.description ? <span>{selectedSample.description}</span> : null}
                            </div>

                            <WaSelect
                                id="journey-sample-selector"
                                appearance="filled"
                                size="s"
                                label="Load a Sample"
                                label-at-start
                                placeholder="Select"
                                value={sampleSelection}
                                disabled={sampleLoading}
                                onChange={handleSampleSelection}
                            >
                                {journeySamples.map(sample => {
                                    const isLoaded = lgs.journeys.has(sample.slug)

                                    return (
                                        <WaOption
                                            key={sample.slug}
                                            value={sample.slug}
                                            disabled={isLoaded}
                                            title={sample.description || sample.name}
                                        >
                                            <WaIcon
                                                slot="start"
                                                name={isLoaded ? 'xmark' : 'check'}
                                                variant="regular"
                                                className={isLoaded ? 'status-error' : 'status-success'}
                                                style={{color: isLoaded ? 'var(--lgs-error-color)' : 'var(--lgs-success-color)'}}
                                            />
                                            {sample.name}
                                        </WaOption>
                                    )
                                })}
                            </WaSelect>
                        </div>
                    </>
                }

                <WaDivider/>
                <div className="buttons-bar">

                    <WaButton variant="brand" onClick={close}>
                        <WaIcon slot="start" variant="regular"
                                name={fileList.size === 0 ? 'xmark' : 'play'}/>
                        {fileList.size === 0 ? 'Close' : 'Continue'}
                    </WaButton>
                </div>
            </div>
            </WaDialog>

            <WaDialog
            open={Boolean(importError)}
            id={'journey-import-error-modal'}
            label={'Journey import error'}
            onWaRequestClose={clearImportError}
            className={'lgs-theme'}
        >
            <div className="journey-import-error">
                <p>
                    {`The file "${importError?.fileName ?? 'Unknown file'}" could not be imported.`}
                </p>
                <p>
                    {importError?.recommendation ?? 'Download the file again and retry the import.'}
                </p>
                {reportOpen && (
                    <div className="journey-import-error__copy">
                        <WaCopyButton
                            from="journey-import-error-details.value"
                            copy-label="Copy error details"
                            success-label="Error details copied"
                            error-label="Unable to copy error details"
                        />
                    </div>
                )}
                <WaDetails
                    open={reportOpen}
                    summary="Technical report"
                    onWaShow={() => setReportOpen(true)}
                    onWaHide={() => setReportOpen(false)}
                >
                    <WaTextarea
                        id="journey-import-error-details"
                        label="Complete diagnostic report"
                        value={importError?.details ?? ''}
                        rows={14}
                        resize="none"
                        readOnly
                    />
                </WaDetails>
            </div>
        </WaDialog>
        </>
    )
}
