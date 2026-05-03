/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    ADD_POI_EVENT, CURRENT_POI, GLOBAL_PARENT, POI_JOURNEY_ASSOCIATION_DISTANCE, POI_STARTER_TYPE,
    POI_THRESHOLD_DISTANCE, POI_TMP_TYPE, POIS_STORE,
    REMOVE_POI_EVENT,
}                                                  from '@Core/constants'
import { MapPOI }                                  from '@Core/MapPOI'
import { getOrbitSettings, setOrbitStoreSettings } from '@Core/OrbitSettings'
import { Export }                                  from '@Core/ui/Export'
import { POIUtils }                                from '@Utils/cesium/POIUtils'
import { KM }                                      from '@Utils/UnitUtils'
import { Cartesian3 }                              from 'cesium'
import { v4 as uuid }                              from 'uuid'
import { subscribe }                               from 'valtio'

const METERS_PER_DEGREE_LATITUDE = 111_320
const MIN_LONGITUDE_COSINE = 0.01
const TRACK_LINE_STRING = 'LineString'
const TRACK_MULTI_LINE_STRING = 'MultiLineString'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const normalizeCoordinate = coordinate => {
    const longitude = finiteNumber(Array.isArray(coordinate) ? coordinate[0] : coordinate?.longitude)
    const latitude = finiteNumber(Array.isArray(coordinate) ? coordinate[1] : coordinate?.latitude)

    if (longitude === null || latitude === null) {
        return null
    }

    return {longitude, latitude}
}

const getTrackCoordinateSegments = track => {
    const geometry = track?.content?.geometry
    const coordinates = geometry?.coordinates

    if (!Array.isArray(coordinates)) {
        return []
    }

    if (geometry.type === TRACK_LINE_STRING) {
        return [coordinates]
    }

    if (geometry.type === TRACK_MULTI_LINE_STRING) {
        return coordinates
    }

    return []
}

export const getJourneyReferencePoints = journey => Array.from(journey?.tracks?.values?.() ?? [])
    .flatMap(track => getTrackCoordinateSegments(track))
    .flatMap(segment => Array.isArray(segment) ? segment : [])
    .map(normalizeCoordinate)
    .filter(Boolean)

const getDistanceBoundingBox = (poi, maxDistanceMeters) => {
    const origin = normalizeCoordinate(poi)
    const maxDistance = finiteNumber(maxDistanceMeters) ?? POI_JOURNEY_ASSOCIATION_DISTANCE

    if (!origin || maxDistance <= 0) {
        return null
    }

    const latitudeDelta = maxDistance / METERS_PER_DEGREE_LATITUDE
    const longitudeCosine = Math.max(Math.abs(Math.cos(origin.latitude * Math.PI / 180)), MIN_LONGITUDE_COSINE)
    const longitudeDelta = maxDistance / (METERS_PER_DEGREE_LATITUDE * longitudeCosine)

    return {
        origin,
        west:  origin.longitude - longitudeDelta,
        east:  origin.longitude + longitudeDelta,
        south: origin.latitude - latitudeDelta,
        north: origin.latitude + latitudeDelta,
    }
}

const isPointInsideBoundingBox = (point, box) => point.longitude >= box.west
    && point.longitude <= box.east
    && point.latitude >= box.south
    && point.latitude <= box.north

export const findNearestJourneyPointDistance = ({
                                                    poi,
                                                    journey,
                                                    maxDistanceMeters = POI_JOURNEY_ASSOCIATION_DISTANCE,
                                                    referencePoints = undefined,
                                                } = {}) => {
    const maxDistance = finiteNumber(maxDistanceMeters) ?? POI_JOURNEY_ASSOCIATION_DISTANCE
    const box = getDistanceBoundingBox(poi, maxDistance)

    if (!box) {
        return null
    }

    const originCartesian = Cartesian3.fromDegrees(box.origin.longitude, box.origin.latitude, 0)
    const points = referencePoints ?? getJourneyReferencePoints(journey)
    let nearest = Number.POSITIVE_INFINITY

    for (const point of points) {
        if (!point || !isPointInsideBoundingBox(point, box)) {
            continue
        }

        const pointCartesian = point.cartesian ?? Cartesian3.fromDegrees(point.longitude, point.latitude, 0)
        const distance = Cartesian3.distance(originCartesian, pointCartesian)

        if (distance <= maxDistance && distance < nearest) {
            nearest = distance
        }
    }

    return Number.isFinite(nearest) ? nearest : null
}

export const focusablePOI = point => {
    const height = finiteNumber(point?.simulatedHeight) ?? finiteNumber(point?.height) ?? 0

    return {
        ...point,
        height,
        simulatedHeight: undefined,
    }
}

export class POIManager {
    threshold = POI_THRESHOLD_DISTANCE
    utils = POIUtils

    #structureSubscription = null
    #initialized = false
    #pendingWrites = new Map()
    #updateTimeout = 300

    #journeyIndex = new Map()
    #journeyReferencePointCache = new Map()

    constructor() {
        if (POIManager.instance) {
            return POIManager.instance
        }
        this.setupSubscriptions()
        POIManager.instance = this
    }

    get list() {
        return lgs.stores.main.components.pois.list
    }

    get allIndexes() {
        return this.#journeyIndex
    }

    index = (slug) => {
        // Fallback pour éviter undefined si le set n'existe pas encore
        return this.#journeyIndex.get(slug) || new Set()
    }

    get starter() {
        return Array.from(this.list.values()).find(poi => poi.type === POI_STARTER_TYPE)
    }

    set starterSettings(poi) {
        Object.keys(lgs.settings.starter).forEach(key => {
            lgs.settings.starter[key] = poi[key]
        })
    }

    copyCoordinatesToClipboard = async (point) => {
        return Export.toClipboard(`${__.convert(point.latitude).to(lgs.settings.coordinateSystem.current)}, ${__.convert(point.longitude).to(lgs.settings.coordinateSystem.current)}`)
    }

    static async create() {
        const manager = new POIManager()
        await manager.initialize()
        return manager
    }

    async initialize() {
        if (this.#initialized) {
            return
        }

        try {
            await this.readAllFromDB()
            this.#initialized = true
        }
        catch (error) {
            console.error('[POIManager] Init error:', error)
            throw error
        }
    }

    isInitialized() {
        return this.#initialized
    }

    async updatePOI(id, updates, options = {}) {
        const {skipPersist = false, immediate = false} = options
        const poi = this.list.get(id)
        if (!poi) {
            return null
        }

        const safeUpdates = {...updates}
        if (Object.prototype.hasOwnProperty.call(safeUpdates, 'height')
            && !Number.isFinite(safeUpdates.height)) {
            delete safeUpdates.height
        }
        if (Object.prototype.hasOwnProperty.call(safeUpdates, 'simulatedHeight')
            && !Number.isFinite(safeUpdates.simulatedHeight)) {
            delete safeUpdates.simulatedHeight
        }
        if (Object.keys(safeUpdates).length === 0) {
            return poi
        }

        const hasVisibilityUpdate = Object.prototype.hasOwnProperty.call(safeUpdates, 'visible')
        const previousVisible = poi.visible
        Object.assign(poi, safeUpdates)

        if (hasVisibilityUpdate && previousVisible !== poi.visible) {
            poi.toggleVisibility()
        }

        // Trigger Valtio proxyMap update for reactivity
        this.list.set(poi.id, poi)

        if (!skipPersist) {
            if (immediate) {
                await this.persistToDatabase(poi)
            }
            else {
                this.#debouncedPersist(poi)
            }
        }
        return poi
    }

    setupSubscriptions() {
        this.#structureSubscription = subscribe(
            this.list,
            (ops) => {
                ops.forEach(([op, , value, prevValue]) => {
                    // Si on ajoute un POI (op 'set' et pas de valeur précédente)
                    if (op === 'set' && prevValue === undefined) {
                        this.#handlePOIAdded(value.id, value)
                    }
                    // Si on modifie un POI existant
                    else if (op === 'set') {
                        this.#handlePOIUpdated(value.id, value, prevValue)
                    }
                    // Si on supprime
                    if (op === 'delete') {
                        this.#handlePOIRemoved(prevValue.id, prevValue)
                    }
                })
            },
        )
    }

    #debouncedPersist(poi) {
        const existingTimeout = this.#pendingWrites.get(poi.id)
        if (existingTimeout) {
            clearTimeout(existingTimeout)
        }

        const timeoutId = setTimeout(async () => {
            try {
                await this.persistToDatabase(poi)
                this.#pendingWrites.delete(poi.id)
            }
            catch (error) {
                console.error(`[POIManager] Persist failed ${poi.id}:`, error)
            }
        }, this.#updateTimeout)

        this.#pendingWrites.set(poi.id, timeoutId)
    }

    #handlePOIAdded(id, poi) {
        this.addToJourneyIndex(id, poi)
        window.dispatchEvent(new CustomEvent(ADD_POI_EVENT, {
            detail:  {poi},
            bubbles: true,
        }))
    }

    #handlePOIRemoved(id, poi) {
        const existingTimeout = this.#pendingWrites.get(id)
        if (existingTimeout) {
            clearTimeout(existingTimeout)
            this.#pendingWrites.delete(id)
        }
        this.removeFromJourneyIndex(id, poi)
        window.dispatchEvent(new CustomEvent(REMOVE_POI_EVENT, {
            detail:  {poi},
            bubbles: true,
        }))
    }

    #handlePOIUpdated(id, newPOI, oldPOI) {
        const oldParent = oldPOI?.parent ?? null
        const newParent = newPOI?.parent ?? null

        if (oldParent !== newParent) {
            this.removeFromJourneyIndex(id, oldPOI)
            this.addToJourneyIndex(id, newPOI)
        }
    }

    destroy() {
        if (this.#structureSubscription) {
            this.#structureSubscription()
            this.#structureSubscription = null
        }
        this.#pendingWrites.forEach(timeoutId => clearTimeout(timeoutId))
        this.#pendingWrites.clear()
        this.#initialized = false
        POIManager.instance = null
    }

    add = async (poi, checkDistance = true, dbSync = true) => {
        if (!(poi instanceof MapPOI)) {
            const id = poi.id ?? uuid()
            poi = new MapPOI({...poi, id})
        }
        if (checkDistance && this.isTooCloseThanExistingPoints(poi, this.threshold)) {
            return false
        }

        this.list.set(poi.id, poi)
        if (dbSync) {
            await this.persistToDatabase(poi)
        }
        return poi
    }

    get = id => this.list.get(id)

    getByParent = parent => {
        return Array.from(this.list.values()).filter(poi => poi.parent === parent)
    }

    get journeyAssociationDistance() {
        return finiteNumber(lgs.settings?.poi?.association?.maxDistance) ?? POI_JOURNEY_ASSOCIATION_DISTANCE
    }

    get #journeys() {
        if (lgs?.journeys?.values) {
            return Array.from(lgs.journeys.values())
        }

        return Array.from(lgs?.stores?.main?.components?.journeyEditor?.list ?? [], slug => lgs.getJourneyBySlug(slug))
            .filter(Boolean)
    }

    #getJourneyReferencePoints = journey => {
        const tracks = Array.from(journey?.tracks?.values?.() ?? [])
        const sources = tracks.map(track => track?.content?.geometry?.coordinates)
        const cached = this.#journeyReferencePointCache.get(journey?.slug)

        if (cached
            && cached.sources.length === sources.length
            && cached.sources.every((source, index) => source === sources[index])) {
            return cached.points
        }

        const points = getJourneyReferencePoints(journey).map(point => ({
            ...point,
            cartesian: Cartesian3.fromDegrees(point.longitude, point.latitude, 0),
        }))

        this.#journeyReferencePointCache.set(journey?.slug, {sources, points})
        return points
    }

    clearJourneyReferencePointCache = (journeySlug = null) => {
        if (journeySlug) {
            this.#journeyReferencePointCache.delete(journeySlug)
            return
        }

        this.#journeyReferencePointCache.clear()
    }

    getNearbyJourneysForPOI = (poi, maxDistanceMeters = this.journeyAssociationDistance) => {
        const maxDistance = finiteNumber(maxDistanceMeters) ?? POI_JOURNEY_ASSOCIATION_DISTANCE

        return this.#journeys
            .map(journey => ({
                journey,
                distance: findNearestJourneyPointDistance({
                                                              poi,
                                                              journey,
                                                              maxDistanceMeters: maxDistance,
                                                              referencePoints:    this.#getJourneyReferencePoints(journey),
                                                          }),
            }))
            .filter(({distance}) => distance !== null)
            .sort((a, b) => a.distance - b.distance || a.journey.title.localeCompare(b.journey.title))
    }

    getPointFromGeoJson = async (json, simulate = false) => {
        const point = {
            longitude:   json.geometry.coordinates[0],
            latitude:    json.geometry.coordinates[1],
            title:       json.properties.name ?? '',
            description: json.properties.display_name
                         ? json.properties.display_name.split(', ').join(' - ')
                         : '',
            color:       lgs.darkContrastColor,
            bgColor:     lgs.colors.poiDefaultBackground,
        }
        if (simulate) {
            try {
                point.simulatedHeight = await this.getHeightFromTerrain({
                                                                            coordinates: {
                                                                                longitude: json.geometry.coordinates[0],
                                                                                latitude:  json.geometry.coordinates[1],
                                                                            },
                                                                        })
            }
            catch {
                point.simulatedHeight = 0
            }
        }
        else {
            point.height = json.height
        }
        return point
    }

    remove = async ({id, dbSync = true} = {}) => {
        const poi = this.list.get(id)
        if (!poi) {
            return {id, success: false}
        }
        if (poi.type === POI_STARTER_TYPE) {
            return {id, success: false}
        }
        this.list.delete(id)
        await poi.remove(dbSync)
        return {id, success: true}
    }

    haversineDistance = (poi1, poi2) => {
        const toRadians = (d) => d * (Math.PI / 180)
        const R = 6371
        const dLat = toRadians(poi2.latitude - poi1.latitude)
        const dLon = toRadians(poi2.longitude - poi1.longitude)
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(poi1.latitude)) * Math.cos(toRadians(poi2.latitude)) * Math.sin(dLon / 2) ** 2
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) / KM
    }

    isTooCloseThanExistingPoints = (newPoi, threshold = this.threshold, tempList = null) => {
        const list = tempList ?? this.list
        if (newPoi.type === POI_STARTER_TYPE) {
            return false
        }
        for (let p of list.values()) {
            const dist = this.haversineDistance(newPoi, p)
            if (dist <= threshold) {
                return true
            }
        }
        return false
    }

    getHeightFromTerrain = async (args) => __.ui.sceneManager.getHeightFromTerrain(args)

    persistToDatabase = async (poi) => {
        const target = typeof poi === 'string' ? this.list.get(poi) : poi
        if (target?.type && target.type !== POI_TMP_TYPE) {
            await lgs.db.lgs1920.put(target.id, MapPOI.serialize({...target, __class: MapPOI}), POIS_STORE)
        }
    }

    readAllFromDB = async () => {
        try {
            const keys = await lgs.db.lgs1920.keys(POIS_STORE)
            const rawList = await Promise.all(keys.map(k => lgs.db.lgs1920.get(k, POIS_STORE)))

            for (const data of rawList) {
                if (!data) {
                    continue
                }
                const poi = new MapPOI(data)

                // On ajoute à la liste Valtio
                this.list.set(poi.id, poi)

                // CRUCIAL : On force l'indexation manuelle car le subscribe
                // peut ne pas se déclencher pendant le chargement initial.
                this.addToJourneyIndex(poi.id, poi)
            }
            return this.list
        }
        catch (e) {
            console.error('[POIManager] DB Read Error:', e)
            return false
        }
    }

    addToJourneyIndex(id, poi) {
        const parentValue = poi?.parent ?? null
        let indexKey = GLOBAL_PARENT

        if (parentValue !== null) {
            const journey = lgs.getJourneyByTrackSlug(parentValue)
            indexKey = journey?.slug ?? parentValue
        }

        if (!this.#journeyIndex.has(indexKey)) {
            this.#journeyIndex.set(indexKey, new Set())
        }
        this.#journeyIndex.get(indexKey).add(id)
    }

    removeFromJourneyIndex(id, poi) {
        const parentValue = poi?.parent ?? null
        let indexKey = GLOBAL_PARENT
        if (parentValue !== null) {
            const journey = lgs.getJourneyByTrackSlug(parentValue)
            indexKey = journey?.slug ?? parentValue
        }
        const set = this.#journeyIndex.get(indexKey)
        if (set) {
            set.delete(id)
            if (set.size === 0) {
                this.#journeyIndex.delete(indexKey)
            }
        }
    }


    clearRotatingPoiAnimation = async () => {
        const rotatingId = this.getRotatingPoiId()
        if (!rotatingId) {
            return
        }

        const rotatingPoi = lgs.stores.main.components.pois.list.get(rotatingId)
        if (rotatingPoi?.animated) {
            await this.updatePOI(rotatingId, {animated: false})
        }
    }

    getRotatingPoiId = () => {
        const target = lgs.stores.ui.mainUI.rotate.target
        if (!target || target.element !== CURRENT_POI) {
            return null
        }
        return target.slug ?? target.id ?? null
    }

    isPOIRotating = (poiId) => {
        if (!poiId) {
            return false
        }
        return __.ui.cameraManager.isRotating() && this.getRotatingPoiId() === poiId
    }

    focusPOI = async (poiId, options = {}) => {
        const point = this.list.get(poiId)
        if (!point) {
            return false
        }
        const target = focusablePOI(point)
        __.ui.sceneManager.focus(target, {
            target:  target,
            heading: lgs.settings.camera.heading,
            roll:    lgs.settings.camera.roll,
            range:   lgs.settings.camera.range,
            ...options,
        })
        return true
    }

    rotateAroundPOI = async (poiId) => {
        const point = this.list.get(poiId)
        if (!point) {
            return false
        }
        const rotationSettings = getOrbitSettings(point, 'rotation')

        if (__.ui.cameraManager.isRotating()) {
            await this.stopRotationAndSync()
        }

        setOrbitStoreSettings(lgs.stores.ui.mainUI.rotate, rotationSettings)

        await this.focusPOI(poiId, {
            direction: rotationSettings.direction,
            infinite:   true,
            rpm:       rotationSettings.rpm,
            rotate:     true,
            flyingTime: 0,
        })
        await this.updatePOI(poiId, {animated: true})
        return true
    }

    toggleRotationAroundPOI = async (poiId) => {
        if (!poiId) {
            return false
        }
        if (this.isPOIRotating(poiId)) {
            await this.stopRotationAndSync()
            return false
        }
        return this.rotateAroundPOI(poiId)
    }

    stopRotationAndSync = async () => {
        const rotatingId = this.getRotatingPoiId()
        const panorama = lgs.stores.ui.mainUI.panorama
        const panoramaId = panorama.target?.slug ?? panorama.target?.id
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        if (panorama.active) {
            panorama.active = false
            panorama.target = false
        }

        if (rotatingId) {
            const rotatingPoi = this.list.get(rotatingId)
            if (rotatingPoi?.animated) {
                await this.updatePOI(rotatingId, {animated: false})
            }
        }
        if (panoramaId && panoramaId !== rotatingId) {
            const panoramicPoi = this.list.get(panoramaId)
            if (panoramicPoi?.animated) {
                await this.updatePOI(panoramaId, {animated: false})
            }
        }
    }

}
