import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LGS_VISUAL_WIDGET, LGS_WIDGET, VIDEO_CROP_ZONE, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { WidgetCoreControls } from '@Core/ui/widget-manager/WidgetCoreControls'
import { WidgetCoreRegistry } from '@Core/ui/widget-manager/WidgetCoreRegistry'

describe('crop board widget repositioning', () => {
    let registry
    let controls
    let board
    let manager
    let widget

    beforeEach(() => {
        board = document.createElement('div')
        document.body.appendChild(board)
        board.getBoundingClientRect = vi.fn(() => ({left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400}))

        widget = document.createElement('div')
        widget.setAttribute('data-widget-id', 'menu#video')
        document.body.appendChild(widget)
        widget.style.left = '780px'
        widget.style.top = '100px'
        widget.getBoundingClientRect = vi.fn(() => ({left: 780, top: 100, width: 200, height: 100, right: 980, bottom: 200}))

        registry = new WidgetCoreRegistry()
        manager = {
            resolveWidgetsBoardBoundsContainer: vi.fn(() => board),
            transform: {setScale: vi.fn()},
            saveWidgetPosition: vi.fn(),
            refreshEditorPreviewSnapshot: vi.fn(),
            getWidgetConfig: vi.fn(),
            applyCropToOverlay: vi.fn(),
            dispatchCropUpdate: vi.fn(),
            setConfig: vi.fn(),
        }
        globalThis.__ = {ui: {widgetManager: manager}}
        globalThis.lgs = {gutter: {xs: 5}}
        controls = new WidgetCoreControls(registry)
    })

    it('manages the control box when the moveable is not registered yet', () => {
        const moveable = {current: {target: widget}}
        const controlBoxTimer = {current: null}
        const setControlBoxProps = vi.fn()
        const config = {
            id: 'menu#control-box',
            type: LGS_WIDGET,
            showControlBox: true,
        }

        registry.setConfig(config.id, config)

        expect(() => controls.manageControlBox(
            moveable,
            setControlBoxProps,
            controlBoxTimer,
            false,
            false,
        )).not.toThrow()
        expect(setControlBoxProps).toHaveBeenCalledWith({renderDirections: [], zoom: 0, opacity: 0})
    })

    it('does not move a widget that fits in the new crop', () => {
        widget.style.left = '400px'
        widget.style.top = '250px'
        widget.getBoundingClientRect = vi.fn(() => ({left: 400, top: 250, width: 200, height: 100, right: 600, bottom: 350}))
        const config = {
            id: 'menu#video',
            type: LGS_WIDGET,
            widgetsBoard: VIDEO_WIDGETS_BOARD,
            element: widget,
            container: board,
            position: {left: 400, top: 250},
            dimensions: {width: 200, height: 100},
            scale: {x: 1, y: 1},
            // These values are stale and must not override the live centered position.
            savedRatios: {leftRatio: 0, topRatio: 100},
            attachTo: 'center',
            persist: false,
        }
        registry.setConfig(config.id, config)
        manager.getWidgetConfig.mockReturnValue(config)

        const changed = controls.repositionWidgetsForBoard(
            VIDEO_WIDGETS_BOARD,
            {left: 0, top: 0, width: 600, height: 400},
            {left: 0, top: 0, width: 1000, height: 600},
        )

        expect(changed).toBe(0)
        expect(config.position.left).toBe(400)
        expect(config.position.top).toBe(250)
        expect(widget.style.left).toBe('400px')
    })

    it('converts local crop coordinates to the screen board only once', () => {
        const canvas = document.createElement('div')
        document.body.appendChild(canvas)
        canvas.getBoundingClientRect = vi.fn(() => ({
            left: 100, top: 50, width: 1200, height: 800, right: 1300, bottom: 850,
        }))
        board.getBoundingClientRect = vi.fn(() => ({
            left: 300, top: 170, width: 600, height: 400, right: 900, bottom: 570,
        }))
        widget.style.left = '500px'
        widget.style.top = '300px'
        widget.getBoundingClientRect = vi.fn(() => ({
            left: 500, top: 300, width: 200, height: 100, right: 700, bottom: 400,
        }))

        const cropConfig = {
            id: 'video-crop-zone',
            container: canvas,
            cropDimensions: {left: 200, top: 120, width: 600, height: 400},
        }
        const config = {
            id: 'menu#video-offset',
            type: LGS_WIDGET,
            widgetsBoard: VIDEO_WIDGETS_BOARD,
            element: widget,
            container: canvas,
            position: {left: 500, top: 300},
            dimensions: {width: 200, height: 100},
            scale: {x: 1, y: 1},
            attachTo: 'center',
            persist: false,
        }
        registry.setConfig(cropConfig.id, cropConfig)
        registry.setConfig(config.id, config)
        manager.getWidgetConfig.mockImplementation(id => id === cropConfig.id ? cropConfig : config)

        controls.repositionWidgetsForBoard(
            VIDEO_WIDGETS_BOARD,
            {left: 250, top: 150, width: 500, height: 300},
            {left: 200, top: 120, width: 600, height: 400},
        )

        // The widget still fits, so its live position is unchanged.
        expect(config.position.left).toBe(500)
        expect(config.position.top).toBe(300)
    })

    it('does not move widgets belonging to another board', () => {
        const config = {
            id: 'menu#scene',
            type: LGS_WIDGET,
            widgetsBoard: 'scene',
            element: widget,
            position: {left: 780, top: 100},
            dimensions: {width: 200, height: 100},
            scale: {x: 1, y: 1},
        }
        registry.setConfig(config.id, config)

        expect(controls.repositionWidgetsForBoard(VIDEO_WIDGETS_BOARD)).toBe(0)
        expect(widget.style.left).toBe('780px')
    })

    it('forces the logo to the bottom-right crop corner', () => {
        const config = {
            id: 'logo-widget#video',
            type: LGS_WIDGET,
            widgetsBoard: VIDEO_WIDGETS_BOARD,
            element: widget,
            position: {left: 780, top: 100},
            dimensions: {width: 200, height: 100},
            scale: {x: 1, y: 1},
            attachTo: 'bottom-right',
            margin: 8,
            draggable: false,
            resizable: false,
            scalable: false,
        }
        registry.setConfig(config.id, config)

        expect(controls.repositionWidgetsForBoard(
            VIDEO_WIDGETS_BOARD,
            {left: 0, top: 0, width: 600, height: 400},
            {left: 0, top: 0, width: 1000, height: 600},
        )).toBe(1)
        expect(config.position.left).toBeCloseTo(392)
        expect(config.position.top).toBeCloseTo(292)
        expect(parseFloat(widget.style.left)).toBeCloseTo(392)
        expect(widget.style.top).toBe('292px')
        expect(manager.saveWidgetPosition).toHaveBeenCalledWith(config.id, config)
    })

    it('forces credits to the bottom-left crop corner', () => {
        widget.style.left = '730px'
        widget.style.top = '50px'
        widget.getBoundingClientRect = vi.fn(() => ({
            left: 780, top: 100, width: 100, height: 50, right: 880, bottom: 150,
        }))
        const config = {
            id: 'credits-widget#video',
            type: LGS_WIDGET,
            widgetsBoard: VIDEO_WIDGETS_BOARD,
            element: widget,
            position: {left: 780, top: 100},
            dimensions: {width: 200, height: 100},
            scale: {x: 0.5, y: 0.5},
            margin: 5,
            draggable: false,
            resizable: false,
            scalable: true,
        }
        registry.setConfig(config.id, config)

        expect(controls.repositionWidgetsForBoard(
            VIDEO_WIDGETS_BOARD,
            {left: 0, top: 0, width: 600, height: 400},
        )).toBe(1)
        expect(config.position.left).toBeCloseTo(5)
        // The logical top includes the center-origin transform offset; the
        // rendered rectangle is anchored at the crop bottom-left.
        expect(config.position.top).toBeCloseTo(270)
        expect(config.scale).toEqual({x: 1, y: 1})
        expect(manager.transform.setScale).toHaveBeenCalledWith(widget, 1, 1)
    })

    it('resizes only a widget larger than the crop', () => {
        widget.style.left = '0px'
        widget.style.top = '0px'
        widget.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top: 0,
            width: 800,
            height: 600,
            right: 800,
            bottom: 600,
        }))
        const config = {
            id: 'visual-widget#video',
            type: LGS_VISUAL_WIDGET,
            widgetsBoard: VIDEO_WIDGETS_BOARD,
            element: widget,
            position: {left: 0, top: 0},
            dimensions: {width: 800, height: 600},
            scale: {x: 1, y: 1},
            persist: false,
        }
        registry.setConfig(config.id, config)

        expect(controls.repositionWidgetsForBoard(
            VIDEO_WIDGETS_BOARD,
            {left: 0, top: 0, width: 600, height: 400},
            {left: 0, top: 0, width: 1000, height: 800},
        )).toBe(1)
        expect(config.scale.x).toBeCloseTo(2 / 3)
        expect(config.scale.y).toBeCloseTo(2 / 3)
        expect(manager.transform.setScale).toHaveBeenCalledWith(widget, 2 / 3, 2 / 3)
        // With a center-origin transform, the logical position becomes
        // negative so that the visible rectangle remains at the crop origin.
        expect(config.position.left).toBeCloseTo(-(800 - (800 * (2 / 3))) / 2)
        expect(config.position.top).toBeCloseTo(-(600 - (600 * (2 / 3))) / 2)
        expect(config.savedRatios.leftEdgeRatio).toBe(0)
        expect(config.savedRatios.topEdgeRatio).toBe(0)
    })

    it('resizes crop dimensions without applying the generic visual scale', () => {
        const originalResizeObserver = globalThis.ResizeObserver
        globalThis.ResizeObserver = class {
            observe = vi.fn()
            unobserve = vi.fn()
            disconnect = vi.fn()
        }
        board.getBoundingClientRect = vi.fn(() => ({
            left: 0, top: 0, width: 545, height: 681, right: 545, bottom: 681,
        }))
        widget.setAttribute('data-widget-id', VIDEO_CROP_ZONE)
        widget.getBoundingClientRect = vi.fn(() => ({
            left: 0, top: 0, width: 813, height: 1016, right: 813, bottom: 1016,
        }))
        const config = {
            id: VIDEO_CROP_ZONE,
            type: LGS_VISUAL_WIDGET,
            isCropper: true,
            container: board,
            boundsContainer: board,
            bounds: {left: 0, top: 0, right: 813, bottom: 1016},
            position: {left: 0, top: 0},
            dimensions: {width: 813, height: 1016},
            cropDimensions: {left: 0, top: 0, width: 813, height: 1016},
            scale: {x: 1, y: 1},
            margin: 0,
            persist: false,
        }
        const setBounds = vi.fn()
        const setPosition = vi.fn()
        registry.setConfig(config.id, config)
        manager.getWidgetConfig.mockReturnValue(config)

        try {
            controls.monitorContainerResize(config, setBounds, {current: null}, widget, setPosition)

            expect(config.scale).toEqual({x: 1, y: 1})
            expect(manager.transform.setScale).not.toHaveBeenCalled()
            expect(config.cropDimensions.width).toBe(545)
            expect(config.cropDimensions.height).toBe(681)
        }
        finally {
            config.observer?.disconnect()
            if (config.windowResizeHandler) {
                window.removeEventListener('resize', config.windowResizeHandler)
            }
            globalThis.ResizeObserver = originalResizeObserver
        }
    })
})
