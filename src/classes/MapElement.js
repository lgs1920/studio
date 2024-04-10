export class MapElement {

    slug
    name
    visible
    description

    constructor(props) {
    }

    /**
     * Deserialize a JS or JSON object.
     *
     * If an instance has been given, we return the instance updated.
     *
     * @param {Object|string} object
     * @param {boolean} full  if true it takes into account __type to
     *                        transform the properties in the right type.
     * @return {Object}
     */
    static deserialize = (props) => {

        let object = props.object
        const full = props.full ?? true
        let instance = props.instance ?? {}

        if (typeof object === 'string') {
            object = JSON.parse(object)
        }

        for (let prop in object) {
            if (full && object[prop]['__type'] === 'Map') {
                const myMap = new Map(Object.entries(object[prop]))
                myMap.delete('__type')
                instance[prop] = myMap
            } else {
                instance[prop] = object[prop]
            }
        }
        return instance

    }

    /**
     * Clone an object
     *
     * @param properties are forced to the clone object
     * @param Class
     */
    clone = (properties) => {
        // we deep clone the object
        let cloned = _.app.deepClone(this)
        // If a property __class exists we us it for prototyping the new class
        if (properties.__class) {
            Object.setPrototypeOf(cloned, properties.__class)
        }

        // then add props
        for (const property in properties) {
            if (properties.hasOwnProperty(property) && property !== '__class') {
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
    serialize = (json = false) => {
        let result = {}
        for (let prop in this) {
            if (this[prop] instanceof Map) {
                result[prop] = Object.fromEntries(this[prop])
                result[prop]['__type'] = 'Map'
            } else {
                result[prop] = this[prop]
            }
        }
        result['__class'] = this.constructor.name
        return json ? JSON.stringify(result) : JSON.parse(JSON.stringify(result))
    }

}