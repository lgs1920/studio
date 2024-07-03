import axios from 'axios'
import { getFileAsString } from 'easy-file-picker'
import { MILLIS } from './AppUtils'

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

}

export const DRAG_AND_DROP_FILE_WAITING   =0,
             DRAG_AND_DROP_FILE_ACCEPTED  =1,
             DRAG_AND_DROP_FILE_REJECTED  =2,
             DRAG_AND_DROP_FILE_PARTIALLY = 3,

             DRAG_AND_DROP_STATUS_TIMER = 3*MILLIS