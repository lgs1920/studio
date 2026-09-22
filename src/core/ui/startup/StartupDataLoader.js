/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StartupDataLoader.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {CustomDataSource, GeoJsonDataSource} from 'cesium'
import {
    CURRENT_JOURNEY, CURRENT_STORE, CURRENT_TRACK, DRAWING_FROM_DB, POI_STARTER_TYPE,
} from '@Core/constants'
import {Journey} from '@Core/Journey'
import {MapPOI} from '@Core/MapPOI'
import {Track} from '@Core/Track'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {markStartup, measureStartup} from './startupTelemetry'
import {StartupWorkerClient, yieldStartupIdleTask, yieldStartupTask} from './StartupWorkerClient'

const appendGeometry = (geometry, packet) => {
    if (packet.geometry) {
        return packet.geometry
    }

    if (!geometry) {
        return geometry
    }

    if (!Array.isArray(geometry.coordinates)) {
        geometry.coordinates = []
    }

    if (geometry.type === 'LineString') {
        geometry.coordinates.push(...packet.coordinates)
        return geometry
    }

    geometry.coordinates[packet.segment] ??= []
    geometry.coordinates[packet.segment].push(...packet.coordinates)
    return geometry
}

const trackContent = (track, geometry) => {
    const content = {...(track.contentMetadata ?? {})}
    delete content.geometry

    return {
        ...content,
        type:       content.type ?? 'Feature',
        properties: content.properties ?? track.contentProperties ?? {name: track.title},
        geometry:   geometry ?? track.geometry ?? {type: track.geometryType ?? 'LineString', coordinates: []},
    }
}

const yieldSecondaryJourneyRender = () => {
    if (typeof globalThis.scheduler?.postTask === 'function') {
        return globalThis.scheduler.postTask(() => {}, {priority: 'background'})
    }

    if (typeof globalThis.requestIdleCallback === 'function') {
        return new Promise(resolve => globalThis.requestIdleCallback(resolve))
    }

    return yieldStartupIdleTask()
}

const hasPendingUserInput = () => globalThis.navigator?.scheduling?.isInputPending?.({includeContinuous: true}) === true

/**
 * Hydrate the primary journey first, then feed each journey through its own
 * worker while acknowledged packets keep main-thread work bounded.
 */
export class StartupDataLoader {
    #client
    #clientWasInjected = false
    #database
    #loadedJourneySlugs = new Set()
    #activeJourneyCompletion = Promise.resolve()
    #deferredTrackQueue = []
    #deferredTrackDrainPromise = null
    #journeyClients = new Set()
    #currentPOIsReady = false

    constructor(database, client) {
        this.#database = database
        if (client !== undefined) {
            this.#client = client
            this.#clientWasInjected = true
            return
        }

        if (typeof Worker !== 'function') {
            this.#client = null
            return
        }

        try {
            this.#client = new StartupWorkerClient()
        }
        catch (error) {
            console.warn('[StartupDataLoader] Worker unavailable, using the legacy startup loader:', error)
            this.#client = null
        }
    }

    #createJourneyClient = () => {
        if (this.#clientWasInjected) {
            return this.#client
        }

        if (typeof Worker !== 'function') {
            return this.#client
        }

        try {
            const client = new StartupWorkerClient()
            this.#journeyClients.add(client)
            return client
        }
        catch (error) {
            console.warn('[StartupDataLoader] Journey worker unavailable, using the shared startup worker:', error)
            return this.#client
        }
    }

    #releaseJourneyClient = client => {
        if (!client || client === this.#client || this.#clientWasInjected) {
            return
        }

        this.#journeyClients.delete(client)
        client.dispose?.()
    }

    #requestFromWorker = async (request, consume, client = this.#client) => {
        if (!client) {
            throw new Error('Startup data worker is unavailable')
        }

        try {
            return await client.request(request, consume)
        }
        catch (error) {
            client.dispose?.(error)
            if (client === this.#client && !this.#clientWasInjected) {
                this.#client = null
            }
            throw error
        }
    }

    get currentPOIsReady() {
        return this.#currentPOIsReady
    }

    #waitForActiveJourney = async () => {
        await this.#activeJourneyCompletion
    }

    #installPOIs = items => {
        for (const data of items ?? []) {
            if (!data?.id || __.ui.poiManager.list.has(data.id)) {
                continue
            }
            const poi = new MapPOI(data)
            __.ui.poiManager.list.set(poi.id, poi)
            __.ui.poiManager.addToJourneyIndex(poi.id, poi)
        }
        lgs.scene?.requestRender?.()
    }

    #enqueueDeferredTrack = (journey, track, source) => {
        if (journey?.visible === false || track?.visible === false || !source) {
            return
        }

        source.__lgsStartupDeferredTrack = true
        source.show = false
        this.#deferredTrackQueue.push({journey, source, track})
    }

    #drainDeferredTracks = async () => {
        if (this.#deferredTrackDrainPromise) {
            return this.#deferredTrackDrainPromise
        }

        this.#deferredTrackDrainPromise = (async () => {
            while (this.#deferredTrackQueue.length > 0) {
                const item = this.#deferredTrackQueue.shift()
                await yieldSecondaryJourneyRender()

                if (hasPendingUserInput()) {
                    this.#deferredTrackQueue.unshift(item)
                    continue
                }

                if (item.journey.visible === false || item.track.visible === false) {
                    item.source.__lgsStartupDeferredTrack = false
                    continue
                }
                await TrackUtils.draw(item.track, {
                    action:       DRAWING_FROM_DB,
                    forcedToHide: false,
                    renderMode:   'primitive',
                })
                item.source.__lgsStartupDeferredTrack = false
                await yieldStartupTask()
            }
        })().finally(() => {
            this.#deferredTrackDrainPromise = null
        })

        return this.#deferredTrackDrainPromise
    }

    loadJourney = async (key, {current = false, currentTrackKey = null} = {}) => {
        if (!key || this.#loadedJourneySlugs.has(key)) {
            return lgs.getJourneyBySlug?.(key) ?? null
        }

        const journeyClient = this.#createJourneyClient()
        if (!journeyClient) {
            return current ? TrackUtils.readCurrentFromDB({alreadyDrawn: false}) : null
        }

        let journey = null
        let currentTrack = null
        let geometry = null
        let trackData = null
        let trackKey = null
        let firstTrackReady = false
        let firstTrackResolve
        let firstTrackReject
        const primaryReady = new Promise((resolve, reject) => {
            firstTrackResolve = resolve
            firstTrackReject = reject
        })
        const ensureJourneyDataSource = async () => {
            if (!lgs.viewer.dataSources.getByName(journey.slug)[0]) {
                await lgs.viewer.dataSources.add(new CustomDataSource(journey.slug))
            }
        }

        const prepareCurrentJourney = async () => {
            if (!current || lgs.theJourney === journey) {
                return
            }

            lgs.theJourney = journey
            lgs.theJourney.addToEditor()
            TrackUtils.setProfileVisibility(journey)
        }

        const installTrack = async track => {
            journey.globalSettings()
            await ensureJourneyDataSource()
            if (!lgs.viewer.dataSources.getByName(track.slug)[0]) {
                await lgs.viewer.dataSources.add(new GeoJsonDataSource(track.slug))
            }

            const isPrimaryTrack = current && !firstTrackReady
            if (current && (isPrimaryTrack || `${track.slug}` === `${currentTrackKey}`)) {
                lgs.theTrack = track
                lgs.theTrack.addToEditor()
                TrackUtils.setProfileVisibility(journey)
            }

            if (current && isPrimaryTrack) {
                await TrackUtils.draw(track, {
                    action:       DRAWING_FROM_DB,
                    forcedToHide: journey.visible === false,
                    renderMode:   'primitive',
                })
            }
            else {
                const source = lgs.viewer.dataSources.getByName(track.slug)[0]
                this.#enqueueDeferredTrack(journey, track, source)
            }

            if (isPrimaryTrack) {
                firstTrackReady = true
                lgs.stores.main.readyForTheShow = true
                markStartup('current-track-drawn', {
                    journey: journey.slug,
                    track:   track.slug,
                })
                measureStartup('current-track', 'current-journey-init-start', 'current-track-drawn')
            }
        }

        const completion = this.#requestFromWorker({
            database:    this.#database,
            defaults:    {renderSmoothing: globalThis.lgs?.settings?.getJourney?.renderSmoothing},
            key,
            currentTrackKey,
            excluded:    [...(__.ui.poiManager.list?.keys?.() ?? [])],
            includeStarter: false,
            primary:     current,
            starterType: POI_STARTER_TYPE,
            type:        'journey',
        }, async packet => {
            if (packet.type === 'journey') {
                journey = Journey.deserialize({object: {...packet.data, tracks: [{__type: 'Map'}]}, reset: true})
                journey.cameraOrigin = journey.camera
                journey.globalSettings()
                lgs.saveJourneyInContext(journey)
                await prepareCurrentJourney()
                await ensureJourneyDataSource()
                return
            }

            if (packet.type === 'track') {
                trackKey = packet.key
                trackData = packet.data
                geometry = null
                return
            }

            if (packet.type === 'geometry') {
                geometry ??= {type: trackData?.geometryType ?? 'LineString', coordinates: []}
                geometry = appendGeometry(geometry, packet)
                return
            }

            if (packet.type === 'track-end' && journey && trackData) {
                const track = new Track(trackData.title, {
                    ...trackData,
                    content: trackContent(trackData, geometry),
                    parent:  trackData.parent ?? journey.slug,
                })
                track.parent = track.parent ?? journey.slug
                journey.tracks.set(trackKey ?? track.slug, track)
                if (!currentTrack || `${track.slug}` === `${currentTrackKey}` || !currentTrackKey) {
                    currentTrack = track
                }
                if (!current || firstTrackReady) {
                    await yieldStartupIdleTask()
                }
                await installTrack(track)
                trackData = null
                geometry = null
                await (current && !firstTrackReady ? yieldStartupTask() : yieldStartupIdleTask())
                return
            }

            if (packet.type === 'pois') {
                this.#installPOIs(packet.items)
                if (current && !this.#currentPOIsReady) {
                    this.#currentPOIsReady = true
                    markStartup('current-pois-first-batch', {count: packet.items?.length ?? 0})
                }
                return
            }

            if (packet.type === 'primary-ready' && current) {
                if (!firstTrackReady) {
                    lgs.stores.main.readyForTheShow = true
                }
                this.#currentPOIsReady = true
                markStartup('current-primary-ready', {journey: journey?.slug ?? key})
                measureStartup('current-primary', 'current-journey-init-start', 'current-primary-ready')
                firstTrackResolve(journey)
            }
        }, journeyClient).finally(() => {
            this.#releaseJourneyClient(journeyClient)
        })

        if (current) {
            this.#activeJourneyCompletion = completion
        }
        void completion.catch(error => {
            if (current) {
                firstTrackReject(error)
            }
            else {
                firstTrackResolve(null)
            }
            this.#activeJourneyCompletion = Promise.resolve()
        })

        if (current) {
            await primaryReady
        }
        else {
            await completion
        }

        if (!journey) {
            return null
        }

        journey.globalSettings()

        if (current || !lgs.theJourney) {
            lgs.theJourney = journey
            lgs.theJourney.addToEditor()
            lgs.theTrack = journey.tracks.get(currentTrackKey) ?? currentTrack
            lgs.theTrack?.addToEditor()
            TrackUtils.setProfileVisibility(journey)
        }

        journey.updateVisibility(current ? journey.visible !== false : false)
        this.#loadedJourneySlugs.add(journey.slug)
        await yieldStartupTask()
        return journey
    }

    loadCurrentJourney = async () => {
        const key = await lgs.db.lgs1920.get(CURRENT_JOURNEY, CURRENT_STORE)
        if (!key || !this.#client) {
            this.#currentPOIsReady = false
            return TrackUtils.readCurrentFromDB()
        }

        try {
            const currentTrackKey = await lgs.db.lgs1920.get(CURRENT_TRACK, CURRENT_STORE)
            const journey = await this.loadJourney(key, {current: true, currentTrackKey})
            if (journey) {
                return journey
            }

            console.warn('[StartupDataLoader] Current journey was not returned by the worker, using the legacy loader')
            return TrackUtils.readCurrentFromDB()
        }
        catch (error) {
            this.#currentPOIsReady = false
            console.warn('[StartupDataLoader] Current journey worker load failed, using the legacy loader:', error)
            return TrackUtils.readCurrentFromDB()
        }
    }

    loadRemainingJourneys = async () => {
        lgs.stores.main.journeysReady = false
        try {
            await this.#waitForActiveJourney()
            if (!this.#client) {
                const journeys = TrackUtils.readRemainingFromDB()
                lgs.stores.main.journeysReady = true
                return journeys
            }
            let keys = []
            await this.#requestFromWorker({
                database:    this.#database,
                type:        'journey-keys',
            }, async packet => {
                if (packet.type !== 'journey-keys') {
                    return
                }
                keys = packet.keys ?? []
            })
            const pendingKeys = keys.filter(key => !this.#loadedJourneySlugs.has(key) && !lgs.journeys.has(key))
            const results = await Promise.allSettled(pendingKeys.map(async key => {
                await yieldStartupIdleTask()
                const journey = await this.loadJourney(key)
                await this.#drainDeferredTracks().catch(error => {
                    console.warn('[StartupDataLoader] Deferred journey render failed:', error)
                })
                await yieldStartupTask()
                return journey
            }))
            const failedJourney = results.find(result => result.status === 'rejected')
            if (failedJourney) {
                throw failedJourney.reason
            }

            lgs.stores.main.journeysReady = true
            return results.map(result => result.value).filter(Boolean)
        }
        catch (error) {
            console.warn('[StartupDataLoader] Remaining journey worker load failed, using the legacy loader:', error)
            const journeys = TrackUtils.readRemainingFromDB()
            lgs.stores.main.journeysReady = true
            return journeys
        }
    }

    loadPOIs = async ({currentOnly = false, journey = lgs.theJourney, includeStarter = true} = {}) => {
        await this.#waitForActiveJourney()
        if (!this.#client) {
            if (currentOnly) {
                const result = await __.ui.poiManager.readStartupPOIsFromDB({includeStarter, journey})
                this.#currentPOIsReady = true
                return result
            }
            return __.ui.poiManager.readAllFromDB({ensureLocations: false})
        }
        const parents = new Set()
        if (journey?.slug) {
            parents.add(journey.slug)
            journey.tracks?.forEach(track => parents.add(track.slug))
        }

        try {
            await this.#requestFromWorker({
                currentOnly,
                database:    this.#database,
                excluded:    [...(__.ui.poiManager.list?.keys?.() ?? [])],
                includeStarter,
                parents:     [...parents],
                type:        'pois',
                starterType: POI_STARTER_TYPE,
            }, async packet => {
                if (packet.type !== 'pois') {
                    return
                }
                this.#installPOIs(packet.items)
                if (currentOnly) {
                    this.#currentPOIsReady = true
                }
                else {
                    await yieldStartupIdleTask()
                }
            })
        }
        catch (error) {
            console.warn('[StartupDataLoader] POI worker load failed, using the legacy loader:', error)
            if (currentOnly) {
                return __.ui.poiManager.readStartupPOIsFromDB({includeStarter, journey})
            }
            return __.ui.poiManager.readAllFromDB({ensureLocations: false})
        }
    }

    dispose = () => {
        this.#client?.dispose()
        this.#journeyClients.forEach(client => client.dispose?.())
        this.#journeyClients.clear()
    }
}
