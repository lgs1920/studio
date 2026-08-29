import {WidgetResizable} from '@Core/ui/widget-manager/WidgetResizable'
import {constrainWidgetDimensions, isNonDistortingWidget, resolveWidgetResizeLimits} from '@Core/ui/widget-manager/widgetResizeUtils'
import {afterEach, describe, expect, it, vi} from 'vitest'

describe('non-distorting widget resize', () => {
    afterEach(() => {
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('constrains unlocked dimensions independently', () => {
        const config = {
            resizable: true,
            scalable:  false,
            min:       {width: 100, height: 50},
            max:       {width: 400, height: 300},
        }

        expect(isNonDistortingWidget(config)).toBe(true)
        expect(constrainWidgetDimensions({config, width: 450, height: 20})).toEqual({width: 400, height: 50})
    })

    it('can constrain either axis to the rendered content dimensions', () => {
        const element = document.createElement('div')
        const content = document.createElement('div')
        Object.defineProperties(content, {
            scrollWidth:  {configurable: true, value: 480},
            scrollHeight: {configurable: true, value: 180},
        })
        element.append(content)

        const config = {
            min:            {width: 100, height: 50},
            max:            {width: 1200, height: 1000},
            resizeToContent: {width: true, height: true},
        }

        expect(resolveWidgetResizeLimits(config, element)).toEqual({
            minWidth:  100,
            minHeight: 50,
            maxWidth:  480,
            maxHeight: 180,
        })
        expect(constrainWidgetDimensions({config, element, width: 900, height: 700})).toEqual({
            width:  480,
            height: 180,
        })
    })

    it('uses content dimensions as dynamic minimums when shrinking is not possible', () => {
        const element = document.createElement('div')
        const content = document.createElement('div')
        Object.defineProperties(content, {
            scrollWidth:  {configurable: true, value: 480},
            scrollHeight: {configurable: true, value: 180},
        })
        element.append(content)

        const config = {
            min:            {width: 100, height: 50},
            max:            {width: 1200, height: 1000},
            resizeToContent: {minWidth: true, minHeight: true},
        }

        expect(resolveWidgetResizeLimits(config, element)).toEqual({
            minWidth:  480,
            minHeight: 180,
            maxWidth:  1200,
            maxHeight: 1000,
        })
        expect(constrainWidgetDimensions({config, element, width: 200, height: 80})).toEqual({
            width:  480,
            height: 180,
        })
    })

    it('does not apply stale content constraints when explicitly disabled', () => {
        const element = document.createElement('div')
        const content = document.createElement('div')
        Object.defineProperties(content, {
            scrollWidth:  {configurable: true, value: 480},
            scrollHeight: {configurable: true, value: 180},
        })
        element.append(content)

        const config = {
            constrainResizeToContent: false,
            min:                     {width: 100, height: 50},
            max:                     {width: 1200, height: 1000},
            resizeToContent:          {minWidth: true, minHeight: true},
        }

        expect(resolveWidgetResizeLimits(config, element)).toEqual({
            minWidth:  100,
            minHeight: 50,
            maxWidth:  1200,
            maxHeight: 1000,
        })
    })

    it('leaves crop zones outside the generic layout resize contract', () => {
        expect(isNonDistortingWidget({
            isCropper: true,
            resizable: true,
            scalable:  false,
        })).toBe(false)
    })

    it('keeps locked dimensions proportional while respecting both axes', () => {
        const config = {
            ratio:     {aspectRatio: 16 / 9, locked: true},
            resizable: true,
            scalable:  false,
            min:       {width: 100, height: 50},
            max:       {width: 400, height: 300},
        }

        expect(constrainWidgetDimensions({config, width: 600, height: 200})).toEqual({width: 400, height: 225})
        expect(constrainWidgetDimensions({config, width: 100, height: 180, preferredAxis: 'height'})).toEqual({width: 320, height: 180})
    })

    it('writes layout dimensions without a scale transform and persists them', async () => {
        const target = document.createElement('div')
        Object.assign(target.style, {
            left:   '10px',
            top:    '20px',
            width:  '200px',
            height: '100px',
        })
        const config = {
            id:         'profile-widget#scene',
            dimensions: {width: 200, height: 100},
            isCropper:  false,
            min:        {width: 100, height: 50},
            max:        {width: 400, height: 200},
            persist:    true,
            position:   {left: 10, top: 20},
            ratio:      {aspectRatio: 2, locked: false},
            resizable:  true,
            scalable:   false,
            bounds:     {left: 0, top: 0, right: 500, bottom: 300},
            container:  {getBoundingClientRect: vi.fn()},
        }
        const widgetManager = {
            isResizing:        false,
            retrieveElementId: vi.fn(() => config.id),
            getWidgetConfig:   vi.fn(() => config),
            saveWidgetPosition: vi.fn(async () => undefined),
        }
        globalThis.__ = {
            app: {parsePx: value => Number.parseFloat(value) || 0},
            ui:  {widgetManager: {setConfig: vi.fn()}},
        }
        globalThis.lgs = {
            stores: {
                ui: {
                    widget: {
                        list: new Map([[config.id, {}]]),
                    },
                },
            },
        }

        const resizable = new WidgetResizable(widgetManager, {})
        resizable.onResizeStart({target, direction: [1, 1]})
        resizable.onResize({
            width:     500,
            height:    300,
            direction: [1, 1],
            drag:      {beforeDist: [0, 0]},
        }, {widget: {current: target}, child: {current: null}}, vi.fn())

        await resizable.onResizeEnd({target})

        expect(target.style.width).toBe('400px')
        expect(target.style.height).toBe('200px')
        expect(target.style.transform).toBe('none')
        expect(config.dimensions).toEqual({width: 400, height: 200})
        expect(lgs.stores.ui.widget.list.get(config.id).dimensions).toEqual({width: 400, height: 200})
        expect(widgetManager.saveWidgetPosition).toHaveBeenCalledWith(config.id, config)
    })
})
