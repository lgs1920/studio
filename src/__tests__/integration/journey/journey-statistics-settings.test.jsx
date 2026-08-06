/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-statistics-settings.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-12
 * Last modified: 2026-07-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { proxy } from 'valtio'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {refreshJourneysStatistics} = vi.hoisted(() => ({
    refreshJourneysStatistics: vi.fn(),
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <div data-testid="scrollbars">{children}</div>,
}))

vi.mock('@Editor/Utils', () => ({
    Utils: {
        refreshJourneysStatistics,
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaCallout: ({children}) => <div>{children}</div>,
    WaDivider: () => <hr/>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaInput: ({label, value, onInput, children, withoutSpinButtons, ...props}) => (
        <label>
            <span>{label}</span>
            <input aria-label={label} value={value} onInput={onInput} {...props}/>
            {children}
        </label>
    ),
    WaOption: ({children, value}) => <option value={value}>{children}</option>,
    WaSelect: ({label, value, onChange, children, ...props}) => (
        <label>
            <span>{label}</span>
            <select aria-label={label} value={value} onChange={onChange} {...props}>{children}</select>
        </label>
    ),
}))

import { JourneyStatisticsSettings } from '@Components/Settings/application/general/JourneyStatisticsSettings'

describe('JourneyStatisticsSettings', () => {
    beforeEach(() => {
        refreshJourneysStatistics.mockClear()
        globalThis.__ = {
            tools: {
                debounce: fn => fn,
            },
        }

        const activity = proxy({
            default: 'trek',
            types:   [
                {
                    id:                     'trek',
                    label:                  'Trek',
                    minSegmentDuration:     2,
                    minSegmentDistance:     3,
                    altitudeSmoothingWindow: 3,
                    maxAltitudeJump:        10,
                    maxSpeed:               0,
                    maxClimbRate:           0,
                    maxDescentRate:         0,
                    maxPace:                0,
                    maxSpeedDelta:          0,
                    stopDuration:           60,
                    stopSpeedLimit:         0,
                },
            ],
        })

        globalThis.lgs = {
            configuration: {
                journey: {
                    activity: {
                        default: activity.default,
                        types:   JSON.parse(JSON.stringify(activity.types)),
                    },
                },
            },
            savedConfiguration: {
                journey: {
                    activity: {
                        default: activity.default,
                        types:   JSON.parse(JSON.stringify(activity.types)),
                    },
                },
            },
            settings: {
                journey: {
                    activity,
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('updates the selected statistics threshold and refreshes journey stats for that activity', async () => {
        render(<JourneyStatisticsSettings/>)

        const input = screen.getByLabelText('Minimum segment distance')
        fireEvent.input(input, {target: {value: '12'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.journey.activity.types[0].minSegmentDistance).toBe(12)
            expect(refreshJourneysStatistics).toHaveBeenCalledWith('trek', {focus: false})
        })
    })
})
