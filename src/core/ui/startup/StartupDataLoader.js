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
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {CustomDataSource, GeoJsonDataSource} from 'cesium'
import {
    CURRENT_JOURNEY, CURRENT_STORE, CURRENT_TRACK, DRAWING_FROM_DB, GLOBAL_PARENT, NO_FOCUS, POI_STARTER_TYPE,
} from '@Core/constants'
import {Journey} from '@Core/Journey'
import {MapPOI} from '@Core/MapPOI'
import {Track} from '@Core/Track'
import {getGlobalHideOtherJourneys} from '@Core/ui/JourneyVisibility'
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

const setStartupJourneyMetadata = (journey, {spatial = null, trackKeys = [], summary = false} = {}) => {
    Object.defineProperties(journey, {
        isStartupSummary: {
            configurable: true,
            enumerable:   false,
            value:        summary,
            writable:     true,
        },
        startupSpatial: {
            configurable: true,
            enumerable:   false,
            value:        spatial,
            writable:     true,
        },
        startupTrackKeys: {
            configurable: true,
            enumerable:   false,
            value:        trackKeys,
            writable:     true,
        },
    })
    return journey
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
 * Hydrate the primary journey first, then keep a lightweight catalog for the
 * remaining journeys while acknowledged worker packets bound main-thread work.
 */
export class StartupDataLoader {
    #client
    #database
    #loadedJourneySlugs = new Set()
    #journeyLoadPromises = new Map()
    #journeyLoadQueue = Promise.resolve()
    #journeyCatalogPromise = null
    #activeJourneyCompletion = Promise.resolve()
    #deferredTrackQueue = []
    #deferredTrackDrainPromise = null
    #currentPOIsReady = false

    constructor(database, client) {
        this.#database = database
        if (client !== undefined) {
            this.#client = client
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

    #requestFromWorker = async (request, consume, client = this.#client) => {
        if (!client) {
            throw new Error('Startup data worker is unavailable')
        }

        try {
            return await client.request(request, consume)
        }
        catch (error) {
            client.dispose?.(error)
            if (client === this.#client) {
                this.#client = null
            }
            throw error
        }
    }

    get currentPOIsReady() {
        return this.#currentPOIsReady
    }

    isJourneyLoaded = slug => this.#loadedJourneySlugs.has(slug)

    #waitForActiveJourney = async () => {
        await this.#activeJourneyCompletion
    }

    /**
     * Persist display defaults on loaded POIs before installing them in the map store.
     *
     * @param {Array<Object>} items - POI records received from the startup worker.
     * @returns {Promise<void>} Resolves after each record has been installed.
     */
    #installPOIs = async items => {
        for (const [index, data] of (items ?? []).entries()) {
            if (!data?.id || __.ui.poiManager.list.has(data.id)) {
                continue
            }
            await __.ui.poiManager.ensurePersistedDisplaySettings?.(data)
            const poi = new MapPOI(data)
            __.ui.poiManager.list.set(poi.id, poi)
            __.ui.poiManager.addToJourneyIndex(poi.id, poi)
            if ((index + 1) % 8 === 0) {
                await yieldStartupTask()
            }
        }
        lgs.scene?.requestRender?.()
    }

    #enqueueDeferredTrack = (journey, track, source) => {
        if (track?.visible === false || !source) {
            return
        }

        source.__lgsStartupDeferredTrack = true
        source.show = false
        this.#deferredTrackQueue.push({journey, source, track})
        void this.#drainDeferredTracks().catch(error => {
            console.warn('[StartupDataLoader] Deferred journey render failed:', error)
        })
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

                if (item.track.visible === false) {
                    item.source.__lgsStartupDeferredTrack = false
                    continue
                }
                await TrackUtils.draw(item.track, {
                    action:       DRAWING_FROM_DB,
                    forcedToHide: item.journey.visible === false
                                  || (getGlobalHideOtherJourneys() && item.journey.slug !== lgs.theJourney?.slug),
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

    loadJourney = async (key, {
        current = false,
        currentTrackKey = null,
        focusOnReady = false,
        loadPOIs = false,
        onFirstTrackReady = null,
        onSpatialReady = null,
    } = {}) => {
        if (!key || this.#loadedJourneySlugs.has(key)) {
            return lgs.getJourneyBySlug?.(key) ?? null
        }

        if (!this.#client) {
            if (current) {
                return TrackUtils.readCurrentFromDB({alreadyDrawn: false})
            }

            const journey = await Journey.readFromDB(key)
            if (!journey) {
                return null
            }

            journey.cameraOrigin = journey.camera
            lgs.saveJourneyInContext(journey, {loaded: false})
            await journey.prepareDrawing()
            await journey.draw({action: DRAWING_FROM_DB, mode: NO_FOCUS})
            journey.tracksLoaded = true
            this.#loadedJourneySlugs.add(journey.slug)
            lgs.markJourneyLoaded?.(journey.slug)
            return journey
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

            const isPrimaryTrack = (current || focusOnReady) && !firstTrackReady
            if (current && (isPrimaryTrack || `${track.slug}` === `${currentTrackKey}`)) {
                lgs.theTrack = track
                lgs.theTrack.addToEditor()
                TrackUtils.setProfileVisibility(journey)
            }

            if (isPrimaryTrack) {
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
                if (current) {
                    lgs.stores.main.readyForTheShow = true
                    markStartup('current-track-drawn', {
                        journey: journey.slug,
                        track:   track.slug,
                    })
                    measureStartup('current-track', 'current-journey-init-start', 'current-track-drawn')
                }
                if (onFirstTrackReady) {
                    void Promise.resolve(onFirstTrackReady(journey, track)).catch(error => {
                        console.warn('[StartupDataLoader] Early journey focus failed:', error)
                    })
                }
            }
        }

        const completion = this.#requestFromWorker({
            database:    this.#database,
            defaults:    {renderSmoothing: globalThis.lgs?.settings?.getJourney?.renderSmoothing},
            key,
            currentTrackKey,
            excluded:    [...(__.ui.poiManager.list?.keys?.() ?? [])],
            globalParent: GLOBAL_PARENT,
            includeStarter: false,
            loadPOIs,
            primary:     current,
            starterType: POI_STARTER_TYPE,
            type:        'journey',
        }, async packet => {
            if (packet.type === 'journey') {
                journey = Journey.deserialize({object: {...packet.data, tracks: [{__type: 'Map'}]}, reset: true})
                journey.cameraOrigin = journey.camera
                setStartupJourneyMetadata(journey, {
                    spatial:   packet.spatial ?? null,
                    trackKeys: packet.trackKeys ?? [],
                })
                journey.tracksLoaded = false
                journey.globalSettings()
                lgs.saveJourneyInContext(journey, {loaded: false})
                if (onSpatialReady && packet.spatial) {
                    void Promise.resolve(onSpatialReady(journey, packet.spatial)).catch(error => {
                        console.warn('[StartupDataLoader] Early journey spatial focus failed:', error)
                    })
                }
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
                await this.#installPOIs(packet.items)
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
        })

        if (current) {
            this.#activeJourneyCompletion = completion
        }
        void completion.then(() => {
            if (journey) {
                journey.tracksLoaded = true
            }
        }).catch(error => {
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

        const journeyVisible = journey.visible !== false
        journey.updateVisibility(journeyVisible)
        if (journeyVisible && getGlobalHideOtherJourneys() && journey.slug !== lgs.theJourney?.slug) {
            TrackUtils.updatePOIsVisibility(journey, false)
            journey.tracks.forEach(track => {
                if (!track?.slug) {
                    return
                }

                try {
                    TrackUtils.updateTrackVisibility(journey, track, false)
                }
                catch (error) {
                    console.error(`[Journey visibility] Failed to hide trace ${track.slug}.`, error)
                }
            })
        }
        if (!current) {
            journey.tracksLoaded = true
        }
        this.#loadedJourneySlugs.add(journey.slug)
        lgs.markJourneyLoaded?.(journey.slug)
        await yieldStartupTask()
        return journey
    }

    ensureJourneyLoaded = async (key, options = {}) => {
        if (!key || this.#loadedJourneySlugs.has(key)) {
            return lgs.getJourneyBySlug?.(key) ?? null
        }

        const pending = this.#journeyLoadPromises.get(key)
        if (pending) {
            return pending
        }

        const promise = this.#journeyLoadQueue.then(async () => {
            if (this.#loadedJourneySlugs.has(key)) {
                return lgs.getJourneyBySlug?.(key) ?? null
            }

            try {
                const journey = await this.loadJourney(key, {
                    ...options,
                    focusOnReady: true,
                    loadPOIs:     true,
                })
                if (!this.#client && journey) {
                    await this.loadPOIs({currentOnly: true, includeStarter: false, journey})
                }
                return journey
            }
            catch (error) {
                if (this.#client) {
                    throw error
                }

                const journey = await this.loadJourney(key, options)
                if (journey) {
                    await this.loadPOIs({currentOnly: true, includeStarter: false, journey})
                }
                return journey
            }
        }).finally(() => {
            if (this.#journeyLoadPromises.get(key) === promise) {
                this.#journeyLoadPromises.delete(key)
            }
        })
        this.#journeyLoadPromises.set(key, promise)
        this.#journeyLoadQueue = promise.catch(() => {})
        return promise
    }

    #readJourneyCatalog = async () => {
        lgs.stores.main.journeysReady = false
        try {
            await this.#waitForActiveJourney()
            if (!this.#client) {
                const journeys = await TrackUtils.readRemainingFromDB()
                lgs.stores.main.journeysReady = true
                return journeys
            }

            const journeys = []
            await this.#requestFromWorker({
                database: this.#database,
                type:     'journey-catalog',
            }, async packet => {
                if (packet.type !== 'journey-summary' || !packet.data?.slug) {
                    return
                }

                const existing = lgs.getJourneyBySlug?.(packet.data.slug)
                if (existing && (this.#loadedJourneySlugs.has(packet.data.slug) || existing.tracksLoaded === true)) {
                    journeys.push(existing)
                    return
                }
                if (existing?.isStartupSummary === true) {
                    journeys.push(existing)
                    return
                }

                const journey = Journey.deserialize({object: packet.data, reset: true})
                setStartupJourneyMetadata(journey, {spatial: packet.spatial ?? null, summary: true})
                journey.tracksLoaded = false
                lgs.saveJourneyInContext(journey, {loaded: false})
                journeys.push(journey)
            })

            lgs.stores.main.journeysReady = true
            return journeys
        }
        catch (error) {
            console.warn('[StartupDataLoader] Journey catalog worker load failed, using the legacy loader:', error)
            const journeys = await TrackUtils.readRemainingFromDB()
            lgs.stores.main.journeysReady = true
            return journeys
        }
    }

    loadJourneyCatalog = () => {
        this.#journeyCatalogPromise ??= this.#readJourneyCatalog()
        return this.#journeyCatalogPromise
    }

    loadRemainingJourneys = async () => this.loadJourneyCatalog()

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

    /** Load POI records and report whether the requested data read completed successfully. */
    loadPOIs = async ({currentOnly = false, journey = lgs.theJourney, includeStarter = true} = {}) => {
        await this.#waitForActiveJourney()
        if (!this.#client) {
            if (currentOnly) {
                const result = await __.ui.poiManager.readStartupPOIsFromDB({includeStarter, journey})
                this.#currentPOIsReady = result !== false
                return result !== false
            }
            const result = await __.ui.poiManager.readAllFromDB({ensureLocations: false})
            return result !== false
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
                globalParent: GLOBAL_PARENT,
                includeStarter,
                parents:     [...parents],
                type:        'pois',
                starterType: POI_STARTER_TYPE,
            }, async packet => {
                if (packet.type !== 'pois') {
                    return
                }
                await this.#installPOIs(packet.items)
                if (currentOnly) {
                    this.#currentPOIsReady = true
                }
                else {
                    await yieldStartupIdleTask()
                }
            })
            if (currentOnly) {
                this.#currentPOIsReady = true
            }
            return true
        }
        catch (error) {
            console.warn('[StartupDataLoader] POI worker load failed, using the legacy loader:', error)
            if (currentOnly) {
                const result = await __.ui.poiManager.readStartupPOIsFromDB({includeStarter, journey})
                this.#currentPOIsReady = result !== false
                return result !== false
            }
            const result = await __.ui.poiManager.readAllFromDB({ensureLocations: false})
            return result !== false
        }
    }

    dispose = () => {
        this.#client?.dispose()
    }
}
