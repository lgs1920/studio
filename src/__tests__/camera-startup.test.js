/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: camera-startup.test.js
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

import { DEFAULT_2D_FOCUS_PITCH, FOCUS_CENTROID, FOCUS_LAST, FOCUS_STARTER } from '@Core/constants'
import {
    buildStartupCameraFocusOptions, cameraPositionWithDefaults, cameraRangeFromStoredPosition, cameraStoreForTarget,
    configureStartupCamera,
}                                                    from '@Core/ui/cameraStartup'
import { focusablePOI }                              from '@Core/ui/POIManager'
import { describe, expect, it, vi }                  from 'vitest'

const cameraSettings = {
    heading: 12,
    pitch:   -34,
    roll:    2,
    range:   2000,
}

const starter = {
    id:              'starter-poi',
    longitude:       5.75,
    latitude:        45.2,
    height:          1200,
    simulatedHeight: 1234,
}

const centroid = {
    longitude: 6.1,
    latitude:  45.6,
    height:    1700,
}

const journey = {
    slug:   'journey-a',
    tracks: new Map([['track-a', {}]]),
}

const context = theJourney => ({theJourney})

const sceneManager = value => ({
    getJourneyCentroid: vi.fn(async () => value),
})

const cameraManager = ({focusMode, savedCamera = null}) => ({
    isAppFocusOn:          vi.fn(mode => mode === focusMode),
    readCameraInformation: vi.fn(async () => savedCamera),
})

const fixedDistance = value => vi.fn(() => value)

const validSavedPosition = {
    longitude: 7,
    latitude:  46,
    height:    3000,
    heading:   80,
    pitch:     -20,
    roll:      4,
    range:     900,
}

const validSavedTarget = {
    longitude: 7.1,
    latitude:  46.1,
    height:    1400,
}

describe('startup camera positioning', () => {
    describe('camera position normalization', () => {
        it('uses defaults when heading, pitch, roll, and range are missing or invalid', () => {
            const position = cameraPositionWithDefaults(
                {longitude: 1, latitude: 2, height: 3, heading: 'x', pitch: null, roll: undefined, range: 'bad'},
                {},
                cameraSettings,
            )

            expect(position).toMatchObject({
                                               longitude: 1,
                                               latitude:  2,
                                               height:    3,
                                               heading:   cameraSettings.heading,
                                               pitch:     cameraSettings.pitch,
                                               roll:      cameraSettings.roll,
                                               range:     cameraSettings.range,
                                           })
        })

        it('computes range from valid stored position and target before using stored range', () => {
            const distance = fixedDistance(4321)
            const position = cameraPositionWithDefaults(
                {...validSavedPosition, range: 111},
                validSavedTarget,
                cameraSettings,
                distance,
            )

            expect(position.range).toBe(4321)
            expect(distance).toHaveBeenCalledWith(
                {longitude: 7, latitude: 46, height: 3000},
                {longitude: 7.1, latitude: 46.1, height: 1400},
            )
        })

        it('falls back to stored range when the stored target cannot produce a range', () => {
            expect(cameraRangeFromStoredPosition(validSavedPosition, {}, fixedDistance(4321))).toBeNull()
            expect(cameraPositionWithDefaults(validSavedPosition, {}, cameraSettings).range).toBe(validSavedPosition.range)
        })
    })

    describe('focus mode: last camera location', () => {
        it('restores a complete saved camera without replacing the target', async () => {
            const savedCamera = {position: validSavedPosition, target: validSavedTarget}
            const manager = cameraManager({focusMode: FOCUS_LAST, savedCamera})
            const result = await configureStartupCamera({
                                                            context:            context(journey),
                                                            starter,
                                                            cameraManager:      manager,
                                                            sceneManager:       sceneManager(centroid),
                                                            cameraSettings,
                                                            distanceCalculator: fixedDistance(5555),
                                                        })

            expect(manager.readCameraInformation).toHaveBeenCalledWith({fallback: false})
            expect(result.focusTarget).toBeNull()
            expect(result.cameraStore.restoreCameraPosition).toBe(true)
            expect(result.cameraStore.target).toEqual(validSavedTarget)
            expect(result.cameraStore.position.range).toBe(5555)
        })

        it('restores saved position but replaces an invalid saved target with journey centroid', async () => {
            const savedCamera = {position: validSavedPosition, target: {longitude: 7}}
            const result = await configureStartupCamera({
                                                            context:       context(journey),
                                                            starter,
                                                            cameraManager: cameraManager({
                                                                                             focusMode: FOCUS_LAST,
                                                                                             savedCamera,
                                                                                         }),
                                                            sceneManager:  sceneManager(centroid),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(journey)
            expect(result.cameraStore.restoreCameraPosition).toBe(true)
            expect(result.cameraStore.target).toMatchObject(centroid)
            expect(result.cameraStore.position).toMatchObject(validSavedPosition)
        })

        it('restores saved position but falls back to starter when saved target and centroid are unavailable', async () => {
            const savedCamera = {position: validSavedPosition, target: null}
            const result = await configureStartupCamera({
                                                            context:       context(null),
                                                            starter,
                                                            cameraManager: cameraManager({
                                                                                             focusMode: FOCUS_LAST,
                                                                                             savedCamera,
                                                                                         }),
                                                            sceneManager:  sceneManager(null),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(starter)
            expect(result.cameraStore.restoreCameraPosition).toBe(true)
            expect(result.cameraStore.target).toMatchObject({
                                                                longitude:       starter.longitude,
                                                                latitude:        starter.latitude,
                                                                height:          starter.height,
                                                                simulatedHeight: starter.simulatedHeight,
                                                            })
        })

        it('ignores invalid saved position and falls back to journey centroid', async () => {
            const savedCamera = {position: {longitude: 7, height: 3000}, target: validSavedTarget}
            const result = await configureStartupCamera({
                                                            context:       context(journey),
                                                            starter,
                                                            cameraManager: cameraManager({
                                                                                             focusMode: FOCUS_LAST,
                                                                                             savedCamera,
                                                                                         }),
                                                            sceneManager:  sceneManager(centroid),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(journey)
            expect(result.cameraStore.restoreCameraPosition).toBeUndefined()
            expect(result.cameraStore.target).toMatchObject(centroid)
        })

        it('ignores saved camera positions that are far below the map', async () => {
            const savedCamera = {
                position: {...validSavedPosition, height: -42000},
                target:   validSavedTarget,
            }
            const result = await configureStartupCamera({
                                                            context:       context(journey),
                                                            starter,
                                                            cameraManager: cameraManager({
                                                                                             focusMode: FOCUS_LAST,
                                                                                             savedCamera,
                                                                                         }),
                                                            sceneManager:  sceneManager(centroid),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(journey)
            expect(result.cameraStore.restoreCameraPosition).toBeUndefined()
            expect(result.cameraStore.target).toMatchObject(centroid)
        })
    })

    describe('focus mode fallback matrix', () => {
        it('uses journey centroid when app focus is centroid and a journey centroid exists', async () => {
            const result = await configureStartupCamera({
                                                            context:       context(journey),
                                                            starter,
                                                            cameraManager: cameraManager({focusMode: FOCUS_CENTROID}),
                                                            sceneManager:  sceneManager(centroid),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(journey)
            expect(result.cameraStore.target).toMatchObject(centroid)
        })

        it('falls back to starter when app focus is centroid but no journey centroid exists', async () => {
            const result = await configureStartupCamera({
                                                            context:       context({slug: 'empty', tracks: new Map()}),
                                                            starter,
                                                            cameraManager: cameraManager({focusMode: FOCUS_CENTROID}),
                                                            sceneManager:  sceneManager(null),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(starter)
            expect(result.cameraStore.target).toMatchObject({
                                                                longitude: starter.longitude,
                                                                latitude:  starter.latitude,
                                                                height:    starter.height,
                                                            })
        })

        it('uses starter when app focus is starter and no journey is loaded', async () => {
            const result = await configureStartupCamera({
                                                            context:       context(null),
                                                            starter,
                                                            cameraManager: cameraManager({focusMode: FOCUS_STARTER}),
                                                            sceneManager:  sceneManager(centroid),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(starter)
            expect(result.cameraStore.target).toMatchObject({
                                                                longitude: starter.longitude,
                                                                latitude:  starter.latitude,
                                                                height:    starter.height,
                                                            })
        })

        it('uses journey centroid instead of starter when app focus is starter and a journey is loaded', async () => {
            const result = await configureStartupCamera({
                                                            context:       context(journey),
                                                            starter,
                                                            cameraManager: cameraManager({focusMode: FOCUS_STARTER}),
                                                            sceneManager:  sceneManager(centroid),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(journey)
            expect(result.cameraStore.target).toMatchObject(centroid)
        })

        it('uses the normal fallback when no explicit startup focus mode matches', async () => {
            const result = await configureStartupCamera({
                                                            context:       context(journey),
                                                            starter,
                                                            cameraManager: cameraManager({focusMode: 'unknown'}),
                                                            sceneManager:  sceneManager(centroid),
                                                            cameraSettings,
                                                        })

            expect(result.focusTarget).toBe(journey)
            expect(result.cameraStore.target).toMatchObject(centroid)
        })
    })

    describe('startup focus options', () => {
        it('restores exact saved camera position and keeps stored pitch even without relief', () => {
            const cameraStore = {
                restoreCameraPosition: true,
                target:                validSavedTarget,
                position:              validSavedPosition,
            }
            const options = buildStartupCameraFocusOptions({
                                                               cameraStore,
                                                               focusTarget: null,
                                                               noRelief:    true,
                                                               rotate:      true,
                                                               rpm:         4,
                                                           })

            expect(options.pitch).toBe(validSavedPosition.pitch)
            expect(options.cameraPosition).toBe(validSavedPosition)
            expect(options.rotate).toBe(true)
            expect(options.rpm).toBe(4)
        })

        it('keeps an existing pitch for non-restored startup focus without relief', () => {
            const cameraStore = cameraStoreForTarget(starter, {pitch: -25}, cameraSettings)
            const options = buildStartupCameraFocusOptions({
                                                               cameraStore,
                                                               focusTarget: starter,
                                                               noRelief:    true,
                                                           })

            expect(options.pitch).toBe(-25)
            expect(options.cameraPosition).toBeNull()
        })

        it('uses the 2D focus pitch when startup focus has no stored pitch without relief', () => {
            const cameraStore = {
                target:   starter,
                position: {
                    heading: 0,
                    roll:    0,
                    range:   1000,
                },
            }
            const options = buildStartupCameraFocusOptions({
                                                               cameraStore,
                                                               focusTarget: starter,
                                                               noRelief:    true,
                                                           })

            expect(options.pitch).toBe(DEFAULT_2D_FOCUS_PITCH)
        })

        it('keeps configured pitch for non-restored startup focus with relief', () => {
            const cameraStore = cameraStoreForTarget(starter, {}, cameraSettings)
            const options = buildStartupCameraFocusOptions({
                                                               cameraStore,
                                                               focusTarget: starter,
                                                               noRelief:    false,
                                                           })

            expect(options.pitch).toBe(cameraSettings.pitch)
        })
    })

    describe('POI focus target height', () => {
        it('uses simulatedHeight as the Cesium positioning reference before real height', () => {
            const poi = focusablePOI({
                                         id:              'poi-a',
                                         longitude:       5,
                                         latitude:        45,
                                         height:          120,
                                         simulatedHeight: 987,
                                     })

            expect(poi.height).toBe(987)
            expect(poi.simulatedHeight).toBeUndefined()
        })

        it('falls back to real height only when simulatedHeight is unavailable', () => {
            expect(focusablePOI({height: 120}).height).toBe(120)
        })
    })
})
