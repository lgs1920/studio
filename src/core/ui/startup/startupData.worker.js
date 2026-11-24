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
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {openDB} from 'idb'
import {
    decodeStartupJourney, streamStartupJourney, streamStartupJourneyCatalog, streamStartupPOIs,
} from './startupData.js'

let nextPacketId = 0
const acknowledgements = new Map()
const cancelledRequests = new Set()
const isExpired = value => Boolean(value?.expiresAt && value.expiresAt <= Date.now())
    || Boolean(value?._exp_ && value._exp_ <= Date.now())

const acknowledge = id => {
    const acknowledgement = acknowledgements.get(id)
    if (acknowledgement) {
        acknowledgements.delete(id)
        acknowledgement.resolve()
    }
}

/**
 * Rejects acknowledgements belonging to a cancelled request.
 * @param {number} requestId - Request identifier.
 * @returns {void}
 */
const cancelRequest = requestId => {
    cancelledRequests.add(requestId)
    acknowledgements.forEach((acknowledgement, id) => {
        if (acknowledgement.requestId !== requestId) {
            return
        }

        acknowledgements.delete(id)
        acknowledgement.reject(new DOMException('Startup data request cancelled', 'AbortError'))
    })
}

/**
 * Emits a packet and waits for its acknowledgement.
 * @param {object} data - Packet payload.
 * @param {number} requestId - Request identifier.
 * @returns {Promise<void>} Promise resolved when the client acknowledges the packet.
 */
const emit = (data, requestId) => new Promise((resolve, reject) => {
    if (cancelledRequests.has(requestId)) {
        reject(new DOMException('Startup data request cancelled', 'AbortError'))
        return
    }

    const id = ++nextPacketId
    acknowledgements.set(id, {reject, requestId, resolve})
    self.postMessage({type: 'packet', id, data})
})

/**
 * Throws when a request has been cancelled.
 * @param {number} requestId - Request identifier.
 * @returns {void}
 */
const throwIfCancelled = requestId => {
    if (cancelledRequests.has(requestId)) {
        throw new DOMException('Startup data request cancelled', 'AbortError')
    }
}

const openReader = async name => {
    const db = await openDB(name)
    return {
        close: () => db.close(),
        get: async (store, key) => {
            const value = await db.get(store, key)
            if (!value || isExpired(value)) {
                return null
            }
            return value.data ?? value
        },
        keys: store => db.getAllKeys(store),
        scan: async function* (store, keys, batchSize = 128) {
            for (let index = 0; index < keys.length; index += batchSize) {
                yield Promise.all(keys.slice(index, index + batchSize).map(async key => {
                    const value = await db.get(store, key)
                    if (!value || isExpired(value)) {
                        return null
                    }
                    return value.data ?? value
                }))
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
    if (message?.type === 'cancel') {
        cancelRequest(message.requestId)
        return
    }
    if (message?.type !== 'request') {
        return
    }

    const requestId = message.requestId
    const emitForRequest = data => emit(data, requestId)
    let reader
    try {
        reader = await openReader(message.database)
        throwIfCancelled(requestId)
        const requestType = message.requestType ?? message.type
        if (requestType === 'journey') {
            const value = await reader.get('journeys', message.key)
            if (value) {
                let journeyPOIsReady = false
                const shouldLoadJourneyPOIs = message.primary || message.loadPOIs
                const emitJourneyPOIs = async journey => {
                    if (!shouldLoadJourneyPOIs || journeyPOIsReady) {
                        return
                    }

                    journeyPOIsReady = true
                    const keys = await reader.keys('pois')
                    const trackKeys = [...(journey?.tracks instanceof Map
                                           ? journey.tracks.keys()
                                           : Object.keys(journey?.tracks ?? {}))]
                    const parents = [journey.slug, ...trackKeys]
                    let firstBatch = true
                    await streamStartupPOIs((async function* () {
                        for await (const batch of reader.scan('pois', keys)) {
                            yield batch.map(item => item?.data ?? item)
                        }
                    })(), emitForRequest, {
                        currentOnly:  true,
                        excluded:     message.excluded,
                        globalParent: message.globalParent,
                        includeStarter: message.includeStarter,
                        onBatch:      async () => {
                            if (firstBatch) {
                                firstBatch = false
                                if (message.primary) {
                                    await emitForRequest({type: 'primary-ready'})
                                }
                            }
                        },
                        onComplete:   async () => {
                            if (firstBatch && message.primary) {
                                await emitForRequest({type: 'primary-ready'})
                            }
                        },
                        parents,
                        starterType:  message.starterType,
                    })
                }

                const decoded = (message.primary || message.loadPOIs) ? decodeStartupJourney(value) : null
                await streamStartupJourney(value, emitForRequest, {
                    ...message,
                    onTrackEnd: async ({firstTrack}) => {
                        if (firstTrack) {
                            await emitJourneyPOIs(decoded)
                        }
                    },
                    preferredTrackKey: message.currentTrackKey,
                })
                if (shouldLoadJourneyPOIs && !journeyPOIsReady) {
                    await emitJourneyPOIs(decoded)
                }
            }
            else if (message.primary) {
                    await emitForRequest({type: 'primary-ready'})
            }
        }
        else if (requestType === 'journey-keys') {
            await emitForRequest({type: 'journey-keys', keys: await reader.keys('journeys')})
        }
        else if (requestType === 'journey-catalog') {
            const keys = await reader.keys('journeys')
            await streamStartupJourneyCatalog((async function* () {
                for await (const batch of reader.scan('journeys', keys)) {
                    yield batch
                }
            })(), emitForRequest)
        }
        else if (requestType === 'pois') {
            const keys = await reader.keys('pois')
            await streamStartupPOIs((async function* () {
                for await (const batch of reader.scan('pois', keys)) {
                    yield batch.map(value => value?.data ?? value)
                }
            })(), emitForRequest, message)
        }
        throwIfCancelled(requestId)
        self.postMessage({type: 'done', result: true})
    }
    catch (error) {
        if (!cancelledRequests.has(requestId)) {
            self.postMessage({type: 'error', message: error?.message ?? String(error)})
        }
    }
    finally {
        reader?.close()
        cancelledRequests.delete(requestId)
    }
}
