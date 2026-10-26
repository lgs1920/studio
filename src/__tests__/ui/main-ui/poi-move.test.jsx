// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-move.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Cartesian2, Cartesian3, ConstantPositionProperty } from 'cesium'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

const mocks = vi.hoisted(() => ({
    entityContainer: null,
    poiManager: null,
    stylePOIDuotoneIcon: vi.fn(() => Promise.resolve(false)),
}))

vi.mock('@awesome.me/webawesome/dist/react', async () => {
    const React = await import('react')

    return {
        WaButton: React.forwardRef(({appearance: _appearance, children, ...props}, ref) => (
            <button ref={ref} {...props}>{children}</button>
        )),
        WaDivider: () => <hr/>,
        WaIcon: ({name, src, className, style, 'aria-hidden': ariaHidden}) => (
            <wa-icon
                name={name}
                src={src}
                className={className}
                style={style}
                aria-hidden={ariaHidden}
                data-icon={name}
            />
        ),
    }
})

vi.mock('@Components/MainUI/MapPOI/duotoneIconUtils', () => ({
    stylePOIDuotoneIcon: mocks.stylePOIDuotoneIcon,
    applyPOIDuotoneIconStyles: vi.fn(),
}))

vi.mock('@Utils/cesium/POIUtils', () => ({
    POIUtils: {
        getEntityContainer: vi.fn(() => mocks.entityContainer),
        toggleVisibility: vi.fn(poi => {
            const entity = mocks.entityContainer?.getById?.(poi?.id)
            if (entity) {
                entity.show = poi.visible !== false
                entity.billboard.show = poi.visible !== false
            }
        }),
    },
}))

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}))

vi.mock('@Components/MainUI/MapPOI/openPOIEditor', () => ({
    openPOIEditor: vi.fn(),
}))

vi.mock('@Core/OrbitSettings', () => ({
    DEFAULT_PANORAMA_HEIGHT_OFFSET: 0,
    DEFAULT_PANORAMA_PITCH: 0,
    getOrbitSettings: vi.fn(() => ({})),
    setOrbitStoreSettings: vi.fn(),
}))

import { MapPOIMoveOverlay } from '@Components/MainUI/MapPOI/MapPOIMoveOverlay'
import { MapPOIContent } from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOIContextMenu } from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { $poiMove } from '@Components/MainUI/MapPOI/poiMoveStore'
import { POIUtils } from '@Utils/cesium/POIUtils'
import { UIToast } from '@Utils/UIToast'
import { POI_TMP_TYPE } from '@Core/constants'

/** Create a POI with the display fields used by the move menu and overlay. */
const createPOI = overrides => proxy({
    id: 'poi-1',
    type: 'poi',
    title: 'River stop',
    category: 'waterfall',
    categoryIcon: () => 'water',
    latitude: 48.2,
    longitude: 2.3,
    height: 120,
    simulatedHeight: 95,
    expanded: true,
    visible: true,
    color: 'var(--wa-color-brand-fill-normal)',
    bgColor: 'var(--wa-color-brand-fill-quiet)',
    noBackground: false,
    ...overrides,
})

/** Create deterministic Cesium and DOM bounds for the POI movement tests. */
const createMapFixture = (
    poi,
    pickedPosition = Cartesian3.fromDegrees(5.1234, 45.6789, 345),
    viewportInset = {left: 0, top: 0},
    drawingBufferScale = 1,
) => {
    const container = document.createElement('div')
    const canvas = document.createElement('canvas')
    canvas.width = 200 * drawingBufferScale
    canvas.height = 100 * drawingBufferScale
    Object.defineProperties(canvas, {
        clientWidth: {configurable: true, value: 200},
        clientHeight: {configurable: true, value: 100},
    })
    container.appendChild(canvas)
    document.body.appendChild(container)

    /** Create a DOM rectangle with all fields consumed by Cesium and the overlay. */
    const makeRect = (left, top, width, height) => ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
    })
    container.getBoundingClientRect = () => makeRect(0, 0, 200 + 2 * viewportInset.left, 100 + 2 * viewportInset.top)
    canvas.getBoundingClientRect = () => makeRect(viewportInset.left, viewportInset.top, 200, 100)

    const entity = {
        show: true,
        billboard: {show: true},
        position: new ConstantPositionProperty(Cartesian3.fromDegrees(poi.longitude, poi.latitude, poi.simulatedHeight)),
    }
    const entities = {getById: vi.fn(() => entity)}
    mocks.entityContainer = entities
    mocks.poiManager = {
        isPOIRotating: vi.fn(() => false),
        updatePOI: vi.fn(async (id, updates) => {
            Object.assign(poi, updates)
            return poi
        }),
    }

    canvas.setPointerCapture = vi.fn()
    canvas.hasPointerCapture = vi.fn(() => true)
    canvas.releasePointerCapture = vi.fn()
    const scene = {
        pick: vi.fn(() => ({id: {id: poi.id}})),
        screenSpaceCameraController: {enableInputs: true, enableRotate: true},
        cartesianToCanvasCoordinates: vi.fn(() => new Cartesian2(100, 50)),
        globe: {pick: vi.fn(() => pickedPosition)},
        postRender: {addEventListener: vi.fn(() => vi.fn())},
        requestRender: vi.fn(),
    }
    const camera = {getPickRay: vi.fn(position => position)}
    const viewer = {container, canvas, scene, camera}
    const poiList = proxyMap([[poi.id, poi]])

    globalThis.lgs = {
        colors: {poiDefault: 'var(--wa-color-brand-fill-normal)', poiDefaultBackground: 'var(--wa-color-brand-fill-quiet)'},
        settings: proxy({
            coordinateSystem: {current: 'decimal'},
            unitSystem: {current: 0},
            scene: {mode: {value: 3}},
            ui: {toolbars: {opacity: 1}},
        }),
        stores: proxy({
            main: {components: {pois: {list: poiList, current: false}}},
            ui: {
                contextMenu: {visible: true, position: {x: 0, y: 0}},
                mainUI: {rotate: {running: false}, panorama: {active: false}},
            },
        }),
        viewer,
    }
    globalThis.__ = {
        canvasEvents: {
            on: vi.fn(),
            onClick: vi.fn(),
            onDoubleClick: vi.fn(),
            onDoubleTap: vi.fn(),
            onLongTap: vi.fn(),
            onRightClick: vi.fn(),
            onTap: vi.fn(),
            offKeyUp: vi.fn(),
            removeAllListenersByEntity: vi.fn(),
        },
        convert: value => ({to: () => `coordinate-${Number(value).toFixed(4)}`}),
        requestAnimationFrame: vi.fn(),
        ui: {
            contextMenu: {hide: vi.fn(), initialize: vi.fn(), showAt: vi.fn()},
            poiManager: mocks.poiManager,
            cameraManager: {isRotating: vi.fn(() => false)},
        },
    }

    return {camera, canvas, container, entity, entities, makeRect, poi, scene, viewer}
}

/** Start a move session using the same initial state captured by the context menu. */
const startMoveSession = poi => {
    $poiMove.session = {
        poiId: poi.id,
        original: {
            longitude: poi.longitude,
            latitude: poi.latitude,
            height: poi.height,
            simulatedHeight: poi.simulatedHeight,
            expanded: poi.expanded,
            visible: poi.visible,
        },
    }
}

/** Give the POI wrapper and card deterministic bounds before layout effects measure their real anchor. */
const mockMovePreviewBounds = () => {
    const originalGetBoundingClientRect = Object.getOwnPropertyDescriptor(
        Element.prototype,
        'getBoundingClientRect',
    )?.value
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
        if (this.classList?.contains('poi-move-marker')) {
            return {left: 101, top: 41, right: 139, bottom: 79, width: 38, height: 38}
        }

        if (this.classList?.contains('poi-card-inner')) {
            return {left: 114, top: 56, right: 134, bottom: 76, width: 20, height: 20}
        }

        if (this.classList?.contains('poi-geographic-anchor')) {
            return {left: 124, top: 87, right: 124, bottom: 87, width: 0, height: 0}
        }

        if (this.classList?.contains('poi-move-preview')) {
            return {left: 93, top: 33, right: 147, bottom: 87, width: 54, height: 54}
        }

        return Reflect.apply(originalGetBoundingClientRect, this, [])
    })
}

describe('POI move interaction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('PointerEvent', class extends MouseEvent {
            constructor(type, options = {}) {
                super(type, options)
                Object.defineProperties(this, {
                    pointerId: {value: options.pointerId ?? 1},
                    isPrimary: {value: options.isPrimary ?? true},
                })
            }
        })
        $poiMove.session = null
        mocks.entityContainer = null
        mocks.poiManager = null
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs?.viewer?.container?.remove()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        $poiMove.session = null
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('starts a move session from the POI context menu', () => {
        const poi = createPOI()
        createMapFixture(poi)
        const menuRef = {current: null}

        render(<MapPOIContextMenu targetId={{id: poi.id}} menuRef={menuRef}/>)
        fireEvent.click(screen.getByText('Move'))

        expect($poiMove.session).toEqual({
            poiId: poi.id,
            original: {
                longitude: 2.3,
                latitude: 48.2,
                height: 120,
                simulatedHeight: 95,
                expanded: true,
                visible: true,
            },
        })
        expect(__.ui.contextMenu.hide).toHaveBeenCalledOnce()
    })

    it.each([false, true])('moves a POI in one Shift-drag gesture, expanded=%s', async expanded => {
        const poi = createPOI({expanded})
        const {canvas, entity, scene} = createMapFixture(poi, undefined, {left: 20, top: 10}, 2)
        const navigate = vi.fn()
        canvas.addEventListener('pointerdown', navigate)
        canvas.addEventListener('pointermove', navigate)
        canvas.addEventListener('pointerup', navigate)
        canvas.addEventListener('click', navigate)
        const {unmount} = render(<MapPOIMoveOverlay/>)
        const pointer = {pointerId: 7, button: 0, buttons: 1, clientX: 120, clientY: 60, shiftKey: true}

        fireEvent.pointerDown(canvas, pointer)
        expect(scene.pick).toHaveBeenCalledWith(expect.objectContaining({x: 100, y: 50}))
        expect(screen.getByRole('button', {name: 'Move River stop'}).getAttribute('aria-pressed')).toBe('true')
        expect(canvas.setPointerCapture).toHaveBeenCalledWith(7)
        expect(entity.show).toBe(false)
        expect(mocks.poiManager.updatePOI).not.toHaveBeenCalled()

        // Foreign pointers and modifier release cannot interrupt the pointer that owns the gesture.
        fireEvent.pointerUp(window, {...pointer, pointerId: 8, buttons: 0})
        expect($poiMove.session?.poiId).toBe(poi.id)
        fireEvent.pointerMove(canvas, {...pointer, clientX: 145, clientY: 70, shiftKey: false})
        expect(screen.getByText('coordinate-45.6789')).toBeTruthy()
        await act(async () => {
            fireEvent.pointerUp(canvas, {...pointer, buttons: 0, clientX: 145, clientY: 70, shiftKey: false})
        })
        fireEvent.click(canvas, {shiftKey: false})

        expect(mocks.poiManager.updatePOI).toHaveBeenCalledOnce()
        expect(poi.longitude).toBeCloseTo(5.1234)
        expect(poi.latitude).toBeCloseTo(45.6789)
        expect(poi.expanded).toBe(expanded)
        expect($poiMove.session).toBeNull()
        expect(entity.show).toBe(true)
        expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7)
        expect(navigate).not.toHaveBeenCalled()
        expect(scene.screenSpaceCameraController).toEqual({enableInputs: true, enableRotate: true})
        fireEvent.pointerDown(canvas, {...pointer, shiftKey: false})
        expect(navigate).toHaveBeenCalledOnce()
        unmount()
        canvas.removeEventListener('pointerdown', navigate)
        canvas.removeEventListener('pointermove', navigate)
        canvas.removeEventListener('pointerup', navigate)
        canvas.removeEventListener('click', navigate)
    })

    it.each(['release', 'pointercancel', 'lostpointercapture', 'Escape', 'blur', 'unmount', 'missing-release'])(
        'clears an interrupted or stationary Shift gesture without saving: %s', interruption => {
            const poi = createPOI()
            const {canvas, entity} = createMapFixture(poi)
            const {unmount} = render(<MapPOIMoveOverlay/>)
            const pointer = {pointerId: 3, button: 0, buttons: 1, shiftKey: true, clientX: 100, clientY: 50}
            fireEvent.pointerDown(canvas, pointer)
            if (interruption === 'release') fireEvent.pointerUp(canvas, {...pointer, buttons: 0})
            else if (interruption === 'Escape') fireEvent.keyDown(window, {key: 'Escape'})
            else if (interruption === 'blur') fireEvent.blur(window)
            else if (interruption === 'unmount') unmount()
            else if (interruption === 'missing-release') fireEvent.pointerMove(canvas, {...pointer, buttons: 0, clientX: 150})
            else fireEvent(canvas, new PointerEvent(interruption, {...pointer, bubbles: true}))

            expect($poiMove.session).toBeNull()
            expect(entity.show).toBe(true)
            expect(mocks.poiManager.updatePOI).not.toHaveBeenCalled()
            expect(canvas.releasePointerCapture).toHaveBeenCalledWith(3)
            expect(document.body.classList.contains('poi-move-hiding-system-cursor')).toBe(false)
            fireEvent.pointerMove(canvas, {...pointer, clientX: 150})
            fireEvent.pointerUp(canvas, {...pointer, buttons: 0, clientX: 150})
            expect(mocks.poiManager.updatePOI).not.toHaveBeenCalled()
        },
    )

    it.each(['plain', 'ctrl', 'alt', 'meta', 'secondary-button', 'secondary-pointer', 'empty', 'temporary', 'replay'])(
        'leaves unrelated or unavailable gestures unclaimed: %s', gesture => {
            const poi = createPOI()
            const {canvas, scene} = createMapFixture(poi)
            if (gesture === 'empty') scene.pick.mockReturnValue(undefined)
            if (gesture === 'temporary') poi.type = POI_TMP_TYPE
            if (gesture === 'replay') lgs.stores.replay = {active: true}
            render(<MapPOIMoveOverlay/>)
            const handled = fireEvent.pointerDown(canvas, {
                pointerId: 4, button: gesture === 'secondary-button' ? 2 : 0,
                isPrimary: gesture !== 'secondary-pointer', shiftKey: gesture !== 'plain',
                ctrlKey: gesture === 'ctrl', altKey: gesture === 'alt', metaKey: gesture === 'meta',
                clientX: 100, clientY: 50,
            })
            expect(handled).toBe(true)
            expect($poiMove.session).toBeNull()
            expect(canvas.setPointerCapture).not.toHaveBeenCalled()
        },
    )

    it('keeps the source POI styling, clamps the marker to the map, and saves the picked terrain position', async () => {
        const poi = createPOI({expanded: false})
        const {camera, entity, scene} = createMapFixture(poi, undefined, {left: 20, top: 10}, 2)
        startMoveSession(poi)
        mockMovePreviewBounds()

        render(<><MapPOIContent poi={poi.id}/><MapPOIMoveOverlay/></>)

        const marker = screen.getByRole('button', {name: 'Move River stop'})
        expect(marker.style.left).toBe('96px')
        expect(marker.style.top).toBe('34px')
        const sourcePOI = document.querySelector(`[data-poi-canvas-source="${poi.id}"]`)
        const clonedPOI = marker.querySelector('.poi-icon-wrapper.poi-shrinked.poi-move-preview')
        expect(clonedPOI).toBeTruthy()
        expect([...clonedPOI.classList].sort()).toEqual([...sourcePOI.classList, 'poi-move-preview'].sort())
        expect(clonedPOI.style.cssText).toBe(sourcePOI.style.cssText)
        const sourceCard = sourcePOI.querySelector('.poi-card-inner')
        const markerCard = marker.querySelector('.poi-card-inner')
        expect(markerCard).toBeTruthy()
        expect([...markerCard.classList]).toEqual([...sourceCard.classList])
        expect(markerCard.style.cssText).toBe(sourceCard.style.cssText)
        expect(markerCard.querySelector('.poi-card-inner-background')).toBeTruthy()
        expect(marker.querySelector('.poi-as-flag[data-icon="water"]')).toBeTruthy()
        expect(marker.querySelector('.poi-icon-wrapper').style.getPropertyValue('--lgs-poi-background-color'))
            .toBe('var(--wa-color-brand-fill-quiet)')
        expect(marker.querySelector('.poi-icon-wrapper').style.getPropertyValue('--lgs-poi-border-color'))
            .toBe('var(--wa-color-brand-fill-normal)')
        expect(entity.show).toBe(false)
        expect(entity.billboard.show).toBe(false)
        expect(screen.getByText('coordinate-48.2000')).toBeTruthy()
        expect(screen.getByText('coordinate-2.3000')).toBeTruthy()
        expect(screen.getByText('95 m')).toBeTruthy()

        fireEvent.pointerDown(marker, {pointerId: 1, clientX: 125, clientY: 60, button: 0})
        const cursorPOI = marker.querySelector('.poi-icon-wrapper')
        expect(marker.getAttribute('aria-pressed')).toBe('true')
        expect(marker.parentElement.querySelectorAll('.poi-move-preview')).toHaveLength(1)
        expect(marker.parentElement.querySelector('.poi-move-cursor')).toBeNull()
        expect(cursorPOI).toBeTruthy()
        expect(cursorPOI.classList.contains('poi-shrinked')).toBe(true)
        expect(cursorPOI.classList.contains('lgs--location-pin')).toBe(true)
        expect(cursorPOI.classList.contains('poi-move-preview')).toBe(true)
        expect(cursorPOI.style.getPropertyValue('--lgs-poi-background-color'))
            .toBe('var(--wa-color-brand-fill-quiet)')
        expect(marker.querySelector('.poi-card-inner').querySelector('.poi-card-inner-background')).toBeTruthy()
        expect(marker.querySelector('.poi-as-flag[data-icon="water"]')).toBeTruthy()
        expect(marker.style.left).toBe('101px')
        expect(marker.style.top).toBe('34px')
        expect(document.body.classList.contains('poi-move-hiding-system-cursor')).toBe(true)
        fireEvent.pointerMove(marker, {pointerId: 1, clientX: 125, clientY: 60})
        expect(marker.querySelector('.poi-move-preview')).toBe(clonedPOI)
        expect(camera.getPickRay).toHaveBeenLastCalledWith(expect.objectContaining({x: 105, y: 50}))
        fireEvent.pointerMove(marker, {pointerId: 1, clientX: -300, clientY: -300})
        expect(screen.getByText('coordinate-45.6789')).toBeTruthy()
        expect(screen.getByText('coordinate-5.1234')).toBeTruthy()
        expect(screen.getByText('345 m')).toBeTruthy()
        await act(async () => {
            fireEvent.pointerUp(marker, {pointerId: 1, clientX: -300, clientY: -300})
            await vi.waitFor(() => expect($poiMove.session).toBeNull())
        })

        expect(camera.getPickRay).toHaveBeenLastCalledWith(expect.objectContaining({x: 10, y: 20}))
        expect(scene.globe.pick).toHaveBeenCalled()
        await vi.waitFor(() => expect(mocks.poiManager.updatePOI).toHaveBeenCalledOnce())
        const [poiId, updates, options] = mocks.poiManager.updatePOI.mock.calls[0]
        expect(poiId).toBe(poi.id)
        expect(updates.longitude).toBeCloseTo(5.1234, 7)
        expect(updates.latitude).toBeCloseTo(45.6789, 7)
        expect(updates.height).toBeCloseTo(345, 5)
        expect(updates.simulatedHeight).toBeCloseTo(345, 5)
        expect(options).toEqual({immediate: true})
        expect(poi.expanded).toBe(false)
        expect(poi.visible).toBe(true)
        expect(poi.title).toBe('River stop')
        expect(poi.category).toBe('waterfall')
        expect(poi.color).toBe('var(--wa-color-brand-fill-normal)')
        expect(entity.show).toBe(true)
        expect(entity.billboard.show).toBe(true)
        expect(POIUtils.toggleVisibility).toHaveBeenCalledWith(poi)
        expect(marker.isConnected).toBe(false)
        expect(document.body.classList.contains('poi-move-hiding-system-cursor')).toBe(false)
        expect($poiMove.session).toBeNull()
    })

    it('inlines the loaded custom SVG category icon in a transparent move preview', async () => {
        const poi = createPOI({
            expanded: false,
            noBackground: true,
            category: 'refuge',
            categoryIcon: () => 'house-bed.svg',
        })
        createMapFixture(poi)
        mocks.stylePOIDuotoneIcon.mockClear()

        const {rerender} = render(<><MapPOIContent poi={poi.id}/>{$poiMove.session && <MapPOIMoveOverlay/>}</>)
        const sourceIcon = document.querySelector(`[data-poi-canvas-source="${poi.id}"] wa-icon[src]`)
        const sourceIconRoot = sourceIcon.attachShadow({mode: 'open'})
        sourceIconRoot.innerHTML = '<svg part="svg" viewBox="0 0 576 512"><path data-duotone-primary=""/></svg>'

        startMoveSession(poi)
        rerender(<><MapPOIContent poi={poi.id}/><MapPOIMoveOverlay/></>)

        const clonedPOI = document.querySelector('.poi-move-preview')
        await act(async () => {
            await Promise.resolve()
        })
        expect(clonedPOI.querySelector('.poi-card-inner').classList.contains('poi-card-inner--no-background')).toBe(true)
        expect(clonedPOI.querySelector('svg.poi-as-flag path[data-duotone-primary]')).toBeTruthy()
        expect(mocks.stylePOIDuotoneIcon).toHaveBeenCalledWith(sourceIcon)
    })

    it('cancels with Escape and restores the POI state without saving coordinates', () => {
        const poi = createPOI({expanded: false, visible: false})
        const {entity} = createMapFixture(poi)
        entity.show = false
        entity.billboard.show = false
        startMoveSession(poi)

        render(<MapPOIMoveOverlay/>)
        expect(entity.show).toBe(false)
        fireEvent.keyDown(window, {key: 'Escape'})

        expect(mocks.poiManager.updatePOI).not.toHaveBeenCalled()
        expect(poi.longitude).toBe(2.3)
        expect(poi.latitude).toBe(48.2)
        expect(poi.expanded).toBe(false)
        expect(poi.visible).toBe(false)
        expect(entity.show).toBe(false)
        expect(entity.billboard.show).toBe(false)
        expect($poiMove.session).toBeNull()
    })

    it('reports persistence failures and restores the original coordinates', async () => {
        const poi = createPOI()
        const {entity} = createMapFixture(poi)
        mocks.poiManager.updatePOI = vi.fn()
            .mockRejectedValueOnce(new Error('database unavailable'))
            .mockResolvedValueOnce(poi)
        startMoveSession(poi)

        render(<MapPOIMoveOverlay/>)
        const marker = screen.getByRole('button', {name: 'Move River stop'})
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        await act(async () => {
            fireEvent.pointerDown(marker, {pointerId: 2, clientX: 100, clientY: 50, button: 0})
            fireEvent.pointerUp(marker, {pointerId: 2, clientX: 130, clientY: 70})
            await vi.waitFor(() => expect($poiMove.session).toBeNull())
        })

        expect(mocks.poiManager.updatePOI).toHaveBeenNthCalledWith(2, poi.id, {
            longitude: 2.3,
            latitude: 48.2,
            height: 120,
            simulatedHeight: 95,
        }, {skipPersist: true, skipLocationUpdate: true})
        expect(UIToast.error).toHaveBeenCalledOnce()
        expect(entity.show).toBe(true)
        consoleError.mockRestore()
    })
})

describe('POI move geometry', () => {
    it('anchors the pointer at the visible rounded pin tip rather than the transparent bounding-box corner', async () => {
        const {calculatePOIMovePinAnchor} = await import('@Components/MainUI/MapPOI/poiMoveGeometry')
        const anchor = calculatePOIMovePinAnchor({left: 20, right: 80, bottom: 100}, 10)

        expect(anchor.x).toBe(50)
        expect(anchor.y).toBeCloseTo(95.857864, 6)
    })

    it('uses the Cesium POI anchor and clamps it using the rotated wrapper bounds', async () => {
        const {
            clampPOIMovePoint,
            measurePOIMoveMarkerGeometry,
            placePOIMoveOverlay,
        } = await import('@Components/MainUI/MapPOI/poiMoveGeometry')
        const bounds = {left: 0, top: 0, right: 100, bottom: 80}
        const marker = measurePOIMoveMarkerGeometry(
            {left: 81, top: 31, right: 119, bottom: 69},
            {left: 73, top: 23, right: 127, bottom: 77},
            {left: 94, top: 46, right: 114, bottom: 66},
        )

        expect(marker).toEqual({
            anchorOffset: {x: 4, y: 27},
            markerBounds: {left: -31, top: -54, right: 23, bottom: 0},
        })
        expect(clampPOIMovePoint({x: -5, y: -5}, bounds, marker.markerBounds))
            .toEqual({x: 31, y: 54})
        expect(clampPOIMovePoint({x: 150, y: 120}, bounds, marker.markerBounds))
            .toEqual({x: 77, y: 80})
        expect(placePOIMoveOverlay({x: 99, y: 78}, bounds, marker.markerBounds, {width: 60, height: 20}, 8))
            .toEqual({x: 40, y: 0})
    })

    it('uses the cloned expanded POI geographic anchor when one is available', async () => {
        const {measurePOIMoveMarkerGeometry} = await import('@Components/MainUI/MapPOI/poiMoveGeometry')
        const marker = measurePOIMoveMarkerGeometry(
            {left: 100, top: 100, right: 140, bottom: 140},
            {left: 50, top: 40, right: 220, bottom: 180},
            {left: 70, top: 50, right: 200, bottom: 130},
            {left: 120, top: 170, right: 120, bottom: 170},
        )

        expect(marker.anchorOffset).toEqual({x: 0, y: 50})
        expect(marker.markerBounds).toEqual({left: -70, top: -130, right: 100, bottom: 10})
    })
})
