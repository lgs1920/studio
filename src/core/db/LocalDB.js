/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LocalDB.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-22
 * Last modified: 2025-06-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { openDB } from 'idb'

const MILLIS = 1000
const CACHE_TTL = 60000 // 1 minute in milliseconds
const DEFAULT_RETRY_DELAY = 10
const DEFAULT_MAX_RETRIES = 3

/**
 * LocalDB - A wrapper around IndexedDB with caching, TTL support, and transaction management
 *
 * Provides a simplified interface for IndexedDB operations with features like:
 * - Memory caching for improved performance
 * - TTL (Time-To-Live) support for automatic data expiration
 * - Transaction management with retry logic
 * - Transient data store support
 *
 * @example
 * const db = new LocalDB({
 *   name: 'myapp',
 *   stores: ['users', 'settings'],
 *   manageTransients: true
 * });
 *
 * await db.put('user1', { name: 'John' }, 'users');
 * const user = await db.get('user1', 'users');
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

    /**
     * Alias for put method - maintains compatibility with existing API
     * @type {Function}
     */
    set = this.put

    /**
     * Alias for put method - maintains compatibility with existing API
     * @type {Function}
     */
    update = this.put

    /**
     * Creates a new LocalDB instance
     *
     * @param {Object} options - Configuration options
     * @param {string} [options.name='mydb'] - Database name
     * @param {string|string[]} [options.stores='mystore'] - Store names
     * @param {boolean} [options.manageTransients=false] - Whether to create a transients store
     * @param {number} [options.version=1] - Database version
     */
    constructor({
                    name = this.#name,
                    stores = this.#stores,
                    manageTransients = false,
                    version = this.#version,
                }) {
        if (!(stores instanceof Array)) {
            stores = [stores]
        }
        if (manageTransients) {
            stores.push(this.#transients)
        }

        this.#stores = stores
        this.#name = name
        this.#version = version
        this.#deletingKeys = new Set()
        this.#writingKeys = new Map()

        const tables = this.#stores
        this.#db = openDB(this.#name, version, {
            upgrade(db, oldVersion, newVersion) {
                tables.forEach(table => {
                    if (!db.objectStoreNames.contains(table)) {
                        db.createObjectStore(table)
                    }
                })
                console.log(`Browser DB ${name} upgraded from version ${oldVersion} to ${newVersion}.`)
            },
        })
    }

    /**
     * Gets the transient store name if available
     * @returns {string|null} The transient store name or null if not available
     */
    get transientStore() {
        return this.#stores.includes(this.#transients) ? this.#transients : null
    }

    /**
     * Retrieves a value from the specified store
     *
     * @param {string} key - The key to retrieve
     * @param {string} store - The store name
     * @param {boolean} [full=false] - Whether to return full metadata or just data
     * @returns {Promise<any>} The value or null if not found/expired
     * @throws {Error} If the operation fails
     */
    async get(key, store, full = false) {
        this.#validateKey(key)
        this.#validateStore(store)

        const cacheKey = `${store}:${key}`

        // Check memory cache first
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

                // Check TTL expiration
                if (this.#isExpired(result)) {
                    await this.delete(key, store)
                    return null
                }

                return full ? result : result.data
            })

            // Cache the result if it exists and cache isn't full
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
     * Stores a key-value pair in the specified store
     *
     * @param {string} key - The key to store
     * @param {any} value - The value to store
     * @param {string} store - The store name
     * @param {number|null} [ttl=null] - Time-to-live in seconds, null for no expiration
     * @returns {Promise<void>} Resolves when the operation completes
     * @throws {Error} If the operation fails
     */
    async put(key, value, store, ttl = null) {
        this.#validateKey(key)
        this.#validateStore(store)

        const cacheKey = `${store}:${key}`

        // Wait for any ongoing write operation
        if (this.#writingKeys.has(cacheKey)) {
            await this.#writingKeys.get(cacheKey)
        }

        // Create promise for this write operation
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
                    content._exp_ = Date.now() + (ttl * MILLIS)
                }

                await storeObj.put(content, key)
            })

            // Invalidate memory cache
            this.#memoryCache.delete(cacheKey)
            resolveWrite()
        }
        finally {
            this.#writingKeys.delete(cacheKey)
        }
    }

    /**
     * Deletes a key from the specified store
     *
     * @param {string} key - The key to delete
     * @param {string} store - The store name
     * @returns {Promise<boolean>} True if deleted, false if key didn't exist or already being deleted
     * @throws {Error} If the operation fails
     */
    async delete(key, store) {
        this.#validateKey(key)
        this.#validateStore(store)

        const callId = this.#generateCallId()
        const cacheKey = `${store}:${key}`

        if (this.#deletingKeys.has(cacheKey)) {
            return false
        }
        this.#deletingKeys.add(cacheKey)

        try {
            const result = await this.#withTransaction(store, 'readwrite', async storeObj => {
                const existsBefore = await storeObj.get(key)
                if (!existsBefore) {
                    console.warn(`[${callId}][${store}] Key "${key}" does not exist.`)
                    return false
                }

                await storeObj.delete(key)
                return true
            })

            this.#memoryCache.delete(cacheKey)
            return result
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
     * Clears all keys from the specified store
     *
     * @param {string} store - The store name
     * @returns {Promise<void>} Resolves when the operation completes
     * @throws {Error} If the operation fails
     */
    async clear(store) {
        this.#validateStore(store)
        const callId = this.#generateCallId()

        try {
            await this.#withTransaction(store, 'readwrite', async storeObj => {
                await storeObj.clear()
            })

            // Clear related cache entries
            for (const [cacheKey] of this.#memoryCache) {
                if (cacheKey.startsWith(`${store}:`)) {
                    this.#memoryCache.delete(cacheKey)
                }
            }
        }
        catch (error) {
            console.error(`[${callId}][${store}] Failed to clear store:`, error)
            throw error
        }
    }

    /**
     * Retrieves all keys in the specified store
     *
     * @param {string} store - The store name
     * @returns {Promise<string[]>} Array of keys in the store
     * @throws {Error} If the operation fails
     */
    async keys(store) {
        this.#validateStore(store)
        const callId = this.#generateCallId()

        try {
            return await this.#withTransaction(store, 'readonly', async storeObj => {
                return await storeObj.getAllKeys()
            })
        }
        catch (error) {
            console.error(`[${callId}][${store}] Failed to get keys:`, error)
            throw error
        }
    }

    /**
     * Checks if a key exists in the store
     * 
     * @param {string} key - The key to check
     * @param {string} store - The store name
     * @returns {Promise<boolean>} True if the key exists and is valid, false otherwise
     */
    async hasKey(key, store) {
        this.#validateKey(key)
        this.#validateStore(store)

        try {
            const value = await this.get(key, store)
            return value !== null
        }
        catch {
            return false
        }
    }

    /**
     * Deletes the entire database
     *
     * @returns {Promise<number>} 0 on error, 1 on success, 2 if blocked
     */
    async deleteDB() {
        return new Promise(async (resolve) => {
            try {
                const db = await this.#db
                db.close()

                const request = window.indexedDB.deleteDatabase(this.#name)
                request.onerror = () => resolve(0)
                request.onsuccess = () => resolve(1)
                request.onblocked = () => {
                    console.error(`Error while deleting database ${this.#name}: blocked`)
                    resolve(2)
                }
            }
            catch (error) {
                console.error('Failed to delete database:', error)
                resolve(0)
            }
        })
    }

    /**
     * Diagnoses the database state and returns diagnostic information
     * 
     * @returns {Promise<Object>} Diagnostic information about the database
     */
    async diagnose() {
        try {
            const db = await this.#getDB()
            const result = {
                name:       this.#name,
                version:    this.#version,
                stores:     {},
                cacheState: {
                    writing: this.#writingKeys.size,
                    deleting: this.#deletingKeys.size,
                    memory:  this.#memoryCache?.size || 0,
                },
            }

            for (const store of this.#stores) {
                try {
                    const tx = db.transaction(store, 'readonly')
                    const keys = await tx.objectStore(store).getAllKeys()
                    result.stores[store] = {
                        count: keys.length,
                        keys: keys.slice(0, 10), // First 10 for debugging
                    }
                    await tx.done
                }
                catch (storeError) {
                    result.stores[store] = {error: storeError.message}
                }
            }

            return result
        }
        catch (error) {
            return {error: error.message}
        }
    }

    /**
     * Clears the memory cache
     */
    clearMemoryCache() {
        this.#memoryCache.clear()
        console.log('Memory cache cleared')
    }

    /**
     * Retrieves cache statistics
     * 
     * @returns {Object} Cache statistics including size, max size, and sample entries
     */
    getCacheStats() {
        return {
            size: this.#memoryCache.size,
            maxSize: this.#cacheMaxSize,
            entries: Array.from(this.#memoryCache.keys()).slice(0, 10),
        }
    }

    /**
     * Removes expired entries from the memory cache
     */
    cleanExpiredCache() {
        const now = Date.now()
        for (const [key, value] of this.#memoryCache) {
            if (value.timestamp < now - CACHE_TTL) {
                this.#memoryCache.delete(key)
            }
        }
    }

    // Private methods

    /**
     * Executes an operation within a transaction with retry logic
     *
     * @param {string} store - The store name
     * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
     * @param {Function} operation - Async function to execute within the transaction
     * @param {Object} [options] - Additional options
     * @param {number} [options.retryDelay=10] - Delay between retries in ms
     * @param {number} [options.maxRetries=3] - Maximum number of retries
     * @returns {Promise<any>} The result of the operation
     * @throws {Error} If the transaction fails after all retries
     * @private
     */
    async #withTransaction(store, mode, operation, options = {}) {
        const {
                  retryDelay = DEFAULT_RETRY_DELAY,
                  maxRetries = DEFAULT_MAX_RETRIES,
              } = options

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
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
            }
        }
    }

    /**
     * Retrieves the initialized IndexedDB database instance
     *
     * @returns {Promise<IDBDatabase>} The IndexedDB database instance
     * @throws {Error} If the database fails to initialize
     * @private
     */
    async #getDB() {
        try {
            return await this.#db
        }
        catch (error) {
            console.error('Failed to open database:', error)
            throw new Error('Database initialization failed.')
        }
    }

    /**
     * Validates a key parameter
     *
     * @param {string} key - The key to validate
     * @throws {Error} If the key is invalid
     * @private
     */
    #validateKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key: Key must be a non-empty string.')
        }
    }

    /**
     * Validates a store parameter
     *
     * @param {string} store - The store to validate
     * @throws {Error} If the store is invalid
     * @private
     */
    #validateStore(store) {
        if (!store || !this.#stores.includes(store)) {
            throw new Error(`Invalid store: "${store}" is not a valid store.`)
        }
    }

    /**
     * Generates a random call ID for logging purposes
     *
     * @returns {string} A random 6-character call ID
     * @private
     */
    #generateCallId() {
        return Math.random().toString(36).slice(2, 8)
    }

    /**
     * Checks if a stored item has expired based on TTL
     *
     * @param {Object} item - The stored item with metadata
     * @returns {boolean} True if expired, false otherwise
     * @private
     */
    #isExpired(item) {
        return item._exp_ && Date.now() > item._exp_
    }
}