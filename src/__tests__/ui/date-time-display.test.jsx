/********************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: date-time-display.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 *******************************************************************************/

import {cleanup, render} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'
import {DateTimeDisplay} from '@Components/DateTimeDisplay'

const JOURNEY_DATE_ITEMS = [
    {date: 'July 3, 2026', time: '10:00 AM'},
    {date: 'July 4, 2026', time: '11:30 AM'},
]

const SAME_DAY_ITEMS = [
    {date: 'July 3, 2026', time: '10:00 AM'},
    {date: 'July 3, 2026', time: '11:30 AM'},
]

afterEach(() => cleanup())

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
})
