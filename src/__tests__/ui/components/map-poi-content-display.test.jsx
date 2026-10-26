/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-content-display.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

const {drawPOI} = vi.hoisted(() => ({drawPOI: vi.fn().mockResolvedValue()}))

vi.mock('@zumer/snapdom', () => ({snapdom: vi.fn()}))

vi.mock('@Components/DataDisplay/NameValueUnit', () => ({
    NameValueUnit: ({text, value}) => <div>{text} {value}</div>,
}))

vi.mock('@Components/DateTimeDisplay', () => ({
    DateTimeDisplay: ({value}) => <div data-testid="poi-date-time">{value}</div>,
}))

vi.mock('@Components/MainUI/MapPOI/duotoneIconUtils', () => ({
    stylePOIDuotoneIcon: vi.fn().mockResolvedValue(),
}))

vi.mock('@Components/MainUI/MapPOI/openPOIEditor', () => ({
    openPOIEditor: vi.fn().mockResolvedValue(),
}))

vi.mock('@Core/MapPOI', () => ({
    MapPOI: class {
        constructor(poi) {
            Object.assign(this, poi)
            this.utils = {draw: drawPOI}
        }
    },
}))

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon: ({className, name}) => <span className={className} data-icon-name={name}/>,
}))

import { MapPOIContent } from '@Components/MainUI/MapPOI/MapPOIContent'
import {snapdom} from '@zumer/snapdom'

/**
 * Create a fully populated expanded POI fixture.
 *
 * @param {Object} display - Display flags for the fixture.
 * @returns {Object} The POI fixture.
 */
const createPOI = display => ({
    id:             'poi-1',
    title:          'River stop',
    category:       'standard',
    categoryIcon:   () => 'location-dot',
    display:        {schemaVersion: 1, ...display},
    expanded:       true,
    height:         125,
    simulatedHeight: 0,
    latitude:       48.2,
    longitude:      2.3,
    location:       'Riverside',
    time:           '2026-10-24T10:00:00Z',
    timeZone:       'Europe/Paris',
    visible:        true,
    replay:         {visible: true, hiddenFields: {}},
})

describe('MapPOIContent display settings', () => {
    let poiList
    let requestAnimationFrame

    beforeEach(() => {
        drawPOI.mockClear()
        vi.mocked(snapdom).mockReset()
        poiList = proxyMap([['poi-1', createPOI({
            category:    true,
            titleCategoryIcon: true,
            titleAltitude: false,
            location:    true,
            altitude:    true,
            coordinates: true,
            dateTime:    true,
            maxWidth:    320,
        })]])
        requestAnimationFrame = vi.fn()

        globalThis.lgs = {
            colors: {poiDefault: '#000000', poiDefaultBackground: '#ffffff'},
            settings: proxy({
                unitSystem:      {current: 0},
                coordinateSystem: {current: 'decimal'},
            }),
            stores: proxy({
                main: {
                    components: {
                        pois: {list: poiList},
                    },
                },
                replay: {
                    active: false,
                    playing: false,
                    paused: false,
                    nearbyPois: [],
                },
            }),
        }

        globalThis.__ = {
            canvasEvents: {
                on: vi.fn(),
                onClick: vi.fn(),
                onTap: vi.fn(),
                onDoubleClick: vi.fn(),
                onDoubleTap: vi.fn(),
                onRightClick: vi.fn(),
                onLongTap: vi.fn(),
                removeAllListenersByEntity: vi.fn(),
            },
            convert: value => ({to: () => String(value)}),
            requestAnimationFrame,
            ui: {
                contextMenu: {hide: vi.fn()},
                poiManager: {ensurePOILocation: vi.fn(), updatePOI: vi.fn()},
            },
        }
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('keeps regular clicks for expansion without arming movement on Shift+click', () => {
        const canvasEvents = globalThis.__.canvasEvents
        render(<MapPOIContent poi="poi-1"/>)

        expect(canvasEvents.on.mock.calls.some(([name]) => name === 'SHIFT#CLICK')).toBe(false)
        act(canvasEvents.onClick.mock.calls[0][0])

        expect(globalThis.__.ui.poiManager.updatePOI).toHaveBeenCalledWith('poi-1', {expanded: false})
    })

    it('renders configured fields on the expanded map POI', () => {
        render(<MapPOIContent poi="poi-1"/>)

        expect(screen.getByRole('heading', {name: 'River stop'})).toBeTruthy()
        expect(document.querySelector('.poi-category-title-icon')?.getAttribute('data-icon-name')).toBe('location-dot')
        expect(document.querySelector('.poi-icon-wrapper').style.getPropertyValue('--poi-expanded-dimension')).toBe('320px')
        expect(screen.getByText('Riverside')).toBeTruthy()
        expect(screen.getByText('standard')).toBeTruthy()
        expect(screen.getByText('Altitude: 125')).toBeTruthy()
        expect(screen.getByText('48.2, 2.3')).toBeTruthy()
        expect(screen.getByTestId('poi-date-time').textContent).toBe('2026-10-24T10:00:00Z')
    })

    it.each([
        {randomValue: 0.1, expectedAngle: -45},
        {randomValue: 0.5, expectedAngle: 0},
        {randomValue: 0.9, expectedAngle: 45},
    ])('renders a one-rem leader at $expectedAngle degrees with the geographic POI as its endpoint', ({
        randomValue,
        expectedAngle,
    }) => {
        vi.spyOn(Math, 'random').mockReturnValue(randomValue)
        render(<MapPOIContent poi="poi-1"/>)

        const wrapper = document.querySelector('.poi-icon-wrapper')
        const leaderSpace = wrapper.querySelector('.poi-expanded-leader-space')
        const angle = Number.parseFloat(leaderSpace.style.getPropertyValue('--poi-expanded-leader-angle'))
        const radians = angle * Math.PI / 180

        expect(angle).toBe(expectedAngle)
        expect(wrapper.querySelector('.poi-card--expanded')).not.toBeNull()
        expect(wrapper.querySelector('.poi-expanded-leader')).not.toBeNull()
        expect(wrapper.querySelector('.poi-geographic-anchor')).not.toBeNull()
        expect(Number.parseFloat(leaderSpace.style.getPropertyValue('--poi-expanded-leader-x')))
            .toBeCloseTo(-Math.sin(radians))
        expect(Number.parseFloat(leaderSpace.style.getPropertyValue('--poi-expanded-leader-y')))
            .toBeCloseTo(Math.cos(radians))
    })

    it('adds a real POI altitude to the title using the selected system units', async () => {
        poiList.get('poi-1').display.titleAltitude = true
        poiList.get('poi-1').display.altitude = false

        render(<MapPOIContent poi="poi-1"/>)

        expect(screen.getByRole('heading', {name: 'River stop (125 m)'})).toBeTruthy()
        expect(screen.queryByText('Altitude: 125')).toBeNull()

        lgs.settings.unitSystem.current = 1

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'River stop (410 ft)'})).toBeTruthy()
        })
    })

    it('adds the available simulated altitude to the title when no real altitude is set', () => {
        const poi = poiList.get('poi-1')
        poi.height = poi.simulatedHeight
        poi.simulatedHeight = 175
        poi.display.titleAltitude = true

        render(<MapPOIContent poi="poi-1"/>)

        expect(screen.getByRole('heading', {name: 'River stop (175 m)'})).toBeTruthy()
    })

    it('keeps only title and enabled category visible during Replay, even when every flag is enabled', () => {
        globalThis.lgs.stores.replay.active = true
        poiList.get('poi-1').display.titleAltitude = true

        render(<MapPOIContent poi="poi-1"/>)

        expect(screen.getByRole('heading', {name: 'River stop'})).toBeTruthy()
        expect(document.querySelector('.poi-category-title-icon')?.getAttribute('data-icon-name')).toBe('location-dot')
        expect(screen.getByText('standard')).toBeTruthy()
        expect(screen.queryByText('Riverside')).toBeNull()
        expect(screen.queryByText('Altitude: 125')).toBeNull()
        expect(screen.queryByText('48.2, 2.3')).toBeNull()
        expect(screen.queryByTestId('poi-date-time')).toBeNull()
    })

    it('reactively updates an expanded POI and schedules a fresh canvas snapshot', async () => {
        const {rerender} = render(<MapPOIContent poi="poi-1"/>)
        const initialRenderCount = requestAnimationFrame.mock.calls.length

        poiList.get('poi-1').display.location = false
        rerender(<MapPOIContent poi="poi-1"/>)

        await waitFor(() => {
            expect(screen.queryByText('Riverside')).toBeNull()
            expect(requestAnimationFrame.mock.calls.length).toBeGreaterThan(initialRenderCount)
        })
    })

    it('schedules a fresh canvas snapshot when the expanded POI width changes', async () => {
        const {rerender} = render(<MapPOIContent poi="poi-1"/>)
        const initialRenderCount = requestAnimationFrame.mock.calls.length

        poiList.get('poi-1').display.maxWidth = 400
        rerender(<MapPOIContent poi="poi-1"/>)

        await waitFor(() => {
            expect(document.querySelector('.poi-icon-wrapper').style.getPropertyValue('--poi-expanded-dimension'))
                .toBe('400px')
            expect(requestAnimationFrame.mock.calls.length).toBeGreaterThan(initialRenderCount)
        })
    })

    it('clamps an expanded POI width to the configured maximum', () => {
        poiList.get('poi-1').display.maxWidth = 900

        render(<MapPOIContent poi="poi-1"/>)

        expect(document.querySelector('.poi-icon-wrapper').style.getPropertyValue('--poi-expanded-dimension'))
            .toBe('400px')
    })

    it('centers the title layout when all optional content is disabled', () => {
        poiList.get('poi-1').display = {
            category:    false,
            titleCategoryIcon: false,
            titleAltitude: false,
            location:    false,
            altitude:    false,
            coordinates: false,
            dateTime:    false,
            maxWidth:    200,
        }

        render(<MapPOIContent poi="poi-1"/>)

        expect(document.querySelector('.poi-card-content--title-only')).not.toBeNull()
        expect(screen.getByRole('heading', {name: 'River stop'})).toBeTruthy()
    })

    it('commits an animated bitmap while Hide all masks the normal POI presentation', async () => {
        const replay = globalThis.lgs.stores.replay
        globalThis.lgs.settings.ui = {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: true}}
        replay.clipSequenceActive = true
        replay.animatedPOIIds = ['poi-1']
        poiList.get('poi-1').replay.visible = false
        const canvas = document.createElement('canvas')
        canvas.width = 200
        canvas.height = 80
        vi.mocked(snapdom).mockResolvedValue({toCanvas: async () => canvas})
        render(<MapPOIContent poi="poi-1"/>)
        vi.spyOn(document.querySelector('.poi-card'), 'getBoundingClientRect')
            .mockReturnValue({width: 100, height: 40})

        await act(async () => {})
        await act(async () => {
            requestAnimationFrame.mock.calls.map(([callback]) => callback).forEach(callback => callback())
        })

        expect(drawPOI).toHaveBeenCalledWith(expect.objectContaining({id: 'poi-1', image: {src: canvas, width: 100, height: 40}}))
    })

    it.each(['global-mask', 'animation-end', 'stop'])('rejects a pending canvas when presentation changes: %s', async transition => {
        const replay = globalThis.lgs.stores.replay
        globalThis.lgs.settings.ui = {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: transition === 'animation-end'}}
        replay.clipSequenceActive = true
        if (transition === 'animation-end') {
            replay.animatedPOIIds = ['poi-1']
            poiList.get('poi-1').replay.visible = false
        }
        let finishCanvas
        const canvas = document.createElement('canvas')
        canvas.width = 200
        canvas.height = 80
        const pendingCanvas = new Promise(resolve => {finishCanvas = resolve})
        vi.mocked(snapdom).mockResolvedValue({toCanvas: () => pendingCanvas})
        render(<MapPOIContent poi="poi-1"/>)
        const element = document.querySelector('.poi-card')
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({width: 100, height: 40})

        // Let mount-time DOM mutations publish their replacement capture requests.
        await act(async () => {})
        await act(async () => {
            const callbacks = requestAnimationFrame.mock.calls.map(([callback]) => callback)
            requestAnimationFrame.mockClear()
            callbacks.forEach(callback => callback())
        })
        try {
            expect(snapdom).toHaveBeenCalled()
            await act(async () => {
                if (transition === 'global-mask') {
                    globalThis.lgs.settings.ui.replay.hideAllPoisDuringJourneyReplay = true
                    replay.hideAllPoisDuringJourneyReplay = true
                }
                else if (transition === 'animation-end') {
                    replay.animatedPOIIds = []
                    poiList.get('poi-1').expanded = false
                }
                else {
                    replay.clipSequenceActive = false
                }
                finishCanvas(canvas)
                await pendingCanvas
            })
            expect(drawPOI.mock.calls.filter(([point]) => point.visible !== false)).toEqual([])
        }
        finally {
            finishCanvas(canvas)
            await pendingCanvas
        }
    })
})
