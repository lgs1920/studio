/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: dynamic-widget-instance.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render, screen, waitFor} from '@testing-library/react'
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

vi.mock('@awesome.me/webawesome/dist/react', () => ({
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
                widgetManager: {
                    getWidgetConfig: vi.fn(() => ({rotate: 18})),
                },
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

    it('finishes mounting when presentation props change during component loading', async () => {
        let completeLoad
        rendererMock.renderWidget.mockImplementation(() => new Promise(resolve => {
            completeLoad ??= resolve
        }))
        const {rerender} = render(<DynamicWidget id="text-widget#title"
            props={{group: 'multi-purpose-widgets', widgetsBoard: 'video-crop-zone', zIndex: 4000}}/>)
        rerender(<DynamicWidget id="text-widget#title"
            props={{group: 'multi-purpose-widgets', widgetsBoard: 'video-crop-zone', zIndex: 4500}}/>)

        await act(async () => {
            completeLoad(({id, zIndex}) => <div data-testid="loaded-widget" data-widget-id={id} data-z-index={zIndex}/>)
        })

        expect(screen.getByTestId('loaded-widget').dataset.widgetId).toBe('text-widget#title')
        expect(screen.getByTestId('loaded-widget').dataset.zIndex).toBe('4500')
        expect(rendererMock.renderWidget).toHaveBeenCalledTimes(1)
    })

    it('reselects a reattached widget after the concrete instance is mounted', async () => {
        lgs.stores.ui.widget.current = {id: 'profile-widget#1'}
        lgs.stores.ui.widget.reattachSelection = {
            id:      'replay-timeline-widget#instance',
            request: 1,
        }

        render(<DynamicWidget id="replay-timeline-widget" props={{group: 'journey-widgets', widgetsBoard: 'scene'}}/>)

        await waitFor(() => expect(lgs.stores.ui.widget.current.id).toBe('replay-timeline-widget#instance'))
        expect(lgs.stores.ui.widget.current.rotate).toBe(18)
    })
})
