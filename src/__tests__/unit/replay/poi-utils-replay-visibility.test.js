/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-utils-replay-visibility.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-12
 * Last modified: 2026-11-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { GLOBAL_PARENT } from '@Core/constants'
import { POIUtils } from '@Utils/cesium/POIUtils'
import {getOrCreateSceneRenderScheduler} from '@Utils/cesium/SceneRenderScheduler'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const propertyValue = value => typeof value?.getValue === 'function' ? value.getValue() : value

const createEntityContainer = () => {
    const entities = new Map()
    return {
        entities,
        container: {
            get values() {
                return Array.from(entities.values())
            },
            getById: id => entities.get(id),
            removeById: id => entities.delete(id),
            add:     entity => {
                entities.set(entity.id, entity)
                return entity
            },
        },
    }
}

describe('POIUtils replay visibility', () => {
    const schedulers = new Set()

    beforeEach(() => {
        const {container} = createEntityContainer()
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    active:  false,
                    playing: false,
                    paused:  false,
                }),
            },
            viewer: {
                entities:    container,
                dataSources: {
                    length: 0,
                    get:    () => null,
                },
                scene: {
                    render:        vi.fn(),
                    requestRender: vi.fn(),
                },
            },
        }
        globalThis.__ = {
            ui: {
                sceneManager: {
                    is2D:     false,
                    noRelief: () => true,
                },
            },
        }
    })

    afterEach(() => {
        schedulers.forEach(scheduler => scheduler.destroy())
        schedulers.clear()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('draws global POIs with the sentinel parent in the viewer entity collection', async () => {
        const poi = {
            id: 'global-poi-sentinel',
            longitude: 2,
            latitude: 48,
            parent: GLOBAL_PARENT,
            visible: true,
        }

        const entity = await POIUtils.drawPlaceholder(poi)

        expect(entity).toBe(globalThis.lgs.viewer.entities.getById(poi.id))
        expect(propertyValue(entity.billboard.image)).toMatch(/^data:image\/svg\+xml,/)
    })

    it('keeps a replay-hidden poi hidden while the replay is active', () => {
        globalThis.lgs.stores.replay.active = true

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {
                visible: false,
            },
        }, true)).toBe(false)
    })

    it('lets visible pois show when the replay is active', () => {
        globalThis.lgs.stores.replay.active = true

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {
                visible: true,
            },
        }, true)).toBe(true)
    })

    it('draws a lightweight POI placeholder and upgrades the same pickable entity', async () => {
        const poi = {
            id: 'poi-startup-placeholder',
            name: 'Startup placeholder',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            color: '#245c45',
            bgColor: '#d7e5dc',
        }

        const blankEntity = await POIUtils.draw({
            ...poi,
            image: {src: '', width: 32, height: 36},
        })
        const duplicateCleanup = vi.spyOn(POIUtils, 'removeEntityFromOtherContainers')
        const placeholder = await POIUtils.drawPlaceholder(poi)
        const placeholderImage = propertyValue(placeholder.billboard.image)

        expect(placeholder).toBe(blankEntity)
        expect(duplicateCleanup).not.toHaveBeenCalled()
        expect(globalThis.lgs.viewer.entities.getById(poi.id)).toBe(placeholder)
        expect(placeholderImage).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(placeholderImage.split(',')[1])).toContain('circle')

        const upgraded = await POIUtils.draw({
            ...poi,
            image: {src: 'final-poi-canvas', width: 120, height: 48},
        })

        expect(upgraded).toBe(placeholder)
        expect(propertyValue(upgraded.billboard.image)).toBe('final-poi-canvas')
    })

    it('preserves a rendered billboard image and geometry during visibility-only updates', async () => {
        const poi = {
            id: 'poi-visibility-image',
            name: 'Visibility image',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            scale: 2,
            image: {src: 'rendered-canvas', width: 120, height: 48},
            pixelOffset: {x: 6, y: -4},
        }
        const entity = await POIUtils.draw(poi)
        const originalImage = propertyValue(entity.billboard.image)
        const originalWidth = propertyValue(entity.billboard.width)
        const originalHeight = propertyValue(entity.billboard.height)
        const originalOffset = propertyValue(entity.billboard.pixelOffset)

        expect(POIUtils.updateVisibility(poi, false)).toBe(true)
        expect(entity.show).toBe(false)
        expect(propertyValue(entity.billboard.show)).toBe(false)
        expect(POIUtils.updateVisibility(poi, true)).toBe(true)
        expect(entity.show).toBe(true)
        expect(propertyValue(entity.billboard.show)).toBe(true)
        expect(propertyValue(entity.billboard.image)).toBe(originalImage)
        expect(propertyValue(entity.billboard.width)).toBe(originalWidth)
        expect(propertyValue(entity.billboard.height)).toBe(originalHeight)
        expect(propertyValue(entity.billboard.pixelOffset)).toEqual(originalOffset)
    })

    it('does not interpret an omitted image as a billboard image update', async () => {
        const poi = {
            id: 'poi-partial-image',
            name: 'Partial image update',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            scale: 2,
            image: {src: 'rendered-canvas', width: 120, height: 48},
            pixelOffset: {x: 6, y: -4},
        }
        const entity = await POIUtils.draw(poi)
        const originalImage = propertyValue(entity.billboard.image)
        const originalWidth = propertyValue(entity.billboard.width)
        const originalHeight = propertyValue(entity.billboard.height)
        const originalOffset = propertyValue(entity.billboard.pixelOffset)
        const partialPOI = {...poi}
        delete partialPOI.image
        delete partialPOI.pixelOffset

        await POIUtils.draw({...partialPOI, visible: false})

        expect(propertyValue(entity.billboard.image)).toBe(originalImage)
        expect(propertyValue(entity.billboard.width)).toBe(originalWidth)
        expect(propertyValue(entity.billboard.height)).toBe(originalHeight)
        expect(propertyValue(entity.billboard.pixelOffset)).toEqual(originalOffset)
        expect(entity.show).toBe(false)
    })

    it('clears an existing billboard image only when explicitly requested', async () => {
        const poi = {
            id: 'poi-clear-image',
            name: 'Clear image',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            scale: 2,
            image: {src: 'rendered-canvas', width: 120, height: 48},
            pixelOffset: {x: 6, y: -4},
        }
        const entity = await POIUtils.draw(poi)

        await POIUtils.draw(poi, true, {clearImage: true})

        expect(propertyValue(entity.billboard.image)).toBe('')
        expect(propertyValue(entity.billboard.width)).toBe(32)
        expect(propertyValue(entity.billboard.height)).toBe(32)
        expect(propertyValue(entity.billboard.pixelOffset)).toEqual({x: 0, y: 0})
    })

    it('preserves terrain masking while replacing a POI image', async () => {
        const poi = {
            id: 'poi-terrain-mask',
            name: 'Terrain masked POI',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            image: {src: 'old-canvas', width: 80, height: 40},
        }
        const entity = await POIUtils.draw(poi)
        entity.billboard.show = false

        await POIUtils.draw({...poi, image: {src: 'new-canvas', width: 100, height: 50}})

        expect(entity.show).toBe(true)
        expect(propertyValue(entity.billboard.show)).toBe(false)
        expect(propertyValue(entity.billboard.image)).toBe('new-canvas')
    })

    it('forces all pois hidden when hide-all replay mode is enabled', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.hideAllPoisDuringJourneyReplay = true
        globalThis.lgs.settings = {
            ui: {
                replay: {
                    userMode: 'expert',
                    hideAllPoisDuringJourneyReplay: true,
                },
            },
        }
        globalThis.lgs.stores.replay.userMode = 'expert'

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {
                visible: true,
            },
        }, true)).toBe(false)
    })

    it('allows an explicitly animated POI to show during its replay animation while hide-all is enabled', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.hideAllPoisDuringJourneyReplay = true
        globalThis.lgs.stores.replay.userMode = 'expert'
        globalThis.lgs.settings = {
            ui: {
                replay: {
                    userMode: 'expert',
                    hideAllPoisDuringJourneyReplay: true,
                },
            },
        }

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {visible: false},
        }, true, {allowReplayAnimation: true})).toBe(true)
        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {visible: true},
        }, true)).toBe(false)
    })

    it('allows animated Start and Stop flags through the replay visibility mask', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.userMode = 'expert'
        globalThis.lgs.stores.replay.hideAllPoisDuringJourneyReplay = true
        globalThis.lgs.settings = {ui: {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: true}}}

        for (const type of ['start', 'stop']) {
            expect(POIUtils.setPOIVisibility({
                type,
                visible: true,
                replay: {visible: false},
            }, true, {allowReplayAnimation: true})).toBe(true)
        }
    })

    it('forces Basic Replay Show all to reveal POIs regardless of their POI-level visibility preference', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.settings = {ui: {replay: {userMode: 'basic', basic: {poiVisibilityMode: 'yes'}}}}

        expect(POIUtils.setPOIVisibility({visible: false, replay: {visible: false}}, true)).toBe(true)
    })

    it.each([
        {clipSequenceActive: true},
        {deferredExportPlan: {runtime: {status: 'exporting'}}},
    ])('keeps Hide all applied to a billboard redraw without a running wall clock: %j', async context => {
        Object.assign(globalThis.lgs.stores.replay, context, {
            userMode: 'expert', hideAllPoisDuringJourneyReplay: true,
        })
        globalThis.lgs.settings = {ui: {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: true}}}
        const poi = {id: 'animated', type: 'poi', longitude: 2, latitude: 48, height: 100,
            visible: true, replay: {visible: false}, image: {src: 'canvas', width: 40, height: 20}}

        const hiddenEntity = await POIUtils.draw(poi)
        expect(hiddenEntity.show).toBe(false)
        globalThis.lgs.stores.replay.animatedPOIIds = [poi.id]
        const animatedEntity = await POIUtils.draw(poi)
        expect(animatedEntity.show).toBe(true)
        expect(propertyValue(animatedEntity.billboard.show)).toBe(true)
        globalThis.lgs.stores.replay.animatedPOIIds = []
        await POIUtils.draw(poi)
        expect(animatedEntity.show).toBe(false)
        expect(poi.replay.visible).toBe(false)
    })

    it('does not apply Replay masks just because linked recording is prepared', () => {
        Object.assign(globalThis.lgs.stores.replay, {
            recordingSync: true, hideAllPoisDuringJourneyReplay: true,
            deferredExportPlan: {runtime: {status: 'ready'}},
        })
        expect(POIUtils.setPOIVisibility({visible: true, replay: {visible: false}}, true)).toBe(true)
    })

    it('keeps Basic Replay Start and Stop visibility under user control even when all POIs are hidden', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.settings = {ui: {replay: {userMode: 'basic', basic: {poiVisibilityMode: 'no'}}}}

        expect(POIUtils.setPOIVisibility({type: 'start', visible: true, replay: {visible: true}}, true)).toBe(true)
        expect(POIUtils.setPOIVisibility({type: 'stop', visible: true, replay: {visible: false}}, true)).toBe(false)
        expect(POIUtils.setPOIVisibility({type: 'poi', visible: true, replay: {visible: true}}, true)).toBe(false)
    })

    it('keeps a too-close poi hidden even when it is otherwise visible', () => {
        expect(POIUtils.setPOIVisibility({
            visible:  true,
            tooClose: true,
        }, true)).toBe(false)
    })

    it('hides POIs attached to other journeys without changing their saved visibility', () => {
        const currentJourney = {slug: 'journey-current'}
        const otherJourney = {slug: 'journey-other'}
        globalThis.lgs.theJourney = currentJourney
        globalThis.lgs.settings = {journey: {hideOtherJourneys: true}}
        globalThis.lgs.getJourneyByTrackSlug = parent => parent === 'track-other' ? otherJourney : null

        const poi = {parent: 'track-other', visible: true}

        expect(POIUtils.setPOIVisibility(poi, true)).toBe(false)
        expect(poi.visible).toBe(true)
    })

    it('keeps current-journey and unassociated POIs visible while hiding other journeys', () => {
        globalThis.lgs.theJourney = {slug: 'journey-current'}
        globalThis.lgs.settings = {journey: {hideOtherJourneys: true}}
        globalThis.lgs.getJourneyBySlug = slug => slug === 'journey-current' ? globalThis.lgs.theJourney : null

        expect(POIUtils.setPOIVisibility({parent: 'journey-current', visible: true}, true)).toBe(true)
        expect(POIUtils.setPOIVisibility({parent: null, visible: true}, true)).toBe(true)
    })

    it('honors an explicit Replay setting that shows other journeys', () => {
        const otherJourney = {slug: 'journey-other'}
        globalThis.lgs.theJourney = {slug: 'journey-current'}
        globalThis.lgs.stores.main = {theJourney: globalThis.lgs.theJourney}
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.settings = {
            journey: {hideOtherJourneys: true},
            ui: {
                replay: {
                    userMode: 'expert',
                    inheritHideOtherJourneys: false,
                    hideOtherJourneys: false,
                },
            },
        }
        globalThis.lgs.getJourneyBySlug = slug => slug === otherJourney.slug ? otherJourney : null

        expect(POIUtils.setPOIVisibility({parent: otherJourney.slug, visible: true}, true)).toBe(true)
    })

    it('updates an existing billboard visibility when replay hides the poi', async () => {
        await POIUtils.draw({
            id:        'poi-1',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            image:     {
                src:    'data:image/png;base64,test',
                width:  40,
                height: 20,
            },
        })

        globalThis.lgs.stores.replay.active = true
        const entity = await POIUtils.draw({
            id:        'poi-1',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            replay: {
                visible: false,
            },
            image: {
                src:    'data:image/png;base64,test2',
                width:  40,
                height: 20,
            },
        })

        expect(entity.show).toBe(false)
        expect(propertyValue(entity.billboard.show)).toBe(false)
        expect(globalThis.lgs.viewer.scene.render).not.toHaveBeenCalled()
        expect(globalThis.lgs.viewer.scene.requestRender).toHaveBeenCalledTimes(2)
    })

    it('skips Cesium property writes and render requests when an existing POI is unchanged', async () => {
        const poi = {
            id: 'poi-stable',
            name: 'Stable POI',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            scale: 1,
            image: {src: 'stable-image', width: 40, height: 20},
        }
        const entity = await POIUtils.draw(poi)
        const originalPosition = entity.position
        const originalImage = entity.billboard.image
        const originalScale = entity.billboard.scale
        globalThis.lgs.viewer.scene.requestRender.mockClear()

        await POIUtils.draw({...poi, image: {...poi.image}})

        expect(entity.position).toBe(originalPosition)
        expect(entity.billboard.image).toBe(originalImage)
        expect(entity.billboard.scale).toBe(originalScale)
        expect(globalThis.lgs.viewer.scene.requestRender).not.toHaveBeenCalled()

        await POIUtils.draw({...poi, longitude: 2.001, scale: 0.8, image: {...poi.image}})

        expect(entity.position).not.toBe(originalPosition)
        expect(entity.billboard.image).toBe(originalImage)
        expect(entity.billboard.scale).not.toBe(originalScale)
        expect(globalThis.lgs.viewer.scene.requestRender).toHaveBeenCalledOnce()
    })

    it('skips redundant geographic position updates while retaining the success result', async () => {
        const poi = {
            id: 'poi-position-stable',
            name: 'Stable position POI',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            image: {src: 'position-image', width: 40, height: 20},
        }
        const entity = await POIUtils.draw(poi)
        const originalPosition = entity.position
        globalThis.lgs.viewer.scene.requestRender.mockClear()

        expect(POIUtils.updatePosition(poi)).toBe(true)
        expect(entity.position).toBe(originalPosition)
        expect(globalThis.lgs.viewer.scene.requestRender).not.toHaveBeenCalled()

        expect(POIUtils.updatePosition({...poi, longitude: 2.001})).toBe(true)
        expect(entity.position).not.toBe(originalPosition)
        expect(globalThis.lgs.viewer.scene.requestRender).toHaveBeenCalledOnce()
    })

    it('requests a render only when the effective POI visibility changes', async () => {
        const poi = {
            id: 'poi-visibility-stable',
            name: 'Stable visibility POI',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            image: {src: 'visibility-image', width: 40, height: 20},
        }
        const entity = await POIUtils.draw(poi)
        globalThis.lgs.viewer.scene.requestRender.mockClear()

        expect(POIUtils.toggleVisibility(poi)).toBe(true)
        expect(globalThis.lgs.viewer.scene.requestRender).not.toHaveBeenCalled()

        poi.visible = false
        expect(POIUtils.toggleVisibility(poi)).toBe(true)
        expect(entity.show).toBe(false)
        expect(propertyValue(entity.billboard.show)).toBe(false)
        expect(globalThis.lgs.viewer.scene.requestRender).toHaveBeenCalledOnce()
    })

    it('requests a render only after removing an existing POI entity', async () => {
        const poi = {
            id: 'poi-remove-render',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            image: {src: 'remove-image', width: 40, height: 20},
        }
        await POIUtils.draw(poi)
        globalThis.lgs.viewer.scene.requestRender.mockClear()

        await POIUtils.remove(poi)
        expect(globalThis.lgs.viewer.entities.getById(poi.id)).toBeUndefined()
        expect(globalThis.lgs.viewer.scene.requestRender).toHaveBeenCalledOnce()

        globalThis.lgs.viewer.scene.requestRender.mockClear()
        await POIUtils.remove(poi)
        expect(globalThis.lgs.viewer.scene.requestRender).not.toHaveBeenCalled()
    })

    it('starts a render window after a delayed final image is drawn', async () => {
        const scene = globalThis.lgs.viewer.scene
        const listeners = new Set()
        scene.requestRenderMode = true
        scene.postUpdate = {
            addEventListener: listener => {
                listeners.add(listener)
                return () => listeners.delete(listener)
            },
        }
        const scheduler = getOrCreateSceneRenderScheduler(scene)
        schedulers.add(scheduler)
        let resolveImage
        const imagePromise = new Promise(resolve => {
            resolveImage = resolve
        })
        const poi = {
            id: 'poi-delayed-image',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
        }
        const pendingDraw = imagePromise.then(async image => {
            poi.image = image
            await POIUtils.draw(poi)
        })

        expect(scene.requestRender).not.toHaveBeenCalled()
        resolveImage({src: 'delayed-canvas', width: 80, height: 60})
        await pendingDraw

        expect(scene.requestRender).toHaveBeenCalledOnce()
        expect(listeners.size).toBe(1)
        scheduler.destroy()
        expect(listeners.size).toBe(0)
    })

    it('removes duplicate entities when a POI moves between the main collection and a data source', async () => {
        const mainContainer = globalThis.lgs.viewer.entities
        const {container: journeyContainer} = createEntityContainer()
        const journeyDataSource = {name: 'journey#gpx', entities: journeyContainer}
        globalThis.lgs.viewer.dataSources = {
            length: 1,
            get: index => index === 0 ? journeyDataSource : undefined,
            getByName: name => name === journeyDataSource.name ? [journeyDataSource] : [],
        }
        const poi = {
            id: 'poi-container-move',
            name: 'POI container move',
            longitude: 2,
            latitude: 48,
            height: 100,
            visible: true,
            image: {src: 'container-image', width: 40, height: 20},
        }

        const mainEntity = await POIUtils.draw(poi)
        expect(mainContainer.getById(poi.id)).toBe(mainEntity)

        poi.parent = 'journey#gpx'
        const journeyEntity = await POIUtils.draw(poi)
        expect(mainContainer.getById(poi.id)).toBeUndefined()
        expect(journeyContainer.getById(poi.id)).toBe(journeyEntity)

        poi.parent = null
        const restoredEntity = await POIUtils.draw(poi)
        expect(journeyContainer.getById(poi.id)).toBeUndefined()
        expect(mainContainer.getById(poi.id)).toBe(restoredEntity)
    })

    it('draws a captured POI on the isolated target without touching the interactive viewer', async () => {
        const mainContainer = globalThis.lgs.viewer.entities
        const {container: targetEntityContainer} = createEntityContainer()
        const targetDataSource = {name: 'journey#gpx', entities: targetEntityContainer}
        const targetScene = {requestRender: vi.fn()}
        const targetViewer = {
            entities: createEntityContainer().container,
            dataSources: {
                getByName: name => name === targetDataSource.name ? [targetDataSource] : [],
            },
        }
        const poi = {
            id: 'isolated-journey-poi',
            name: 'Isolated POI',
            longitude: 2,
            latitude: 48,
            height: 100,
            parent: 'journey#gpx',
            visible: true,
            image: {src: 'isolated-image', width: 40, height: 20},
        }
        const capturedImage = {width: 120, height: 80}

        const entity = await POIUtils.draw(poi, true, {
            renderTarget: {viewer: targetViewer, scene: targetScene},
            effectiveVisibility: false,
            billboardOverrides: {
                image: capturedImage,
                width: 120,
                height: 80,
                scale: 1.5,
                pixelOffset: {x: 6, y: -9},
            },
        })

        expect(POIUtils.getDataSourceName(poi)).toBe('journey#gpx')
        expect(targetDataSource.entities.getById(poi.id)).toBe(entity)
        expect(mainContainer.getById(poi.id)).toBeUndefined()
        expect(entity.show).toBe(false)
        expect(propertyValue(entity.billboard.image)).toBe(capturedImage)
        expect(propertyValue(entity.billboard.width)).toBe(120)
        expect(propertyValue(entity.billboard.height)).toBe(80)
        expect(propertyValue(entity.billboard.scale)).toBe(1.5)
        expect(propertyValue(entity.billboard.pixelOffset)).toMatchObject({x: 6, y: -9})
        expect(targetScene.requestRender).toHaveBeenCalledOnce()
        expect(globalThis.lgs.viewer.scene.requestRender).not.toHaveBeenCalled()
    })

    it('scales an anchored POI pixel offset with the billboard distance scale', async () => {
        const entity = await POIUtils.draw({
            id:        'poi-expanded-anchor',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            expanded:  true,
            scale:     0.5,
            pixelOffset: {x: -20, y: -40},
            image: {
                src:    'data:image/png;base64,test',
                width:  200,
                height: 100,
            },
        })

        expect(propertyValue(entity.billboard.pixelOffset).x).toBe(-10)
        expect(propertyValue(entity.billboard.pixelOffset).y).toBe(-20)
        expect(propertyValue(entity.billboard.pixelOffsetScaleByDistance)).toMatchObject({
            near:      10000,
            nearValue: 1,
            far:       50000,
            farValue:  0,
        })
    })

    it('uses a canvas directly as a billboard image without serializing it', async () => {
        const canvas = {width: 80, height: 60}

        const entity = await POIUtils.draw({
            id:        'poi-canvas-image',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            image: {
                src:    canvas,
                width:  40,
                height: 30,
            },
        })

        expect(propertyValue(entity.billboard.image)).toBe(canvas)
        expect(globalThis.lgs.viewer.scene.requestRender).toHaveBeenCalledOnce()
    })
})
