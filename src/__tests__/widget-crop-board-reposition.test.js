import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LGS_VISUAL_WIDGET, LGS_WIDGET, VIDEO_WIDGETS_BOARD } from '@Core/constants'
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
        }
        globalThis.__ = {ui: {widgetManager: manager}}
        globalThis.lgs = {gutter: {xs: 5}}
        controls = new WidgetCoreControls(registry)
    })

    it('preserves the live center position for centered widgets in the new crop', () => {
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

        expect(changed).toBe(1)
        expect(config.position.left).toBe(240)
        expect(config.position.top).toBe(170)
        expect(widget.style.left).toBe('240px')
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

        // The widget center was 50% / 45% in the old crop. It remains at
        // those percentages in the new crop, in viewport coordinates.
        expect(config.position.left).toBeCloseTo(525)
        expect(config.position.top).toBeCloseTo(297.5)
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

    it('preserves the live position of a non-draggable widget', () => {
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
        expect(config.position.left).toBeCloseTo(468)
        expect(config.position.top).toBeCloseTo(70)
        expect(widget.style.left).toBe('468px')
        expect(widget.style.top).toBe('70px')
        expect(manager.saveWidgetPosition).toHaveBeenCalledWith(config.id, config)
    })

    it('resizes widgets by the crop percentage without distorting them', () => {
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
        expect(config.scale.x).toBeCloseTo(0.5)
        expect(config.scale.y).toBeCloseTo(0.5)
        expect(manager.transform.setScale).toHaveBeenCalledWith(widget, 0.5, 0.5)
        expect(config.position.left).toBe(40)
        expect(config.position.top).toBe(0)
    })
})
