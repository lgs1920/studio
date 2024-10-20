import { proxy, subscribe } from 'valtio'
import { SETTINGS_STORE }   from '../constants'

export class SettingsSection {

    /** @type {string} */
    key
    /** @type {object} */
    #content

    /**
     *
     * @param {string} key  section key
     */
    constructor(key) {
        this.key = key
    }

    /**
     * Content getter
     *
     * @return {Proxy}
     */
    get content() {
        return (this.#content.__value !== undefined) ? this.#content.__value : this.#content
    }

    /**
     * Each time a section content change, we save it
     *
     * @return {{}}
     */
    subscribeToChange=()=> {
        return subscribe(this.#content, async () => {
            await this.save()
        })
    }

    init = async () => {
        const data = await this.read()
        if (data === null) {
            if (lgs.configuration[this.key] !== undefined) {
                this.#content = proxy(
                    (lgs.configuration[this.key] instanceof Object) ? lgs.configuration[this.key]
                                                                    : {__value: lgs.configuration[this.key]},
                )
                await this.save()
                this.subscribeToChange()
            }
        }
        else {
            this.#content = proxy((data instanceof Object) ? data : {__value: data})
            lgs.configuration[this.key] = JSON.parse(JSON.stringify(data))
            this.subscribeToChange()
        }

    }

    /**
     * Save settings in indexedDB: Settings object is unproxified before saving
     *
     * @return {Promise<void>}
     */
    save = async () => {
        await lgs.db.settings.put(this.key, JSON.parse(JSON.stringify(this.content)), SETTINGS_STORE)
        lgs.configuration[this.key] = JSON.parse(JSON.stringify(this.content))
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
        if (!all) {
            return all
        }
        const value = parameter ? all[parameter] ?? undefined : all
        if (parameter) {
            lgs.configuration[this.key][parameter] = (value.__value !== undefined) ? value.__value : value
        }
        else {
            lgs.configuration[this.key] = (value.__value !== undefined) ? value.__value : value
        }
        return value
    }

    /**
     * Reset to factory setting
     *
     * @return {Promise<void>}
     */
    reset = async () => {
        this.#content = lgs.savedConfiguration[this.key]
        lgs.configuration[this.key] = JSON.parse(JSON.stringify(this.content))

    }
}
