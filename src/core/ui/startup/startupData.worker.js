/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: startupData.worker.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {openDB} from 'idb'
import {streamStartupJourney, streamStartupPOIs} from './startupData.js'

let nextPacketId = 0
const acknowledgements = new Map()

const acknowledge = id => {
    const resolve = acknowledgements.get(id)
    if (resolve) {
        acknowledgements.delete(id)
        resolve()
    }
}

const emit = data => new Promise(resolve => {
    const id = ++nextPacketId
    acknowledgements.set(id, resolve)
    self.postMessage({type: 'packet', id, data})
})

const openReader = async name => {
    const db = await openDB(name)
    return {
        close: () => db.close(),
        get: async (store, key) => {
            const value = await db.get(store, key)
            if (!value || (value.expiresAt && value.expiresAt <= Date.now())) {
                return null
            }
            return value.data ?? value
        },
        keys: store => db.getAllKeys(store),
        scan: async function* (store, keys, batchSize = 128) {
            for (let index = 0; index < keys.length; index += batchSize) {
                yield Promise.all(keys.slice(index, index + batchSize).map(key => db.get(store, key)))
            }
        },
    }
}

self.onmessage = async event => {
    const message = event.data
    if (message?.type === 'ack') {
        acknowledge(message.id)
        return
    }
    if (message?.type !== 'request') {
        return
    }

    let reader
    try {
        reader = await openReader(message.database)
        const requestType = message.requestType ?? message.type
        if (requestType === 'journey') {
            const value = await reader.get('journeys', message.key)
            if (value) {
                await streamStartupJourney(value, emit, message)
            }
        }
        else if (requestType === 'journey-keys') {
            await emit({type: 'journey-keys', keys: await reader.keys('journeys')})
        }
        else if (requestType === 'pois') {
            const keys = await reader.keys('pois')
            await streamStartupPOIs((async function* () {
                for await (const batch of reader.scan('pois', keys)) {
                    yield batch.map(value => value?.data ?? value)
                }
            })(), emit, message)
        }
        self.postMessage({type: 'done', result: true})
    }
    catch (error) {
        self.postMessage({type: 'error', message: error?.message ?? String(error)})
    }
    finally {
        reader?.close()
    }
}
