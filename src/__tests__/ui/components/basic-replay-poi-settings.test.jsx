/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: basic-replay-poi-settings.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: ({'for': target, children}) => <span data-tooltip-for={target}>{children}</span>,
    WaOption: ({children, value}) => <option value={value}>{children}</option>,
    WaSelect: ({'aria-label': ariaLabel, children, onChange, value}) => (
        <select aria-label={ariaLabel} value={value} onChange={event => onChange({currentTarget: {value: event.target.value}})}>
            {children}
        </select>
    ),
    WaSwitch: ({checked, children, disabled, onInput}) => (
        <label>
            <input
                type="checkbox"
                aria-label={children}
                checked={checked}
                disabled={disabled}
                onChange={event => onInput({currentTarget: {checked: event.target.checked}})}
            />
            {children}
        </label>
    ),
    WaNumberInput: ({'aria-label': ariaLabel, disabled, onInput, value}) => (
        <label>
            <input
                type="number"
                aria-label={ariaLabel}
                disabled={disabled}
                value={value}
                onInput={event => onInput({currentTarget: {value: event.target.value}})}
            />
        </label>
    ),
}))

import {BasicReplayPOISettings} from '@Components/MainUI/video/toolbox/BasicReplayPOISettings'

let journey

beforeEach(() => {
    vi.useFakeTimers()
    journey = proxy({
        slug: 'journey-1',
        replay: {basic: {}},
        persistToDatabase: vi.fn(async () => undefined),
    })
    vi.stubGlobal('lgs', {
        settings: {ui: {replay: proxy({userMode: 'basic', basic: {}})}},
        stores: {main: proxy({theJourney: journey})},
        theJourney: journey,
    })
    vi.stubGlobal('__', {ui: {replay: {refresh: vi.fn()}}})
})

afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('Basic Replay POI settings', () => {
    it('defaults to user visibility and a disabled two-second animation duration', () => {
        render(<BasicReplayPOISettings/>)

        expect(screen.getByLabelText('Show POIs').value).toBe('user')
        expect(screen.getByText('View POIs').dataset.tooltipFor).toBe('basic-replay-poi-visibility')
        expect(screen.getByText('With animation').dataset.tooltipFor).toBe('basic-replay-poi-animation')
        expect(screen.getByText('Duration').dataset.tooltipFor).toBe('basic-replay-poi-duration')
        expect(screen.getByRole('option', {name: 'All'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'None'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'User choice'})).toBeTruthy()
        expect(screen.getByLabelText('animation').checked).toBe(false)
        expect(screen.getByLabelText('Animation duration in seconds').value).toBe('2')
        expect(screen.getByLabelText('Animation duration in seconds').disabled).toBe(true)
    })

    it('persists visibility and animation choices globally and on the active Journey', () => {
        render(<BasicReplayPOISettings/>)

        fireEvent.change(screen.getByLabelText('Show POIs'), {target: {value: 'yes'}})
        fireEvent.click(screen.getByLabelText('animation'))
        fireEvent.input(screen.getByLabelText('Animation duration in seconds'), {target: {value: '3'}})

        expect(lgs.settings.ui.replay.basic).toMatchObject({
            poiVisibilityMode: 'yes',
            animatePoisDuringJourneyReplay: true,
            poiAnimationDurationSeconds: 3,
        })
        expect(journey.replay.basic).toMatchObject({
            poiVisibilityMode: 'yes',
            animatePoisDuringJourneyReplay: true,
            poiAnimationDurationSeconds: 3,
        })
        expect(__.ui.replay.refresh).toHaveBeenCalled()
    })
})
