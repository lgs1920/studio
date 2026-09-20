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
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {CustomDataSource, GeoJsonDataSource} from 'cesium'
import {
    CURRENT_JOURNEY, CURRENT_STORE, CURRENT_TRACK, DRAWING_FROM_DB, FOCUS_ON_FEATURE, NO_FOCUS, POI_STARTER_TYPE,
} from '@Core/constants'
import {Journey} from '@Core/Journey'
import {MapPOI} from '@Core/MapPOI'
import {Track} from '@Core/Track'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {StartupWorkerClient, yieldStartupTask} from './StartupWorkerClient'

const appendGeometry = (geometry, packet) => {
    if (!geometry) {
        return
    }

    if (!Array.isArray(geometry.coordinates)) {
        geometry.coordinates = []
    }

    if (geometry.type === 'LineString') {
        geometry.coordinates.push(...packet.coordinates)
        return
    }

    geometry.coordinates[packet.segment] ??= []
    geometry.coordinates[packet.segment].push(...packet.coordinates)
}

const trackContent = (track, geometry) => ({
    type: 'Feature',
    properties: track.contentProperties ?? {name: track.title},
    geometry: geometry ?? track.geometry ?? {type: 'LineString', coordinates: []},
})

/**
 * Hydrate only the primary journey synchronously, then let the worker feed the
 * remaining journeys and POIs in small acknowledged packets.
 */
export class StartupDataLoader {
    #client
    #database
    #loadedJourneySlugs = new Set()

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

    #requestFromWorker = async (request, consume) => {
        if (!this.#client) {
            throw new Error('Startup data worker is unavailable')
        }

        try {
            return await this.#client.request(request, consume)
        }
        catch (error) {
            this.#client.dispose?.(error)
            this.#client = null
            throw error
        }
    }

    loadJourney = async (key, {current = false} = {}) => {
        if (!key || this.#loadedJourneySlugs.has(key)) {
            return lgs.getJourneyBySlug?.(key) ?? null
        }

        if (!this.#client) {
            return current ? TrackUtils.readCurrentFromDB({alreadyDrawn: false}) : null
        }

        let journey = null
        let currentTrack = null
        let geometry = null
        let trackData = null
        let trackKey = null

        await this.#requestFromWorker({
            database:    this.#database,
            defaults:    {renderSmoothing: globalThis.lgs?.settings?.getJourney?.renderSmoothing},
            key,
            type:        'journey',
        }, async packet => {
            if (packet.type === 'journey') {
                journey = Journey.deserialize({object: {...packet.data, tracks: [{__type: 'Map'}]}, reset: true})
                journey.cameraOrigin = journey.camera
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
                appendGeometry(geometry, packet)
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
                if (!currentTrack) {
                    currentTrack = track
                }
                trackData = null
                geometry = null
                await yieldStartupTask()
            }
        })

        if (!journey) {
            return null
        }

        journey.globalSettings()
        lgs.saveJourneyInContext(journey)

        if (!lgs.viewer.dataSources.getByName(journey.slug)[0]) {
            await lgs.viewer.dataSources.add(new CustomDataSource(journey.slug))
        }
        for (const track of journey.tracks.values()) {
            if (!lgs.viewer.dataSources.getByName(track.slug)[0]) {
                await lgs.viewer.dataSources.add(new GeoJsonDataSource(track.slug))
            }
        }

        if (current || !lgs.theJourney) {
            lgs.theJourney = journey
            lgs.stores.main.readyForTheShow = true
            lgs.theJourney.addToEditor()
            lgs.theTrack = journey.tracks.get(await lgs.db.lgs1920.get(CURRENT_TRACK, CURRENT_STORE)) ?? currentTrack
            lgs.theTrack?.addToEditor()
            TrackUtils.setProfileVisibility(journey)
        }

        await journey.draw({
            action: DRAWING_FROM_DB,
            mode:   current ? FOCUS_ON_FEATURE : NO_FOCUS,
        })
        this.#loadedJourneySlugs.add(journey.slug)
        await yieldStartupTask()
        return journey
    }

    loadCurrentJourney = async () => {
        const key = await lgs.db.lgs1920.get(CURRENT_JOURNEY, CURRENT_STORE)
        if (!key || !this.#client) {
            return TrackUtils.readCurrentFromDB()
        }

        try {
            const journey = await this.loadJourney(key, {current: true})
            if (journey) {
                return journey
            }

            console.warn('[StartupDataLoader] Current journey was not returned by the worker, using the legacy loader')
            return TrackUtils.readCurrentFromDB()
        }
        catch (error) {
            console.warn('[StartupDataLoader] Current journey worker load failed, using the legacy loader:', error)
            return TrackUtils.readCurrentFromDB()
        }
    }

    loadRemainingJourneys = async () => {
        if (!this.#client) {
            return TrackUtils.readRemainingFromDB()
        }
        const journeys = []
        let keys = []
        try {
            await this.#requestFromWorker({
                database:    this.#database,
                type:        'journey-keys',
            }, async packet => {
                if (packet.type !== 'journey-keys') {
                    return
                }
                keys = packet.keys ?? []
            })
            for (const key of keys) {
                if (this.#loadedJourneySlugs.has(key) || lgs.journeys.has(key)) {
                    continue
                }
                const journey = await this.loadJourney(key)
                if (journey) {
                    journeys.push(journey)
                }
                await yieldStartupTask()
            }
        }
        catch (error) {
            console.warn('[StartupDataLoader] Remaining journey worker load failed, using the legacy loader:', error)
            return TrackUtils.readRemainingFromDB()
        }
        return journeys
    }

    loadPOIs = async ({currentOnly = false, journey = lgs.theJourney, includeStarter = true} = {}) => {
        if (!this.#client) {
            if (currentOnly) {
                return __.ui.poiManager.readStartupPOIsFromDB({includeStarter, journey})
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
                for (const data of packet.items ?? []) {
                    if (!data?.id || __.ui.poiManager.list.has(data.id)) {
                        continue
                    }
                    const poi = new MapPOI(data)
                    __.ui.poiManager.list.set(poi.id, poi)
                    __.ui.poiManager.addToJourneyIndex(poi.id, poi)
                }
                lgs.scene?.requestRender?.()
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

    dispose = () => this.#client?.dispose()
}
