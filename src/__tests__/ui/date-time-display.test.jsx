/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: date-time-display.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-05
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, waitFor} from '@testing-library/react'
import {Settings} from 'luxon'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {DateTimeDisplay} from '@Components/DateTimeDisplay'
import {formatTimestampAtCoordinates} from '@Utils/TimeZoneUtils'

vi.mock('@Utils/TimeZoneUtils', async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        formatTimestampAtCoordinates: vi.fn(async (value, coordinates, options) => actual.formatTimestampInTimeZone(
            value,
            'Europe/Paris',
            options,
        )),
    }
})

const JOURNEY_DATE_ITEMS = [
    {date: 'July 3, 2026', time: '10:00 AM'},
    {date: 'July 4, 2026', time: '11:30 AM'},
]

const SAME_DAY_ITEMS = [
    {date: 'July 3, 2026', time: '10:00 AM'},
    {date: 'July 3, 2026', time: '11:30 AM'},
]

const defaultZone = Settings.defaultZone

afterEach(() => {
    cleanup()
    Settings.defaultZone = defaultZone
    vi.clearAllMocks()
})

describe('DateTimeDisplay', () => {
    it('keeps date-range stacking independent from date-time stacking', () => {
        const {container} = render(
            <DateTimeDisplay
                items={JOURNEY_DATE_ITEMS}
                stackItems={false}
                stackDateTime={true}
            />,
        )

        const display = container.querySelector('.lgs-date-time-display')

        expect(display.dataset.itemsStacked).toBe('false')
        expect(display.dataset.dateTimeStacked).toBe('true')
        expect(display.querySelectorAll('.lgs-date-time-display-content > .lgs-date-time-display-item')).toHaveLength(2)
    })

    it('supports separate date and time lines for a same-day range', () => {
        const {container} = render(
            <DateTimeDisplay
                items={SAME_DAY_ITEMS}
                stackItems={false}
                stackDateTime={true}
            />,
        )

        const display = container.querySelector('.lgs-date-time-display')
        const range = container.querySelector('.lgs-date-time-display-range')

        expect(display.dataset.itemsStacked).toBe('false')
        expect(display.dataset.dateTimeStacked).toBe('true')
        expect(range).not.toBeNull()
    })

    it('supports stacked date-range items without stacking date and time', () => {
        const {container} = render(
            <DateTimeDisplay
                items={JOURNEY_DATE_ITEMS}
                stackItems={true}
                stackDateTime={false}
            />,
        )

        const display = container.querySelector('.lgs-date-time-display')

        expect(display.dataset.itemsStacked).toBe('true')
        expect(display.dataset.dateTimeStacked).toBe('false')
    })

    it('formats a timestamp in its coordinate zone instead of the browser zone', async () => {
        Settings.defaultZone = 'America/Los_Angeles'
        const coordinates = {longitude: 2.3522, latitude: 48.8566}
        const {container} = render(
            <DateTimeDisplay value="2026-01-15T12:00:00Z" {...coordinates}/>,
        )

        await waitFor(() => expect(container.textContent).toContain('1:00'))
        expect(formatTimestampAtCoordinates).toHaveBeenCalledWith(
            '2026-01-15T12:00:00Z',
            coordinates,
            expect.any(Object),
        )
    })

    it('uses a POI-stored time zone without resolving its coordinates again', () => {
        Settings.defaultZone = 'America/Los_Angeles'
        const {container} = render(
            <DateTimeDisplay
                value="2026-01-15T12:00:00Z"
                timeZone="Europe/Paris"
                longitude={2.3522}
                latitude={48.8566}
            />,
        )

        expect(container.textContent).toContain('1:00')
        expect(formatTimestampAtCoordinates).not.toHaveBeenCalled()
    })
})
