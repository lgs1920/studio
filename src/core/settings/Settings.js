import { snapshot } from 'valtio'

export class Settings {

    /** @type {Map} */
    #sections

    constructor() {

        if (Settings.instance) {
            return Settings.instance
        }

        this.#sections = new Map()
        Settings.instance= this
    }

    /**
     * Add a new section to Settings and define getter using the key
     *
     * @param {string} key
     * @param {object} section
     */
    add = ( section) => {
        this.#sections.set(section.key, section)
        // key
        Object.defineProperty(this, section.key, {
                get: function () {
                    return this.#sections.get(section.key).content
                }
            })

        // snapKey
        Object.defineProperty(this, __.app.camelCase(`snap-${section.key}`), {
            get: function () {
                return snapshot(this.#sections.get(section.key).content)
            }
        })
    }
}