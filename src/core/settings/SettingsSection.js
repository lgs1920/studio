import { proxy, subscribe } from 'valtio'
import { SETTINGS_STORE }   from '../LGS1920Context.js'

export class SettingsSection {

    /** @type {string} */
    key
    /** @type {object} */
    #content

    /**
     *
     * @param {string} key
     * @param {object} section
     */
    constructor(key, section) {
        this.key = key
        this.#content = proxy(section)
        let data = {};

        (async () => {
            data = await this.read()
            if (data === null) {
                (async () => {
                    await this.save()
                })()
            } else {
                this.#content = proxy(data)
            }
        })()


        // Each time we update a parameter in this store, we save it
        subscribe(this.#content, () => {
            this.save()
        })


    }

    /**
     * Content getter
     *
     * @return {Proxy}
     */
    get content() {
        return this.#content
    }

    /**
     * Save settings in indexedDB: Settings object is unproxified before saving
     *
     * @return {Promise<void>}
     */
    save = async () => {
        await lgs.db.lgs1920.put(this.key, JSON.parse(JSON.stringify(this.#content)), SETTINGS_STORE)
    }

    /**
     *  Read Settings: We proxify the read object
     *
     *  @param  {any} parameter : if specified we return only the corresponding value
     *
     *  @return {Promise<void>}
     */
    read = async (parameter = undefined) => {
        const all = await lgs.db.lgs1920.get(this.key, SETTINGS_STORE)
        return parameter ? all[parameter] ?? undefined : all
    }
}
