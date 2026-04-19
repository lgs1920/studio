/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyLoaderUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-19
 * Last modified: 2026-04-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyFilesList }                                   from '@Components/FileLoader/JourneyFilesList'
import {
    ALREADY_IMPORTED, IMPORT_FAILED, IMPORT_NOT_SUPPORTED, IMPORT_SUCCESS, JOURNEY_EXISTS, JOURNEY_KO, JOURNEY_OK,
    JOURNEY_WAITING, TrackUtils,
}                                                             from '@Utils/cesium/TrackUtils'
import { FileUtils }                                          from '@Utils/FileUtils'
import { UIToast }                                            from '@Utils/UIToast'
import { WaButton, WaDialog, WaDivider, WaFileInput, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useMemo, useRef }                         from 'react'
import { v4 as uuid }                                         from 'uuid'
import { useSnapshot }                                        from 'valtio'
import './style.css'

const SUPPORTED_EXTENSIONS = ['.geojson', '.json', '.kml', '.gpx']
const ACCEPTED_FILES = 'GPX, KML, JSON, GeoJSON'

/**
 * JourneyLoaderUI Component
 */
export const JourneyLoaderUI = (props) => {
    const $journeyLoader = lgs.stores.ui.mainUI.journeyLoader
    const journeyLoader = useSnapshot($journeyLoader)

    const $fileLoader = lgs.stores.main.components.fileLoader
    const {fileList, sampleLoaded} = useSnapshot($fileLoader)

    const _dialog = useRef(null)
    const _filesDropper = useRef(null)

    const _attemptCounter = useRef(0)

    const GPX_SAMPLE_FILENAME = 'LGS1920.gpx'
    const GPX_SAMPLE_URL = [__.app.isDevelopment() ? '/public' : '/', 'assets', 'samples', GPX_SAMPLE_FILENAME].join('/')
    const sampleFileInfo = useMemo(() => FileUtils.getFileNameAndExtension(GPX_SAMPLE_FILENAME), [])
    const sampleSlug = useMemo(() => __.app.setSlug({content: GPX_SAMPLE_FILENAME.split('.')}), [])

    /**
     * Resynchronize sampleLoaded state whenever the dialog opens.
     * This ensures the button reappears if the sample was deleted elsewhere.
     */
    useEffect(() => {
        if (journeyLoader.visible) {
            const isPresent = lgs.journeys.has(sampleSlug)
            if ($fileLoader.sampleLoaded !== isPresent) {
                $fileLoader.sampleLoaded = isPresent
            }
        }
    }, [journeyLoader.visible, sampleSlug])

    /**
     * Reactive visibility based on Valtio store state
     */
    const showSampleButton = !sampleLoaded

    /**
     * Updates file status in the Valtio store
     * @param {string} id
     * @param {number} status
     * @param {string} error
     */
    const updateFileStatus = (id, status, error = '') => {
        const item = $fileLoader.fileList.get(id)
        if (item) {
            $fileLoader.fileList.set(id, {
                ...item,
                journeyStatus: status,
                error:         error || item.error,
            })

            // Update sampleLoaded flag if this file matches the sample slug
            if (status === JOURNEY_OK && item.slug === sampleSlug) {
                $fileLoader.sampleLoaded = true
            }
        }
    }

    /**
     * Handles file processing logic
     * @param {File} file
     */
    const processLocalFile = async (file) => {
        const validation = validateFile(file)
        const slug = __.app.slugify(file.name)
        const currentId = `id_${_attemptCounter.current++}`

        const item = createListItem(file, validation)
        item.journeyStatus = JOURNEY_WAITING
        item.internalId = currentId

        $fileLoader.fileList.set(currentId, item)

        if (lgs.journeys.has(slug)) {
            updateFileStatus(currentId, JOURNEY_EXISTS, ALREADY_IMPORTED.text)
            if (slug === sampleSlug) {
                $fileLoader.sampleLoaded = true
            }

            UIToast.warning({
                                caption: ALREADY_IMPORTED.caption,
                                text:    `<strong>${file.name}</strong> ${ALREADY_IMPORTED.text}`,
                            })
            return
        }

        if (!validation.validated) {
            updateFileStatus(currentId, JOURNEY_KO, 'Format not supported')
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
                if (isDoublon && slug === sampleSlug) {
                    $fileLoader.sampleLoaded = true
                }

                UIToast.warning({
                                    caption: isDoublon ? ALREADY_IMPORTED.caption : IMPORT_FAILED.caption,
                                    text:    `<strong>${file.name}</strong> ${isDoublon ? ALREADY_IMPORTED.text : IMPORT_FAILED.text}`,
                                })
            }
        }
        catch (error) {
            updateFileStatus(currentId, JOURNEY_KO, 'Error during upload')
            triggerFailureEvent(file.name, error)
        }
    }

    /**
     * File input change handler
     */
    const handleFilesChange = (event) => {
        const currentFiles = Array.from(_filesDropper.current.files || [])
        currentFiles.forEach(file => processLocalFile(file))
        _filesDropper.current.files = []
    }

    /**
     * Loads sample file and updates Valtio store state
     */
    const loadSample = async () => {
        const currentId = `sample_${_attemptCounter.current++}`
        const mockFile = {name: GPX_SAMPLE_FILENAME, lastModified: 0, size: 0, type: 'application/gpx+xml'}
        const item = createListItem(mockFile, {validated: true, file: sampleFileInfo})

        if (lgs.journeys.has(sampleSlug)) {
            $fileLoader.sampleLoaded = true
            item.journeyStatus = JOURNEY_EXISTS
            item.error = ALREADY_IMPORTED.text
            $fileLoader.fileList.set(currentId, item)
            UIToast.warning({
                                caption: ALREADY_IMPORTED.caption,
                                text:    `The sample <strong>${GPX_SAMPLE_FILENAME}</strong> ${ALREADY_IMPORTED.text}`,
                            })
            return
        }

        item.journeyStatus = JOURNEY_WAITING
        $fileLoader.fileList.set(currentId, item)

        try {
            const response = await lgs.axios.get(GPX_SAMPLE_URL)
            const content = (typeof response.data === 'object') ? JSON.stringify(response.data) : response.data
            const status = await TrackUtils.loadJourneyFromFile({
                                                                    name:      sampleFileInfo.name,
                                                                    extension: sampleFileInfo.extension,
                                                                    content:   content,
                                                                })

            if (status === JOURNEY_OK) {
                updateFileStatus(currentId, JOURNEY_OK)
                $fileLoader.sampleLoaded = true
            }
            else {
                updateFileStatus(currentId, JOURNEY_KO, 'Sample load failed')
            }
        }
        catch (error) {
            updateFileStatus(currentId, JOURNEY_KO, 'Sample network error')
            triggerFailureEvent(GPX_SAMPLE_FILENAME, error)
        }
    }

    /**
     * Error handling for failed operations
     */
    const triggerFailureEvent = (fileName, error = null) => {
        console.error(`[JourneyLoader] Error: ${fileName}`, error)
        UIToast.error({
                          caption: IMPORT_FAILED.caption,
                          text:    `${fileName} ${IMPORT_FAILED.text}`,
                      })
    }

    /**
     * File validation logic
     */
    const validateFile = (file) => {
        let result = {validated: true, error: ''}
        const info = FileUtils.getFileNameAndExtension(file.name)
        if (!SUPPORTED_EXTENSIONS.includes(`.${info.extension}`)) {
            result.validated = false
            result.error = 'Format not supported'
        }
        else if (props.validateCB) {
            result = props.validateCB(file)
        }
        result.file = info
        return result
    }

    /**
     * Factory for list item objects
     */
    const createListItem = (file, validation) => {
        return {
            slug:      __.app.slugify(file.name),
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
        if (_filesDropper.current) {
            _filesDropper.current.value = ''
        }
        $fileLoader.fileList.clear()
        lgs.stores.ui.mainUI.journeyLoader.visible = false
    }


    return (
        <WaDialog
            open={journeyLoader.visible}
            id={'file-loader-modal'}
            label={'Add Journeys'}
            onWaRequestClose={close}
            className={'lgs-theme'}
            ref={_dialog}
        >
            <div className="download-columns">
                <WaFileInput
                    ref={_filesDropper}
                    className={'drag-and-drop-container'}
                    size="large"
                    multiple
                    accept={SUPPORTED_EXTENSIONS.join(',')}
                    hint={`Accepted formats: ${ACCEPTED_FILES}`}
                    onInput={handleFilesChange}
                >
                    <WaIcon slot="file-icon" name="route" variant="regular"/>
                    <label slot="dropzone">
                        <WaIcon name="route" variant="regular"/>
                        <strong>Drop your files here</strong>
                        <span>or click to browse</span>
                    </label>
                </WaFileInput>


                {fileList.size > 0 &&
                    <>
                        <WaDivider/>
                        <JourneyFilesList/>
                    </>
                }

                {showSampleButton &&
                    <>
                        {fileList.size === 0 && <WaDivider/>}
                    <div className={'load-sample'}>
                        {'Don\'t have any'}{lgs.journeys.size ? ' more ' : ' '}{'files handy?'}
                        <br/>
                        {'Play with a sample!'}
                        <WaButton onClick={loadSample} variant="brand" size="small">
                            <WaIcon slot="prefix" variant="regular" name="circle-plus"/>
                            {'Load Sample'}
                        </WaButton>
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
    )
}