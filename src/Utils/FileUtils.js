import {getFileAsString} from 'easy-file-picker'

export class FileUtils {


    /**
     * Upload a file corresponding to the desired types
     *
     *
     * @returns {Promise<FileStringResult|string>}
     */
    static async uploadFileFromFrontEnd(props = null) {
        return await getFileAsString(
            props.accepted ? {acceptedExtensions: props.accepted} : {},
        ).then(file => {
            // Let's add extension info to file and change name by removing it
            const info = FileUtils.getFileNameAndExtension(file.name)
            file.name = info.name
            file.extension = info.extension

            // If no types specified, we force one type if mimes are specified
            // else we use extension as types then we return the file object
            if (file.type === '' && props.mimes) {
                file.type = props.mimes[file.extension][0]
                return file
            }
            // Else, Let's check for the type found in content to avoid hacking
            if (file.type === extension || (props.mimes && props.mimes[file.extension].includes(file.type))) {
                return file
            }

            return ''
        })
    }

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