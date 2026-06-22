/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DatabaseExportImportUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-21
 * Last modified: 2026-06-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'

const DEFAULT_JSON_SPACE = 2
const DEFAULT_EXPORT_FOLDER = 'database'
const ZIP_OPTIONS = {level: 6}

const isLocalDB = value =>
    value
    && typeof value.keys === 'function'
    && typeof value.get === 'function'
    && typeof value.put === 'function'
    && typeof value.clear === 'function'

const isObjectLike = value => value !== null && typeof value === 'object'

const toArrayBufferView = value => {
    if (value instanceof Uint8Array) {
        return value
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value)
    }
    return null
}

const blobToUint8Array = async blob => {
    const direct = toArrayBufferView(blob)
    if (direct) {
        return direct
    }
    if (typeof Blob !== 'undefined' && blob instanceof Blob) {
        return new Uint8Array(await blob.arrayBuffer())
    }
    if (blob?.arrayBuffer) {
        return new Uint8Array(await blob.arrayBuffer())
    }
    throw new Error('Unsupported archive input.')
}

const normalizeDBEntries = databases => {
    if (!databases) {
        return []
    }
    if (Array.isArray(databases)) {
        return databases.map(entry => Array.isArray(entry) ? entry : [entry?.name ?? entry?.dbName ?? DEFAULT_EXPORT_FOLDER, entry]).filter(([, db]) => isLocalDB(db))
    }
    if (databases instanceof Map) {
        return Array.from(databases.entries()).filter(([, db]) => isLocalDB(db))
    }
    return Object.entries(databases).filter(([, db]) => isLocalDB(db))
}

const normalizeStoreNames = (db, stores = null) => {
    if (Array.isArray(stores) && stores.length > 0) {
        return stores
    }
    return Array.isArray(db?.storeNames) ? db.storeNames : []
}

const normalizeFolderName = name => {
    const safe = `${name ?? DEFAULT_EXPORT_FOLDER}`.trim()
    return safe.length > 0 ? safe : DEFAULT_EXPORT_FOLDER
}

const buildStoreExport = async (db, store, {pretty = true} = {}) => {
    const keys = await db.keys(store)
    const records = []

    for (const key of keys) {
        const entry = await db.get(key, store, true)
        if (entry === null || entry === undefined) {
            continue
        }

        records.push({
            key,
            value: entry?.data ?? entry,
            meta: {
                createdAt: entry?._ct_ ?? null,
                modifiedAt: entry?._mt_ ?? null,
                ttlMillis: entry?._ttl_ ?? null,
                expiresAt: entry?._exp_ ?? null,
            },
        })
    }

    return JSON.stringify({
        store,
        exportedAt: new Date().toISOString(),
        count: records.length,
        records,
    }, null, pretty ? DEFAULT_JSON_SPACE : 0)
}

const buildRecordExport = async (db, store, key, {pretty = true} = {}) => {
    const entry = await db.get(key, store, true)
    if (entry === null || entry === undefined) {
        return null
    }

    return JSON.stringify({
        store,
        key,
        exportedAt: new Date().toISOString(),
        value: entry?.data ?? entry,
        meta: {
            createdAt: entry?._ct_ ?? null,
            modifiedAt: entry?._mt_ ?? null,
            ttlMillis: entry?._ttl_ ?? null,
            expiresAt: entry?._exp_ ?? null,
        },
    }, null, pretty ? DEFAULT_JSON_SPACE : 0)
}

const extractImportedValue = record => {
    if (!isObjectLike(record)) {
        return {value: record, ttl: null}
    }

    const value = Object.prototype.hasOwnProperty.call(record, 'value')
                 ? record.value
                 : (Object.prototype.hasOwnProperty.call(record, 'data') ? record.data : record.record?.data)

    const meta = isObjectLike(record.meta) ? record.meta : {}
    const ttlMillis = Number.isFinite(meta.ttlMillis)
                      ? meta.ttlMillis
                      : (Number.isFinite(meta.expiresAt) ? meta.expiresAt - Date.now() : null)
    const ttl = Number.isFinite(ttlMillis) && ttlMillis > 0 ? Math.ceil(ttlMillis / 1000) : null

    return {
        value,
        ttl,
    }
}

const parseStoreJson = jsonString => {
    const parsed = JSON.parse(jsonString)
    if (Array.isArray(parsed)) {
        return {records: parsed}
    }
    if (isObjectLike(parsed) && typeof parsed.key === 'string' && Object.prototype.hasOwnProperty.call(parsed, 'value')) {
        return {records: [parsed]}
    }
    if (isObjectLike(parsed) && Array.isArray(parsed.records)) {
        return parsed
    }
    if (isObjectLike(parsed) && Array.isArray(parsed.entries)) {
        return {...parsed, records: parsed.entries}
    }
    if (isObjectLike(parsed) && isObjectLike(parsed.data)) {
        return {records: Object.entries(parsed.data).map(([key, value]) => ({key, value}))}
    }
    throw new Error('Unsupported store JSON payload.')
}

const extractRecordsFromPayload = payload => {
    if (Array.isArray(payload.records)) {
        return payload.records
    }

    return []
}

export const exportStoreToJson = async (db, store, options = {}) => {
    if (!isLocalDB(db)) {
        throw new Error('A valid LocalDB instance is required.')
    }
    if (!store || typeof store !== 'string') {
        throw new Error('A valid store name is required.')
    }
    return buildStoreExport(db, store, options)
}

export const importJsonToStore = async (db, store, jsonString, {clear = true} = {}) => {
    if (!isLocalDB(db)) {
        throw new Error('A valid LocalDB instance is required.')
    }
    if (!store || typeof store !== 'string') {
        throw new Error('A valid store name is required.')
    }

    const payload = parseStoreJson(jsonString)
    await importRecordsToStore(db, store, extractRecordsFromPayload(payload), {clear})
}

/**
 * Import a list of records into one store.
 *
 * @param {LocalDB} db - Database instance.
 * @param {string} store - Target store.
 * @param {Array} records - Records to import.
 * @param {Object} options - Import options.
 * @return {Promise<void>}
 */
export const importRecordsToStore = async (db, store, records, {clear = true} = {}) => {
    if (!isLocalDB(db)) {
        throw new Error('A valid LocalDB instance is required.')
    }
    if (!store || typeof store !== 'string') {
        throw new Error('A valid store name is required.')
    }

    if (clear) {
        await db.clear(store)
    }

    for (const record of records ?? []) {
        if (!record || typeof record.key !== 'string') {
            continue
        }
        const {value, ttl} = extractImportedValue(record)
        await db.put(record.key, value, store, ttl)
    }
}

export const exportLocalDBToFiles = async (db, {stores = null, folder = null, pretty = true} = {}) => {
    const storeNames = normalizeStoreNames(db, stores)
    const baseFolder = normalizeFolderName(folder ?? db?.dbName ?? DEFAULT_EXPORT_FOLDER)
    const files = {}

    for (const store of storeNames) {
        if (store === 'journeys') {
            const keys = await db.keys(store)
            for (const key of keys) {
                const json = await buildRecordExport(db, store, key, {pretty})
                if (!json) {
                    continue
                }
                files[`${baseFolder}/${store}/${key}.json`] = strToU8(json)
            }
            continue
        }

        const json = await exportStoreToJson(db, store, {pretty})
        files[`${baseFolder}/${store}.json`] = strToU8(json)
    }

    return files
}

export const exportLocalDBToZip = async (db, options = {}) => {
    const files = await exportLocalDBToFiles(db, options)
    return zipSync(files, ZIP_OPTIONS)
}

export const importLocalDBFromZip = async (db, archive, {folder = null} = {}) => {
    if (!isLocalDB(db)) {
        throw new Error('A valid LocalDB instance is required.')
    }

    const bytes = await blobToUint8Array(archive)
    const baseFolder = normalizeFolderName(folder ?? db?.dbName ?? DEFAULT_EXPORT_FOLDER)
    const entries = unzipSync(bytes)
    let journeysImported = false

    for (const [path, content] of Object.entries(entries)) {
        if (!path.startsWith(`${baseFolder}/`) || !path.endsWith('.json')) {
            continue
        }

        const relative = path.slice(baseFolder.length + 1)
        const json = strFromU8(content)
        if (relative.startsWith('journeys/') && relative.endsWith('.json')) {
            const journeySlug = relative.slice('journeys/'.length, -5)
            const payload = parseStoreJson(json)
            await importRecordsToStore(db, 'journeys', [{
                key:   journeySlug,
                value: payload.value ?? payload.records?.[0]?.value ?? null,
                meta:  payload.meta ?? payload.records?.[0]?.meta ?? null,
            }], {clear: !journeysImported})
            journeysImported = true
            continue
        }

        const store = relative.slice(0, -5)
        await importJsonToStore(db, store, json)
    }

}

export const exportDatabaseBundleToZip = async (databases, options = {}) => {
    const files = await exportDatabaseBundleToFiles(databases, options)
    return zipSync(files, ZIP_OPTIONS)
}

export const exportDatabaseBundleToFiles = async (databases, options = {}) => {
    const files = {}

    for (const [scopeName, db] of normalizeDBEntries(databases)) {
        const folder = normalizeFolderName(scopeName)
        const scopedFiles = await exportLocalDBToFiles(db, {
            ...options,
            folder,
        })
        Object.assign(files, scopedFiles)
    }

    return files
}

export const importDatabaseBundleFromZip = async (databases, archive, options = {}) => {
    const bytes = await blobToUint8Array(archive)
    const entries = unzipSync(bytes)
    const dbEntries = normalizeDBEntries(databases)

    for (const [scopeName, db] of dbEntries) {
        const folder = normalizeFolderName(options.folder ?? scopeName)
        let journeysImported = false

        for (const [path, content] of Object.entries(entries)) {
            if (!path.startsWith(`${folder}/`) || !path.endsWith('.json')) {
                continue
            }

            const relative = path.slice(folder.length + 1)
            const json = strFromU8(content)
            if (relative.startsWith('journeys/') && relative.endsWith('/journey.json')) {
                const parts = relative.split('/')
                const journeySlug = parts[1]
                const payload = parseStoreJson(json)
                await importRecordsToStore(db, 'journeys', [{
                    key:   journeySlug,
                    value: payload.value ?? payload.records?.[0]?.value ?? null,
                    meta:  payload.meta ?? payload.records?.[0]?.meta ?? null,
                }], {clear: !journeysImported})
                journeysImported = true
                continue
            }

            const store = relative.slice(0, -5)
            await importJsonToStore(db, store, json)
        }
    }
}
