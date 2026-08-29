import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxyMap} from 'valtio/utils'

const rendererMock = vi.hoisted(() => ({
    renderWidget: vi.fn(),
}))

vi.mock('@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender', () => ({
    WidgetDynamicRenderer: {
        get instance() {
            return rendererMock
        },
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaSpinner: () => <span data-testid="widget-spinner"/>,
}))

import {DynamicWidget} from '@Components/MainUI/widgets/DynamicWidget'

describe('DynamicWidget instance identity', () => {
    beforeEach(() => {
        const widgetList = proxyMap()
        rendererMock.renderWidget.mockImplementation(async () => {
            widgetList.set('replay-timeline-widget#instance', {
                widgetsBoard: 'scene',
            })
            return ({id}) => <div data-testid="dynamic-widget" data-widget-id={id}/>
        })

        globalThis.lgs = {
            stores: {
                ui: {
                    widget: {
                        list: widgetList,
                    },
                },
            },
        }
        globalThis.__ = {
            ui: {
                widgetCache: {
                    get: vi.fn(() => null),
                    set: vi.fn(),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('passes the concrete renderer instance to the widget component', async () => {
        render(<DynamicWidget id="replay-timeline-widget" props={{group: 'journey-widgets', widgetsBoard: 'scene'}}/>)

        await waitFor(() => {
            expect(screen.getByTestId('dynamic-widget').getAttribute('data-widget-id')).toBe('replay-timeline-widget#instance')
        })
    })
})
