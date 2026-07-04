/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-stats-realign.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'

vi.mock('@Components/DataDisplay/NameValueUnit', () => ({
    NameValueUnit: ({value}) => <span>{String(value)}</span>,
}))

vi.mock('@Components/DateTimeDisplay', () => ({
    DateTimeDisplay: () => <div />,
}))

vi.mock('@Components/MainUI/widgets/useWidgetScaleCorrection', () => ({
    useWidgetScaleCorrection: () => 1,
}))

vi.mock('@shoelace-style/shoelace/dist/react', () => ({
    SlDivider: () => <hr />,
    SlIcon: () => <span />,
}))

import { JourneyStats } from '@Components/Stats/JourneyStats'

describe('JourneyStats', () => {
    let target
    let updateRect
    let originalDescriptors

    beforeEach(() => {
        updateRect = vi.fn()
        originalDescriptors = {
            offsetWidth:  Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
            offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
            scrollWidth:  Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
            scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
        }
        target = {
            style: {
                left:   '10px',
                top:    '20px',
                width:  '100px',
                height: '50px',
            },
            contains: () => true,
        }

        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            get() {
                return this.classList?.contains('journey-stats-widget') ? 140 : 0
            },
        })
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            get() {
                return this.classList?.contains('journey-stats-widget') ? 90 : 0
            },
        })
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            get() {
                return this.classList?.contains('journey-stats-widget') ? 140 : 0
            },
        })
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get() {
                return this.classList?.contains('journey-stats-widget') ? 90 : 0
            },
        })

        globalThis.lgs = {
            theJourney: {
                slug:        'journey-a',
                hasTime:     true,
                hasAltitude: true,
                getDate:     () => new Date('2026-07-03T10:00:00Z'),
                location:    'Test location',
                metrics:     proxy({
                    global: {},
                }),
            },
            stores: {
                main: proxy({
                    theJourney: {slug: 'journey-a'},
                    components: {
                        journeyStats: proxy({global: {}}),
                    },
                }),
                replay: proxy({
                    recordingSync: true,
                    playing:       true,
                    paused:        false,
                    progress:      0.1,
                    durationMillis: 10000,
                    elapsedMillis:  1000,
                    sample: {},
                }),
                ui: {
                    video: proxy({editing: false, preRecording: false, recording: false, finalizing: false, snapshot: false}),
                    widget: proxy({}),
                },
            },
            settings: {
                unitSystem: proxy({current: 'metric'}),
                widgets: {
                    'journey-stats-widget': {
                    configuration: proxy({
                        default: {
                            textOrder: ['distance'],
                            text:      {show: true, color: '#fff', shadow: {show: false}},
                            border:    {show: false, thickness: 0, color: '#fff', scaled: false, radius: 'none', radiusScaled: false},
                            background:{show: false, color: '#000', blur: false},
                            separator: {show: false, color: '#fff', opacity: 1, padding: 0},
                            padding:   {top: 16, right: 16, bottom: 16, left: 16, scaled: false},
                        },
                        user: null,
                        elements: {},
                    }),
                    },
                },
            },
        }

        globalThis.__ = {
            ui: {
                ui: {
                    resolveItemColor: () => '#ffffff',
                    formatJourneyDurationDates: () => ({prefix: 'prefix', sufix: 'suffix', items: []}),
                },
                widgetManager: {
                    getMoveable: vi.fn(() => ({
                        current: {
                            target,
                            updateRect,
                        },
                    })),
                    getWidgetConfig: vi.fn(() => ({
                        position:   {left: 10, top: 20},
                        dimensions: {width: 100, height: 50},
                        persist:    false,
                        runtimeReady: false,
                    })),
                    saveWidgetPosition: vi.fn(),
                },
            },
            widgets: new Map(),
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
        for (const [key, descriptor] of Object.entries(originalDescriptors ?? {})) {
            if (descriptor) {
                Object.defineProperty(HTMLElement.prototype, key, descriptor)
            }
            else {
                delete HTMLElement.prototype[key]
            }
        }
    })

    it('recenters the widget when the measured stats size changes', async () => {
        render(
            <JourneyStats
                id="journey-stats-widget#1"
                metrics={{
                    distance: 120,
                    positive: {elevation: 87},
                    duration: 4,
                }}
                units={{
                    elevation: 'm',
                    distance:  'm',
                    pace:      'min/km',
                    speed:     'km/h',
                }}
                mode="journey"
                widgetKey="journey-stats-widget"
            />,
        )

        await waitFor(() => {
            expect(target.style.width).toBe('140px')
            expect(target.style.height).toBe('90px')
            expect(target.style.left).toBe('-10px')
            expect(target.style.top).toBe('0px')
        })
    })

    it('stays visible on the video board before the recording starts', async () => {
        globalThis.lgs.stores.ui.video.preRecording = true

        const {container} = render(
            <JourneyStats
                id="journey-stats-widget#1"
                metrics={{
                    distance: 120,
                    positive: {elevation: 87},
                    duration: 4,
                }}
                units={{
                    elevation: 'm',
                    distance:  'm',
                    pace:      'min/km',
                    speed:     'km/h',
                }}
                mode="journey"
                widgetKey="journey-stats-widget"
                widgetsBoard={VIDEO_WIDGETS_BOARD}
            />,
        )

        const widget = container.querySelector('.journey-stats-widget')
        expect(widget).not.toBeNull()
        expect(widget.style.visibility).not.toBe('hidden')
    })

    it('hides the journey stats widget on the video board while recording is active and the replay is not near the end', async () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.progress = 0.1

        const {container} = render(
            <JourneyStats
                id="journey-stats-widget#1"
                metrics={{
                    distance: 120,
                    positive: {elevation: 87},
                    duration: 4,
                }}
                units={{
                    elevation: 'm',
                    distance:  'm',
                    pace:      'min/km',
                    speed:     'km/h',
                }}
                mode="journey"
                widgetKey="journey-stats-widget"
                widgetsBoard={VIDEO_WIDGETS_BOARD}
            />,
        )

        const widget = container.querySelector('.journey-stats-widget')
        expect(widget).not.toBeNull()
        expect(widget.style.visibility).toBe('hidden')
    })
})
