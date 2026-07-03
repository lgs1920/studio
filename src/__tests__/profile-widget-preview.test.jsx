/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profile-widget-preview.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-09
 * Last modified: 2026-06-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render } from '@testing-library/react'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Components/Profile/ProfileChart', () => ({
    ProfileChart: ({height, width}) => (
        <div data-testid="profile-chart" data-height={height} data-width={width}/>
    ),
}))

import { ProfileWidgetPreview } from '@Components/Profile/ProfileWidgetPreview'

describe('ProfileWidgetPreview', () => {
    let originalGetBoundingClientRect

    beforeEach(() => {
        originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
        HTMLElement.prototype.getBoundingClientRect = vi.fn(function () {
            if (this?.classList?.contains('profile-widget-preview-surface')) {
                return {
                    left:   0,
                    top:    0,
                    right:  800,
                    bottom: 600,
                    width:  800,
                    height: 600,
                }
            }

            return {
                left:   0,
                top:    0,
                right:  0,
                bottom: 0,
                width:  0,
                height: 0,
            }
        })
        globalThis.__ = {
            ui: {
                profiler: {
                    prepareData: vi.fn(() => ({dataset: [{source: [[0, 0]]}], options: [{color: '#fff'}]})),
                },
                widgetManager: {
                    getWidgetConfig: vi.fn(() => ({
                        ratio: {
                            value:       '16x9',
                            aspectRatio: 16 / 9,
                        },
                    })),
                },
            },
        }

        globalThis.ResizeObserver = class {
            constructor(callback) {
                this.callback = callback
            }

            observe = (element) => {
                this.callback([{target: element}])
            }

            disconnect = () => {}
        }

        globalThis.lgs = {
            configuration: {
                widgetRatio: {
                    value:       '16x9',
                    aspectRatio: 16 / 9,
                },
                videoFormats: [],
            },
            settings: {
                unitSystem: proxy({current: 0}),
                ui: {
                    replay: proxy({
                        profileInfo: proxy({
                            useTrackStyle: false,
                            color:         '#ffffff',
                        }),
                    }),
                },
            },
            stores: {
                main: {
                    components: {
                        profile: proxy({key: 'profile-key'}),
                    },
                },
                ui: {
                    widget: {
                        list: proxyMap([
                            ['profile-widget#1', {
                                ratio: {
                                    value:       '16x9',
                                    aspectRatio: 16 / 9,
                                },
                            }],
                        ]),
                    },
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
        globalThis.ResizeObserver = undefined
        if (originalGetBoundingClientRect) {
            HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
        }
    })

    it('fits landscape ratios on width first', async () => {
        const {findByTestId, container} = render(<ProfileWidgetPreview entity="profile-widget#1"/>)
        const surface = container.querySelector('.profile-widget-preview-surface')
        const chart = await findByTestId('profile-chart')

        expect(surface.style.height).toBe('100%')
        expect(surface.style.width).toBe('100%')
        expect(chart.dataset.width).toBe('800')
        expect(chart.dataset.height).toBe('450')
    })

    it('fits portrait ratios on height first', async () => {
        lgs.stores.ui.widget.list.set('profile-widget#1', {
            ratio: {
                value:       'custom',
                aspectRatio: 1 / 2,
            },
        })

        const {findByTestId} = render(<ProfileWidgetPreview entity="profile-widget#1"/>)
        const chart = await findByTestId('profile-chart')

        expect(chart.dataset.width).toBe('300')
        expect(chart.dataset.height).toBe('600')
    })
})
