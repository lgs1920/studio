import { detailedDiff }                       from 'deep-object-diff'
import { proxy, subscribe }                   from 'valtio'
import { SETTING_EXCLUSIONS, SETTINGS_STORE } from '../constants'

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
            newConfig = this.#syncAddedValues(newConfig, diffs.added)
        }
        // Remove Settings
        if (this.#data.deleted) {
            newConfig = this.#syncDeletedValues(newConfig, diffs.deleted)
        }
        // Update settings
        if (this.#data.updated && !SETTING_EXCLUSIONS.includes(this.key)) {
            newConfig = this.#syncUpdatedValues(newConfig, diffs.updated, SETTING_EXCLUSIONS, this.key)
        }
        return newConfig

    }

    /**
     * Check if section content has been changed
     *
     * @return {boolean}
     */
    hasChanged = () => {
        return this.#data.added || this.#data.updated || this.#data.deleted
    }

    /**
     * Sync target object with added values
     *
     * @param target {object} is the original object
     * @param toAdd {object} contains keys/values to remove
     *
     * @param excludeKeys      {[string]} define the excluded attributs by specifying the key path.
     *                                    'a.b.c' exclude {a:{b:c:d}
     * @param parentKey        {string} used in recursion
     *
     * @return {*}
     */

    #syncAddedValues = (target, toAdd, excludeKeys = [], parentKey = '') => {
        for (const key in toAdd) {
            if (Object.hasOwnProperty.call(toAdd, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key
                if (excludeKeys.includes(fullKey)) {
                    continue // Ignore les clés à exclure
                }
                if (typeof toAdd[key] === 'object' && toAdd[key] !== null) {
                    if (!target[key]) {
                        target[key] = Array.isArray(toAdd[key]) ? [] : {}
                    }
                    this.#syncAddedValues(target[key], toAdd[key], excludeKeys, fullKey)
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
     *
     * @param excludeKeys      {[string]} define the excluded attributs by specifying the key path.
     *                                    'a.b.c' exclude {a:{b:c:d}
     * @param parentKey        {string} used in recursion
     *
     * @return {*}
     */
    #syncDeletedValues(target, toRemove, excludeKeys = [], parentKey = '') {
        for (const key in toRemove) {
            if (Object.prototype.hasOwnProperty.call(toRemove, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key
                if (excludeKeys.includes(fullKey)) {
                    continue // Ignore les clés à exclure
                }
                if (typeof toRemove[key] === 'object' && toRemove[key] !== null && toRemove[key] !== undefined) {
                    if (target[key] && typeof target[key] === 'object') {
                        this.#syncDeletedValues(target[key], toRemove[key], excludeKeys, fullKey)
                    }
                }
                else {
                    if (Array.isArray(target)) {
                        target.splice(key, 1)
                    }
                    else if (typeof target === 'object') {
                        delete target[key]
                    }

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
     * @param excludeKeys      {[string]} define the excluded attributs by specifying the key path.
     *                                    'a.b.c' exclude {a:{b:c:d}
     * @param parentKey        {string} used in recursion
     * @return {*}
     */
    #syncUpdatedValues = (target, toUpdate, excludeKeys = [], parentKey = '') => {
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
                    this.#syncUpdatedValues(target[key], toUpdate[key], excludeKeys, fullKey)
                }
                else {
                    target[key] = toUpdate[key]
                }
            }
        }
        return target
    }

    #matchesExclusionKey = (exclusionKeys, path) => {
        exclusionKeys.forEach((exclusionKey) => {
            const keySegments = exclusionKey.split('.')
            const pathSegments = path.split('.')
            let keyIndex = 0
            for (let i = 0; i < pathSegments.length; i++) {
                if (keySegments[keyIndex] === pathSegments[i] || keySegments[keyIndex] === '*') {
                    keyIndex++
                }
                if (keyIndex === keySegments.length) {
                    return true
                }
            }
        })
        return false
    }
}
