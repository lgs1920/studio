/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: elevation-profile.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-14
 * Last modified: 2026-06-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

const rendererMock = vi.hoisted(() => ({
    findExistingInList: vi.fn(() => null),
    renderWidget:       vi.fn(),
    destroyWidget:      vi.fn(),
}))

vi.mock('@Components/Profile/ProfileChart', () => ({
    ProfileChart: ({data}) => <div data-testid="profile-chart" data-has-data={String(Boolean(data))}/>,
}))
vi.mock('@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender', () => ({
    WidgetDynamicRenderer: {instance: rendererMock},
}))
vi.mock('@Core/Elevation/ElevationServer', () => ({
    ElevationServer: {
        FILE_CONTENT: 'file-content',
        NONE:         'none',
    },
}))
vi.mock('@Core/ui/Export', () => ({
    Export: {toPNG: vi.fn()},
}))
vi.mock('@Utils/cesium/TrackUtils', () => ({
    TrackUtils: {setProfileVisibility: vi.fn()},
}))
vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        success: vi.fn(),
        error:   vi.fn(),
    },
}))
vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton:      ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon:        ({name}) => <span data-icon={name}/>,
    WaOption:      ({children, ...props}) => <div role="option" {...props}>{children}</div>,
    WaProgressBar: () => <div data-testid="progress-bar"/>,
    WaSelect:      ({children, ...props}) => <div data-testid="select" {...props}>{children}</div>,
    WaSwitch:      ({children, checked, disabled, onChange}) => (
        <label>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange}/>
            {children}
        </label>
    ),
    WaTooltip:     ({children}) => <span>{children}</span>,
}))

import {ElevationProfile} from '@Components/MainUI/ElevationProfile'

describe('ElevationProfile', () => {
    beforeEach(() => {
        HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
            left:   0,
            top:    0,
            right:  400,
            bottom: 180,
            width:  400,
            height: 180,
        }))

        rendererMock.findExistingInList.mockReset()
        rendererMock.findExistingInList.mockReturnValue(null)
        rendererMock.renderWidget.mockReset()
        rendererMock.destroyWidget.mockReset()

        globalThis.__ = {
            ui: {
                profiler: {
                    prepareData: vi.fn(() => ({
                        dataset:    [{source: [[0, 1200], [1, 1300]]}],
                        options:    [{color: '#3b82f6', name: 'Track', dataset: 'track'}],
                        dimensions: ['distance', 'elevation'],
                    })),
                },
                widgetManager: {
                    getElementById:       vi.fn(() => null),
                    disposeElement:       vi.fn(),
                    deleteWidgetPosition: vi.fn(),
                },
                drawerManager: {
                    open: vi.fn(),
                },
            },
        }

        globalThis.lgs = {
            settings: {
                unitSystem: proxy({current: 0}),
            },
            stores:   {
                journeyEditor: proxy({
                    journey:      proxy({
                        slug:            'journey-1',
                        title:           'Journey',
                        hasElevation:    true,
                        elevationServer: 'file-content',
                    }),
                    isProcessing: true,
                }),
                main:          {
                    components: {
                        profile: proxy({
                            key:           'profile-key',
                            elevationData: null,
                            show:          false,
                        }),
                    },
                },
                ui:            {
                    widget:  proxy({
                        currentSnapshot: null,
                    }),
                    drawers: proxy({
                        open: null,
                    }),
                },
            },
            theJourney: {
                slug: 'journey-1',
            },
        }
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('keeps the drawer profile chart mounted while elevation processing is running', async () => {
        render(<ElevationProfile
            default="file-content"
            label="Elevation Source:"
            servers={[{id: 'file-content', label: 'File', icon: 'chart'}]}
        />)

        await waitFor(() => {
            expect(screen.getByTestId('profile-chart')).not.toBeNull()
            expect(screen.getByTestId('profile-chart').dataset.hasData).toBe('true')
        })
    })
})
