/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LocalDB.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-17
 * Last modified: 2025-06-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

export class LocalDB {

    #db = null
    #version = 1
    #stores = 'mystore'
    #name = 'mydb'
    #deletingKeys = new Set()
    #writingKeys = new Map() // Use Map instead of Set
    #transients = 'transients'
    #content
    /**
     * Smart cache with invalidation
     */
    #memoryCache = new Map()
    #cacheMaxSize = 1000

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

        let tables = this.#stores
        this.#db = openDB(this.#name, version, {
            upgrade(db, undefined, version) {
                tables.forEach(table => {
                    if (!db.objectStoreNames.contains(table)) {
                        db.createObjectStore(table)
                    }
                })
                console.log(`Browser DB ${name} upgraded to version ${version}.`)
            },
        })
    }

    /**
     * Returns the transient store name
     *
     * @returns {string|null} The transient store name or null if not available
     */
    get transientStore() {
        if (this.#stores.includes(this.#transients)) {
            return this.#transients
        }
        return null
    }

    /**
     * Retrieves a key's value from the specified store.
     * @param {string} key - The key to retrieve.
     * @param {string} store - The store name.
     * @param {boolean} [full=false] - Whether to return the full value (including metadata).
     * @returns {Promise<any>} The value associated with the key, or `null` if not found.
     * @throws {Error} If the operation fails.
     */
    /**
     * Alias for put method - maintains compatibility with existing API
     */
    set = async (key, value, store, ttl = null) => {
        return await this.put(key, value, store, ttl)
    }

    async get(key, store, full = false) {
        const cacheKey = `${store}:${key}`

        // Check memory cache first
        if (this.#memoryCache.has(cacheKey)) {
            const cached = this.#memoryCache.get(cacheKey)
            if (cached.timestamp > Date.now() - 60000) { // Cache for 1 minute
                return full ? cached.value : cached.value.data
            }
        }

        // Retrieve from IndexedDB (use existing logic)
        const callId = Math.random().toString(36).slice(2, 8)

        try {
            if (!key || typeof key !== 'string') {
                throw new Error('Invalid key: Key must be a non-empty string.')
            }
            if (!store || !this.#stores.includes(store)) {
                throw new Error(`Invalid store: "${store}" is not a valid store.`)
            }

            const value = await this.#withTransaction(store, 'readonly', async storeObj => {
                const result = await storeObj.get(key)
                if (!result) {
                    return null
                }
                return full ? result : result.data
            })

            // Cache the result
            if (value && this.#memoryCache.size < this.#cacheMaxSize) {
                this.#memoryCache.set(cacheKey, {
                    value:     full ? value : {data: value},
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
     * Stores a key-value pair in the specified store.
     * @param {string} key - The key to store.
     * @param {any} value - The value to store.
     * @param {string} store - The store name.
     * @param {number|null} [ttl=null] - Time-to-live in seconds, or null for no expiration.
     * @returns {Promise<void>} Resolves when the operation completes.
     * @throws {Error} If the operation fails.
     */
    put = async (key, value, store, ttl = null) => {
        const cacheKey = `${store}:${key}`

        // If already being written, wait for completion
        if (this.#writingKeys.has(cacheKey)) {
            await this.#writingKeys.get(cacheKey)
            // Then continue normally with our write
        }

        // Create a promise for this write operation
        let resolveWrite
        const writePromise = new Promise(resolve => {
            resolveWrite = resolve
        })
        this.#writingKeys.set(cacheKey, writePromise)
        
        try {
            // Perform the write operation
            await this.#withTransaction(store, 'readwrite', async storeObj => {
                const content = {data: value, _ct_: Date.now(), _mt_: Date.now()}
                if (ttl) {
                    content._ttl_ = ttl * 1000
                }
                await storeObj.put(content, key)
            })

            // Invalidate memory cache
            this.#memoryCache.delete(cacheKey)

            resolveWrite() // Signal that the write is complete
        }
        finally {
            this.#writingKeys.delete(cacheKey)
        }
    }

    /**
     * Adds TTL to the content object if required
     * @param {Object} content - The content object to modify
     * @param {number} ttl - Time-to-live in milliseconds
     */
    setTTL = (content, ttl) => {
        if (ttl > 0) {
            let end = content._mt_ + ttl
            content.ttl = {
                duration: ttl,                                      // ttl in millis
                end:      end,                              // end in millis
            }
            content._iso_.ttl = DateTime.fromMillis(end).toISO()
        }
    }

    /**
     * Executes an operation within a transaction, handling commits and retries.
     * @param {string} store - The store name.
     * @param {string} mode - Transaction mode ('readonly' or 'readwrite').
     * @param {Function} operation - Async function to execute within the transaction.
     * @param {Object} [options] - Additional options.
     * @param {number} [options.commitDelay=0] - Delay after transaction commit (ms).
     * @param {number} [options.retryDelay=10] - Delay between retries (ms).
     * @param {number} [options.maxRetries=3] - Maximum verification retries.
     * @returns {Promise<any>} The result of the operation.
     * @throws {Error} If the transaction fails.
     * @private
     */
    async #withTransaction(store, mode, operation, options = {}) {
        const {
                  commitDelay = 0, // Reduce default delay
                  retryDelay  = 10,
                  maxRetries  = 3,
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
     * Updates a key's value in the specified store.
     * @param {string} key - The key to update.
     * @param {any} value - The new value.
     * @param {string} store - The store name.
     * @param {number} [ttl=0] - Time-to-live in seconds.
     * @returns {Promise<void>} Resolves when the operation completes.
     * @throws {Error} If the operation fails.
     */
    update = async (key, value, store, ttl = 0) => {
        const callId = Math.random().toString(36).slice(2, 8)

        try {
            await this.put(key, value, store, ttl)
        }
        catch (error) {
            console.error(`[${callId}][${store}] Failed to update key "${key}":`, error)
            throw error
        }
    }

    /**
     * Deletes a key from the specified store.
     * @param {string} key - The key to delete.
     * @param {string} store - The store name.
     * @returns {Promise<boolean>} `true` if deleted, `false` if the key didn't exist or was already being deleted.
     * @throws {Error} If the operation fails.
     */
    delete = async (key, store) => {
        const callId = Math.random().toString(36).slice(2, 8)
        const startTime = performance.now()
        const cacheKey = `${store}:${key}`

        if (this.#deletingKeys.has(cacheKey)) {
            return false
        }
        this.#deletingKeys.add(cacheKey)

        try {
            if (!key || typeof key !== 'string') {
                throw new Error('Invalid key: Key must be a non-empty string.')
            }
            if (!store || !this.#stores.includes(store)) {
                throw new Error(`Invalid store: "${store}" is not a valid store.`)
            }

            return await this.#withTransaction(store, 'readwrite', async storeObj => {
                const existsBefore = await storeObj.get(key)

                if (!existsBefore) {
                    console.warn(`[${callId}][${store}] Key "${key}" does not exist.`)
                    return false
                }

                await storeObj.delete(key)

                // Verify deletion
                let existsAfter
                for (let attempt = 1; attempt <= 2; attempt++) {
                    const verifyTx = (await this.#getDB()).transaction(store, 'readonly')
                    const verifyStore = verifyTx.objectStore(store)
                    existsAfter = await verifyStore.get(key)
                    await verifyTx.done

                    if (!existsAfter) {
                        break
                    }
                    await new Promise(resolve => setTimeout(resolve, 50))
                }

                if (existsAfter) {
                    const fallbackTx = (await this.#getDB()).transaction(store, 'readwrite')
                    const fallbackStore = fallbackTx.objectStore(store)
                    await fallbackStore.delete(key)
                    await fallbackTx.done

                    const finalCheck = await this.get(key, store)
                    if (finalCheck) {
                        console.error(`[${callId}][${store}] Fallback deletion failed: Key "${key}" still exists`)
                        const keys = await (await this.#getDB()).getAllKeys(store)
                        return false
                    }
                }

                return true
            })
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
     * Retrieves the initialized IndexedDB database instance.
     * Handles errors during database access and ensures proper initialization.
     *
     * @returns {Promise<IDBDatabase>} A promise that resolves to the IndexedDB database instance.
     * @throws {Error} If the database fails to initialize or open.
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
     * Removes a store from the database
     *
     * @param {string} store - The store name to remove
     * @returns {Promise<void>}
     */
    deleteStore = async (store) => {
        (await this.#db).deleteObjectStore(store)
    }

    /**
     * Removes all stores from the database
     *
     * @returns {Promise<void>}
     */
    deleteAllStores = async () => {
        (await this.#stores).forEach(store => this.deleteStore(store))
    }

    /**
     * Clears all keys from the specified store.
     * @param {string} store - The store name.
     * @returns {Promise<void>} Resolves when the operation completes.
     * @throws {Error} If the operation fails.
     */
    clear = async (store) => {
        const callId = Math.random().toString(36).slice(2, 8)
        const startTime = performance.now()

        try {
            if (!store || !this.#stores.includes(store)) {
                throw new Error(`Invalid store: "${store}" is not a valid store.`)
            }

            return await this.#withTransaction(store, 'readwrite', async storeObj => {
                await storeObj.clear()
            })
        }
        catch (error) {
            console.error(`[${callId}][${store}] Failed to clear store:`, error)
            throw error
        }
    }

    /**
     * Deletes the entire database
     *
     * @returns {Promise<number>} Returns 0 on error, 1 on success, 2 if blocked
     */
    deleteDB = async () => {
        return new Promise(async (resolve, reject) => {
            // Close transactions
            const idb = unwrap(this.#db).result
            const transactionNames = Array.from(idb.objectStoreNames)
            for (const storeName of transactionNames) {
                idb.transaction(storeName, 'readonly').abort()
            }
            idb.close()

            // Delete database
            const request = window.indexedDB.deleteDatabase(this.#name)
            request.onerror = () => {
                resolve(0)
            }
            request.onsuccess = () => {
                resolve(1)
            }
            request.onblocked = () => {
                console.error(`Error while deleting database ${this.#name}: blocked`)
                resolve(2)
            }
        })
    }

    /**
     * Retrieves all keys in the specified store.
     * @param {string} store - The store name.
     * @returns {Promise<string[]>} An array of keys in the store.
     * @throws {Error} If the operation fails.
     */
    keys = async (store) => {
        const callId = Math.random().toString(36).slice(2, 8)
        const startTime = performance.now()

        try {
            if (!store || !this.#stores.includes(store)) {
                throw new Error(`Invalid store: "${store}" is not a valid store.`)
            }

            return await this.#withTransaction(store, 'readonly', async storeObj => {
                const keys = await storeObj.getAllKeys()
                return keys
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
     * @returns {Promise<boolean>} True if the key exists, false otherwise
     */
    hasKey = async (key) => {
        const keys = await this.keys()
        return this.keys.includes(key)
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
                    writing:  this.#writingKeys.size,
                    deleting: this.#deletingKeys.size,
                    memory:   this.#memoryCache?.size || 0,
                },
            }

            for (const store of this.#stores) {
                try {
                    const tx = db.transaction(store, 'readonly')
                    const keys = await tx.objectStore(store).getAllKeys()
                    result.stores[store] = {
                        count: keys.length,
                        keys:  keys.slice(0, 10), // First 10 for debugging
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
     *
     * @returns {void}
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
            size:    this.#memoryCache.size,
            maxSize: this.#cacheMaxSize,
            entries: Array.from(this.#memoryCache.keys()).slice(0, 10),
        }
    }
}