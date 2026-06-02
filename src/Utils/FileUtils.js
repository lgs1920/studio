/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FileUtils.js
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

import { MILLIS } from '@Core/constants'

/* https://github.com/danisss9/easy-file-picker */
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
    static readFileAsTextAsync = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()

            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(reader.error)

            reader.readAsText(file)
        })
    }

}

export const DRAG_AND_DROP_FILE_WAITING   =0,
             DRAG_AND_DROP_FILE_ACCEPTED  =1,
             DRAG_AND_DROP_FILE_REJECTED  =2,
             DRAG_AND_DROP_FILE_PARTIALLY = 3,
             DRAG_AND_DROP_STATUS_DELAY = 3*MILLIS