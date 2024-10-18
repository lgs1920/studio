import { proxy, subscribe } from 'valtio'
import { SETTINGS_STORE }   from '../constants'

export class SettingsSection {

    /** @type {string} */
    key
    /** @type {object} */
    #content

    /**
     *
     * @param {object} section {key,content}
     */
    constructor(section) {
        this.key = section.key
        this.#content = proxy(section.content)
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

            // Each time we update a parameter in this store, we save it
            this.subscribeToChange()
        })()




    }
    subscribeToChange=()=> {
        return subscribe(this.#content, async () => {
            //console.log('subscribe =>', this.#content)
            await this.save()
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
        await lgs.db.settings.put(this.key, JSON.parse(JSON.stringify(this.#content)), SETTINGS_STORE)
    }

    /**
     *  Read Settings: We proxify the read object
     *
     *  @param  {any} parameter : if specified we return only the corresponding value
     *
     *  @return {Promise<void>}
     */
    read = async (parameter = undefined) => {
        const all = await lgs.db.settings.get(this.key, SETTINGS_STORE)
        return parameter ? all[parameter] ?? undefined : all
    }
}
