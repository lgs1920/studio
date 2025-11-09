/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LocalDB.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-09
 * Last modified: 2025-11-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { openDB } from 'idb'

const MILLIS = 1000
const CACHE_TTL = 60000
const DEFAULT_RETRY_DELAY = 10
const DEFAULT_MAX_RETRIES = 3

/**
 * LocalDB - Wrapper around IndexedDB with nested keyPath, smart one-time index migration (no rebuild on every boot)
 */
export class LocalDB {
    #db = null
    #version = 1
    #stores = 'mystore'
    #name = 'mydb'
    #deletingKeys = new Set()
    #writingKeys = new Map()
    #transients = 'transients'
    #memoryCache = new Map()
    #cacheMaxSize = 1000
    #indexConfigs = {}
    #needsOneTimeRebuild = new Set()
    #oneTimeRebuilt = new Set()

    set = this.put
    update = this.put

    constructor({
                    name = this.#name,
                    stores = this.#stores,
                    manageTransients = false,
                    version = this.#version,
                } = {}) {
        const normalizedStores = Array.isArray(stores)
                                 ? stores.map(store => typeof store === 'string' ? {name: store, indexes: []} : store)
                                 : [{name: stores, indexes: []}]

        if (manageTransients) {
            normalizedStores.push({name: this.#transients, indexes: []})
        }

        this.#indexConfigs = normalizedStores.reduce((acc, cfg) => {
            acc[cfg.name] = cfg.indexes || []
            return acc
        }, {})

        this.#stores = normalizedStores.map(s => s.name)
        this.#name = name
        this.#version = version

        this.#db = openDB(this.#name, version, {
            upgrade:  this.#upgradeDatabase,
            blocked:  () => console.warn(`Upgrade blocked for ${this.#name} - close other tabs`),
            blocking: () => console.warn(`New version blocked - closing current DB`),
        })
    }

    get transientStore() {
        return this.#stores.includes(this.#transients) ? this.#transients : null
    }

    /**
     * Manual one-time rebuild (dev only if needed)
     *
     * @param {string} store - Store name
     */
    forceOneTimeRebuild = async store => {
        this.#validateStore(store)
        this.#oneTimeRebuilt.delete(store)
        await this.#rebuildOneTime(store)
    }

    /**
     * Internal one-time rebuild (clear + re-put to populate new index)
     *
     * @param {string} store - Store name
     */
    #rebuildOneTime = async store => {
        if (this.#oneTimeRebuilt.has(store)) {
            console.log(`One-time rebuild for "${store}" already done, skipping`)
            return
        }
        this.#oneTimeRebuilt.add(store)
        const callId = this.#generateCallId()
        console.log(`[${callId}] One-time rebuild for "${store}" (migrating index to data.group)...`)

        let itemCount = 0
        await this.#withTransaction(store, 'readwrite', async storeObj => {
            const allItems = await storeObj.getAll()
            const allKeys = await storeObj.getAllKeys()
            itemCount = allItems.length

            await storeObj.clear()
            for (let i = 0; i < allItems.length; i++) {
                await storeObj.put(allItems[i], allKeys[i])
            }
        })

        console.log(`[${callId}] One-time rebuild complete for "${store}" (${itemCount} items re-indexed)`)
    }

    /**
     * Upgrade handler - recreate index if keyPath changed
     *
     * @param {IDBDatabase} db
     * @param {number} oldVersion
     * @param {number} newVersion
     * @param {IDBVersionChangeEvent} transaction
     */
    #upgradeDatabase = (db, oldVersion, newVersion, transaction) => {
        console.log(`Upgrading ${this.#name} from ${oldVersion} to ${newVersion}`)

        const configs = this.#stores.map(name => ({
            name,
            indexes: this.#indexConfigs[name] || [],
        }))

        configs.forEach(config => {
            let store
            if (!db.objectStoreNames.contains(config.name)) {
                store = db.createObjectStore(config.name)
                console.log(`Store "${config.name}" created`)
            }
            else {
                store = transaction.objectStore(config.name)
                console.log(`Store "${config.name}" already exists, checking indexes...`)
            }

            config.indexes.forEach(idx => {
                const indexExists = store.indexNames.contains(idx.name)
                if (!indexExists) {
                    store.createIndex(idx.name, idx.keyPath, idx.options || {unique: false})
                    console.log(`Index "${idx.name}" added with keyPath "${idx.keyPath}"`)
                    this.#needsOneTimeRebuild.add(config.name)
                }
                else {
                    const existing = store.index(idx.name)
                    if (existing.keyPath !== idx.keyPath) {
                        console.warn(`Index "${idx.name}" keyPath changed "${existing.keyPath}" → "${idx.keyPath}", recreating...`)
                        store.deleteIndex(idx.name)
                        store.createIndex(idx.name, idx.keyPath, idx.options || {unique: false})
                        this.#needsOneTimeRebuild.add(config.name)
                    }
                }
            })
        })
    }

    /**
     * Post-upgrade one-time rebuild only if migration needed
     */
    #postUpgradeOneTimeRebuild = async () => {
        for (const store of this.#needsOneTimeRebuild) {
            await this.#rebuildOneTime(store)
        }
        this.#needsOneTimeRebuild.clear()
    }

    #getDB = async () => {
        const db = await this.#db
        if (this.#needsOneTimeRebuild.size > 0) {
            await this.#postUpgradeOneTimeRebuild()
        }
        return db
    }

    /**
     * Get item by key
     *
     * @param {string} key
     * @param {string} store
     * @param {boolean} full
     * @returns {Promise<any|null>}
     */
    get = async (key, store, full = false) => {
        this.#validateKey(key)
        this.#validateStore(store)
        const cacheKey = `${store}:${key}`

        if (this.#memoryCache.has(cacheKey)) {
            const cached = this.#memoryCache.get(cacheKey)
            if (cached.timestamp > Date.now() - CACHE_TTL) {
                return full ? cached.value : cached.value.data
            }
            this.#memoryCache.delete(cacheKey)
        }

        const callId = this.#generateCallId()
        try {
            const value = await this.#withTransaction(store, 'readonly', async storeObj => {
                const result = await storeObj.get(key)
                if (!result) {
                    return null
                }
                if (this.#isExpired(result)) {
                    await this.delete(key, store)
                    return null
                }
                return full ? result : result.data
            })

            if (value !== null && this.#memoryCache.size < this.#cacheMaxSize) {
                this.#memoryCache.set(cacheKey, {
                    value: full ? value : {data: value},
                    timestamp: Date.now(),
                })
            }
            return value
        }
        catch (error) {
            console.error(`[${callId}][${store}] Failed to get key "${key}":`, error)
            throw error
        }
    }

    /**
     * Put item (wrapper for set/update)
     *
     * @param {string} key
     * @param {any} value
     * @param {string} store
     * @param {number|null} ttl - seconds
     * @returns {Promise<void>}
     */
    put = async (key, value, store, ttl = null) => {
        this.#validateKey(key)
        this.#validateStore(store)
        const cacheKey = `${store}:${key}`

        if (this.#writingKeys.has(cacheKey)) {
            await this.#writingKeys.get(cacheKey)
        }

        let resolveWrite
        const writePromise = new Promise(resolve => {
            resolveWrite = resolve
        })
        this.#writingKeys.set(cacheKey, writePromise)

        try {
            await this.#withTransaction(store, 'readwrite', async storeObj => {
                const content = {
                    data: value,
                    _ct_: Date.now(),
                    _mt_: Date.now(),
                }
                if (ttl && ttl > 0) {
                    content._ttl_ = ttl * MILLIS
                    content._exp_ = Date.now() + ttl * MILLIS
                }
                await storeObj.put(content, key)
            })
            this.#memoryCache.delete(cacheKey)
            resolveWrite()
        }
        finally {
            this.#writingKeys.delete(cacheKey)
        }
    }

    /**
     * Delete item by key
     *
     * @param {string} key
     * @param {string} store
     * @returns {Promise<boolean>}
     */
    delete = async (key, store) => {
        this.#validateKey(key)
        this.#validateStore(store)
        const callId = this.#generateCallId()
        const cacheKey = `${store}:${key}`

        if (this.#deletingKeys.has(cacheKey)) {
            return false
        }
        this.#deletingKeys.add(cacheKey)

        try {
            const existed = await this.#withTransaction(store, 'readwrite', async storeObj => {
                const exists = await storeObj.get(key)
                if (!exists) {
                    return false
                }
                await storeObj.delete(key)
                return true
            })
            this.#memoryCache.delete(cacheKey)
            return existed
        }
        catch (error) {
            console.error(`[${callId}][${store}] Failed to delete key "${key}":`, error)
            throw error
        }
        finally {
            this.#deletingKeys.delete(cacheKey)
        }
    }

    /**
     * Clear entire store
     *
     * @param {string} store
     * @returns {Promise<void>}
     */
    clear = async store => {
        this.#validateStore(store)
        try {
            await this.#withTransaction(store, 'readwrite', async storeObj => storeObj.clear())
            for (const cacheKey of this.#memoryCache.keys()) {
                if (cacheKey.startsWith(`${store}:`)) {
                    this.#memoryCache.delete(cacheKey)
                }
            }
        }
        catch (error) {
            console.error(`Failed to clear store "${store}":`, error)
            throw error
        }
    }

    /**
     * Get all keys in store
     *
     * @param {string} store
     * @returns {Promise<string[]>}
     */
    keys = async store => {
        this.#validateStore(store)
        try {
            return await this.#withTransaction(store, 'readonly', async storeObj => storeObj.getAllKeys())
        }
        catch (error) {
            console.error(`Failed to get keys from "${store}":`, error)
            throw error
        }
    }

    /**
     * Check if key exists
     *
     * @param {string} key
     * @param {string} store
     * @returns {Promise<boolean>}
     */
    hasKey = async (key, store) => {
        this.#validateKey(key)
        this.#validateStore(store)
        try {
            return await this.get(key, store) !== null
        }
        catch {
            return false
        }
    }

    /**
     * Find by index with one-time migration if needed
     *
     * @param {string} indexName
     * @param {any} indexValue
     * @param {string} store
     * @param {boolean} full
     * @returns {Promise<any[]>}
     */
    findByIndex = async (indexName, indexValue, store, full = false) => {
        this.#validateStore(store)

        if (indexValue === undefined || indexValue === null) {
            return []
        }

        const cacheKey = `${store}:index:${indexName}:${JSON.stringify(indexValue)}`

        if (this.#memoryCache.has(cacheKey)) {
            const cached = this.#memoryCache.get(cacheKey)
            if (cached.timestamp > Date.now() - CACHE_TTL) {
                return full ? cached.value : cached.value.map(i => i.data)
            }
            this.#memoryCache.delete(cacheKey)
        }

        try {
            const results = await this.#withTransaction(store, 'readonly', async storeObj => {
                if (!storeObj.indexNames.contains(indexName)) {
                    throw new Error('NotFound')
                }
                const index = storeObj.index(indexName)
                const configIdx = (this.#indexConfigs[store] || []).find(i => i.name === indexName)
                if (configIdx && index.keyPath !== configIdx.keyPath) {
                    throw new Error('WrongKeyPath')
                }
                const totalCount = await storeObj.count()
                const indexCount = await index.count()
                if (totalCount > 0 && indexCount === 0) {
                    throw new Error('EmptyIndex')
                }

                const items = await index.getAll(indexValue)
                const validItems = []

                for (const item of items) {
                    if (!this.#isExpired(item)) {
                        validItems.push(full ? item : item.data)
                    }
                }

                return validItems
            })

            if (results.length > 0 && this.#memoryCache.size < this.#cacheMaxSize) {
                this.#memoryCache.set(cacheKey, {
                    value: full ? results : results.map(item => ({data: item.data || item})),
                    timestamp: Date.now(),
                })
            }
            return results
        }
        catch (error) {
            if (error.message === 'NotFound' || error.message === 'WrongKeyPath' || error.message === 'EmptyIndex') {
                console.warn(`Index "${indexName}" issue in "${store}" - triggering one-time migration rebuild...`)
                this.#oneTimeRebuilt.delete(store)
                await this.#rebuildOneTime(store)
                return this.findByIndex(indexName, indexValue, store, full)
            }
            console.error(`Failed to find by index "${indexName}" in "${store}":`, error)
            throw error
        }
    }

    deleteDB = async () => {
        return new Promise(resolve => {
            try {
                this.#db.then(db => db.close())
                const req = indexedDB.deleteDatabase(this.#name)
                req.onsuccess = () => resolve(1)
                req.onerror = () => resolve(0)
                req.onblocked = () => resolve(2)
            }
            catch (e) {
                resolve(0)
            }
        })
    }

    /**
     * Diagnose DB state (stores, indexes with keyPath and count)
     *
     * @returns {Promise<object>}
     */
    diagnose = async () => {
        try {
            const db = await this.#getDB()
            const result = {
                name:       this.#name,
                version:    db.version,
                stores:     {},
                cacheState: {
                    writing: this.#writingKeys.size,
                    deleting: this.#deletingKeys.size,
                    memory: this.#memoryCache.size,
                },
            }

            for (const store of this.#stores) {
                const tx = db.transaction(store, 'readonly')
                const s = tx.objectStore(store)
                const keys = await s.getAllKeys()
                const indexes = []
                for (const indexName of s.indexNames) {
                    const index = s.index(indexName)
                    const count = await index.count()
                    indexes.push({name: indexName, keyPath: index.keyPath.toString(), count})
                }
                result.stores[store] = {count: keys.length, keys: keys.slice(0, 10), indexes}
                await tx.done
            }
            return result
        }
        catch (e) {
            return {error: e.message}
        }
    }

    clearMemoryCache = () => this.#memoryCache.clear()

    /**
     * Transaction wrapper with retry
     *
     * @param {string} store
     * @param {string} mode
     * @param {function} operation
     * @param {object} options
     * @returns {Promise<any>}
     */
    #withTransaction = async (store, mode, operation, {
        retryDelay = DEFAULT_RETRY_DELAY,
        maxRetries = DEFAULT_MAX_RETRIES,
    } = {}) => {
        const db = await this.#getDB()
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const tx = db.transaction(store, mode)
                const result = await operation(tx.objectStore(store))
                await tx.done
                return result
            }
            catch (error) {
                if (attempt === maxRetries) {
                    throw error
                }
                await new Promise(r => setTimeout(r, retryDelay * attempt))
            }
        }
    }

    #validateKey = key => {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key: must be non-empty string.')
        }
    }
    #validateStore = store => {
        if (!store || !this.#stores.includes(store)) {
            throw new Error(`Invalid store: "${store}"`)
        }
    }
    #generateCallId = () => Math.random().toString(36).slice(2, 8)
    #isExpired = item => item._exp_ && Date.now() > item._exp_
}