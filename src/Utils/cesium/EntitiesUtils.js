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
        return lgs.viewer.entities.getById(`${prefix}-group`)
    }

    static getEntityById = (id) => {
        return lgs.viewer.entities.getById(id)
    }

    /**
     * Retrieve the entities
     *
     * @param name  {string|null}   name of the datasource
     */
    static getEntitiesByDataSourceName = (name) => {
        // if we do not have datasource name, we'll find in all datasource
        for (let i = 0; i < lgs.viewer.dataSources.length; i++) {
            const item = lgs.viewer.dataSources.get(i)
            if (item.name === name) {
                return item.entities
            }
        }
    }
}