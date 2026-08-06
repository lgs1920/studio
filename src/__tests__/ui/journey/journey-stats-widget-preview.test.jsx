/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-stats-widget-preview.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified on: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/Stats/JourneyStats', () => ({
    JourneyStats: () => <div className="journey-stats-widget" data-testid="journey-stats-widget"/>,
}))

import { JourneyStatsWidgetPreview } from '@Components/Stats/JourneyStatsWidgetPreview'

describe('JourneyStatsWidgetPreview', () => {
    let originalGetBoundingClientRect
    let originalResizeObserver

    beforeEach(() => {
        originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
        HTMLElement.prototype.getBoundingClientRect = vi.fn(function () {
            if (this?.classList?.contains('journey-stats-widget-preview-surface')) {
                return {
                    left: 0,
                    top: 0,
                    right: 1000,
                    bottom: 500,
                    width: 1000,
                    height: 500,
                }
            }

            return {
                left: 0,
                top: 0,
                right: 1000,
                bottom: 100,
                width: 1000,
                height: 100,
            }
        })

        originalResizeObserver = globalThis.ResizeObserver
        globalThis.ResizeObserver = class {
            constructor(callback) {
                this.callback = callback
            }

            observe = (element) => {
                this.callback([{target: element}])
            }

            disconnect = () => {}
        }

        globalThis.__ = {
            ui: {
                ui: {
                    resolveItemColor: () => '#ffffff',
                    formatJourneyDurationDates: () => ({prefix: 'a', sufix: 'b'}),
                },
                widgetManager: {
                    getWidgetPosition: vi.fn(async () => ({rotate: 0})),
                },
            },
            widgets: new Map(),
        }

        globalThis.lgs = {
            theJourney: {
                slug: 'journey-a',
                getMetrics: () => ({metrics: {distance: 1}}),
            },
            settings: {
                unitSystem: proxy({current: 'metric'}),
                widgets: {
                    'journey-stats-widget': {
                        configuration: proxy({
                            default: {
                                textOrder: ['distance'],
                                text: {show: true, shadow: {show: false}},
                                border: {show: false, width: 0, thickness: 0},
                                background: {show: false},
                                separator: {show: false},
                                padding: {top: 0, right: 0, bottom: 0, left: 0, scaled: false},
                            },
                            user: null,
                            elements: {},
                        }),
                    },
                },
            },
            stores: {
                ui: {
                    widget: proxy({current: {id: null, rotate: 0}}),
                    video: proxy({editing: false}),
                },
                main: proxy({
                    theJourney: {slug: 'journey-a'},
                    components: {
                        journeyStats: proxy({global: {distance: 1}}),
                    },
                }),
                replay: proxy({}),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
        globalThis.ResizeObserver = originalResizeObserver
        if (originalGetBoundingClientRect) {
            HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
        }
    })

    it('caps the preview scale at 90 percent while preserving the ratio', async () => {
        const {container} = render(<JourneyStatsWidgetPreview entity="journey-stats-widget#1"/>)

        await waitFor(() => {
            const stage = container.querySelector('.journey-stats-widget-preview-stage')
            expect(stage).toBeTruthy()
            expect(stage.style.transform).toContain('scale(0.9)')
            expect(stage.style.transform).toContain('rotate(0deg)')
        })
    })
})
