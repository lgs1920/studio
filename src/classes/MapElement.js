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
            if (full && object[prop] instanceof Array && object[prop].some(function (item) {
                return item['__type'] === 'Map'
            })) {
                const myMap = new Map()
                object[prop].forEach((item) => {
                    if (item.key) { // avoid __type
                        myMap.set(item.key, item.value)
                    }
                })
                instance[prop] = myMap
            } else {
                instance[prop] = object[prop]
            }
        }
        return instance

    }

    /**
     * Serialize an object
     *
     * @param object
     * @param {boolean} json return json string if true else object
     * @return {Object | string} JSON
     */
    static serialize = (object, json = false) => {
        const result = _.app.deepClone(object)
        for (let prop in object) {
            if (object[prop] instanceof Map) {
                result[prop] = Array.from(object[prop], ([key, value]) => {
                    return {key, value}
                })
                result[prop].push({__type: 'Map'})
            }
        }
        return json ? JSON.stringify(result) : JSON.parse(JSON.stringify(result))
    }
}