import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxyMap} from 'valtio/utils'

const widgetMocks = vi.hoisted(() => ({
    config: null,
    runtimeConfig: {
        dimensions:       {width: 2160, height: 900},
        min:              {width: 360, height: 66},
        max:              {width: 3840, height: 2160},
        resizeToContent:  {minHeight: true},
    },
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config}) => {
        widgetMocks.config = config
        return <div data-testid="replay-timeline-widget-host">{children}</div>
    },
}))

vi.mock('@Components/MainUI/video/ReplayTimelinePreview', () => ({
    ReplayTimelinePreview: () => <div className="replay-timeline-preview" data-testid="replay-timeline-preview"/>,
}))

import {ReplayTimelineWidget} from '@Components/MainUI/widgets/list/ReplayTimelineWidget'

describe('ReplayTimelineWidget dimensions', () => {
    beforeEach(() => {
        widgetMocks.config = null
        widgetMocks.runtimeConfig = {
            dimensions:      {width: 2160, height: 900},
            min:             {width: 360, height: 66},
            max:             {width: 3840, height: 2160},
            resizeToContent: {minHeight: true},
        }
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getElementById: vi.fn(() => screen.queryByTestId('replay-timeline-widget-host')),
                    getMoveable:    vi.fn(() => ({current: {updateRect: vi.fn()}})),
                    getWidgetConfig: vi.fn(() => widgetMocks.runtimeConfig),
                    saveWidgetPosition: vi.fn(),
                    setConfig:      vi.fn(),
                    invalidateRuntimeById: vi.fn(),
                },
                widgetCache: {
                    unmount: vi.fn(),
                },
            },
        }
        globalThis.lgs = {
            canvas: document.createElement('div'),
            stores: {
                ui: {
                    widget: {
                        list: proxyMap([['replay-timeline-widget', {dimensions: {width: 2160, height: 900}}]]),
                    },
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('restores persisted dimensions while respecting the preview content minimum', async () => {
        const {unmount} = render(<ReplayTimelineWidget id="replay-timeline-widget"/>)
        const content = screen.getByTestId('replay-timeline-preview')
        vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
            bottom:  114,
            height: 114,
            left:   0,
            right:  720,
            top:    0,
            width:  720,
            x:      0,
            y:      0,
        })

        expect(widgetMocks.config.width).toBeUndefined()
        expect(widgetMocks.config.height).toBeUndefined()
        expect(widgetMocks.config.persist).toBe(true)
        expect(widgetMocks.config.constrainResizeToContent).toBe(true)
        expect(widgetMocks.config.resizeToContent).toEqual({minHeight: true})
        await waitFor(() => expect(widgetMocks.runtimeConfig.dimensions).toEqual({width: 2160, height: 900}))
        expect(__.ui.widgetManager.saveWidgetPosition).not.toHaveBeenCalled()

        unmount()

        expect(lgs.stores.ui.widget.list.has('replay-timeline-widget')).toBe(true)
        expect(__.ui.widgetManager.invalidateRuntimeById).toHaveBeenCalledWith('replay-timeline-widget')
    })
})
