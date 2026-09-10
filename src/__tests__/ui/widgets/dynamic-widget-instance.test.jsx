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
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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
