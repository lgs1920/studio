export class EntitiesUtils {
    /**
     * Get a group of entities.
     *
     *  Some entities group are created on init under the id <prefix>-group
     *
     *
     * @param prefix
     * @return {*}
     */
    static getGroupById = (prefix) => {
        return vt3d.viewer.entities.getById(`${prefix}-group`)
    }

    static getEntityById = (id) => {
        return vt3d.viewer.entities.getById(id)
    }
}