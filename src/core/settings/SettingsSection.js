/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SettingsSection.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-02-20
 * Last modified: 2026-02-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SETTINGS_STORE }     from '@Core/constants'
import {
    SETTING_EXCLUSIONS,
    SETTING_EXCLUSION_ALLOWLIST,
    isSettingPathExcluded,
    shouldTraverseSettingPath,
} from '@Core/settings/settingsExclusions'
import { detailedDiff }       from 'deep-object-diff'
import { proxy, subscribe }   from 'valtio'

/**
 * A class to manage a section of settings, handling initialization, updates, and storage in IndexedDB.
 */
export class SettingsSection {
    /**
     * Identifying key for the settings section.
     * @type {string}
     */
    key

    /**
     * Proxied content object for reactivity.
     * @type {object}
     * @private
     */
    #content

    /**
     * Change tracking state for the section.
     * @type {{added: boolean, deleted: boolean, updated: boolean}}
     * @private
     */
    #data = {added: false, deleted: false, updated: false}

    /**
     * Creates a new SettingsSection instance.
     * @param {string} key - The section identifier.
     */
    constructor(key) {
        this.key = key
    }

    /**
     * Returns the unproxied content value.
     * @returns {object|any} The section content.
     */
    get content() {
        return this.#content.__value !== undefined ? this.#content.__value : this.#content
    }

    /**
     * Sets the section content and initializes the Valtio proxy.
     * @param {object|any} value - The new content.
     */
    set content(value) {
        this.#content = proxy({__value: value})
    }

    /**
     * Subscribes to proxy changes to trigger automatic persistence.
     * @returns {function} Cleanup function for the subscription.
     */
    subscribeToChange = () => {
        return subscribe(this.#content, async () => {
            await this.save()
        })
    }

    /**
     * Initializes the section by merging IndexedDB data with the base configuration.
     * @returns {Promise<void>}
     */
    init = async () => {
        const configFromJSON = JSON.parse(JSON.stringify(lgs.configuration[this.key]))
        const data = await this.read()

        if (data === null || data === undefined) {
            if (lgs.configuration[this.key] !== undefined) {
                this.#content = proxy(
                    lgs.configuration[this.key] instanceof Object
                    ? lgs.configuration[this.key]
                    : {__value: lgs.configuration[this.key]},
                )
                await this.save()
                this.subscribeToChange()
            }
        }
        else {
            const updated = this.update(data, configFromJSON)
            this.#content = proxy(updated instanceof Object ? updated : {__value: updated})
            lgs.configuration[this.key] = JSON.parse(JSON.stringify(updated))

            if (this.hasChanged()) {
                await this.save()
            }
            this.subscribeToChange()
        }
    }

    /**
     * Persists the current content to IndexedDB and syncs the global configuration.
     * @returns {Promise<void>}
     */
    save = async () => {
        await lgs.db.settings.put(this.key, JSON.parse(JSON.stringify(this.content)), SETTINGS_STORE)
        lgs.configuration[this.key] = JSON.parse(JSON.stringify(this.content))
    }

    /**
     * Fetches settings from IndexedDB for the current key.
     * @param {string} [parameter] - Optional specific parameter to retrieve.
     * @returns {Promise<object|any|null>} The stored data.
     */
    read = async (parameter = undefined) => {
        const all = await lgs.db.settings.get(this.key, SETTINGS_STORE)
        if (!all) {
            return all
        }

        const value = parameter ? all[parameter] ?? undefined : all
        if (parameter) {
            lgs.configuration[this.key][parameter] = value.__value !== undefined ? value.__value : value
        }
        else {
            lgs.configuration[this.key] = value.__value !== undefined ? value.__value : value
        }
        return value
    }

    /**
     * Reverts the section to factory default values.
     * @returns {Promise<void>}
     */
    reset = async () => {
        this.#content = lgs.savedConfiguration[this.key]
        lgs.configuration[this.key] = JSON.parse(JSON.stringify(this.content))
    }

    /**
     * Compares IndexedDB data with JSON template and applies safe updates.
     * @param {object|any} origin - Data from IndexedDB.
     * @param {object|any} updated - Data from JSON template.
     * @returns {object|any} The merged configuration.
     */
    update = (origin, updated) => {
        const newConfig = JSON.parse(JSON.stringify(origin))
        const diffs = detailedDiff(origin, updated)

        this.#data = {
            added:   Object.keys(diffs.added).length > 0,
            deleted: Object.keys(diffs.deleted).length > 0,
            updated: Object.keys(diffs.updated).length > 0,
        }

        if (this.#data.added) {
            this.#syncAddedValues(newConfig, diffs.added, SETTING_EXCLUSIONS, SETTING_EXCLUSION_ALLOWLIST, this.key)
        }
        if (this.#data.deleted) {
            this.#syncDeletedValues(newConfig, diffs.deleted, SETTING_EXCLUSIONS, SETTING_EXCLUSION_ALLOWLIST, this.key)
        }
        if (this.#data.updated) {
            this.#syncUpdatedValues(newConfig, diffs.updated, SETTING_EXCLUSIONS, SETTING_EXCLUSION_ALLOWLIST, this.key)
        }

        if (this.key === 'widgets') {
            this.#syncAddedValues(newConfig, updated, [], [], this.key)
            this.#data.added = this.#data.added || JSON.stringify(newConfig) !== JSON.stringify(origin)
        }

        return newConfig
    }

    /**
     * Returns true when the value is a plain object that can host nested settings.
     * @param {any} value
     * @returns {boolean}
     */
    #isPlainObject = value => typeof value === 'object' && value !== null && !Array.isArray(value)

    /**
     * Returns a migrated branch for nested settings when the stored shape no longer matches the template.
     * Primitive values are preserved into a `content` field when the template exposes one.
     *
     * @param {object|array} templateValue
     * @param {any} previousValue
     * @returns {object|array}
     */
    #cloneMigratedBranch = (templateValue, previousValue) => {
        const clone = JSON.parse(JSON.stringify(templateValue))

        if (this.#isPlainObject(clone) && previousValue !== undefined && previousValue !== null && typeof previousValue !== 'object') {
            if (Object.prototype.hasOwnProperty.call(clone, 'content')) {
                clone.content = previousValue
            }
        }

        return clone
    }

    /**
     * Returns true if any changes were detected during update.
     * @returns {boolean}
     */
    hasChanged = () => {
        return this.#data.added || this.#data.updated || this.#data.deleted
    }

    /**
     * Recursively adds missing keys from template to target.
     * Allows traversal into excluded paths to add new attributes without overwriting.
     * @private
     */
    #syncAddedValues = (target, toAdd, excludeKeys = [], allowKeys = [], parentKey = '') => {
        if (!this.#isPlainObject(target) && !Array.isArray(target)) {
            return target
        }

        for (const key in toAdd) {
            if (Object.hasOwnProperty.call(toAdd, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key

                if (typeof toAdd[key] === 'object' && toAdd[key] !== null) {
                    if (!shouldTraverseSettingPath(fullKey, excludeKeys, allowKeys)) {
                        continue
                    }

                    // Migrate legacy scalar branches to the new nested structure before recursing.
                    if (!this.#isPlainObject(target[key]) && !Array.isArray(target[key])) {
                        target[key] = this.#cloneMigratedBranch(toAdd[key], target[key])
                    }
                    this.#syncAddedValues(target[key], toAdd[key], excludeKeys, allowKeys, fullKey)
                }
                else if (!(key in target)) {
                    target[key] = toAdd[key]
                }
            }
        }
        return target
    }

    /**
     * Removes keys present in target but missing in template.
     * Strictly respects exclusions to prevent deletion of user-managed data.
     * @private
     */
    #syncDeletedValues = (target, toRemove, excludeKeys = [], allowKeys = [], parentKey = '') => {
        for (const key in toRemove) {
            if (Object.prototype.hasOwnProperty.call(toRemove, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key

                if (typeof toRemove[key] === 'object' && toRemove[key] !== null) {
                    if (target[key] && typeof target[key] === 'object' && shouldTraverseSettingPath(fullKey, excludeKeys, allowKeys)) {
                        this.#syncDeletedValues(target[key], toRemove[key], excludeKeys, allowKeys, fullKey)
                    }
                    continue
                }

                if (isSettingPathExcluded(fullKey, excludeKeys, allowKeys)) {
                    continue
                }

                if (Array.isArray(target)) {
                    target[key] = undefined
                }
                else {
                    delete target[key]
                }
            }
        }
        return target
    }

    /**
     * Updates existing keys in target with values from template.
     * Respects exclusion list for the entire path.
     * @private
     */
    #syncUpdatedValues = (target, toUpdate, excludeKeys = [], allowKeys = [], parentKey = '') => {
        for (const key in toUpdate) {
            if (Object.prototype.hasOwnProperty.call(toUpdate, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key

                if (typeof toUpdate[key] === 'object' && toUpdate[key] !== null) {
                    if (!shouldTraverseSettingPath(fullKey, excludeKeys, allowKeys)) {
                        continue
                    }

                    if (!target[key]) {
                        target[key] = Array.isArray(toUpdate[key]) ? [] : {}
                    }
                    this.#syncUpdatedValues(target[key], toUpdate[key], excludeKeys, allowKeys, fullKey)
                }
                else {
                    if (isSettingPathExcluded(fullKey, excludeKeys, allowKeys)) {
                        continue
                    }
                    target[key] = toUpdate[key]
                }
            }
        }
        return target
    }
}
