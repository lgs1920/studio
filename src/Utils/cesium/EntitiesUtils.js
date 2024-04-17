export const POI_TYPE = 1
export const TRACK_TYPE = 2
export const JOURNEY_TYPE = 4
export const OTHER_TYPE = 3
export const NOT_AN_ENTITY = 0


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