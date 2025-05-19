/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LocalDB.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-19
 * Last modified: 2025-05-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Dependencies
 */
import { openDB, unwrap } from 'idb'
import { DateTime }       from 'luxon'

let millis = 1000

export class LocalDB {

    #db = null
    #version = 1
    #stores = 'mystore'
    #name = 'mydb'
    #deletingKeys = new Set()
    #writingKeys = new Set()
    #transients = 'transients'
    #content

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
        this.#writingKeys = new Set()

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
     * Return the transient store name
     *
     * @return {*|null}
     */
    get transientStore() {
        if (this.#stores.includes(this.#transients)) {
            return this.#transients
        }
        return null
    }

    /**
     * Retrieves a key’s value from the specified store.
     * @param {string} key - The key to retrieve.
     * @param {string} store - The store name.
     * @param {boolean} [full=false] - Whether to return the full value (including metadata).
     * @returns {Promise<any>} The value associated with the key, or `null` if not found.
     * @throws {Error} If the operation fails.
     */
    get = async (key, store, full = false) => {
        const callId = Math.random().toString(36).slice(2, 8)
        const startTime = performance.now()

        try {
            if (!key || typeof key !== 'string') {
                throw new Error('Invalid key: Key must be a non-empty string.')
            }
            if (!store || !this.#stores.includes(store)) {
                throw new Error(`Invalid store: "${store}" is not a valid store.`)
            }

            return await this.#withTransaction(store, 'readonly', async storeObj => {
                const value = await storeObj.get(key)

                if (!value) {
                    return null
                }

                return full ? value : value.data // Adjust based on your value structure
            })
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
        const callId = Math.random().toString(36).slice(2, 8)
        const startTime = performance.now()
        const cacheKey = `${store}:${key}`

        if (this.#writingKeys.has(cacheKey)) {
            return
        }
        this.#writingKeys.add(cacheKey)

        try {
            if (!key || typeof key !== 'string') {
                throw new Error('Invalid key: Key must be a non-empty string.')
            }
            if (!store || !this.#stores.includes(store)) {
                throw new Error(`Invalid store: "${store}" is not a valid store.`)
            }

            return await this.#withTransaction(store, 'readwrite', async storeObj => {
                const content = {data: value, _ct_: Date.now(), _mt_: Date.now()}
                if (ttl) {
                    content._ttl_ = ttl * 1000
                }

                await storeObj.put(content, key)
            })
        }
        catch (error) {
            console.error(`[${callId}][${store}] Failed to put key "${key}":`, error)
            throw error
        }
        finally {
            this.#writingKeys.delete(cacheKey)
        }
    }

    /**
     * Add the object ttl if required
     * @param ttl
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
     * @param {number} [options.commitDelay=100] - Delay after transaction commit (ms).
     * @param {number} [options.retryDelay=50] - Delay between retries (ms).
     * @param {number} [options.maxRetries=2] - Maximum verification retries.
     * @returns {Promise<any>} The result of the operation.
     * @throws {Error} If the transaction fails.
     * @private
     */
    async #withTransaction(store, mode, operation, {commitDelay = 100, retryDelay = 50, maxRetries = 2} = {}) {
        const db = await this.#getDB()
        if (!db.objectStoreNames.contains(store)) {
            throw new Error(`Store "${store}" does not exist in the database.`)
        }

        const tx = db.transaction(store, mode)
        let result
        try {
            result = await operation(tx.objectStore(store))
            await tx.done
            if (mode === 'readwrite') {
                await new Promise(resolve => setTimeout(resolve, commitDelay))
            }
            return result
        }
        catch (error) {
            console.error(`Transaction failed for store "${store}":`, error)
            throw error
        }
    }

    /**
     * Updates a key’s value in the specified store.
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
     * @returns {Promise<boolean>} `true` if deleted, `false` if the key didn’t exist or was already being deleted.
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
     * Remove a store
     *
     * @param store
     */
    deleteStore = async (store) => {
        (await this.#db).deleteObjectStore(store)
    }

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

    deleteDB = async () => {
        return new Promise(async (resolve, reject) => {
            // Close transactions
            const idb = unwrap(this.#db).result
            const transactionNames = Array.from(idb.objectStoreNames)
            for (const storeName of transactionNames) {
                idb.transaction(storeName, 'readonly').abort()
            }
            idb.close()

            //Delete database
            const request = window.indexedDB.deleteDatabase(this.#name)
            request.onerror = () => {
                resolve(0)
            }
            request.onsuccess = () => {
                resolve(1)
            }
            request.onblocked = () => {
                console.error(`Error while deleting database ${this.#name}:blocked`)
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

    hasKey = async (key) => {
        const keys = await this.keys()
        return this.keys.includes(key)
    }


}