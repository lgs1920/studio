/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profile-widget-resize.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-08-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

const widgetMocks = vi.hoisted(() => ({config: null}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config}) => {
        widgetMocks.config = config
        return <div data-testid="profile-widget-host">{children}</div>
    },
}))

vi.mock('@Components/Profile/ProfileChart', () => ({
    ProfileChart: ({height, width}) => <div data-testid="profile-chart" data-height={height} data-width={width}/>,
}))

import {ProfileWidget} from '@Components/Profile/ProfileWidget'

describe('ProfileWidget resize ratio', () => {
    beforeEach(() => {
        widgetMocks.config = null
        globalThis.__ = {
            ui: {
                profiler: {
                    prepareData:  vi.fn(() => ({dataset: [{source: [[0, 100], [1, 200]]}]})),
                    setVisibility: vi.fn(),
                },
                widgetManager: {
                    getWidgetConfig:             vi.fn(() => null),
                    resolveWidgetsBoardContainer: vi.fn(() => lgs.canvas),
                },
            },
        }
        globalThis.lgs = {
            canvas: document.createElement('div'),
            settings: {
                unitSystem: proxy({current: 0}),
            },
            stores: {
                main: {
                    components: {
                        profile: proxy({height: '200px', key: 1, width: '500px'}),
                    },
                },
                ui: {
                    widget: {
                        list: proxyMap(),
                    },
                },
            },
            theJourney: {slug: 'journey-1'},
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('does not inherit the global locked ratio', async () => {
        render(<ProfileWidget id="profile-widget#scene" context={proxy({widgetsBoard: 'scene'})}/>)

        await waitFor(() => {
            expect(screen.getByTestId('profile-widget-host')).not.toBeNull()
            expect(widgetMocks.config.ratio).toEqual({value: '0x0', aspectRatio: 0, locked: false})
            expect(widgetMocks.config.resizable).toBe(true)
            expect(widgetMocks.config.scalable).toBe(false)
            expect(widgetMocks.config.constrainResizeToContent).toBe(false)
            expect(screen.getByTestId('profile-chart').dataset.width).toBe('100%')
            expect(screen.getByTestId('profile-chart').dataset.height).toBe('100%')
        })
    })
})
