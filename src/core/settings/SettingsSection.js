/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SettingsSection.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-06
 * Last modified: 2025-07-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SETTING_EXCLUSIONS, SETTINGS_STORE } from '@Core/constants'
import { detailedDiff }                       from 'deep-object-diff'
import { proxy, subscribe }                   from 'valtio'

/**
 * A class to manage a section of settings, handling initialization, updates, and storage in IndexedDB.
 */
export class SettingsSection {
    /**
     * The key identifying the settings section.
     * @type {string}
     */
    key

    /**
     * The private content object, proxied for reactivity.
     * @type {object}
     * @private
     */
    #content

    /**
     * Tracks changes (added, deleted, updated) in the section.
     * @type {{added: boolean, deleted: boolean, updated: boolean}}
     * @private
     */
    #data = {added: false, deleted: false, updated: false}

    /**
     * Creates a new SettingsSection instance.
     * @param {string} key - The key identifying the settings section.
     */
    constructor(key) {
        this.key = key
    }

    /**
     * Gets the content of the settings section, unproxied if necessary.
     * @returns {object|any} The content of the section.
     */
    get content() {
        return this.#content.__value !== undefined ? this.#content.__value : this.#content
    }

    /**
     * Sets the content of the settings section, wrapping it in a proxy.
     * @param {object|any} value - The new content value.
     */
    set content(value) {
        this.#content = proxy({__value: value})
    }

    /**
     * Subscribes to changes in the content and saves them automatically.
     * @returns {function} The subscription cleanup function.
     */
    subscribeToChange = () => {
        return subscribe(this.#content, async () => {
            await this.save()
        })
    }

    /**
     * Initializes the settings section by loading from IndexedDB or configuration.
     * @returns {Promise<void>}
     */
    init = async () => {
        const configFromJSON = JSON.parse(JSON.stringify(lgs.configuration[this.key]))
        const data = await this.read()
        if (data === null) {
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
     * Saves the settings to IndexedDB, unproxying the content before saving.
     * @returns {Promise<void>}
     */
    save = async () => {
        await lgs.db.settings.put(this.key, JSON.parse(JSON.stringify(this.content)), SETTINGS_STORE)
        lgs.configuration[this.key] = JSON.parse(JSON.stringify(this.content))
    }

    /**
     * Reads settings from IndexedDB, optionally for a specific parameter.
     * @param {string} [parameter] - If specified, returns only the value for the given parameter.
     * @returns {Promise<object|any|null>} The settings data or null if not found.
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
     * Resets the settings to their factory defaults.
     * @returns {Promise<void>}
     */
    reset = async () => {
        this.#content = lgs.savedConfiguration[this.key]
        lgs.configuration[this.key] = JSON.parse(JSON.stringify(this.content))
    }

    /**
     * Updates the configuration by applying differences between the origin and updated data.
     * @param {object|any} origin - The current configuration (from IndexedDB).
     * @param {object|any} updated - The new configuration (from JSON file).
     * @returns {object|any} The updated configuration.
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
            this.#syncAddedValues(newConfig, diffs.added, SETTING_EXCLUSIONS, this.key)
        }
        if (this.#data.deleted) {
            this.#syncDeletedValues(newConfig, diffs.deleted, SETTING_EXCLUSIONS, this.key)
        }
        if (this.#data.updated && !SETTING_EXCLUSIONS.includes(this.key)) {
            this.#syncUpdatedValues(newConfig, diffs.updated, SETTING_EXCLUSIONS, this.key)
        }
        return newConfig
    }

    /**
     * Checks if the section content has changed.
     * @returns {boolean} True if the section has added, deleted, or updated values.
     */
    hasChanged = () => {
        return this.#data.added || this.#data.updated || this.#data.deleted
    }

    /**
     * Syncs the target object with added values, respecting excluded keys.
     * @param {object|any[]} target - The original object or array to modify.
     * @param {object} toAdd - The added keys/values to sync.
     * @param {string[]} excludeKeys - Keys to exclude from syncing.
     * @param {string} parentKey - The parent key path for recursive calls.
     * @returns {object|any[]} The modified target.
     * @private
     */
    #syncAddedValues = (target, toAdd, excludeKeys = [], parentKey = '') => {
        for (const key in toAdd) {
            if (Object.hasOwnProperty.call(toAdd, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key
                if (excludeKeys.includes(fullKey) || excludeKeys.includes(this.key)) {
                    continue
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
     * Syncs the target object with deleted values, respecting excluded keys.
     * @param {object|any[]} target - The original object or array to modify.
     * @param {object} toRemove - The keys/values to remove.
     * @param {string[]} excludeKeys - Keys to exclude from syncing.
     * @param {string} parentKey - The parent key path for recursive calls.
     * @returns {object|any[]} The modified target.
     * @private
     */
    #syncDeletedValues = (target, toRemove, excludeKeys = [], parentKey = '') => {
        for (const key in toRemove) {
            if (Object.prototype.hasOwnProperty.call(toRemove, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key
                if (excludeKeys.includes(fullKey) || excludeKeys.includes(this.key)) {
                    continue
                }
                if (typeof toRemove[key] === 'object' && toRemove[key] !== null && toRemove[key] !== undefined) {
                    if (target[key] && typeof target[key] === 'object') {
                        this.#syncDeletedValues(target[key], toRemove[key], excludeKeys, fullKey)
                    }
                }
                else {
                    if (Array.isArray(target) && !isNaN(key)) {
                        target.splice(Number(key), 1)
                    }
                    else if (typeof target === 'object') {
                        delete target[key]
                    }
                }
            }
        }
        return target
    }

    /**
     * Syncs the target object with updated values, respecting excluded keys.
     * @param {object|any[]} target - The original object or array to modify.
     * @param {object} toUpdate - The keys/values to update.
     * @param {string[]} excludeKeys - Keys to exclude from syncing.
     * @param {string} parentKey - The parent key path for recursive calls.
     * @returns {object|any[]} The modified target.
     * @private
     */
    #syncUpdatedValues = (target, toUpdate, excludeKeys = [], parentKey = '') => {
        for (const key in toUpdate) {
            if (Object.prototype.hasOwnProperty.call(toUpdate, key)) {
                const fullKey = parentKey ? `${parentKey}.${key}` : key
                if (excludeKeys.includes(fullKey) || excludeKeys.includes(this.key)) {
                    continue
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
}