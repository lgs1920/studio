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

        let tables = this.#stores // passe dto upgrad contest
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
     * Get a value in current store
     *
     *
     * @param key           The key used
     * @param store
     * @param full      If false (default), get returns only the value
     *                      else it returns value+ttl, ie the full DB data content
     * @return {Promise<null|any>}
     */
    get = async (key, store, full = false) => {

        // Get the normal value
        const data = await (await this.#db).get(store, key)
        if (!data) {
            return null
        }

        this.#content = data

        // If we need ttl, we return the full object
        if (full) {
            return data
        }
        return data.value

    }

    /**
     * Add a key/value with optional ttl
     *
     * We take into account if the transient already exist.
     * In this case, we update it
     *
     *
     * @param key
     * @param value         any kind of value
     * @param store
     * @param ttl           in milliseconds  null = no change
     *
     * @return the content saved
     */
    put = async (key, value, store, ttl = null) => {

        let now = DateTime.now()
        let old = await this.get(key, store, true)
        let content = {_iso_: {}}

        content.value = value                                               // Information to save

        // Do not change creation time if it is an update
        content._ct_ = old ? old._ct_ : now.toMillis()                      // Creation time in millis
        content._iso_._ct_ = DateTime.fromMillis(content._ct_).toISO()       // same in ISO

        content._mt_ = now.toMillis()                                       // Last modification time in millis
        content._iso_._mt_ = now.toISO()                                    // same in ISO

        // if there is no one existing nor ttl
        if (!old || (ttl !== null && ttl > 0)) {
            this.setTTL(content, ttl)
        }

        await (await this.#db).put(store, content, key)

        this.#content = content
        return this.#content

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
     *  Update a key with a new value
     *
     * @param key
     * @param value
     * @param store
     * @param ttl       in milliseconds
     * @return {Promise<*>}
     */
    update = async (key, value, store, ttl = 0) => {
        return this.put(key, value, store, ttl)

    }

    /**
     * delete a key
     *
     * @param key
     * @param store
     * @return {Promise<*>}
     */
    delete = async (key, store) => {
        return (await this.#db).delete(store, key)
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
     * Clear a store
     *
     * @return {Promise<*>}
     */
    clear = async (store) => {
        return (await this.#db).clear(store)
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
                console.error(`Error while deleting database ${this.#name}!`)
                resolve(0)
            }
            request.onsuccess = () => {
                console.log(`Database ${this.#name} deleted successfully.`)
                resolve(1)
            }
            request.onblocked = () => {
                console.error(`Error while deleting database ${this.#name}:blocked`)
                resolve(2)
            }
        })

    }


    /**
     * Get all keys
     *
     * @return {Promise<IDBRequest<IDBValidKey[]>>}
     */
    keys = async (store) => {
        return (await this.#db).getAllKeys(store)
    }

    hasKey = async (key) => {
        const keys = await this.keys()
        return this.keys.includes(key)
    }


}