/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FileUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-19
 * Last modified: 2026-04-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MILLIS } from '@Core/constants'

/* https://github.com/danisss9/easy-file-picker */

/**
 * Reads a file as text through a temporary object URL.
 * @param {File} file
 * @returns {Promise<string>}
 */
const readFileAsTextWithObjectUrl = async file => {
    const objectUrl = URL.createObjectURL(file)

    try {
        const response = await fetch(objectUrl)
        if (!response.ok) {
            throw new Error(`Unable to read file through object URL: ${response.status}`)
        }

        return await response.text()
    }
    finally {
        URL.revokeObjectURL(objectUrl)
    }
}

/**
 * Decodes a UTF-8 buffer into text.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
const decodeUtf8Buffer = buffer => new TextDecoder('utf-8').decode(buffer)

/**
 * Reads a file as text through FileReader.readAsText.
 * @param {File} file
 * @returns {Promise<string>}
 */
const readFileAsTextWithFileReaderText = file => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)

        reader.readAsText(file)
    })
}

/**
 * Reads a file as an UTF-8 buffer through FileReader.readAsArrayBuffer.
 * @param {File} file
 * @returns {Promise<string>}
 */
const readFileAsTextWithFileReaderBuffer = file => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => resolve(decodeUtf8Buffer(reader.result))
        reader.onerror = () => reject(reader.error)

        reader.readAsArrayBuffer(file)
    })
}

/**
 * Detects Android where object URL fetching can hide the original file-provider error.
 * @returns {boolean}
 */
const isAndroidPlatform = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

/**
 * Creates a file reading error that preserves every attempted browser API.
 * @param {Array<{strategy: string, error: unknown}>} attempts
 * @returns {Error}
 */
const createFileReadError = attempts => {
    const primaryAttempt = attempts.find(attempt => attempt.error?.name === 'NotFoundError') ?? attempts[0]
    const primaryError = primaryAttempt?.error
    const error = new Error(primaryError?.message ?? 'Unable to read file.')

    error.name = primaryError?.name ?? 'FileReadError'
    if (primaryError?.code !== undefined) {
        error.code = primaryError.code
    }
    error.cause = primaryError
    error.readAttempts = attempts.map(attempt => ({
        strategy: attempt.strategy,
        name:     attempt.error?.name ?? 'Unknown',
        code:     attempt.error?.code ?? 'Unknown',
        message:  attempt.error?.message ?? (typeof attempt.error === 'string' ? attempt.error : 'Unknown error'),
    }))

    return error
}

export class FileUtils {

    /**
     * Extract file extension (ie after the last dot)
     *
     * @param {string} fileName file name
     * @returns {*} extension
     */
    static getExtension(fileName) {
        return fileName.slice((Math.max(0, fileName.lastIndexOf('.')) || Infinity) + 1)
    }

    /**
     * Split file name in name and extension
     *
     * @param {string} fileName
     * @returns {{extension, name: *}}
     */
    static getFileNameAndExtension(fileName) {
        const extension = FileUtils.getExtension(fileName)
        const re = new RegExp(`.${extension}`, 'g')
        return {name: fileName.replace(re, ''), extension: extension}
    }

    /**
     * Read a file as text
     *
     * @param {File} file      file to read
     * @param manageContentCB  Callback used to manage read content.
     *             - {File} file      : this is tne entry File object
     *             - {string} content : this is the file content
     *             - {boolean} status : this is the reading status
     *
     */
    static readFileAsText = (file, manageContentCB = null) => {
        const reader = new FileReader()

        reader.addEventListener('load', () => {
                                    if (manageContentCB) {
                                        manageContentCB(file, reader.result, true)
                                    }
                                },
                                false,
        )
        reader.addEventListener('error', () => {
                                    if (manageContentCB) {
                                        manageContentCB(file, reader.result, false)
                                    }
                                },
                                false,
        )

        reader.readAsText(file)

    }

    /**
     * Read a file as text returning a Promise for async/await usage
     * @param {File} file
     * @returns {Promise<string>}
     */
    static readFileAsTextAsync = async (file) => {
        const attempts = []

        if (typeof file?.text === 'function') {
            try {
                return await file.text()
            }
            catch (error) {
                attempts.push({strategy: 'file.text', error})
            }
        }

        try {
            return await readFileAsTextWithFileReaderText(file)
        }
        catch (error) {
            attempts.push({strategy: 'FileReader.readAsText', error})
        }

        if (typeof file?.arrayBuffer === 'function') {
            try {
                return decodeUtf8Buffer(await file.arrayBuffer())
            }
            catch (error) {
                attempts.push({strategy: 'file.arrayBuffer', error})
            }
        }

        try {
            return await readFileAsTextWithFileReaderBuffer(file)
        }
        catch (error) {
            attempts.push({strategy: 'FileReader.readAsArrayBuffer', error})
        }

        if (!isAndroidPlatform() && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            try {
                return await readFileAsTextWithObjectUrl(file)
            }
            catch (error) {
                attempts.push({strategy: 'blob URL + fetch', error})
            }
        }

        throw createFileReadError(attempts)
    }

}

export const DRAG_AND_DROP_FILE_WAITING   =0,
             DRAG_AND_DROP_FILE_ACCEPTED  =1,
             DRAG_AND_DROP_FILE_REJECTED  =2,
             DRAG_AND_DROP_FILE_PARTIALLY = 3,
             DRAG_AND_DROP_STATUS_DELAY = 3*MILLIS
