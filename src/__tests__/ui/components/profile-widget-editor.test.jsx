/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profile-widget-editor.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-11-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen }                from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                                           from 'valtio'

let widgetConfig
let widgetElement

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <div>{children}</div>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/BackgroundElement', () => ({
    BackgroundElement: () => <div data-testid="background-element"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/BorderElement', () => ({
    BorderElement: () => <div data-testid="border-element"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/PaddingElement', () => ({
    PaddingElement: () => <div data-testid="padding-element"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/ScaleSwitchElement', () => ({
    ScaleSwitchElement: () => <div data-testid="scale-switch-element"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/sliderUtils', () => ({
    formatSliderPercent: value => `${value}%`,
}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton:      ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaCard:        ({children}) => <div>{children}</div>,
    WaColorPicker: props => <input data-testid="color-picker" {...props}/>,
    WaDivider:     () => <hr/>,
    WaIcon:        ({name}) => <span data-icon={name}/>,
    WaNumberInput: ({label, onInput, value, children, ...props}) => {
        delete props['label-at-start']
        delete props['width-auto']
        delete props['no-start']
        return (
            <label>
                {label}
                <input aria-label={label} type="number" value={value ?? ''} onInput={onInput} {...props}/>
                {children}
            </label>
        )
    },
    WaOption:      ({children, value}) => <option value={value}>{children}</option>,
    WaSelect:      ({label, onChange, value, children, ...props}) => {
        delete props['label-at-start']
        delete props['width-auto']
        delete props['no-start']
        return (
            <label>
                {label}
                <select aria-label={label} value={value} onChange={onChange} {...props}>
                    {children}
                </select>
            </label>
        )
    },
    WaSlider:      ({label, onInput, value, defaultValue, ...props}) => (
        <label>
            {label}
            <input
                aria-label={label}
                value={value ?? defaultValue ?? ''}
                onInput={onInput}
                {...props}
            />
        </label>
    ),
    WaSwitch:      ({children, checked, onChange, onInput, ...props}) => {
        delete props['label-at-start']
        delete props['width-auto']
        return (
            <label>
                <input type="checkbox" checked={checked} onChange={onChange ?? onInput} {...props}/>
                {children}
            </label>
        )
    },
}))

import { ProfileWidgetEditor } from '@Components/Profile/ProfileWidgetEditor'

describe('ProfileWidgetEditor', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                profiler: {
                    draw:        vi.fn(),
                    prepareData: vi.fn(() => ({
                        options: [{color: '#3b82f6'}],
                    })),
                },
                css:      {
                    getCSSVariable: vi.fn(value => value),
                },
                widgetManager: {
                    getElementById:     vi.fn(() => widgetElement),
                    getMoveable:        vi.fn(() => ({current: {updateRect: vi.fn()}})),
                    getWidgetConfig:    vi.fn(() => widgetConfig),
                    saveWidgetPosition: vi.fn(),
                    setConfig:          vi.fn(),
                    refreshEditorPreviewSnapshot: vi.fn(),
                },
            },
            app: {},
        }

        widgetConfig = {
            persist: true,
            position: {left: 100, top: 100},
            dimensions: {width: 1600, height: 300},
            ratio:   {
                value:       '16x9',
                aspectRatio: 16 / 9,
                locked:      true,
                width:       16,
                height:      9,
            },
        }

        widgetElement = {
            style: {
                left:   '100px',
                top:    '100px',
                width:  '1600px',
                height: '300px',
            },
            getBoundingClientRect: vi.fn(() => ({
                left:   100,
                top:    100,
                width:  1600,
                height: 300,
            })),
        }

        globalThis.lgs = {
            configuration: {
                videoFormats: [
                    {value: '1x1', label: '1:1', aspectRatio: 1},
                    {value: '16x9', label: '16:9', aspectRatio: 16 / 9},
                ],
                widgetRatio: {value: '16x9', label: '16:9', aspectRatio: 16 / 9},
            },
            settings: {
                getSwatches: {
                    list: ['#ffffff', '#000000'],
                },
                ui:          proxy({
                                       replay: proxy({
                                                             userMode: 'basic',
                                                             profileInfo: proxy({
                                                                                    color:         '#ffffff',
                                                                                    useTrackStyle: false,
                                                                                }),
                                                         }),
                                       profile:    proxy({
                                                             liveData: false,
                                                         }),
                                   }),
                widgets:     {
                    'profile-widget': {
                        configuration: proxy({
                                                 default: {
                                                     show: true,
                                                     background: {
                                                         show: true,
                                                         color: '#ffffff',
                                                         opacity: 0.15,
                                                         blur: true,
                                                         shadow: {
                                                             show: true,
                                                             value: 'normal',
                                                             color: '#000000',
                                                             opacity: 0.5,
                                                         },
                                                     },
                                                     border: {
                                                         show: true,
                                                         color: '#ffffff',
                                                         opacity: 0.5,
                                                         thickness: 1,
                                                         scaled: false,
                                                     },
                                                     padding: {
                                                         top: 8,
                                                         right: 8,
                                                         bottom: 8,
                                                         left: 8,
                                                         scaled: false,
                                                     },
                                                     xAxis: {
                                                         main: true,
                                                         second: true,
                                                         labels: true,
                                                         units: true,
                                                     },
                                                     yAxis: {
                                                         main: true,
                                                         second: true,
                                                         labels: true,
                                                         units: true,
                                                     },
                                                     mainAxis: {
                                                         color: '--lgs-dark-color',
                                                         opacity: 0.8,
                                                         thickness: 1,
                                                         scaled: false,
                                                     },
                                                     secondAxis: {
                                                         color: '--lgs-light-color',
                                                         opacity: 0.6,
                                                         thickness: 0.5,
                                                         scaled: false,
                                                     },
                                                     shadow: {
                                                         show: true,
                                                         value: 'normal',
                                                         color: '#000000',
                                                         opacity: 0.5,
                                                     },
                                                     gradient: {
                                                         show: true,
                                                         color: null,
                                                     },
                                                 },
                                                 user:     null,
                                                 elements: {},
                                             }),
                    },
                },
            },
            stores: {
                main: proxy({theJourney: null}),
                replay: proxy({
                    userMode: 'basic',
                    basicPreparationActive: false,
                    profileInfo: {color: '#ffffff', useTrackStyle: false},
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        vi.useRealTimers()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('toggles the no live data profile setting', () => {
        render(<ProfileWidgetEditor entity="default"/>)

        const toggle = screen.getByLabelText('Show live data')
        expect(toggle.checked).toBe(false)

        fireEvent.click(toggle)

        expect(lgs.settings.ui.profile.liveData).toBe(true)
        expect(__.ui.profiler.draw).toHaveBeenCalled()
    })

    it('saves Expert profile styling on the active Journey and updates the live Replay style', () => {
        const persistToDatabase = vi.fn()
        const journey = proxy({
            slug: 'expert-profile-journey',
            replay: {
                expert: {
                    camera: {altitude: 1200, pitch: -45},
                    progression: {},
                    profileInfo: {color: '#123456', useTrackStyle: true},
                },
            },
            persistToDatabase,
        })
        lgs.stores.main.theJourney = journey
        lgs.settings.ui.replay.userMode = 'expert'
        lgs.settings.ui.replay.profileInfo.useTrackStyle = true
        lgs.stores.replay.userMode = 'expert'
        vi.useFakeTimers()

        render(<ProfileWidgetEditor entity="default"/>)
        const toggle = screen.getByLabelText('Use track style')

        expect(toggle.checked).toBe(true)
        fireEvent.click(toggle)

        expect(journey.replay.expert.profileInfo).toEqual({color: '#123456', useTrackStyle: false})
        expect(lgs.settings.ui.replay.profileInfo.useTrackStyle).toBe(true)
        expect(lgs.stores.replay.profileInfo.useTrackStyle).toBe(false)
        expect(persistToDatabase).not.toHaveBeenCalled()

        vi.advanceTimersByTime(250)
        expect(persistToDatabase).toHaveBeenCalledOnce()
    })

    it('saves Basic profile styling to the Basic Journey presentation', () => {
        const persistToDatabase = vi.fn()
        const journey = proxy({
            slug: 'basic-profile-journey',
            replay: {
                basic: {
                    presentation: {
                        profileInfo: {color: '#654321', useTrackStyle: true},
                    },
                },
            },
            persistToDatabase,
        })
        lgs.stores.main.theJourney = journey
        vi.useFakeTimers()

        render(<ProfileWidgetEditor entity="default"/>)
        const toggle = screen.getByLabelText('Use track style')

        expect(toggle.checked).toBe(true)
        fireEvent.click(toggle)

        expect(journey.replay.basic.presentation.profileInfo).toEqual({color: '#654321', useTrackStyle: false})
        expect(lgs.settings.ui.replay.basic.presentation.profileInfo).toEqual({color: '#654321', useTrackStyle: false})
        expect(lgs.stores.replay.profileInfo.useTrackStyle).toBe(false)

        vi.advanceTimersByTime(250)
        expect(persistToDatabase).toHaveBeenCalledOnce()
    })

    it('updates the widget ratio preset and keeps custom dimensions independent', async () => {
        render(<ProfileWidgetEditor entity="profile-widget#1"/>)

        fireEvent.change(screen.getByLabelText('Ratio'), {target: {value: 'custom'}})
        const widthInput = await screen.findByLabelText('Width (px)')
        const heightInput = await screen.findByLabelText('Height (px)')

        fireEvent.input(widthInput, {target: {value: '400'}})
        expect(heightInput.value).toBe('300')

        fireEvent.input(heightInput, {target: {value: '500'}})
        expect(widthInput.value).toBe('400')
        expect(heightInput.value).toBe('320')

        expect(__.ui.widgetManager.setConfig).toHaveBeenCalled()
        expect(__.ui.widgetManager.saveWidgetPosition).toHaveBeenCalled()
        expect(widgetConfig.ratio.value).toBe('custom')
        expect(widgetConfig.ratio.aspectRatio).toBeCloseTo(1.25)
        expect(widgetConfig.ratio.width).toBe(400)
        expect(widgetConfig.ratio.height).toBe(320)
        expect(widgetConfig.ratio.locked).toBe(true)
        expect(widgetElement.style.width).toBe('400px')
        expect(widgetElement.style.height).toBe('320px')
        expect(__.ui.profiler.draw).toHaveBeenCalled()
    })

    it('exposes the updated preset list', () => {
        render(<ProfileWidgetEditor entity="profile-widget#1"/>)

        expect(screen.getByRole('option', {name: 'None'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'Large'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'X large'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'Golden'})).toBeTruthy()
        expect(screen.queryByRole('option', {name: '4:3'})).toBeNull()
    })

    it('defaults the ratio selector to None for a free profile widget', () => {
        widgetConfig.ratio = {value: '0x0', aspectRatio: 0, locked: false}

        render(<ProfileWidgetEditor entity="profile-widget#1"/>)

        expect(screen.getByLabelText('Ratio').value).toBe('0x0')
    })
})
