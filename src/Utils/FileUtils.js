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

}

export const DRAG_AND_DROP_FILE_WAITING   =0,
             DRAG_AND_DROP_FILE_ACCEPTED  =1,
             DRAG_AND_DROP_FILE_REJECTED  =2,
             DRAG_AND_DROP_FILE_PARTIALLY = 3,

             DRAG_AND_DROP_STATUS_TIMER = 3*MILLIS