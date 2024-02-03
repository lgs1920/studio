import {getFileAsString} from "easy-file-picker";

export class FileUtils {


    /**
     * Upload a file corresponding to the desired types
     *
     *
     * @returns {Promise<FileStringResult>}
     */
    static async uploadFileFromFrontEnd(types=null) {
        return await getFileAsString(
            types ? {acceptedExtensions: types}:{}
        ).then(file => {
            // If no types specified, we return the file without any checks
            return file

            // Else, Let's check for the real type found in content to avoid hacking
            let found = false
            let checkedFile=''
            types.forEach(type => {
                // If file type is empty, we cannot check.
                // So we hope that it is a text file #crossfingers
                if (!found && (file.type === '' || file.type.includes(type.slice(1)))) {
                    found = true
                    checkedFile = file
                }
            })
            return checkedFile;

        })
    }
}