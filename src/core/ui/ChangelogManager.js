
export class ChangelogManager {

    constructor() {
        // Singleton
        if (ChangelogManager.instance) {
            return ChangelogManager.instance
        }
        ChangelogManager.instance = this
    }

    /**
     * List the change log directory and get all markdown files.
     * @return {{files:[],last:{}}}
     */
    list = async () => {
      return lgs.axios.get(`${[lgs.BACKEND_API,'changelog','list'].join('/')}?extension=md`)
            .then(function (response) {
                return response.data
            })
            .catch(function () {
                return {list: [], last: undefined}
            })
    }

    /**
     * Get all th files that were created after the last visit
     *
     * @param {[{name,time}]} files
     * @param {timestamp} lastVisit  the last visit date
     *
     * @return {[{name,time}]}
     */
    whatsNew = (files,lastVisit) => {
        return files.filter(file=> file.time > lastVisit)
    }

    /**
     * Read  changelog file
     */
    read =async(file)=> {
        return lgs.axios.get([lgs.BACKEND_API,'changelog','read',file].join('/'))
            .then(function (response) {
                return response.data.content
            })
            .catch(function (error) {
                console.error(error)
                return ''
            })
    }
}
