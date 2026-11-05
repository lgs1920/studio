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
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaButton: ({children, onClick, size}) => <button type="button" data-size={size} onClick={onClick}>{children}</button>,
    WaTooltip: ({'for': target, children}) => <span data-tooltip-for={target}>{children}</span>,
    WaSlider: ({'aria-label': ariaLabel, disabled, max, min, onChange, step, value}) => (
        <input
            type="range"
            aria-label={ariaLabel}
            disabled={disabled}
            max={max}
            min={min}
            onChange={onChange}
            step={step}
            value={value}
        />
    ),
    WaOption: ({children, value}) => <option value={value}>{children}</option>,
    WaSelect: ({'aria-label': ariaLabel, children, onChange, value}) => (
        <select aria-label={ariaLabel} value={value} onChange={event => onChange({currentTarget: {value: event.target.value}})}>
            {children}
        </select>
    ),
    WaSwitch: ({'aria-label': ariaLabel, checked, children, disabled, onInput}) => (
        <label>
            <input
                type="checkbox"
                aria-label={ariaLabel ?? children}
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
let globalReplayPOIs

beforeEach(() => {
    vi.useFakeTimers()
    journey = proxy({
        slug: 'journey-1',
        replay: {basic: {}},
        persistToDatabase: vi.fn(async () => undefined),
    })
    globalReplayPOIs = [
        {poi: {id: 'global-1'}, source: 'global-near-journey', distanceToJourneyMeters: 100},
        {poi: {id: 'global-2'}, source: 'global-near-journey', distanceToJourneyMeters: 400},
        {poi: {id: 'journey-1-poi'}, source: 'journey-poi'},
    ]
    const pois = proxy({list: new Map(), current: null})
    vi.stubGlobal('lgs', {
        settings: {ui: {replay: proxy({userMode: 'basic', basic: {}})}},
        stores: {
            main: proxy({theJourney: journey, components: {pois}}),
            replay: proxy({}),
        },
        theJourney: journey,
    })
    vi.stubGlobal('__', {
        ui: {
            drawerManager: {open: vi.fn()},
            poiManager: {
                getJourneyReplayPOIsForJourney: vi.fn((_journey, _distance, options) => (
                    globalReplayPOIs.filter(entry => entry.source !== 'global-near-journey'
                        || (options.includeGlobalPois && entry.distanceToJourneyMeters <= options.globalPoiDistanceMeters))
                )),
            },
            replay: {refresh: vi.fn()},
        },
    })
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

        expect(screen.getByRole('combobox', {name: 'Show at start'}).value).toBe('user')
        expect(screen.getByText('Choose which POIs are shown when Replay starts').dataset.tooltipFor).toBe('basic-replay-poi-visibility')
        expect(screen.getByText('With animation').dataset.tooltipFor).toBe('basic-replay-poi-animation')
        expect(screen.getByText('Duration', {selector: '[data-tooltip-for="basic-replay-poi-duration"]'}).dataset.tooltipFor)
            .toBe('basic-replay-poi-duration')
        expect(screen.getByRole('option', {name: 'All'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'None'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'User choice'})).toBeTruthy()
        expect(screen.getByRole('checkbox', {name: 'Animation'}).checked).toBe(false)
        expect(screen.getByLabelText('Animation duration in seconds').value).toBe('2')
        expect(screen.getByLabelText('Animation duration in seconds').disabled).toBe(true)
    })

    it('persists visibility and animation choices globally and on the active Journey', async () => {
        render(<BasicReplayPOISettings/>)

        await act(async () => {
            fireEvent.change(screen.getByRole('combobox', {name: 'Show at start'}), {target: {value: 'yes'}})
            fireEvent.click(screen.getByRole('checkbox', {name: 'Animation'}))
            fireEvent.input(screen.getByLabelText('Animation duration in seconds'), {target: {value: '3'}})
            await Promise.resolve()
        })

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

    it('shows the matching global POI count and opens the POI editor above Replay', () => {
        render(<BasicReplayPOISettings/>)

        expect(screen.getByText('2 POIs')).toBeTruthy()
        expect(__.ui.poiManager.getJourneyReplayPOIsForJourney).toHaveBeenCalledWith(journey, undefined, {
            includeGlobalPois: true,
            globalPoiDistanceMeters: 500,
            includeHidden: false,
        })

        const editPOIsButton = screen.getByRole('button', {name: 'Edit POIs'})
        expect(editPOIsButton.dataset.size).toBe('s')
        fireEvent.click(editPOIsButton)

        expect(__.ui.drawerManager.open).toHaveBeenCalledWith('pois-editor-drawer', {
            stacked: true,
            suppressFocusOnOpen: false,
        })
    })

    it('updates the count when global POIs are not accepted', async () => {
        render(<BasicReplayPOISettings/>)

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Accept global POIs'))
            await Promise.resolve()
        })

        expect(screen.getByText('0 POIs')).toBeTruthy()
        expect(__.ui.poiManager.getJourneyReplayPOIsForJourney).toHaveBeenLastCalledWith(journey, undefined, {
            includeGlobalPois: false,
            globalPoiDistanceMeters: 500,
            includeHidden: false,
        })
    })

    it('updates the count when the global POI distance changes', async () => {
        render(<BasicReplayPOISettings/>)

        await act(async () => {
            fireEvent.change(screen.getByLabelText('Global POI distance in meters'), {target: {value: '250'}})
            await Promise.resolve()
        })

        expect(screen.getByText('1 POI')).toBeTruthy()
        expect(lgs.settings.ui.replay.basic.globalPoiDistanceMeters).toBe(250)
    })
})
