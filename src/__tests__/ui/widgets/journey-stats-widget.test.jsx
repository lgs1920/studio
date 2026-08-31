/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-stats-widget.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-08-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

const widgetMocks = vi.hoisted(() => ({config: null}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config}) => {
        widgetMocks.config = config
        return <div>{children}</div>
    },
}))

vi.mock('@Components/Stats/JourneyStats', () => ({
    JourneyStats: () => <div data-testid="journey-stats"/>,
}))

vi.mock('@Utils/useManagedStylesheet', () => ({
    useManagedStylesheet: vi.fn(),
}))

vi.mock('@Utils/ValtioUtils', () => ({
    useOptionalSnapshot: (value, fallback) => value ?? fallback,
}))

import {DynamicStatsWidget} from '@Components/Stats/DynamicStatsWidget'
import {JourneyStatsWidget} from '@Components/Stats/JourneyStatsWidget'

describe('Stats widget dimensions', () => {
    beforeEach(() => {
        widgetMocks.config = null
        globalThis.__ = {
            ui: {
                widgetManager: {
                    resolveWidgetsBoardContainer: vi.fn(() => document.body),
                },
            },
        }
        globalThis.lgs = {
            canvas: document.body,
            theJourney: {
                getMetrics: () => ({metrics: {distance: 1}}),
            },
            settings: {
                unitSystem: proxy({current: 'metric'}),
            },
            stores: {
                main: proxy({theJourney: {slug: 'journey-a'}}),
                ui: {
                    video: proxy({
                        editing:     false,
                        finalizing:  false,
                        preRecording: false,
                        recording:   false,
                        snapshot:    false,
                    }),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('uses a 50px minimum width for Journey Stats and Dynamic Stats', () => {
        const journeyView = render(<JourneyStatsWidget id="journey-stats-widget" widgetsBoard="scene"/>)
        expect(widgetMocks.config.min).toEqual({width: 50})
        journeyView.unmount()

        const dynamicView = render(<DynamicStatsWidget id="dynamic-stats-widget" widgetsBoard="scene"/>)
        expect(widgetMocks.config.min).toEqual({width: 50})
        dynamicView.unmount()
    })
})
