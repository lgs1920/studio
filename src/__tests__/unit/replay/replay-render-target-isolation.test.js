/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-render-target-isolation.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-08
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/* ******************************************************************************
 * This file is part of the LGS1920/studio project.
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {JourneyReplaySessionController} from '@Core/ui/replay/JourneyReplaySessionController'
import {JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {replayRendererFor, replayRenderTargetFor} from '@Core/ui/replay/ReplayRenderTarget'
import {createReplayPOIEntityLookup} from '@Core/ui/replay/ReplayPOIEntityLookup'

describe('isolated Replay render target ownership', () => {
    let mode = null

    afterEach(() => {
        mode?.[JOURNEY_REPLAY_INTERNAL_STATE]?.unbind?.forEach(unbind => unbind())
        mode = null
    })

    it('keeps the visible renderer intact while Native HQ owns a separate renderer', () => {
        const mainRenderer = {
            clear: vi.fn(),
            setRenderTarget: vi.fn(),
        }
        mode = new JourneyReplaySessionController({
            controller: {on: vi.fn(() => () => {})},
            renderer: mainRenderer,
        })
        const target = {
            viewer: {dataSources: {values: []}},
            scene: {requestRender: vi.fn()},
            canvas: {},
        }

        mode.setRenderTarget(target)

        const exportRenderer = replayRendererFor(mode)
        expect(exportRenderer).not.toBe(mainRenderer)
        expect(replayRenderTargetFor(mode)).toBe(target)
        expect(mainRenderer.clear).not.toHaveBeenCalled()
        expect(mainRenderer.setRenderTarget).not.toHaveBeenCalled()

        expect(mode.clearRenderTarget(target)).toBe(true)
        expect(replayRendererFor(mode)).toBe(mainRenderer)
        expect(replayRenderTargetFor(mode)).toBeNull()
        expect(mainRenderer.clear).not.toHaveBeenCalled()
    })

    it('disposes POI collection listeners before clearing an isolated target', () => {
        const createEvent = () => {
            const listeners = new Set()
            return {
                addEventListener(listener) {
                    listeners.add(listener)
                    return () => listeners.delete(listener)
                },
                raiseEvent: (...args) => [...listeners].forEach(listener => listener(...args)),
            }
        }
        const entityCollection = {collectionChanged: createEvent()}
        const dataSources = {
            length: 0,
            dataSourceAdded: createEvent(),
            dataSourceRemoved: createEvent(),
            dataSourceMoved: createEvent(),
        }
        let destroyed = false
        const viewer = {
            scene: {},
            dataSources,
            get entities() {
                if (destroyed) {
                    throw new TypeError("Cannot read properties of undefined (reading 'defaultDataSource')")
                }
                return entityCollection
            },
        }
        mode = new JourneyReplaySessionController({controller: {on: vi.fn(() => () => {})}})
        const target = {viewer, scene: {}, canvas: {}}
        mode.setRenderTarget(target)
        mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPOIEntityLookup = createReplayPOIEntityLookup(viewer)

        expect(mode.clearRenderTarget(target)).toBe(true)
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPOIEntityLookup).toBeNull()

        destroyed = true
        expect(() => dataSources.dataSourceRemoved.raiseEvent()).not.toThrow()
    })

    it('detaches POI collection listeners when Cesium emits removals during viewer destruction', () => {
        const createEvent = () => {
            const listeners = new Set()
            return {
                addEventListener(listener) {
                    listeners.add(listener)
                    return () => listeners.delete(listener)
                },
                raiseEvent: (...args) => [...listeners].forEach(listener => listener(...args)),
                get listenerCount() {
                    return listeners.size
                },
            }
        }
        const entityCollection = {collectionChanged: createEvent()}
        const dataSources = {
            length: 0,
            dataSourceAdded: createEvent(),
            dataSourceRemoved: createEvent(),
            dataSourceMoved: createEvent(),
        }
        let destroyed = false
        const viewer = {
            scene: {},
            dataSources,
            get entities() {
                if (destroyed) {
                    throw new TypeError("Cannot read properties of undefined (reading 'defaultDataSource')")
                }
                return entityCollection
            },
        }
        const lookup = createReplayPOIEntityLookup(viewer)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        destroyed = true

        expect(() => dataSources.dataSourceRemoved.raiseEvent()).not.toThrow()
        expect(dataSources.dataSourceRemoved.listenerCount).toBe(0)
        expect(entityCollection.collectionChanged.listenerCount).toBe(0)
        expect(warn).toHaveBeenCalledWith(
            '[Replay] POI entity lookup detached during Cesium viewer teardown.',
            expect.objectContaining({message: expect.stringContaining('defaultDataSource')}),
        )
        expect(lookup.get({id: 'poi-1'})).toEqual([])
    })
})
