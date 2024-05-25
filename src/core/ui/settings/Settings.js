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
    add = (key, section) => {
        this.#sections.set(key, section)
        Object.defineProperty(this, key, {
                get: function () {
                    return this.#sections.get(key).content
                },
            })


    }
}