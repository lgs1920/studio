export class MapElement {

    slug
    name
    visible
    description


    constructor(props) {
    }

    /**
     * Clone an object
     *
     * @param properties are forced to the clone object
     */
    clone = (properties) => {
        // we deep clone the object
        let cloned = _.app.deepClone(this)

        // then add props
        for (const property in properties) {
            if (properties.hasOwnProperty(property)) {
                cloned[property] = properties[property]
            }
        }
        return cloned
    }

    /**
     * Serialize an object
     *
     * @param {boolean} json return json string if true else object
     * @return {Object | string} JSON
     */
    serialize(json = false) {
        let result = this
        for (let prop in result) {
            if (result[prop] instanceof Map) {
                result[prop] = Object.fromEntries(result[prop])
                result[prop]['__type'] = 'Map'
            }
        }
        return json ? JSON.stringify(result) : JSON.parse(JSON.stringify(result))
    }

    /**
     * Deserialize a JS or JSON object
     *
     * @param {Object|string} object
     * @param {boolean} full  if true it takes into account __type to
     *                        transform the properties in the right type.
     * @return {Object}
     */
    deserialize(object, full = true) {
        if (typeof object === 'string') {
            object = JSON.parse(object)
        }
        for (let prop in object) {
            if (full && object[prop]['__type'] === 'Map') {
                const myMap = new Map(Object.entries(object[prop]))
                myMap.delete('__type')
                object[prop] = myMap
            }
        }
        return object

    }

}