import { detailedDiff }     from 'deep-object-diff'
import { proxy, subscribe } from 'valtio'
import { SETTINGS_STORE }   from '../constants'


export class SettingsSection {

    /** @type {string} */
    key
    /** @type {object} */
    #content
    /** @type {object} */
    #data = {added: false, deleted: false, updated: false}

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
    subscribeToChange = () => {
        return subscribe(this.#content, async () => {
            await this.save()
        })
    }

    init = async () => {
        const configFromJSON = JSON.parse(JSON.stringify(lgs.configuration[this.key]))
        const data = await this.read()
        if (data === null) {
            if (lgs.configuration[this.key] !== undefined) {
                this.#content = proxy(
                    (lgs.configuration[this.key] instanceof Object) ? lgs.configuration[this.key]
                                                                    : {__value: lgs.configuration[this.key]},
                )
                await this.save()

                // Subscribe Proxy to change
                this.subscribeToChange()
            }
        }
        else {
            // let's update settings if it is necessary
            const updated = this.update(data, configFromJSON)
            //TODO add exclusion

            // Use them
            this.#content = proxy((updated instanceof Object) ? updated : {__value: updated})
            lgs.configuration[this.key] = JSON.parse(JSON.stringify(updated))

            // Some changes? => save them
            if (this.hasChanged()) {
                await this.save()
            }

            // Subscribe Proxy to change
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

    /**
     * Return updated configuration
     *
     * @param origin    : read from internal DB
     * @param updated   : read from file
     *
     * @return {{}} updated configuration
     *
     */
    update = (origin, updated) => {
        const diffs = detailedDiff(origin, updated)
        this.#data = {
            added:   !__.app.isEmpty(diffs.added),
            deleted: !__.app.isEmpty(diffs.deleted),
            updated: !__.app.isEmpty(diffs.updated),
        }
        let newConfig = origin

        // Add new settings
        if (this.#data.added) {
            newConfig = this.#syncAddingValues(origin, diffs.added)
        }
        // Remove Settings
        if (this.#data.deleted) {
            newConfig = this.#syncRemovingValues(newConfig, diffs.deleted)
        }

        // Update settings
        if (this.#data.deleted) {
            newConfig = this.#syncUpdatingValues(newConfig, diffs.updated)
        }
        return newConfig

    }

    /**
     * Check if section content has been changed
     *
     * @return {boolean}
     */
    hasChanged = () => {
        return this.#data.added || this.#data.deleted || this.#data.deleted
    }

    /**
     * Sync target object with added values
     *
     * @param target {object} is the original object
     * @param toAdd {object} contains keys/values to remove
     *
     * @return {*}
     */
    #syncAddingValues = (target, toAdd) => {
        for (const key in toAdd) {
            if (Object.hasOwnProperty.call(toAdd, key)) {
                if (typeof toAdd[key] === 'object' && toAdd[key] !== null) {
                    if (!target[key]) {
                        target[key] = Array.isArray(toAdd[key]) ? [] : {}
                    }
                    this.#syncAddingValues(target[key], toAdd[key])
                }
                else {
                    target[key] = toAdd[key]
                }
            }
        }
        return target
    }


    /**
     * Sync target object with removed values
     *
     * @param target {object} is the original object
     * @param toRemove {object} contains keys/values to remove
     * @return {*}
     */
    #syncRemovingValues(target, toRemove) {
        for (const key in toRemove) {
            if (Object.prototype.hasOwnProperty.call(toRemove, key)) {
                if (typeof toRemove[key] === 'object' && toRemove[key] !== null) {
                    if (target[key] && typeof target[key] === 'object') {
                        this.#syncRemovingValues(target[key], toRemove[key])
                    }
                }
                else {
                    delete target[key]
                }
            }
        }
        return target
    }

    /*
     * Sync target object with updated values
     *
     * @param target {object} is the original object
     * @param updated {object} contains keys/values to update
     *
     * @param excludeKeys      {[string]} define the excluded attributs by specifying the ley path.
     *                                    'a.b.c' exclude {a:{b:c:d}
     * @param parentKey        {string} used in recursion
     * @return {*}
     */
    #syncUpdatingValues = (target, toUpdate, excludeKeys = [], parentKey = '') => {
        for (const key in toUpdate) {
            if (Object.prototype.hasOwnProperty.call(toUpdate, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key
                if (excludeKeys.includes(fullKey)) {
                    continue // Ignore les clés à exclure
                }
                if (typeof toUpdate[key] === 'object' && toUpdate[key] !== null) {
                    if (!target[key]) {
                        target[key] = Array.isArray(toUpdate[key]) ? [] : {}
                    }
                    this.#syncUpdatingValues(target[key], toUpdate[key], excludeKeys, fullKey)
                }
                else {
                    target[key] = toUpdate[key]
                }
            }
        }
        return target
    }
}
