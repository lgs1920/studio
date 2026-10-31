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
 * Last modified: 2026-10-31
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
    WaTooltip: () => null,
}))

import { MapPOIContent } from '@Components/MainUI/MapPOI/MapPOIContent'
import {
    clearPOIHoverTitlePreview, getPOIHoverTitle,
} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'
import { POIUtils } from '@Utils/cesium/POIUtils'
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
    let originalResizeObserver

    beforeEach(() => {
        drawPOI.mockClear()
        vi.mocked(snapdom).mockReset()
        originalResizeObserver = globalThis.ResizeObserver
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
                offKeyUp: vi.fn(),
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
        clearPOIHoverTitlePreview()
        vi.restoreAllMocks()
        if (originalResizeObserver === undefined) {
            delete globalThis.ResizeObserver
        }
        else {
            globalThis.ResizeObserver = originalResizeObserver
        }
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

    it.each([false, true])('uses the hand cursor on enter and restores it on leave when expanded=%s', expanded => {
        poiList.get('poi-1').expanded = expanded
        const canvas = document.createElement('canvas')
        canvas.style.cursor = 'crosshair'
        canvas.style.color = 'rgb(20, 30, 40)'
        globalThis.lgs.viewer = {scene: {canvas}}
        vi.spyOn(POIUtils, 'setPOIVisibility').mockReturnValue(true)
        const {unmount} = render(<MapPOIContent poi="poi-1"/>)
        const events = globalThis.__.canvasEvents.on.mock.calls
        const enter = events.find(([name]) => name === 'MOUSE_ENTER')[1]
        const leave = events.find(([name]) => name === 'MOUSE_LEAVE')[1]

        act(enter)
        expect(getPOIHoverTitle('poi-1')).toBe(true)
        expect(canvas.style.cursor).toBe('pointer')
        act(leave)
        expect(getPOIHoverTitle('poi-1')).toBe(false)
        expect(canvas.style.cursor).toBe('crosshair')

        act(enter)
        unmount()
        expect(canvas.style.cursor).toBe('crosshair')
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

    it('marks a POI as title-only when enabled detail fields have no rendered value', () => {
        const point = poiList.get('poi-1')
        point.category = ''
        point.location = ''
        point.display = {
            schemaVersion: 1,
            category:    true,
            location:    true,
            altitude:    false,
            coordinates: false,
            dateTime:    false,
            fontSize:    30,
        }

        render(<MapPOIContent poi="poi-1"/>)

        const wrapper = document.querySelector('.poi-icon-wrapper')
        const card = wrapper.querySelector('.poi-card-inner')
        const content = card.querySelector('.poi-card-content')

        expect(card.classList.contains('poi-card-inner--title-only')).toBe(true)
        expect(content.classList.contains('poi-card-content--title-only')).toBe(true)
        expect(wrapper.style.getPropertyValue('--poi-font-size')).toBe('30px')
    })

    it('renders the selected POI style and horizontal stick anchor', () => {
        poiList.get('poi-1').display.style = 'underline'
        poiList.get('poi-1').display.stickHorizontalPosition = 80
        render(<MapPOIContent poi="poi-1"/>)

        const wrapper = document.querySelector('.poi-icon-wrapper')
        const card = wrapper.querySelector('.poi-card')
        expect(card.querySelector('.poi-card-inner--style-underline')).not.toBeNull()
        expect(card.classList.contains('poi-card--stick-horizontal-position-80')).toBe(true)
        expect(wrapper.style.getPropertyValue('--poi-expanded-leader-position'))
            .toBe('80%')
    })

    it.each(['left', 'right'])('renders the %s side stick on the matching POI edge', side => {
        poiList.get('poi-1').display.stickPosition = side
        poiList.get('poi-1').display.stickHorizontalPosition = 20
        poiList.get('poi-1').display.stickAngle = 'straight'

        render(<MapPOIContent poi="poi-1"/>)

        const wrapper = document.querySelector('.poi-icon-wrapper')
        const card = wrapper?.querySelector('.poi-card')

        expect(card?.classList.contains(`poi-card--stick-${side}`)).toBe(true)
        expect(wrapper?.style.getPropertyValue('--poi-expanded-leader-position')).toBe('20%')
        expect(card?.querySelector('.poi-expanded-leader')).not.toBeNull()
        expect(card?.querySelector('.poi-geographic-anchor')).not.toBeNull()
    })

    it('updates an underline POI when its background is disabled and enabled again', async () => {
        const point = poiList.get('poi-1')
        point.display.style = 'underline'
        point.bgColor = '#ffffff'
        render(<MapPOIContent poi="poi-1"/>)

        const wrapper = document.querySelector('.poi-icon-wrapper')
        const card = wrapper.querySelector('.poi-card-inner--style-underline')
        expect(wrapper.style.getPropertyValue('--lgs-poi-background-color')).toBe('#ffffff')
        expect(card.classList.contains('poi-card-inner--background-hidden')).toBe(false)

        await act(async () => {
            point.background = false
        })

        expect(wrapper.style.getPropertyValue('--lgs-poi-background-color')).toBe('transparent')
        expect(card.classList.contains('poi-card-inner--background-hidden')).toBe(true)

        await act(async () => {
            point.background = true
        })

        expect(wrapper.style.getPropertyValue('--lgs-poi-background-color')).toBe('#ffffff')
        expect(card.classList.contains('poi-card-inner--background-hidden')).toBe(false)
    })

    it('keeps every POI detail in the round badge content beside the category icon', () => {
        poiList.get('poi-1').display.style = 'round-badge'
        render(<MapPOIContent poi="poi-1"/>)

        const content = document.querySelector('.poi-card-inner--style-round-badge .poi-card-content')
        const badge = content?.querySelector('.poi-category-title-icon')

        expect(content).not.toBeNull()
        expect(badge).not.toBeNull()
        expect(content?.querySelector('h3')?.textContent).toBe('River stop')
        expect(content?.querySelectorAll('.poi-location')).toHaveLength(2)
        expect(content?.querySelector('.poi-full-coordinates')).not.toBeNull()
        expect(content?.contains(badge)).toBe(true)
    })

    it('frames all POI text separately from the top-left icon', () => {
        poiList.get('poi-1').display.style = 'icon-frame'
        poiList.get('poi-1').title = 'River stop with a long name that spans several lines'
        render(<MapPOIContent poi="poi-1"/>)

        const card = document.querySelector('.poi-card-inner--style-icon-frame')
        const content = card?.querySelector('.poi-card-content')
        const title = content?.querySelector('.poi-title')
        const icon = title?.querySelector('.poi-category-title-icon')
        const heading = title?.querySelector('h3')

        expect(card).not.toBeNull()
        expect(content).not.toBeNull()
        expect(icon).not.toBeNull()
        expect(heading?.textContent).toBe('River stop with a long name that spans several lines')
        expect(icon?.parentElement).toBe(title)
        expect(heading?.parentElement).toBe(title)
        expect(content?.querySelectorAll('.poi-location')).toHaveLength(2)
        expect(content?.querySelector('.poi-full-coordinates')).not.toBeNull()
    })

    it('updates the rendered POI when an optional style is first added', async () => {
        render(<MapPOIContent poi="poi-1"/>)
        const card = document.querySelector('.poi-card-inner')
        const queuedRenders = requestAnimationFrame.mock.calls.length
        expect(card.classList.contains('poi-card-inner--style-pill')).toBe(true)

        await act(async () => {
            poiList.get('poi-1').display.style = 'open-frame'
            await Promise.resolve()
        })

        expect(card.classList.contains('poi-card-inner--style-open-frame')).toBe(true)
        expect(requestAnimationFrame.mock.calls.length).toBeGreaterThan(queuedRenders)
    })

    it.each([
        {stickAngle: '-45', expectedAngle: -45},
        {stickAngle: 'vertical', expectedAngle: 0},
        {stickAngle: '45', expectedAngle: 45},
    ])('renders a one-rem leader at $expectedAngle degrees with the geographic POI as its endpoint', ({
        stickAngle,
        expectedAngle,
    }) => {
        poiList.get('poi-1').display.stickAngle = stickAngle
        render(<MapPOIContent poi="poi-1"/>)

        const wrapper = document.querySelector('.poi-icon-wrapper')
        const angle = Number.parseFloat(wrapper.style.getPropertyValue('--poi-expanded-leader-angle'))
        const radians = angle * Math.PI / 180

        expect(angle).toBe(expectedAngle)
        expect(wrapper.querySelector('.poi-card--expanded')).not.toBeNull()
        expect(wrapper.querySelector('.poi-expanded-leader')).not.toBeNull()
        expect(wrapper.querySelector('.poi-geographic-anchor')).not.toBeNull()
        expect(Number.parseFloat(wrapper.style.getPropertyValue('--poi-expanded-leader-x')))
            .toBeCloseTo(-Math.sin(radians) * 16)
        expect(Number.parseFloat(wrapper.style.getPropertyValue('--poi-expanded-leader-y')))
            .toBeCloseTo(Math.cos(radians) * 16)
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

    it('keeps the title altitude and enabled category visible while hiding other fields during Replay', () => {
        globalThis.lgs.stores.replay.active = true
        poiList.get('poi-1').display.titleAltitude = true

        render(<MapPOIContent poi="poi-1"/>)

        expect(screen.getByRole('heading', {name: 'River stop (125 m)'})).toBeTruthy()
        expect(document.querySelector('.poi-category-title-icon')?.getAttribute('data-icon-name')).toBe('location-dot')
        expect(screen.getByText('standard')).toBeTruthy()
        expect(screen.queryByText('Riverside')).toBeNull()
        expect(screen.queryByText('Altitude: 125')).toBeNull()
        expect(screen.queryByText('48.2, 2.3')).toBeNull()
        expect(screen.queryByTestId('poi-date-time')).toBeNull()
    })

    it('hides title altitude when Replay hides altitude for a nearby global POI', () => {
        globalThis.lgs.stores.replay.active = true
        const poi = poiList.get('poi-1')
        poi.parent = null
        poi.display.titleAltitude = true
        poi.replay.hiddenFields.altitude = true
        globalThis.lgs.stores.replay.nearbyPois = [{poi}]

        render(<MapPOIContent poi="poi-1"/>)

        expect(screen.getByRole('heading', {name: 'River stop'})).toBeTruthy()
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

    it('refreshes the expanded POI anchor when its card resizes without changing the stick edge offset', () => {
        let notifyResize
        globalThis.ResizeObserver = class {
            constructor(callback) {
                notifyResize = callback
            }

            observe = vi.fn()
            disconnect = vi.fn()
        }

        const {container} = render(<MapPOIContent poi="poi-1"/>)
        const card = container.querySelector('.poi-card-inner')
        const initialRenderCount = requestAnimationFrame.mock.calls.length
        Object.defineProperties(card, {
            offsetWidth: {configurable: true, value: 320},
            offsetHeight: {configurable: true, value: 160},
        })

        act(() => notifyResize([{target: card}]))

        expect(requestAnimationFrame.mock.calls.length).toBeGreaterThan(initialRenderCount)
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
        vi.spyOn(document.querySelector('.poi-canvas-capture-surface'), 'getBoundingClientRect')
            .mockReturnValue({left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40})

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
        const element = document.querySelector('.poi-canvas-capture-surface')
        vi.spyOn(element, 'getBoundingClientRect')
            .mockReturnValue({left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40})

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

    it('pads SnapDOM capture for a slanted style and restores the preview layout', async () => {
        poiList.get('poi-1').display.style = 'slanted-banner'
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 240
        let capturedElement
        let capturedPadding
        vi.mocked(snapdom).mockImplementation(async element => {
            capturedElement = element
            capturedPadding = element.style.padding
            return {toCanvas: async () => canvas}
        })
        render(<MapPOIContent poi="poi-1"/>)

        const captureSurface = document.querySelector('.poi-canvas-capture-surface')
        const slantedContent = document.querySelector('.poi-card-inner--style-slanted-banner')
        vi.spyOn(captureSurface, 'getBoundingClientRect')
            .mockReturnValue({left: 0, top: 0, right: 300, bottom: 160, width: 300, height: 160})
        vi.spyOn(slantedContent, 'getBoundingClientRect')
            .mockReturnValue({left: 0, top: 0, right: 300, bottom: 120, width: 300, height: 120})

        await act(async () => {})
        await act(async () => {
            requestAnimationFrame.mock.calls.map(([callback]) => callback).forEach(callback => callback())
        })

        expect(capturedElement).toBe(captureSurface)
        expect(capturedPadding).toBe('21px')
        expect(captureSurface.style.display).toBe('')
        expect(captureSurface.style.width).toBe('')
        expect(captureSurface.style.boxSizing).toBe('')
        expect(captureSurface.style.padding).toBe('')
        expect(drawPOI).toHaveBeenCalledWith(expect.objectContaining({id: 'poi-1', image: {src: canvas, width: 200, height: 120}}))
    })

    it('positions an expanded POI from the SnapDOM viewBox origin', async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 200
        vi.mocked(snapdom).mockResolvedValue({
            meta: {vbW: 200, vbH: 100, contentX: 20, contentY: 10},
            toCanvas: async () => canvas,
        })
        render(<MapPOIContent poi="poi-1"/>)

        const captureSurface = document.querySelector('.poi-canvas-capture-surface')
        vi.spyOn(captureSurface, 'getBoundingClientRect')
            .mockReturnValue({left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40})
        vi.spyOn(captureSurface.querySelector('.poi-geographic-anchor'), 'getBoundingClientRect')
            .mockReturnValue({left: 40, top: 45, right: 40, bottom: 45, width: 0, height: 0})

        await act(async () => {})
        await act(async () => {
            requestAnimationFrame.mock.calls.map(([callback]) => callback).forEach(callback => callback())
        })

        expect(drawPOI).toHaveBeenCalledWith(expect.objectContaining({
            id: 'poi-1',
            pixelOffset: {x: 50, y: 15},
        }))
    })

    it('replaces the shrinked capture with the correctly anchored first expanded capture', async () => {
        const poi = poiList.get('poi-1')
        poi.expanded = false
        const compactCanvas = document.createElement('canvas')
        compactCanvas.width = 200
        compactCanvas.height = 200
        const expandedCanvas = document.createElement('canvas')
        expandedCanvas.width = 640
        expandedCanvas.height = 400
        const getBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
            if (this.classList?.contains('poi-canvas-capture-surface')) {
                return poi.expanded
                    ? {left: 10, top: 20, right: 310, bottom: 200, width: 300, height: 180}
                    : {left: 10, top: 20, right: 110, bottom: 120, width: 100, height: 100}
            }
            if (this.classList?.contains('poi-geographic-anchor')) {
                return {left: 170, top: 190, right: 170, bottom: 190, width: 0, height: 0}
            }
            if (this.classList?.contains('poi-card-inner')) {
                return {left: 20, right: 80, top: 20, bottom: 80, width: 60, height: 60}
            }

            return getBoundingClientRect.call(this)
        })
        vi.mocked(snapdom).mockImplementation(async () => poi.expanded
            ? {
                meta: {vbW: 320, vbH: 200, contentX: 10, contentY: 10},
                toCanvas: async () => expandedCanvas,
            }
            : {meta: {}, toCanvas: async () => compactCanvas})

        render(<MapPOIContent poi="poi-1"/>)

        await waitFor(() => expect(drawPOI).toHaveBeenCalled())
        const compactRenderCount = drawPOI.mock.calls.length

        await act(async () => {
            poi.expanded = true
        })

        await waitFor(() => {
            const latestPOI = drawPOI.mock.calls.at(-1)?.[0]
            expect(drawPOI.mock.calls.length).toBeGreaterThan(compactRenderCount)
            expect(latestPOI?.expanded).toBe(true)
            expect(latestPOI?.image?.src).toBe(expandedCanvas)
        })

        expect(drawPOI.mock.calls.at(-1)[0].pixelOffset).toEqual({x: -10, y: -80})
    })
})
